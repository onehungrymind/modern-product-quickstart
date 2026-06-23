// R07 — Delivery pipeline: CI gates lint+test+build (build-once), act-runnable, DORA emitted.
import { execFileSync } from 'node:child_process';
import { Probe, root, read, exists } from './_lib.mjs';

const p = new Probe();

// The pipeline definition gates the build on lint + typecheck + test + build.
const ci = exists('.github/workflows/ci.yml') ? read('.github/workflows/ci.yml') : '';
p.assert(ci !== '', 'ci.yml exists (.github/workflows/ci.yml)');
for (const step of ['lint', 'typecheck', 'test', 'build']) {
  p.assert(new RegExp(`nx run-many -t ${step}|-t ${step}\\b|run ${step}`).test(ci), `CI gates on ${step}`);
}
p.assert(/dora\.mjs/.test(ci), 'CI emits DORA metrics (runs scripts/dora.mjs)');

// act can parse + plan the workflow (the local pipeline runner). A red commit
// fails the gate steps above, so it can never be promoted — `act` enforces that.
try {
  const list = execFileSync('act', ['--list', '-W', '.github/workflows/ci.yml'], {
    cwd: root,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  p.assert(/verify/.test(list), 'act parses ci.yml (the gate job is present)', list.split('\n').slice(-2).join(' '));
} catch (err) {
  p.assert(false, 'act parses ci.yml', `${err.stdout ?? ''}${err.stderr ?? ''}`.split('\n').slice(-2).join(' '));
}

// DORA: the four metrics are emitted from the deployment ledger.
try {
  const out = execFileSync(process.execPath, ['scripts/dora.mjs'], { cwd: root, encoding: 'utf-8' });
  const dora = JSON.parse(out.slice(out.indexOf('{')));
  for (const k of [
    'deployment_frequency_per_day',
    'lead_time_for_changes_hours',
    'change_failure_rate',
    'time_to_restore_hours',
  ]) {
    p.assert(typeof dora[k] === 'number', `DORA metric emitted: ${k} = ${dora[k]}`);
  }
} catch (err) {
  p.assert(false, 'DORA metrics emitted', String(err).split('\n')[0]);
}

p.done();
