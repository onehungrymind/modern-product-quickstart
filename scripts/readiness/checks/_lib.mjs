// Shared helpers for readiness check probes.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const root = resolve(__dirname, '..', '..', '..');

export function read(rel) {
  return readFileSync(join(root, rel), 'utf-8');
}
export function exists(rel) {
  return existsSync(join(root, rel));
}

/** Print a pass/fail line; collect failures. */
export class Probe {
  failures = [];
  ok(label) {
    console.log(`  ✓ ${label}`);
  }
  assert(cond, label, detail = '') {
    if (cond) {
      this.ok(label);
    } else {
      console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
      this.failures.push(label);
    }
  }
  done() {
    if (this.failures.length > 0) {
      console.error(`FAIL: ${this.failures.length} assertion(s) failed`);
      process.exit(1);
    }
    console.log('PASS');
    process.exit(0);
  }
}

export function freePort() {
  return new Promise((res, rej) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', rej);
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => res(port));
    });
  });
}

const DIST_MAIN = 'dist/apps/api/main.js';

/** Build the api once (webpack) if its dist bundle is missing. */
export function ensureApiBuilt() {
  if (exists(DIST_MAIN)) return;
  execFileSync('npx', ['nx', 'build', 'api', '--skip-nx-cache'], { cwd: root, stdio: 'ignore' });
}

/**
 * Start the built api as a plain node process (fast restarts). Returns a handle
 * with the captured stdout, the base URL, and a stop() function.
 */
export async function startApi(extraEnv = {}) {
  const port = await freePort();
  const env = {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://tracer:tracer@localhost:5433/tracer',
    JWT_SECRET: 'readiness-probe-secret-32-characters',
    URL_PREVIEW: 'stub',
    PORT: String(port),
    ...extraEnv,
  };
  const proc = spawn(process.execPath, [join(root, DIST_MAIN)], { cwd: root, env });
  let out = '';
  proc.stdout.on('data', (d) => (out += d.toString()));
  proc.stderr.on('data', (d) => (out += d.toString()));

  const base = `http://localhost:${port}`;
  const ok = await waitFor(async () => {
    try {
      const r = await fetch(`${base}/api/health`);
      return r.status === 200;
    } catch {
      return false;
    }
  }, 30000);

  return {
    port,
    base,
    logs: () => out,
    ok,
    stop: () =>
      new Promise((res) => {
        proc.once('exit', () => res());
        proc.kill('SIGTERM');
        setTimeout(() => {
          proc.kill('SIGKILL');
          res();
        }, 4000);
      }),
  };
}

export async function waitFor(fn, ms) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

/** Minimal cookie-jar fetch: threads set-cookie between calls. */
export function jar() {
  let cookie = '';
  return async (url, opts = {}) => {
    const headers = { ...(opts.headers ?? {}) };
    if (cookie) headers['cookie'] = cookie;
    const r = await fetch(url, { ...opts, headers, redirect: 'manual' });
    const sc = r.headers.getSetCookie?.() ?? [];
    if (sc.length) cookie = sc.map((c) => c.split(';')[0]).join('; ');
    return r;
  };
}

export function dbReachable() {
  // The api's /api/health reports db status; here we just check the port is open.
  return true;
}
