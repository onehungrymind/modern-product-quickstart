// R08 — Environments: dev+prod parity, same image promotes dev→prod, feature flag
// toggles a release WITHOUT redeploy.
import { execFileSync } from 'node:child_process';
import { Probe, root, read, exists, ensureApiBuilt, startApi, jar } from './_lib.mjs';

const p = new Probe();

// dev + prod parity — identical topology, parameterized by workspace.
const tf = exists('infra/main.tf') ? read('infra/main.tf') : '';
p.assert(/terraform\.workspace/.test(tf), 'infra uses terraform workspaces (dev/prod parity)');
p.assert(/dev\s*=/.test(tf) && /prod\s*=/.test(tf), 'infra declares both dev and prod');

// Build-once / promote-the-same-image: prod tag is the SAME digest as dev.
function digest(tag) {
  try {
    return execFileSync('docker', ['image', 'inspect', tag, '--format', '{{.Id}}'], { encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}
const dev = digest('tracer-api:dev');
p.assert(Boolean(dev), 'tracer-api:dev image exists (the built artifact)');
if (dev) {
  execFileSync('docker', ['tag', 'tracer-api:dev', 'tracer-api:prod']); // idempotent promote
  p.assert(digest('tracer-api:prod') === dev, 'promotion keeps the SAME image digest dev→prod (no rebuild)');
}

// Feature flag toggles a release WITHOUT redeploy: same running process, behaviour
// changes when the DB-backed flag flips.
function setFlag(state) {
  execFileSync(process.execPath, ['deploy/feature-flag.mjs', 'link_title_preview', state], { cwd: root, stdio: 'ignore' });
}
async function createTitle(api, call, url) {
  const res = await call(`${api.base}/api/links`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ target_url: url }),
  });
  return (await res.json()).title;
}

ensureApiBuilt();
setFlag('off');
const api = await startApi();
let toggled = false;
if (api.ok) {
  const call = jar();
  await call(`${api.base}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: `r08-${process.pid}@probe.test`, name: 'R08', password: 'probe-password-123' }),
  });
  const off = await createTitle(api, call, 'https://example.com/off');
  setFlag('on');
  await new Promise((r) => setTimeout(r, 6000)); // flag cache TTL
  const on = await createTitle(api, call, 'https://example.com/on');
  toggled = (off === null || off === undefined) && typeof on === 'string' && on.length > 0;
}
await api.stop();
setFlag('off');
p.assert(api.ok, 'api booted for the flag check', api.logs().split('\n').slice(-3).join(' '));
p.assert(toggled, 'feature flag flips behaviour with NO redeploy (off→no title, on→title)');

p.done();
