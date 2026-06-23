// R04 — Persistence: synchronize:false + migrations-only + survives restart.
import { execFileSync } from 'node:child_process';
import { Probe, root, read, exists, ensureApiBuilt, startApi, jar } from './_lib.mjs';

const p = new Probe();

// --- static: migration is the only schema path ---
const ds = exists('apps/api/src/database/data-source.ts') ? read('apps/api/src/database/data-source.ts') : '';
p.assert(/synchronize:\s*false/.test(ds), 'data-source sets synchronize: false');

let migrations = '';
try {
  migrations = execFileSync('ls', ['apps/api/src/database/migrations'], { cwd: root, encoding: 'utf-8' }).trim();
} catch {
  migrations = '';
}
p.assert(/\.ts$/m.test(migrations), 'at least one migration exists', migrations || '(none)');

// --- runtime: data written before an api restart survives it (stateless app, external DB) ---
ensureApiBuilt();
const a = await startApi();
if (!a.ok) {
  p.assert(false, 'api booted (1st)', a.logs().split('\n').slice(-4).join(' '));
  p.done();
}

const email = `r04-${Date.now()}@probe.test`;
const call = jar();
let linkId = '';
try {
  await call(`${a.base}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, name: 'R04', password: 'probe-password-123' }),
  });
  const created = await (
    await call(`${a.base}/api/links`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ target_url: 'https://example.com/r04' }),
    })
  ).json();
  linkId = created.id ?? '';
} catch (e) {
  /* handled by assertion below */
}
p.assert(Boolean(linkId), 'created a link before restart', linkId);

await a.stop();

// Restart a fresh process against the same database.
const b = await startApi();
p.assert(b.ok, 'api booted again after kill (2nd)', b.logs().split('\n').slice(-4).join(' '));

let survived = false;
try {
  const call2 = jar();
  await call2(`${b.base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'probe-password-123' }),
  });
  const res = await call2(`${b.base}/api/links/${linkId}`);
  const link = await res.json();
  survived = res.status === 200 && link.id === linkId;
} catch {
  survived = false;
}
await b.stop();
p.assert(survived, 'the link survived the kill+restart (no data loss)');

p.done();
