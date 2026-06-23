// R13 — Supply chain: pinned deps, SBOM, dep-scan gates the pipeline.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { Probe, root, read, exists } from './_lib.mjs';

const p = new Probe();

// Lockfile pinned.
p.assert(exists('package-lock.json'), 'lockfile present (package-lock.json — deps pinned)');

// SBOM is emitted with real components.
try {
  execFileSync('npm', ['run', 'sbom'], { cwd: root, stdio: 'ignore' });
  const sbom = JSON.parse(readFileSync(`${root}/reports/sbom.json`, 'utf-8'));
  p.assert(Array.isArray(sbom.components) && sbom.components.length > 0, `SBOM emitted (${sbom.components?.length ?? 0} components, CycloneDX ${sbom.bomFormat ?? '?'})`);
} catch (err) {
  p.assert(false, 'SBOM emitted', String(err).split('\n')[0]);
}

// The pipeline gates on a dependency scan.
const ci = exists('.github/workflows/ci.yml') ? read('.github/workflows/ci.yml') : '';
p.assert(/npm run audit|npm audit/.test(ci), 'CI runs a dependency scan (dep-scan gates the pipeline)');

// The scan passes on the real (clean-at-critical) runtime deps...
let realClean = false;
try {
  execFileSync('npm', ['run', 'audit'], { cwd: root, stdio: 'ignore' });
  realClean = true;
} catch {
  realClean = false;
}
p.assert(realClean, 'dependency scan is clean on the runtime deps (no critical vulns)');

// ...but BLOCKS a planted known-vuln dep (the gate actually bites).
let fixtureBlocked = false;
try {
  execFileSync('npm', ['audit', '--package-lock-only', '--audit-level=critical'], {
    cwd: `${root}/scripts/adversary/vuln-fixture`,
    stdio: 'ignore',
  });
  fixtureBlocked = false; // exit 0 = no vuln found = gate did NOT bite
} catch {
  fixtureBlocked = true; // non-zero = vuln found = gate blocks it
}
p.assert(fixtureBlocked, 'dep-scan BLOCKS a planted known-vuln dep (minimist@1.2.0 → critical)');

p.done();
