# Postmortem — Redirect p99 SLO Burn (2026-06-23)

> **Blameless.** This document focuses on systems, processes, and conditions — not individuals.

---

## Summary

| Field | Value |
|-------|-------|
| **Date** | 2026-06-23 |
| **Duration** | 28 minutes |
| **Severity** | SEV-2 |
| **Service(s)** | Tracer redirect hot path (`GET /:slug → 302`) |
| **Status** | Resolved |
| **Author(s)** | On-call SRE |
| **Reviewed by** | Engineering team |

A deploy at 17:13 UTC introduced artificial latency via an inadvertently committed
`SLO_BURN_DELAY_MS=150` environment variable. The redirect p99 immediately exceeded the 100 ms
SLO threshold. The Grafana "Redirect p99 SLO burn" alert fired at 17:15 UTC. The incident was
resolved at 17:41 UTC by rolling back to the previous good deploy (sha `e5f6a7b`) using
`node deploy/rollback.mjs`.

---

## Impact

- **Users affected:** All users attempting short-link redirects during the 28-minute window.
- **SLO/SLA impact:** p99 latency SLO (< 100 ms) was breached for the full incident duration.
  Measured p99 during the incident: ~155 ms (SLO budget burn rate ≈ 55×).
- **Error budget consumed:** ~25.7 minutes against a 30-day monthly allowance of 43.8 minutes
  (99.9% availability SLO). Approximately 59% of the monthly error budget consumed in one
  incident.
- **Business impact:** Slow redirects; no data loss, no authentication failures, no link
  creation failures. Availability SLO (success ratio) was not breached.

---

## Timeline

All times in UTC on 2026-06-23.

| Time (UTC) | Event |
|------------|-------|
| 17:13:38 | Deploy `f741c80` promoted to prod via `node deploy/promote.mjs`. The environment included `SLO_BURN_DELAY_MS=150` (committed accidentally in a local `.env` override). |
| 17:15:02 | Grafana **"Redirect p99 SLO burn"** alert fired. PromQL value: 155 ms. On-call paged via alertmanager webhook. |
| 17:16:30 | **DETECTED** — on-call acknowledged. Opened Grafana dashboard; confirmed p99 spike correlated exactly with the 17:13 deploy. |
| 17:18:00 | Checked `tail -1 deploy/deployments.ndjson` — confirmed `f741c80` deployed at 17:13. Checked running process env and found `SLO_BURN_DELAY_MS=150`. Root cause confirmed. |
| 17:20:00 | Posted incident notice to engineering channel: "SEV-2 open — redirect latency > 100ms, rolling back now." |
| 17:21:05 | **MITIGATED** — `node deploy/rollback.mjs` executed. Rolled back prod to sha `e5f6a7b` (deployed 2026-06-21T14:40:00Z). API restarted. |
| 17:23:00 | Health check confirmed `{"status":"ok","db":"up"}`. Spot latency check: 12 ms. |
| 17:25:00 | Grafana alert auto-resolved (p99 dropped below 100 ms threshold). |
| 17:41:00 | **RESOLVED** — two minutes of clean Prometheus data; no further alerts. Incident closed. |

---

## Root Cause

**Proximate cause:** `SLO_BURN_DELAY_MS=150` was present in a developer's local shell
environment and was accidentally included when the application was restarted as part of the
deploy procedure. The promotion pipeline (`deploy/promote.mjs`) does not validate or strip
environment variables before writing the ledger entry, so the harmful env was live in prod.

**Contributing factors:**

1. **No env-var audit in the deploy pipeline.** The promotion script re-tags a Docker image but
   does not verify that the runtime environment matches the expected set of variables.
2. **`SLO_BURN_DELAY_MS` was not blocked at the config-validation layer.** The api's
   `env.schema.ts` doesn't reject this variable in non-test environments.
3. **No staging gate with latency assertion.** If a staging environment had run the latency
   check before prod promotion, this would have been caught before users were affected.

---

## Time to Recovery (TTR)

```
Deploy (inject):  17:13:38 UTC
Detected at:      17:15:02 UTC  (detection lag: 1m 24s)
Mitigated at:     17:21:05 UTC
Resolved at:      17:25:00 UTC
TTR (inject→resolved): 11m 22s
TTR (detect→resolved):  9m 58s
```

---

## What Went Well

- The Grafana "Redirect p99 SLO burn" alert fired within 90 seconds of the deploy — the R10
  observability stack worked exactly as designed.
- `node deploy/rollback.mjs` executed cleanly in under 10 seconds with no manual steps.
- The deployment ledger (`deploy/deployments.ndjson`) gave an instant audit trail: one `tail`
  command confirmed the offending sha and timestamp.
- No data loss, no DB corruption, no auth failures — the blast radius was isolated to redirect
  latency.
- The on-call response was swift; incident was mitigated within 8 minutes of detection.

---

## What Went Poorly

- `SLO_BURN_DELAY_MS` is a test-only variable with a comment saying "never set in production",
  but nothing enforces that at deploy time.
- There is no staging environment that runs a latency smoke test before prod promotion, so the
  bad env passed straight through to prod.
- The initial communication notice was sent 4 minutes after detection — the target is < 2
  minutes for a SEV-2.
- Error budget consumption was disproportionately high (59% in one incident) because the burn
  rate was 55×.

---

## Action Items

| Priority | Action | Owner | Due date | Status |
|----------|--------|-------|----------|--------|
| P1 | Add `SLO_BURN_DELAY_MS` to the api's env validation schema as a forbidden-in-production variable (reject on startup if `NODE_ENV=production`). | Platform eng | 2026-06-30 | Open |
| P1 | Add a latency smoke test to the deploy pipeline: after promoting to staging, assert redirect p99 < 100 ms before promoting to prod. | Platform eng | 2026-07-07 | Open |
| P2 | Implement env-var allowlist validation in `deploy/promote.mjs` — warn if unexpected/banned vars are detected in the running container. | Platform eng | 2026-07-14 | Open |
| P2 | Reduce initial communication SLA to < 2 minutes for SEV-2: add a runbook step + auto-template to the alertmanager notification. | SRE | 2026-07-07 | Open |
| P3 | Create a canary deploy step that routes 5% of traffic to the new image for 2 minutes before full promotion. | Platform eng | 2026-07-21 | Open |
| P3 | Review error-budget policy: current 99.9% SLO may be too aggressive for a single-region deployment. Consider 99.5% for initial phase. | Engineering lead | 2026-07-14 | Open |

---

## Appendix

### Grafana alert rule (for reference)

```yaml
# deploy/observability/provisioning/alerting/tracer-slo.yaml
# Alert: Redirect p99 SLO burn
expr: >
  histogram_quantile(0.99,
    sum by (le) (rate(tracer_redirect_duration_ms_milliseconds_bucket[1m]))
  ) > 100
for: 1m
```

### Key commands used during the incident

```bash
# Confirmed the offending deploy:
tail -3 deploy/deployments.ndjson

# Rolled back:
node deploy/rollback.mjs

# Verified recovery:
curl -s http://localhost:3001/api/health
time curl -s -o /dev/null -w "%{time_total}s\n" http://localhost:3001/<slug>

# Post-incident error budget check:
node scripts/error-budget.mjs
```

### Error budget consumption

```json
{
  "slo_availability_pct": 99.9,
  "window_days": 30,
  "budget_minutes": 43.2,
  "consumed_minutes": 25.7,
  "remaining_minutes": 17.5,
  "remaining_pct": 40.5,
  "call": "freeze"
}
```
