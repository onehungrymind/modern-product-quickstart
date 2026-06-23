#!/usr/bin/env node
// Promote the SAME image dev → prod (build-once, promote-the-artifact — R08). No
// rebuild: the prod tag points at the identical image digest as dev. Records the
// deployment in deploy/deployments.ndjson so DORA (scripts/dora.mjs) can report.
//   node deploy/promote.mjs            # promote tracer-api:dev → tracer-api:prod
//   node deploy/promote.mjs <src-tag>
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcApi = process.argv[2] ?? 'tracer-api:dev';
const relApi = 'tracer-api:prod';

function digest(tag) {
  return execFileSync('docker', ['image', 'inspect', tag, '--format', '{{.Id}}'], {
    encoding: 'utf-8',
  }).trim();
}
function sh(cmd, args) {
  execFileSync(cmd, args, { stdio: 'inherit' });
}

const srcDigest = digest(srcApi);
console.log(`Promoting ${srcApi} (${srcDigest.slice(0, 19)}…) → ${relApi}`);
sh('docker', ['tag', srcApi, relApi]);
const relDigest = digest(relApi);

if (srcDigest !== relDigest) {
  console.error('Promotion changed the image digest — that is a rebuild, not a promotion.');
  process.exit(1);
}
console.log(`✓ ${relApi} is the SAME image (${relDigest.slice(0, 19)}…) — promoted, not rebuilt.`);

let sha = 'unknown';
try {
  sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf-8' }).trim();
} catch {
  /* not a git repo / no commits */
}
const stamp = process.env.PROMOTE_TIMESTAMP ?? new Date().toISOString();
appendFileSync(
  join(root, 'deploy', 'deployments.ndjson'),
  JSON.stringify({ sha, env: 'prod', status: 'success', committed_at: stamp, deployed_at: stamp }) + '\n',
);
console.log('Recorded prod deployment in deploy/deployments.ndjson (feeds DORA).');
