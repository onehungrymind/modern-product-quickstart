#!/usr/bin/env node
// Compute the Tracer redirect availability error budget (R11).
// SLO: 99.9% availability over a 30-day rolling window.
// Reads deploy/deployments.ndjson for the change-failure-rate signal, then
// estimates consumed budget from it and makes a ship-or-freeze call.
// Prints a JSON summary and writes reports/error-budget.json.
//   node scripts/error-budget.mjs
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ledgerPath = join(root, 'deploy', 'deployments.ndjson');

// ---------------------------------------------------------------------------
// SLO parameters
// ---------------------------------------------------------------------------
const SLO_AVAILABILITY_PCT = 99.9; // %
const WINDOW_DAYS = 30;
const FREEZE_THRESHOLD_PCT = 20; // freeze if remaining budget < 20% of total

// Availability error budget = (1 - SLO) × window_minutes
const windowMinutes = WINDOW_DAYS * 24 * 60;
const budgetMinutes = +((1 - SLO_AVAILABILITY_PCT / 100) * windowMinutes).toFixed(2);

// ---------------------------------------------------------------------------
// Load deployment ledger
// ---------------------------------------------------------------------------
let rows = [];
if (existsSync(ledgerPath)) {
  rows = readFileSync(ledgerPath, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((r) => r.env === 'prod');
}

// Filter to 30-day window
const cutoff = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
const windowRows = rows.filter((r) => new Date(r.deployed_at) >= cutoff);

const totalDeploys = windowRows.length;
const failedDeploys = windowRows.filter((r) => r.status === 'failed').length;
const rollbacks = windowRows.filter((r) => r.note === 'rollback').length;
const changeFailureRate = totalDeploys > 0 ? +(failedDeploys / totalDeploys).toFixed(3) : 0;

// ---------------------------------------------------------------------------
// Consumed budget estimate
// Each failed deploy consumes some error budget. We estimate based on the
// median time-to-restore from the ledger (time from a failed deploy to the
// next successful one). If no failure data, assume 0 consumed.
// ---------------------------------------------------------------------------
const restoreSamplesMs = [];
for (let i = 0; i < windowRows.length; i++) {
  if (windowRows[i].status !== 'failed') continue;
  const next = windowRows.slice(i + 1).find((r) => r.status === 'success');
  if (next) {
    restoreSamplesMs.push(
      new Date(next.deployed_at).getTime() - new Date(windowRows[i].deployed_at).getTime(),
    );
  }
}

const medianRestoreMs =
  restoreSamplesMs.length > 0
    ? restoreSamplesMs.sort((a, b) => a - b)[Math.floor(restoreSamplesMs.length / 2)]
    : 0;

// Consumed = number of failures × median time-to-restore (minutes).
// This is a lower-bound estimate — actual consumption depends on traffic and
// whether errors compound.
const consumedMinutes = +((failedDeploys * medianRestoreMs) / 60_000).toFixed(2);
const remainingMinutes = +(Math.max(0, budgetMinutes - consumedMinutes)).toFixed(2);
const remainingPct = +(budgetMinutes > 0 ? (remainingMinutes / budgetMinutes) * 100 : 100).toFixed(1);

const call = remainingPct <= FREEZE_THRESHOLD_PCT ? 'freeze' : 'ship';

// ---------------------------------------------------------------------------
// Build report
// ---------------------------------------------------------------------------
const report = {
  generated_at: new Date().toISOString(),
  slo: {
    availability_pct: SLO_AVAILABILITY_PCT,
    window_days: WINDOW_DAYS,
  },
  budget: {
    total_minutes: budgetMinutes,
    consumed_minutes: consumedMinutes,
    remaining_minutes: remainingMinutes,
    remaining_pct: remainingPct,
  },
  ledger: {
    window_days: WINDOW_DAYS,
    total_prod_deployments: totalDeploys,
    failed_deployments: failedDeploys,
    rollbacks,
    change_failure_rate: changeFailureRate,
    median_restore_minutes: +(medianRestoreMs / 60_000).toFixed(2),
  },
  call,
  call_reason:
    call === 'freeze'
      ? `Error budget is at ${remainingPct}% (≤ ${FREEZE_THRESHOLD_PCT}% threshold). ` +
        `Freeze feature deploys until the window resets or the budget is restored.`
      : `Error budget is at ${remainingPct}% (> ${FREEZE_THRESHOLD_PCT}% threshold). ` +
        `Normal shipping is allowed; monitor carefully.`,
};

mkdirSync(join(root, 'reports'), { recursive: true });
writeFileSync(join(root, 'reports', 'error-budget.json'), JSON.stringify(report, null, 2) + '\n');

console.log('Error budget (Tracer redirect availability SLO, 30-day window):');
console.log(JSON.stringify(report, null, 2));
console.log(
  `\n→ Call: ${call.toUpperCase()} — ${report.call_reason}`,
);
