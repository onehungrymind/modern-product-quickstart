#!/usr/bin/env node
/**
 * Gameday: Self-contained incident lifecycle drill (R11).
 *
 * Drives a real end-to-end incident against the dist API:
 *   1. Build api if dist/apps/api/main.js is missing.
 *   2. INJECT — boot api with SLO_BURN_DELAY_MS=150 (bad deploy).
 *   3. DETECT — measure redirect p99 > 100ms (SLO breach confirmed).
 *   4. ROLL BACK — stop bad api, boot api without burn (good deploy).
 *   5. VERIFY RECOVERY — redirect p99 < 100ms.
 *   6. Write reports/incident.json and print summary.
 *
 * Requirements: node 20+, Postgres on localhost:5433 (db/user/pass: tracer).
 * Usage: node scripts/adversary/gameday-inject.mjs
 */

import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createServer } from 'node:net';
import { performance } from 'node:perf_hooks';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Find a free TCP port. */
function getFreePort() {
  return new Promise((res, rej) => {
    const srv = createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => res(port));
    });
    srv.on('error', rej);
  });
}

/**
 * Wait for the api /api/health to return {"status":"ok"}.
 * Retries every 500ms for up to `timeoutMs`.
 */
async function waitForHealth(port, timeoutMs = 30_000) {
  const url = `http://127.0.0.1:${port}/api/health`;
  const deadline = Date.now() + timeoutMs;
  let lastErr = null;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (r.ok) {
        const body = await r.json();
        if (body.status === 'ok') return;
      }
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`API on port ${port} never became healthy. Last error: ${lastErr?.message}`);
}

/**
 * Spawn the dist API with given env overrides. Returns the child process.
 * Stdout/stderr are suppressed (piped to null) to keep output clean.
 */
function spawnApi(port, extraEnv = {}) {
  const env = {
    ...process.env,
    DATABASE_URL: 'postgres://tracer:tracer@localhost:5433/tracer',
    JWT_SECRET: 'gameday-secret-xyzzy-drill-only',  // ≥ 16 chars
    URL_PREVIEW: 'stub',                             // env enum: 'stub' | 'real'
    PORT: String(port),
    NODE_ENV: 'test',
    // suppress OTel noise during drill
    OTEL_SDK_DISABLED: 'true',
    ...extraEnv,
  };

  const child = spawn('node', [resolve(root, 'dist/apps/api/main.js')], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  // Suppress output; uncomment for debugging:
  // child.stdout.pipe(process.stdout);
  // child.stderr.pipe(process.stderr);

  return child;
}

/** Kill a child process gracefully. */
function killApi(child) {
  if (!child || child.killed) return;
  try {
    child.kill('SIGTERM');
  } catch {
    /* already dead */
  }
}

// ---------------------------------------------------------------------------
// Simple cookie jar: capture Set-Cookie from responses, re-send as Cookie.
// ---------------------------------------------------------------------------
class CookieJar {
  constructor() {
    this._cookies = {};
  }

  absorb(headers) {
    const raw = headers.getSetCookie?.() ?? [];
    for (const c of raw) {
      const [pair] = c.split(';');
      const eq = pair.indexOf('=');
      if (eq < 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      this._cookies[name] = value;
    }
  }

  header() {
    return Object.entries(this._cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }
}

// ---------------------------------------------------------------------------
// API client helpers
// ---------------------------------------------------------------------------

async function apiFetch(port, path, options = {}, jar) {
  const url = `http://127.0.0.1:${port}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers ?? {}) };
  if (jar) {
    const cookie = jar.header();
    if (cookie) headers['Cookie'] = cookie;
  }
  const res = await fetch(url, {
    ...options,
    headers,
    signal: AbortSignal.timeout(10_000),
    redirect: 'manual', // we handle redirects manually for timing
  });
  if (jar) jar.absorb(res.headers);
  return res;
}

async function register(port, email, password, jar) {
  const res = await apiFetch(
    port,
    '/api/auth/register',
    { method: 'POST', body: JSON.stringify({ email, password, name: 'Gameday User' }) },
    jar,
  );
  if (!res.ok) throw new Error(`register failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function login(port, email, password, jar) {
  const res = await apiFetch(
    port,
    '/api/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) },
    jar,
  );
  if (!res.ok) throw new Error(`login failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function createLink(port, targetUrl, jar) {
  const res = await apiFetch(
    port,
    '/api/links',
    { method: 'POST', body: JSON.stringify({ target_url: targetUrl }) },
    jar,
  );
  if (!res.ok) throw new Error(`createLink failed: ${res.status} ${await res.text()}`);
  return res.json();
}

/**
 * Measure redirect latency for a slug. Returns the round-trip time in ms.
 * Does NOT follow the redirect (redirect: 'manual'), just measures the 302 response time.
 */
async function measureRedirect(port, slug) {
  const url = `http://127.0.0.1:${port}/${slug}`;
  const t0 = performance.now();
  const res = await fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
  });
  const elapsed = performance.now() - t0;
  // Accept 302 or 301; if 404 or other, the slug may not exist yet
  if (res.status !== 302 && res.status !== 301) {
    throw new Error(`Expected redirect for slug ${slug}, got ${res.status}`);
  }
  return elapsed;
}

/**
 * Sample redirect latency N times and return the p99 (max of small sample).
 */
async function sampleLatency(port, slug, n = 15) {
  const samples = [];
  for (let i = 0; i < n; i++) {
    const ms = await measureRedirect(port, slug);
    samples.push(ms);
    // Small pause between requests
    await new Promise((r) => setTimeout(r, 20));
  }
  samples.sort((a, b) => a - b);
  // p99 of N samples: take the ceil(N * 0.99)-th element (1-indexed)
  const idx = Math.min(Math.ceil(n * 0.99) - 1, n - 1);
  return { p99: samples[idx], median: samples[Math.floor(n / 2)], samples };
}

// ---------------------------------------------------------------------------
// Main drill
// ---------------------------------------------------------------------------

let badApi = null;
let goodApi = null;

async function main() {
  console.log('=== Tracer Gameday Drill — R11 Incident Lifecycle ===\n');

  // 1. Build api if missing
  const distMain = resolve(root, 'dist/apps/api/main.js');
  if (!existsSync(distMain)) {
    console.log('Step 0: dist/apps/api/main.js missing — building...');
    execFileSync('npx', ['nx', 'build', 'api'], { cwd: root, stdio: 'inherit' });
    console.log('Build complete.\n');
  } else {
    console.log('Step 0: dist/apps/api/main.js found, skipping build.\n');
  }

  // Pick ports
  const badPort = await getFreePort();
  const goodPort = await getFreePort();

  // Unique email per run to avoid conflicts with existing DB state
  const runId = Date.now();
  const email = `gameday-${runId}@example.com`;
  const password = 'Gameday123!';

  const injected_at = new Date();
  console.log(`Step 1: INJECT — booting bad api (SLO_BURN_DELAY_MS=150) on port ${badPort}...`);
  badApi = spawnApi(badPort, { SLO_BURN_DELAY_MS: '150' });

  badApi.on('exit', (code) => {
    if (code !== null && code !== 0 && !badApi._killed) {
      console.error(`Bad api exited unexpectedly with code ${code}`);
    }
  });

  try {
    await waitForHealth(badPort);
  } catch (e) {
    console.error('ERROR: bad api never became healthy.', e.message);
    process.exit(1);
  }
  console.log(`  Bad api healthy on port ${badPort}.\n`);

  // 2. Register + login + create link using the bad api
  const jar = new CookieJar();
  console.log('Step 2: Setting up test link via bad api...');
  await register(badPort, email, password, jar);
  await login(badPort, email, password, jar);

  // Use a public HTTPS URL that passes the SSRF allowlist
  const link = await createLink(badPort, 'https://example.com', jar);
  const slug = link.slug;
  console.log(`  Created link: slug=${slug}\n`);

  // 3. Detect: measure redirect latency — should be > 100ms
  console.log('Step 3: DETECT — sampling redirect latency on bad api (expecting p99 > 100ms)...');
  const { p99: badP99, median: badMedian, samples: badSamples } = await sampleLatency(badPort, slug);
  console.log(`  Bad api p99: ${badP99.toFixed(1)}ms  median: ${badMedian.toFixed(1)}ms`);
  console.log(`  Samples (ms): [${badSamples.map((s) => s.toFixed(0)).join(', ')}]`);

  const slo_breached = badP99 > 100;
  if (!slo_breached) {
    console.error(
      `ERROR: Expected bad api p99 > 100ms to confirm SLO breach, got ${badP99.toFixed(1)}ms.\n` +
        `SLO_BURN_DELAY_MS=150 should have caused this. The drill cannot confirm a breach.`,
    );
    badApi._killed = true;
    killApi(badApi);
    process.exit(1);
  }

  const detected_at = new Date();
  console.log(`  ✓ SLO breached (p99 ${badP99.toFixed(1)}ms > 100ms) — detected at ${detected_at.toISOString()}\n`);

  // 4. Roll back: stop bad api, boot good api (without SLO_BURN_DELAY_MS)
  console.log('Step 4: ROLL BACK — stopping bad api, booting good api...');
  badApi._killed = true;
  killApi(badApi);
  // Allow time for port to free (process exit)
  await new Promise((r) => setTimeout(r, 500));

  console.log(`  Starting good api (no SLO_BURN_DELAY_MS) on port ${goodPort}...`);
  goodApi = spawnApi(goodPort, {});
  goodApi.on('exit', (code) => {
    if (code !== null && code !== 0 && !goodApi._killed) {
      console.error(`Good api exited unexpectedly with code ${code}`);
    }
  });

  try {
    await waitForHealth(goodPort);
  } catch (e) {
    console.error('ERROR: good api never became healthy.', e.message);
    process.exit(1);
  }
  console.log(`  Good api healthy on port ${goodPort}.\n`);

  // 5. Verify recovery: login + re-use same slug (link is still in DB)
  console.log('Step 5: VERIFY RECOVERY — sampling redirect latency on good api (expecting p99 < 100ms)...');
  // Login with new cookie jar for good api
  const goodJar = new CookieJar();
  await login(goodPort, email, password, goodJar);

  const { p99: goodP99, median: goodMedian, samples: goodSamples } = await sampleLatency(goodPort, slug);
  console.log(`  Good api p99: ${goodP99.toFixed(1)}ms  median: ${goodMedian.toFixed(1)}ms`);
  console.log(`  Samples (ms): [${goodSamples.map((s) => s.toFixed(0)).join(', ')}]`);

  const recovered = goodP99 < 100;
  if (!recovered) {
    console.error(
      `ERROR: Expected good api p99 < 100ms after rollback, got ${goodP99.toFixed(1)}ms.\n` +
        `Recovery could not be confirmed.`,
    );
    goodApi._killed = true;
    killApi(goodApi);
    process.exit(1);
  }

  const recovered_at = new Date();
  console.log(`  ✓ Recovery confirmed (p99 ${goodP99.toFixed(1)}ms < 100ms) — recovered at ${recovered_at.toISOString()}\n`);

  // 6. Compute TTR and write report
  const ttr_seconds = Math.round((recovered_at - injected_at) / 1000);

  const report = {
    injected_at: injected_at.toISOString(),
    detected_at: detected_at.toISOString(),
    recovered_at: recovered_at.toISOString(),
    ttr_seconds,
    slo_breached: true,
    recovered: true,
    detail: {
      bad_api_p99_ms: +badP99.toFixed(1),
      good_api_p99_ms: +goodP99.toFixed(1),
      slug,
      bad_port: badPort,
      good_port: goodPort,
    },
  };

  mkdirSync(resolve(root, 'reports'), { recursive: true });
  writeFileSync(resolve(root, 'reports', 'incident.json'), JSON.stringify(report, null, 2) + '\n');

  console.log('=== Incident Summary ===');
  console.log(`  Injected at:  ${report.injected_at}`);
  console.log(`  Detected at:  ${report.detected_at}  (SLO breach: p99 ${report.detail.bad_api_p99_ms}ms > 100ms)`);
  console.log(`  Recovered at: ${report.recovered_at}  (p99 ${report.detail.good_api_p99_ms}ms < 100ms)`);
  console.log(`  TTR:          ${ttr_seconds}s`);
  console.log(`  slo_breached: ${report.slo_breached}`);
  console.log(`  recovered:    ${report.recovered}`);
  console.log('\nWrote reports/incident.json');
  console.log('\n✓ Gameday drill PASSED. Exit 0.');
}

main()
  .catch((err) => {
    console.error('\nGameday drill FAILED:', err.message);
    process.exit(1);
  })
  .finally(() => {
    if (badApi && !badApi._killed) {
      badApi._killed = true;
      killApi(badApi);
    }
    if (goodApi && !goodApi._killed) {
      goodApi._killed = true;
      killApi(goodApi);
    }
  });
