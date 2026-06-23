// R14 — Readiness gate: the full PRR is assembled. Every delta R01–R13 has a machine-checkable
// probe, so `npm run readiness` covers the whole outer ring. (R14 verifies the gate is COMPLETE;
// the all-green verdict is the full `npm run readiness` run itself — running it here would recurse.)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { Probe, exists } from './_lib.mjs';

const p = new Probe();
const here = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(resolve(here, '..', '..', 'readiness.manifest.json'), 'utf-8'));

p.assert(exists('scripts/readiness.mjs'), 'PRR runner present (scripts/readiness.mjs)');
p.assert(manifest.deltas.length === 14, `manifest declares all 14 deltas (${manifest.deltas.length})`);

// Every delta except R14 itself must have a wired check probe.
const missing = [];
for (const d of manifest.deltas) {
  if (d.id === 'R14') continue;
  if (!exists(join('scripts', 'readiness', 'checks', `${d.id.toLowerCase()}.mjs`))) missing.push(d.id);
}
p.assert(missing.length === 0, 'every delta R01–R13 has a check probe', missing.join(', '));

p.done();
