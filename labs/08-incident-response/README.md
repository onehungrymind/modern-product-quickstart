# Lab 08 — Incident Response (Game Day)   ·   Capability: Reliability   ·   Manifest: R11   ·   Ring: outer

## What you'll learn

How to run a structured incident lifecycle drill: inject a real SLO breach, detect it via the
observability stack from Lab 07, roll back via the pipeline from Lab 04, write a runbook and a
blameless postmortem, and make the error-budget call — so that when a real incident happens, the
team has rehearsed every step.

## The Other Computer Test

On your machine you know when the app is broken because you just broke it and you're looking at
the terminal. On any other computer — a server running in production, at 3 AM, with a colleague
on call — a broken app is invisible without a runbook that says "here is how you detect it, here
is how you triage it, here is how you roll it back." The incident response capability is the gap
between "the app can fail gracefully in theory" and "we have actually practiced failing gracefully."

## Where the seed leaves it  →  Where production needs it

| Dimension | Before this lab | Product-grade |
|---|---|---|
| Rollback | None — no prior deployment to roll back to | `node deploy/rollback.mjs` finds the last good image and re-tags it |
| Runbook | None | `docs/runbook.md` — DETECT → TRIAGE → MITIGATE → ROLL BACK → COMMUNICATE |
| Postmortem | None | Filled postmortem from `docs/postmortem.template.md` |
| Error budget | Charter defines it; nothing tracks it | `node scripts/error-budget.mjs` reads the deployment ledger and makes a ship/freeze call |
| Incident lifecycle | Never practiced | Game Day drill: inject → detect → roll back → recover; TTR recorded in `reports/incident.json` |

## Why it matters

An incident response plan that has never been exercised is a theory. The game day turns it into a
practice. The blameless postmortem prevents the same failure from happening twice. The error-
budget call connects the incident to the 30-day SLO window — if enough budget was burned, you
freeze feature work and focus on reliability, not because of a rule but because the math says so.

## The principle (public anchor)

> **Google SRE** — Beyer et al. (2016) — Chapters 14 (Managing Incidents), 15 (Postmortem Culture), 5 (Eliminating Toil).
>
> - [sre.google/books/site-reliability-engineering](https://sre.google/books/site-reliability-engineering/) — "Managing Incidents" + "Postmortem Culture"
> - [sre.google/resources/practices-and-processes/postmortem-culture](https://sre.google/resources/practices-and-processes/postmortem-culture/)

## Prerequisites

- Completed Lab 07 · `npm run module:begin 08`
- Docker running and `docker compose up -d` applied (Postgres + LGTM running)
- The API built: `dist/apps/api/main.js` must exist (`npx nx build api` if not)
- At least one successful prod deployment in `deploy/deployments.ndjson` (from Lab 05)

## Walkthrough

This lab is a drill. You play both the role of the system injecting the failure *and* the on-call
engineer detecting and resolving it. Work through the lifecycle in order.

### Phase 1 — Inject the failure

1. Run the game day script:
   ```bash
   node scripts/adversary/gameday-inject.mjs
   ```
   This script drives the full incident lifecycle automatically and writes `reports/incident.json`
   at the end. Read it as it runs — each step is printed with timing.

   What it does:
   - Boots the API with `SLO_BURN_DELAY_MS=150` (simulating a bad deploy that added 150 ms to
     every redirect).
   - Registers a test user, creates a link, samples redirect latency.
   - Confirms p99 > 100 ms (SLO breach detected).
   - Stops the bad API, boots a clean API (no delay), samples again.
   - Confirms p99 < 100 ms (recovery).
   - Records `injected_at`, `detected_at`, `recovered_at`, and `ttr_seconds`.

2. Open Grafana at `http://localhost:3001`. During the injection phase (before the script rolls
   back), watch the "Redirect p99 SLO burn" alert transition from Normal → Pending → Firing.
   This is R10 and R11 working together: R10 detected the breach; R11 records the lifecycle.

### Phase 2 — Understand the rollback path (R07)

3. Review `deploy/rollback.mjs`. It reads `deploy/deployments.ndjson`, finds the most recent
   successful prod deployment before the current one, and re-tags that image as `tracer-api:prod`:
   ```bash
   node deploy/rollback.mjs
   ```
   The game day script performs an equivalent rollback programmatically (it doesn't use
   `rollback.mjs` because the drill runs on ephemeral ports — but the mechanism is identical).

4. After the script completes, run:
   ```bash
   node deploy/rollback.mjs
   ```
   You should see the rollback ledger entry printed. If the deployments ledger is too sparse
   (only one entry), add a dummy entry to simulate a prior successful deploy:
   ```bash
   node deploy/promote.mjs
   ```
   Then run `rollback.mjs` again.

### Phase 3 — Write the runbook

5. Open `docs/runbook.md`. The reference implementation contains the full DETECT → TRIAGE →
   MITIGATE → ROLL BACK → COMMUNICATE → ERROR-BUDGET CALL structure. In `08-start`, this file
   may be a template with placeholders. Fill in the real commands from the reference:
   - DETECT: the Grafana alert + `curl /api/health` + the Prometheus raw metric query.
   - TRIAGE: the five questions (DB responding? Recent deploy? `SLO_BURN_DELAY_MS` set? Errors
     spiking? Latency uniform?).
   - ROLL BACK: `node deploy/rollback.mjs` → `docker compose up -d api` → verify.
   - ERROR-BUDGET CALL: `node scripts/error-budget.mjs`.

### Phase 4 — Write the postmortem

6. Open `docs/postmortem.template.md`. Fill in a postmortem for the game day drill as if it were
   a real incident:
   - **Summary**: what failed, when, impact.
   - **Timeline**: injected_at, detected_at, recovered_at (from `reports/incident.json`).
   - **Root cause**: `SLO_BURN_DELAY_MS` left set in a prod deploy (the simulated cause).
   - **Contributing factors**: no pre-deploy latency canary, no automated rollback trigger.
   - **Action items**: add a latency canary step to CI; automate rollback when p99 > 200 ms for 2
     minutes; add `SLO_BURN_DELAY_MS` to the pre-deploy env audit checklist.
   - **What went well**: OTel alert fired within 2 minutes; rollback restored SLO immediately.

### Phase 5 — Error budget call

7. Run the error budget calculator:
   ```bash
   node scripts/error-budget.mjs
   ```
   Review the output JSON. The `call` field is either `"ship"` (> 20% budget remaining) or
   `"freeze"` (≤ 20%). The drill consumed some budget (simulated via the failed deployment
   entries). Record the call in the postmortem under "Action items."

## Exercise

Modify the game day drill to simulate a *database failure* instead of latency: stop the Postgres
container while the API is running, observe the `/api/health` endpoint return `{"db":"down"}`,
then restart Postgres and confirm recovery. Document the updated DETECT step in `docs/runbook.md`
with the `curl /api/health` check as the first detection signal for DB failures.

## Verify

```bash
npm run readiness:check R11
```

The R11 check asserts:
- `reports/incident.json` exists with `slo_breached: true` and `recovered: true`.
- `ttr_seconds` is present and > 0.
- `docs/runbook.md` exists and contains the key section headers (DETECT, TRIAGE, ROLL BACK).
- `docs/postmortem.template.md` exists.

Green means: the full game day lifecycle ran and produced evidence; the runbook is present.

## Compare

```bash
npm run module:compare 08
```

Key diffs: `docs/runbook.md` (filled), postmortem from the drill, `reports/incident.json`
(produced by the game day script), `reports/error-budget.json`.

## Cheat sheet

| Command | What it does |
|---|---|
| `node scripts/adversary/gameday-inject.mjs` | Run the full incident drill |
| `node deploy/rollback.mjs` | Roll back prod to the previous good image |
| `node scripts/error-budget.mjs` | Compute 30-day error budget (ship/freeze call) |
| `node scripts/dora.mjs` | Print DORA metrics (includes time_to_restore_hours) |
| `tail -5 deploy/deployments.ndjson` | View the last 5 deployment ledger entries |
| `docker compose logs api --tail=30` | API logs during the incident window |

**Gotcha:** The game day script requires `dist/apps/api/main.js`. If you haven't built since Lab
04, run `npx nx build api` first.

**Gotcha:** The game day script runs the API on ephemeral (OS-assigned) ports — it does not
disturb any running `docker compose` API container. The Postgres used by the drill is the
`docker compose` one on port 5433.

**Gotcha:** `rollback.mjs` needs at least two entries in `deploy/deployments.ndjson` (a failed
or current deploy and a prior successful one). The R11 check seeds the ledger if needed.

**Gotcha:** A "blameless postmortem" does not assign blame to individuals. The action items target
system-level changes (automation, monitoring, process) not people. This is the Google SRE
discipline: failure is a property of systems, not engineers.

## Next → [Lab 09](../09-security/README.md)
