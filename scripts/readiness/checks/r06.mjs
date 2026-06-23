// R06 — Test outer-ring: integration vs testcontainer + 2 E2E + coverage floor + mutation.
// The heaviest probe — it runs the real suites (Postgres container, browser E2E, Stryker).
import { execSync } from 'node:child_process';
import { root } from './_lib.mjs';

function run(label, cmd) {
  try {
    execSync(cmd, {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 12 * 60 * 1000,
      encoding: 'utf-8',
    });
    console.log(`  ✓ ${label}`);
    return true;
  } catch (err) {
    console.log(`  ✗ ${label}`);
    const out = `${err.stdout ?? ''}${err.stderr ?? ''}`.trim().split('\n').slice(-8).join('\n');
    console.log(out.split('\n').map((l) => `      ${l}`).join('\n'));
    return false;
  }
}

const checks = [
  ['unit + property suite, coverage ≥ floor (common-models)', 'npx nx test common-models --coverage --skip-nx-cache'],
  ['unit suite, coverage ≥ floor (api)', 'npx nx test api --coverage --skip-nx-cache'],
  ['integration vs a real Postgres testcontainer', 'npx nx run api:integration --skip-nx-cache'],
  ['mutation score ≥ break threshold (Stryker)', 'npm run mutation'],
  ['2 E2E workflows green — create + resolve (Playwright/BDD)', 'npm run e2e:bdd:gen && npx nx e2e web-e2e --skip-nx-cache'],
];

let ok = true;
for (const [label, cmd] of checks) {
  if (!run(label, cmd)) ok = false;
}

if (ok) {
  console.log('PASS');
  process.exit(0);
}
console.error('FAIL: one or more test-ring gates failed');
process.exit(1);
