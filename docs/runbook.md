# Tracer Incident Runbook — Redirect Hot-Path SLO Burn

**Scope:** The redirect hot path (`GET /:slug → 302`) is the only user-facing SLO-critical path.
**SLO:** p99 latency < 100 ms | Availability 99.9% (30-day rolling).

---

## 1. DETECT

### Grafana Alert
The **"Redirect p99 SLO burn"** alert (provisioned in
`deploy/observability/provisioning/alerting/tracer-slo.yaml`) fires when

```
histogram_quantile(0.99, sum by (le) (rate(tracer_redirect_duration_ms_milliseconds_bucket[1m]))) > 100
```

for ≥ 1 minute. Open the Tracer dashboard at `http://localhost:3000` (Grafana) — the
`tracer_redirect_duration_ms` panel shows the p99 trend in real time.

### Manual health check
```bash
curl -s http://localhost:3001/api/health   # prod port
# Expected: {"status":"ok","db":"up"}
# If db is "down" → Postgres failure, not a latency issue
```

### Latency spot-check (requires a known slug)
```bash
time curl -s -o /dev/null -w "%{time_total}s  HTTP %{http_code}\n" \
  -L http://localhost:3001/<slug>
# p99 > 0.1s while alert is firing → confirmed breach
```

### Prometheus raw metric
```bash
curl -s http://localhost:3001/api/metrics \
  | grep tracer_redirect_duration_ms_milliseconds_bucket
```

---

## 2. TRIAGE

Ask these questions in order:

| # | Question | How to check |
|---|----------|--------------|
| 1 | Is the DB responding? | `curl /api/health` — check `"db"` field |
| 2 | Did a deploy happen just before the alert? | `tail -5 deploy/deployments.ndjson` |
| 3 | Is `SLO_BURN_DELAY_MS` set on the running process? | Check the deployment environment / container env |
| 4 | Are errors spiking alongside latency? | Grafana: `tracer_redirect_errors_total` counter |
| 5 | Is latency uniform across slugs or only some? | Spot-check multiple slugs |

**Decision tree:**
- DB down → escalate to infra / restart Postgres.
- Recent bad deploy + latency only → **roll back** (Section 4).
- `SLO_BURN_DELAY_MS` left set in prod → emergency env-var update + restart.
- Unknown → capture metrics snapshot, escalate, move to Section 4 anyway if p99 > 200 ms.

---

## 3. MITIGATE (before rollback, if needed)

If you need to reduce SLO burn while investigating:

```bash
# Restart the api to clear transient state (e.g. connection pool exhaustion):
# In a Docker / PM2 environment:
docker restart tracer-api   # or pm2 restart api

# If SLO_BURN_DELAY_MS was accidentally left set in prod:
# Remove the env var and restart — do NOT leave it in .env files.
```

---

## 4. ROLL BACK VIA THE PIPELINE

### Step 1 — Roll back to the previous good image (R07)

```bash
node deploy/rollback.mjs
```

This reads `deploy/deployments.ndjson`, finds the last successful prod deployment before the
most recent one, re-tags that image as `tracer-api:prod`, and records a rollback entry in the
ledger. Output example:

```
Rolling back prod → sha d4e5f6a (deployed 2026-06-19T09:48:00Z)
✓ tracer-api:prod now points to d4e5f6a
Recorded rollback in deploy/deployments.ndjson
```

### Step 2 — Restart with the rolled-back image

```bash
# Docker Compose (typical dev/staging):
docker compose up -d api

# Or run directly (replace env values):
DATABASE_URL=postgres://tracer:tracer@localhost:5433/tracer \
JWT_SECRET=<secret> \
URL_PREVIEW=https://t.example.com \
PORT=3001 \
node dist/apps/api/main.js
```

### Step 3 — Verify the rollback fixed the SLO

```bash
# Health check:
curl -s http://localhost:3001/api/health

# Latency check (should now be < 100ms):
time curl -s -o /dev/null -w "%{time_total}s  HTTP %{http_code}\n" \
  http://localhost:3001/<slug>

# Confirm alert cleared in Grafana (usually within 2 minutes of data)
```

### Step 4 — Re-promote when a fixed image is ready

```bash
# Build and tag the fixed image as dev, then promote:
node deploy/promote.mjs tracer-api:dev
```

---

## 5. COMMUNICATE

Use the following communication template during an active incident:

```
[INCIDENT OPEN – <time>]
Service: Tracer redirect hot path
Symptom: p99 latency > 100ms (SLO breach)
Impact: Users may experience slow redirects; no data loss expected
Status: Investigating / Mitigating / Rolled back
ETA: <N> minutes
```

Update every 15 minutes or at each status change. Post to the team channel and tag the on-call
engineer. When resolved:

```
[INCIDENT RESOLVED – <time>]
Service: Tracer redirect hot path
Duration: <HH:MM>
Root cause: <brief>
Fix: Rolled back to sha <X>
Action items: Postmortem within 5 business days
```

---

## 6. ERROR-BUDGET CALL

After resolving, run the error-budget calculator:

```bash
node scripts/error-budget.mjs
# Prints JSON + writes reports/error-budget.json
# Look at the "call" field: "ship" or "freeze"
```

**Decision rule:**
- `"call": "ship"` → error budget > 20% remaining. Normal shipping is allowed.
- `"call": "freeze"` → budget ≤ 20% remaining. Freeze feature deploys; only bug fixes /
  rollbacks until the 30-day window resets.

If this incident consumed significant budget, file a postmortem using
`docs/postmortem.template.md` and track action items to exhaustion.

---

## Quick Reference Commands

```bash
# Check ledger (last 5 deployments):
tail -5 deploy/deployments.ndjson

# DORA metrics:
node scripts/dora.mjs

# Error budget:
node scripts/error-budget.mjs

# Rollback:
node deploy/rollback.mjs

# Game day drill (simulate incident lifecycle):
node scripts/adversary/gameday-inject.mjs
```
