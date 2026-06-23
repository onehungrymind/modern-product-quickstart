// R11 — Incident response: rollback path, runbook, blameless postmortem, error budget.
// The gameday drill injects a failure, detects the SLO breach, rolls back, recovers, records TTR.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Probe, root, exists } from './_lib.mjs';

const p = new Probe();

p.assert(exists('docs/runbook.md'), 'runbook present (docs/runbook.md)');
p.assert(exists('docs/postmortem.template.md'), 'blameless postmortem template present');
const pmDir = join(root, 'docs', 'postmortems');
const filledPostmortem = existsSync(pmDir) && readdirSync(pmDir).some((f) => f.endsWith('.md'));
p.assert(filledPostmortem, 'a filled postmortem is present (docs/postmortems/*.md)');
p.assert(exists('deploy/rollback.mjs'), 'rollback path present (deploy/rollback.mjs)');

// Run the gameday drill: inject → detect SLO breach → roll back → recover → TTR.
try {
  execFileSync(process.execPath, ['scripts/adversary/gameday-inject.mjs'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 5 * 60 * 1000,
  });
  const incident = JSON.parse(readFileSync(join(root, 'reports', 'incident.json'), 'utf-8'));
  p.assert(incident.slo_breached === true, 'gameday injected a detectable SLO breach (via R10 signal)');
  p.assert(incident.recovered === true, 'rolled back to a good deploy and recovered (via R07)');
  p.assert(typeof incident.ttr_seconds === 'number' && incident.ttr_seconds > 0, `TTR recorded (${incident.ttr_seconds}s)`);
} catch (err) {
  p.assert(false, 'gameday drill ran (inject→detect→rollback→recover)', `${err.stdout ?? ''}${err.stderr ?? ''}`.split('\n').slice(-3).join(' '));
}

// Error budget is computed and produces a ship/freeze call.
try {
  execFileSync(process.execPath, ['scripts/error-budget.mjs'], { cwd: root, stdio: 'ignore' });
  const budget = JSON.parse(readFileSync(join(root, 'reports', 'error-budget.json'), 'utf-8'));
  p.assert(typeof budget.call === 'string' && budget.call.length > 0, `error-budget call made (${budget.call})`);
} catch (err) {
  p.assert(false, 'error budget computed', String(err).split('\n')[0]);
}

p.done();
