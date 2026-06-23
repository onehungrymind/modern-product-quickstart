// R05 — Logs: structured JSON + correlation ids. Boot in production mode (raw JSON), hit a route, prove it.
import { Probe, ensureApiBuilt, startApi } from './_lib.mjs';

const p = new Probe();

ensureApiBuilt();
const a = await startApi({ NODE_ENV: 'production' });
if (!a.ok) {
  p.assert(false, 'api booted', a.logs().split('\n').slice(-4).join(' '));
  p.done();
}

// Generate a request carrying a known correlation id.
const reqId = 'readiness-r05-correlation-id';
await fetch(`${a.base}/api/health`, { headers: { 'x-request-id': reqId } });
await new Promise((r) => setTimeout(r, 500));
await a.stop();

const lines = a.logs().split('\n').filter(Boolean);

// At least one line must be valid JSON (structured logging, not plain text).
const jsonLines = [];
for (const l of lines) {
  try {
    jsonLines.push(JSON.parse(l));
  } catch {
    /* not a json line */
  }
}
p.assert(jsonLines.length > 0, 'logs are structured JSON', `${lines.length} lines, 0 parsed as JSON`);

// A request log line must carry a correlation id, and our x-request-id must propagate.
const withReqId = jsonLines.find((o) => o.requestId || o.reqId || o.req?.id);
p.assert(Boolean(withReqId), 'a log line carries a request/correlation id');

const propagated = jsonLines.some(
  (o) => o.requestId === reqId || o.reqId === reqId || o.req?.id === reqId,
);
p.assert(propagated, 'incoming x-request-id propagates into logs', `expected ${reqId}`);

p.done();
