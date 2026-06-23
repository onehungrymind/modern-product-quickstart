#!/usr/bin/env node
// Emit the four DORA metrics (R07) from the deployment ledger the promotion path
// appends to (deploy/deployments.ndjson). Each line:
//   {"sha","env","status":"success|failed","deployed_at":ISO,"committed_at":ISO}
// Prints a JSON summary to stdout and writes reports/dora.json. Exit 0 = emitted.
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ledgerPath = join(root, 'deploy', 'deployments.ndjson');

if (!existsSync(ledgerPath)) {
  console.error(`No deployment ledger at ${ledgerPath}. Promote at least once (deploy/promote.mjs).`);
  process.exit(1);
}

const rows = readFileSync(ledgerPath, 'utf-8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l))
  .filter((r) => r.env === 'prod');

if (rows.length === 0) {
  console.error('No prod deployments in the ledger yet.');
  process.exit(1);
}

const ms = (a, b) => new Date(a).getTime() - new Date(b).getTime();
const median = (xs) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const hours = (m) => +(m / 3_600_000).toFixed(2);

const successes = rows.filter((r) => r.status === 'success');
const failures = rows.filter((r) => r.status === 'failed');

// 1. Deployment frequency — successful prod deploys per day over the observed window.
const times = rows.map((r) => new Date(r.deployed_at).getTime());
const spanDays = Math.max(1, (Math.max(...times) - Math.min(...times)) / 86_400_000);
const deploymentFrequencyPerDay = +(successes.length / spanDays).toFixed(2);

// 2. Lead time for changes — median(deployed_at − committed_at) of successful deploys.
const leadTimeHours = hours(median(successes.map((r) => ms(r.deployed_at, r.committed_at))));

// 3. Change failure rate — failed / total.
const changeFailureRate = +(failures.length / rows.length).toFixed(3);

// 4. Time to restore — median time from a failure to the next success.
const restoreSamples = [];
for (let i = 0; i < rows.length; i++) {
  if (rows[i].status !== 'failed') continue;
  const next = rows.slice(i + 1).find((r) => r.status === 'success');
  if (next) restoreSamples.push(ms(next.deployed_at, rows[i].deployed_at));
}
const timeToRestoreHours = hours(median(restoreSamples));

const dora = {
  generated_at_window_days: +spanDays.toFixed(2),
  total_deployments: rows.length,
  deployment_frequency_per_day: deploymentFrequencyPerDay,
  lead_time_for_changes_hours: leadTimeHours,
  change_failure_rate: changeFailureRate,
  time_to_restore_hours: timeToRestoreHours,
};

mkdirSync(join(root, 'reports'), { recursive: true });
writeFileSync(join(root, 'reports', 'dora.json'), JSON.stringify(dora, null, 2) + '\n');

console.log('DORA metrics (from deploy/deployments.ndjson):');
console.log(JSON.stringify(dora, null, 2));
