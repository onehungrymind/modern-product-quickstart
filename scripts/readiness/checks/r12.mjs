// R12 — App security: scheme allowlist + SSRF guard, rate limiting, ASVS. The
// adversary kit must be DEFEATED (each exploit returns 4xx/429) against the reference.
import { execFileSync } from 'node:child_process';
import { Probe, root, exists, ensureApiBuilt, startApi } from './_lib.mjs';

const p = new Probe();

p.assert(exists('docs/asvs-checklist.md'), 'ASVS checklist present (docs/asvs-checklist.md)');

ensureApiBuilt();
const api = await startApi();
if (!api.ok) {
  p.assert(false, 'api booted for the adversary kit', api.logs().split('\n').slice(-3).join(' '));
  p.done();
}

const exploits = [
  ['open-redirect defeated (bad schemes → 4xx)', 'scripts/adversary/open-redirect-poc.mjs'],
  ['SSRF defeated (internal targets → 4xx)', 'scripts/adversary/ssrf-poc.mjs'],
  ['rate limiting engaged (burst → 429)', 'scripts/adversary/ratelimit-poc.mjs'],
];

for (const [label, script] of exploits) {
  try {
    execFileSync(process.execPath, [script, api.base], {
      cwd: root,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 90_000,
    });
    p.assert(true, label);
  } catch (err) {
    p.assert(false, label, `${err.stdout ?? ''}${err.stderr ?? ''}`.trim().split('\n').slice(-3).join(' '));
  }
}

await api.stop();
p.done();
