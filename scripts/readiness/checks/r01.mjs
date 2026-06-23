// R01 — Definition of done: the Readiness Charter parses, with SLOs + both critical workflows present.
import { Probe, read, exists } from './_lib.mjs';

const p = new Probe();

p.assert(exists('docs/charter.md'), 'charter present (docs/charter.md)');
const charter = exists('docs/charter.md') ? read('docs/charter.md') : '';

// SLOs present (a latency target + an availability target).
p.assert(/p99[^\n]*100\s*ms/i.test(charter), 'latency SLO present (redirect p99 < 100ms)');
p.assert(/99\.9\s*%/.test(charter), 'availability SLO present (99.9%)');
p.assert(/error budget/i.test(charter), 'error budget defined');

// Both critical workflows present.
p.assert(/create/i.test(charter) && /POST \/api\/links/.test(charter), 'Create workflow present (POST /api/links)');
p.assert(/resolve/i.test(charter) && /GET \/:slug/.test(charter), 'Resolve workflow present (GET /:slug)');

// The delta inventory is present (the Readiness Manifest spine).
const deltas = (charter.match(/\bR0\d\b|\bR1[0-4]\b/g) ?? []).length;
p.assert(deltas >= 14, `delta inventory present (${deltas} delta references)`);

p.done();
