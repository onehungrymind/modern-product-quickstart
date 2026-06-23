# Lab 07 — Observability   ·   Capability: Observability   ·   Manifest: R10   ·   Ring: outer

## What you'll learn

How to wire OpenTelemetry logs, metrics, and traces from the NestJS API into the `grafana/otel-
lgtm` all-in-one local stack, define SLI metrics for the redirect hot path (`tracer_redirects_total`,
`tracer_redirect_duration_ms`), provision a Grafana dashboard that answers "is the redirect SLO
being met?", and configure an alert that fires when the p99 latency breaches 100 ms — so a
synthetic SLO burn can be detected in under two minutes.

## The Other Computer Test

On your machine you can open a terminal and watch the API logs scroll by. On any other computer —
a production server, an incident at 3 AM, a colleague asked to triage — "is the redirect hot path
healthy?" must be answerable from a dashboard without SSH access or reading logs line-by-line.
Observability is the outer-ring discipline that turns a running process into a system you can
reason about from the outside.

## Where the seed leaves it  →  Where production needs it

| Dimension | Seed (after Lab 05/06, logs only) | Product-grade |
|---|---|---|
| Traces | None | OTel auto-instrumentation → OTLP HTTP → Tempo (in LGTM) |
| Metrics | None | `tracer_redirects_total`, `tracer_redirect_duration_ms` → Prometheus |
| Logs | pino JSON (R05) | pino → OTel log SDK → Loki; correlated by trace ID |
| Dashboard | None | Provisioned `deploy/observability/dashboards/tracer.json` |
| Alert | None | "Redirect p99 SLO burn" fires when p99 > 100 ms for ≥ 1 minute |
| SLO instrumented | No | SLI metrics emitted on every `resolveTarget` call |

## Why it matters

The charter (Lab 01) promises a p99 < 100 ms SLO. Without instrumentation that promise is
unverifiable. The SLI metrics on `redirect.service.ts` are the connection between the contract in
the charter and the evidence in the dashboard. The alert is the connection between the dashboard
and a human being woken up at 3 AM — it must fire reliably, which is why the readiness check
proves it by injecting artificial latency and confirming the alert fires.

## The principle (public anchor)

> **Google SRE** — Beyer et al. (2016) — Chapters 6 (Monitoring), 10 (Practical Alerting).
> **OpenTelemetry** — the vendor-neutral observability framework.
>
> - [sre.google/books/site-reliability-engineering](https://sre.google/books/site-reliability-engineering/) — "Monitoring Distributed Systems"
> - [opentelemetry.io/docs](https://opentelemetry.io/docs/)
> - [grafana.com/oss/lgtm](https://grafana.com/oss/lgtm/) — Loki, Grafana, Tempo, Mimir in one container

## Prerequisites

- Completed Lab 06 · `npm run module:begin 07`
- Docker running

## Walkthrough

### Start the LGTM stack

1. Start Postgres and the LGTM observability stack:
   ```bash
   docker compose up -d
   ```
   This starts `postgres` (port 5433) and `lgtm` (`grafana/otel-lgtm:latest`):
   - Grafana UI: `http://localhost:3001` (anonymous admin access)
   - OTLP HTTP endpoint: `http://localhost:4318`
   - OTLP gRPC endpoint: `localhost:4317`

   Wait for `lgtm` to be healthy: `docker compose ps` should show `healthy` after ~30 seconds.

### Wire OTel in the API

2. Review `apps/api/src/tracing.ts`. It must be the *first* import in `apps/api/src/main.ts`
   (before `reflect-metadata` and Nest) so auto-instrumentation patches the HTTP, TypeORM, and
   pino modules at load time:
   ```ts
   import './tracing.js';     // ← must be line 1
   import 'reflect-metadata';
   // ... rest of main.ts
   ```
   The SDK exports to `http://localhost:4318` (the LGTM OTLP HTTP endpoint) by default, or to
   `process.env.OTEL_EXPORTER_OTLP_ENDPOINT` if set.

3. Start the API locally:
   ```bash
   DATABASE_URL=postgres://tracer:tracer@localhost:5433/tracer \
   JWT_SECRET=local-dev-secret-32-chars-min \
   npm run serve:api
   ```
   Make a few requests (create a link, resolve it). Open Grafana at `http://localhost:3001` →
   Explore → select the Tempo data source → search for a recent trace. You should see a `GET
   /:slug` span with child spans for the TypeORM query and the clicks service call.

### SLI metrics

4. Open `apps/api/src/redirect/redirect.service.ts`. The three OTel meters are created at module
   load time:
   - `tracer_redirects_total` (counter, `outcome` label: `redirect | not_found | error`)
   - `tracer_redirect_duration_ms` (histogram, `unit: 'ms'`, same `outcome` label)
   - `tracer_redirect_errors_total` (counter)

   Every call to `resolveTarget()` records to all three. In `07-start`, these may be absent or
   incomplete — wire them following the reference in `redirect.service.ts`.

5. Verify metrics are flowing: `curl http://localhost:3000/api/metrics` (if the Prometheus
   scrape endpoint is wired) or query Grafana → Explore → Prometheus →
   `tracer_redirects_total{outcome="redirect"}`.

### Dashboard and alert

6. The provisioned dashboard (`deploy/observability/dashboards/tracer.json`) and alerting rule
   (`deploy/observability/provisioning/alerting/tracer-slo.yaml`) are mounted into the LGTM
   container as read-only volumes (see `deploy/docker-compose.yml`). They are loaded automatically
   on container start.

7. Open Grafana → Dashboards → "Tracer". You should see panels for:
   - Redirect rate (req/s) by outcome
   - p99 redirect latency (ms)
   - Error rate
   Trigger a redirect: `curl -I http://localhost:3000/<slug>`. The panels should update within
   3–5 seconds (the OTel metric export interval is 3 000 ms).

8. Review the alert rule in `deploy/observability/provisioning/alerting/tracer-slo.yaml`. The
   PromQL is:
   ```
   histogram_quantile(0.99, sum by (le) (
     rate(tracer_redirect_duration_ms_milliseconds_bucket[1m])
   )) > 100
   ```
   The alert fires when this is true for ≥ 1 minute.

### Test the alert fires

9. Inject artificial latency via `SLO_BURN_DELAY_MS`:
   ```bash
   SLO_BURN_DELAY_MS=150 \
   DATABASE_URL=postgres://tracer:tracer@localhost:5433/tracer \
   JWT_SECRET=local-dev-secret-32-chars-min \
   npm run serve:api
   ```
   Generate traffic: resolve a slug ~20 times. Watch Grafana → Alerting → Alert rules →
   "Redirect p99 SLO burn" transition from `Normal` → `Pending` → `Firing` (takes ~1 minute of
   sustained breach). Stop the API and restart without the env var to clear the alert.

## Exercise

Add a fourth panel to the dashboard showing `tracer_redirect_errors_total` as a time series. Export
the updated dashboard JSON (`Grafana → Dashboard → Share → Export`) and replace
`deploy/observability/dashboards/tracer.json`. Restart the LGTM container to verify the panel
is provisioned automatically:
```bash
docker compose restart lgtm
```

## Verify

```bash
npm run readiness:check R10
```

The R10 check:
1. Starts the API with `SLO_BURN_DELAY_MS=150` and generates traffic.
2. Queries Prometheus for `tracer_redirect_duration_ms` — asserts the metric exists.
3. Checks the Grafana alerting API for the "Redirect p99 SLO burn" alert rule.
4. Confirms the dashboard JSON file exists and is valid.

Green means: SLI metrics are flowing, the dashboard is provisioned, and the alert rule is present.

## Compare

```bash
npm run module:compare 07
```

Key diffs: `apps/api/src/tracing.ts`, `apps/api/src/main.ts` (first import), `apps/api/src/
redirect/redirect.service.ts` (OTel meters), `deploy/docker-compose.yml` (lgtm service + volume
mounts), `deploy/observability/` directory.

## Cheat sheet

| Command | What it does |
|---|---|
| `docker compose up -d` | Start Postgres + LGTM |
| `docker compose ps` | Check health status |
| `docker compose logs lgtm --tail=20` | LGTM startup logs |
| `curl http://localhost:3001/api/health` | Grafana health check |
| `SLO_BURN_DELAY_MS=150 npm run serve:api` | Inject latency to trigger the SLO alert |

**Gotcha:** `tracing.ts` must be imported *before* `reflect-metadata`. If NestJS loads first, the
OTel HTTP instrumentation misses the initial requests. Check `apps/api/src/main.ts` line order.

**Gotcha:** The LGTM container maps host port 3001 (not 3000) to Grafana's internal 3000, because
the Angular dev server occupies host port 3000. This is set in `deploy/docker-compose.yml`.

**Gotcha:** The metric export interval is 3 000 ms (`exportIntervalMillis: 3000` in `tracing.ts`).
New metrics appear in Grafana within ~5 seconds of the first request — not instantly.

**Gotcha:** `GF_AUTH_ANONYMOUS_ENABLED=true` in `docker-compose.yml` grants anonymous admin
access to Grafana for local dev convenience. This must never be set in production.

## Next → [Lab 08](../08-incident-response/README.md)
