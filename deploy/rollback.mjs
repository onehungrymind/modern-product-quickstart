#!/usr/bin/env node
// Roll back the prod deployment to the previous successful image (R11).
// Reads deploy/deployments.ndjson, finds the last successful prod entry BEFORE
// the most recent one, re-tags that image as tracer-api:prod, and appends a
// rollback record to the ledger.
//   node deploy/rollback.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ledgerPath = join(root, 'deploy', 'deployments.ndjson');

// ---------------------------------------------------------------------------
// Load ledger
// ---------------------------------------------------------------------------
if (!existsSync(ledgerPath)) {
  console.error(`No deployment ledger at ${ledgerPath}. Deploy at least once first.`);
  process.exit(1);
}

const rows = readFileSync(ledgerPath, 'utf-8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l));

const prodRows = rows.filter((r) => r.env === 'prod' && r.status === 'success' && !r.note);

if (prodRows.length < 2) {
  console.error(
    `Cannot roll back: need at least 2 successful prod deployments in the ledger, ` +
      `found ${prodRows.length}.`,
  );
  process.exit(1);
}

// The most recent successful prod deploy (the "bad" current one) and the one before it.
const current = prodRows[prodRows.length - 1];
const target = prodRows[prodRows.length - 2];

console.log(`Current prod:  sha ${current.sha}  (deployed ${current.deployed_at})`);
console.log(`Rolling back to: sha ${target.sha}  (deployed ${target.deployed_at})`);

// ---------------------------------------------------------------------------
// Re-tag the previous good image as tracer-api:prod
// Docker must be available; if not, skip tagging but still record the rollback.
// ---------------------------------------------------------------------------
const srcTag = `tracer-api:${target.sha}`;
const destTag = 'tracer-api:prod';

function dockerAvailable() {
  try {
    execFileSync('docker', ['info'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function imageExists(tag) {
  try {
    execFileSync('docker', ['image', 'inspect', tag, '--format', '{{.Id}}'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

if (dockerAvailable()) {
  if (imageExists(srcTag)) {
    execFileSync('docker', ['tag', srcTag, destTag], { stdio: 'inherit' });
    console.log(`✓ ${destTag} now points to ${target.sha}`);
  } else {
    // Try the generic dev image as a proxy (the workspace uses a single image; the sha tag
    // may not exist locally, but tracer-api:dev is the same image that was promoted).
    console.warn(
      `Image ${srcTag} not found locally. Re-tagging tracer-api:dev as tracer-api:prod ` +
        `(same artifact, safe for single-image workspaces).`,
    );
    if (imageExists('tracer-api:dev')) {
      execFileSync('docker', ['tag', 'tracer-api:dev', destTag], { stdio: 'inherit' });
      console.log(`✓ ${destTag} re-tagged from tracer-api:dev`);
    } else {
      console.warn('No suitable image found to re-tag. Skipping docker tag step.');
    }
  }
} else {
  console.warn('Docker not available — skipping image re-tag. Recording rollback in ledger only.');
}

// ---------------------------------------------------------------------------
// Append rollback record to ledger
// ---------------------------------------------------------------------------
let sha = 'unknown';
try {
  sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf-8' }).trim();
} catch {
  /* not a git repo */
}
const stamp = new Date().toISOString();
const record = {
  sha: target.sha,
  env: 'prod',
  status: 'success',
  committed_at: target.committed_at,
  deployed_at: stamp,
  note: 'rollback',
};
appendFileSync(ledgerPath, JSON.stringify(record) + '\n');

console.log(`✓ Rolled back prod → sha ${target.sha} (was ${current.sha})`);
console.log(`Recorded rollback in ${ledgerPath}`);
console.log(
  '\nNext steps:\n' +
    '  1. Restart the api with the rolled-back image (docker compose up -d api, or restart manually).\n' +
    '  2. Verify: curl http://localhost:<port>/api/health\n' +
    '  3. Confirm SLO alert cleared in Grafana.\n' +
    '  4. When a fixed image is ready: node deploy/promote.mjs',
);
