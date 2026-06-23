// R10 — Observability: OTel logs+metrics+traces; SLOs; dashboard + alert.
// "healthy?" is answerable from the signals; a synthetic SLO burn fires the alert.
import { execFileSync } from 'node:child_process';
import { Probe, root, ensureApiBuilt, startApi, jar, waitFor } from './_lib.mjs';

const p = new Probe();
const GRAFANA = 'http://localhost:3001';
const AUTH = { Authorization: `Basic ${Buffer.from('admin:admin').toString('base64')}` };

function compose(args) {
  return execFileSync('docker', ['compose', '-f', 'deploy/docker-compose.yml', ...args], {
    cwd: root,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}
async function promQuery(q) {
  const url = `${GRAFANA}/api/datasources/proxy/uid/prometheus/api/v1/query?query=${encodeURIComponent(q)}`;
  const r = await fetch(url, { headers: AUTH });
  if (!r.ok) return [];
  return (await r.json())?.data?.result ?? [];
}
async function alertState(name) {
  const r = await fetch(`${GRAFANA}/api/prometheus/grafana/api/v1/rules`, { headers: AUTH });
  if (!r.ok) return 'unknown';
  const groups = (await r.json())?.data?.groups ?? [];
  for (const g of groups) {
    for (const rule of g.rules ?? []) {
      if ((rule.name ?? '').includes(name)) return rule.state ?? 'unknown';
    }
  }
  return 'absent';
}

let api;
try {
  // 1. Bring up the LGTM stack (postgres already running from the root compose).
  compose(['up', '-d', 'lgtm']);
  const grafanaUp = await waitFor(async () => {
    try {
      return (await fetch(`${GRAFANA}/api/health`)).ok;
    } catch {
      return false;
    }
  }, 60000);
  p.assert(grafanaUp, 'LGTM Grafana is up');

  // The dashboard + alert are provisioned.
  const search = await fetch(`${GRAFANA}/api/search?query=Tracer`, { headers: AUTH });
  const dashboards = search.ok ? await search.json() : [];
  p.assert(dashboards.length > 0, 'Tracer SLI dashboard is provisioned');
  p.assert((await alertState('SLO burn')) !== 'absent', 'SLO-burn alert rule is provisioned');

  // 2. Boot the api exporting OTel to LGTM, with the synthetic latency burn ON
  //    (every redirect waits 150ms → p99 > 100ms SLO breach).
  ensureApiBuilt();
  api = await startApi({ OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318', SLO_BURN_DELAY_MS: '150' });
  p.assert(api.ok, 'api booted with OTel export', api.logs().split('\n').slice(-3).join(' '));

  // Mint a link, then drive redirect traffic continuously.
  const call = jar();
  await call(`${api.base}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: `r10-${process.pid}@probe.test`, name: 'R10', password: 'probe-password-123' }),
  });
  const created = await (
    await call(`${api.base}/api/links`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ target_url: 'https://example.com/r10' }),
    })
  ).json();
  const slug = created.slug;

  const deadline = Date.now() + 200000; // up to ~3.3 min for the alert's `for:` window
  let metricSeen = false;
  let logsSeen = false;
  let fired = false;
  while (Date.now() < deadline) {
    // keep the SLI flowing
    for (let i = 0; i < 10; i++) await fetch(`${api.base}/${slug}`, { redirect: 'manual' }).catch(() => {});
    if (!metricSeen) metricSeen = (await promQuery('tracer_redirect_duration_ms_milliseconds_count')).length > 0;
    if (!logsSeen) {
      const lr = await fetch(
        `${GRAFANA}/api/datasources/proxy/uid/loki/loki/api/v1/label/service_name/values`,
        { headers: AUTH },
      ).catch(() => null);
      logsSeen = lr?.ok ? (await lr.json())?.data?.includes('tracer-api') : false;
    }
    const state = await alertState('SLO burn');
    if (state === 'firing') {
      fired = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }

  // Final settle + re-query: by now (esp. once the alert fired) the metric/logs have
  // definitely been scraped, so don't let a mid-loop race decide the verdict.
  await new Promise((r) => setTimeout(r, 4000));
  if (!metricSeen) metricSeen = (await promQuery('tracer_redirect_duration_ms_milliseconds_count')).length > 0;
  if (!logsSeen) {
    const lr = await fetch(`${GRAFANA}/api/datasources/proxy/uid/loki/loki/api/v1/label/service_name/values`, {
      headers: AUTH,
    }).catch(() => null);
    logsSeen = lr?.ok ? (await lr.json())?.data?.includes('tracer-api') : false;
  }

  // "healthy?" is answerable from the dashboard's backing signals.
  p.assert(metricSeen, 'redirect SLI metric present in Prometheus (dashboard is backed by data)');
  p.assert(logsSeen, 'tracer-api logs present in Loki');
  p.assert(fired, 'synthetic SLO burn moved the alert to firing');
} catch (err) {
  p.assert(false, 'observability probe ran', String(err.stdout ?? err.message ?? err).split('\n').slice(-3).join(' '));
} finally {
  if (api) await api.stop();
  try {
    compose(['stop', 'lgtm']);
  } catch {
    /* best effort */
  }
}

p.done();
