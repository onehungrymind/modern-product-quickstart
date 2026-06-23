# Lab 10 — Production Readiness Review   ·   Capability: Readiness gate   ·   Manifest: R14   ·   Ring: outer

## What you'll learn

How to run the full Production Readiness Review — walking every delta from R01 to R13, confirming
each is at product-grade, and witnessing the moment `npm run readiness` turns all-green. Lab 10 is
not where new code is written; it is where the whole course resolves into a single, repeatable,
machine-checkable gate.

## The Other Computer Test

Every earlier lab answered "is *this* capability outer-ring ready?" Lab 10 asks the harder
question: "is the *system* outer-ring ready?" A system that passes 12 of 14 checks is not
production-ready — it has two known gaps. The PRR gate is the binary that matters: `npm run
readiness` exits 0 or it does not. This is the same gate a new engineer, a security auditor, or
an on-call rotation would use to answer "can I trust this system with production traffic?"

## Where the seed leaves it  →  Where production needs it

| Dimension | Seed | Lab 10 (`10-complete` = `reference-complete`) |
|---|---|---|
| Readiness gate | Absent — no way to know if the app is production-ready | `npm run readiness` — 14 checks, exit 0 = all-green PRR |
| Delta inventory | R01 (authored in Lab 01) | R01–R14 all passing |
| Observable | No | SLIs emitted, dashboard live, alert provisioned |
| Tested | Inner ring only | Integration + E2E + coverage + mutation (R06) |
| Secured | Inner ring (Zod, JWT) | SSRF + redirect guard + rate limit + SBOM + dep-scan (R12, R13) |
| Incident-proven | Never practiced | Game day run, runbook written, postmortem filed (R11) |

## Why it matters

The PRR is a structural forcing function, not a checklist of opinions. Every item on the manifest
was defined in Lab 01 (`docs/charter.md`) and built by the subsequent labs. Running the PRR now
is the proof that the charter's promises were kept. It is also the artifact you hand to a new
team member, a customer, or a compliance officer — a program that runs and exits 0 is more
convincing than a document that claims 0.

## The principle (public anchor)

> **Google SRE** — Production Readiness Review (Chapter 32) + **AWS Well-Architected Framework**
> (all five pillars).
>
> - [sre.google/books/site-reliability-engineering](https://sre.google/books/site-reliability-engineering/) — Chapter 32, "The Production Readiness Review"
> - [docs.aws.amazon.com/wellarchitected/latest/framework](https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html)
> - [sre.google/workbook/implementing-slos](https://sre.google/workbook/implementing-slos/)

## Prerequisites

- Completed Lab 09 · `npm run module:begin 10`
- Docker running
- `docker compose up -d` running (Postgres + LGTM)
- Terraform dev workspace applied (`terraform -chdir=infra workspace select dev && terraform
  -chdir=infra apply -auto-approve`)
- The game day drill has been run (`reports/incident.json` exists from Lab 08)

## Walkthrough

### Step 1 — Run the status view

```bash
npm run readiness:status
```

This prints the full manifest table with the current grade of each delta (green / not-yet /
pending). Work through any `not-yet` items before running the full gate.

### Step 2 — Triage any remaining failures

For each non-green delta, the status output prints the failure reason. Common issues at this stage:

| Delta | Common cause | Fix |
|---|---|---|
| R01 | `docs/charter.md` missing a keyword | Re-check the SLO targets (100 ms, 99.9%) and workflow names |
| R04 | `synchronize: true` still in `data-source.ts` | Set `synchronize: false` |
| R06 | Coverage below the floor | Add tests, or review the floor in `vitest.config.ts` |
| R07 | `act` not installed, or `ci.yml` missing a job | Install `act`; check `npm run readiness:check R07` output |
| R08 | No entry in `deploy/deployments.ndjson` | Run `node deploy/promote.mjs` |
| R09 | Terraform probe workspace failed | Check `infra/main.tf` for port conflicts; confirm Docker is running |
| R10 | LGTM not running | `docker compose up -d lgtm` |
| R11 | `reports/incident.json` missing | Run `node scripts/adversary/gameday-inject.mjs` |
| R12 | Adversary scripts still succeed | Re-check `url-safety.ts` and `app.module.ts` throttler wiring |
| R13 | `reports/sbom.json` missing | Run `npm run sbom` |

### Step 3 — Check deltas individually if needed

```bash
npm run readiness:check R01    # Charter
npm run readiness:check R02 R03 R04 R05   # Twelve-factor
npm run readiness:check R06    # Test outer ring
npm run readiness:check R07    # Delivery pipeline
npm run readiness:check R08    # Environments
npm run readiness:check R09    # Infrastructure
npm run readiness:check R10    # Observability
npm run readiness:check R11    # Incident response
npm run readiness:check R12 R13   # Security + supply chain
```

Each command is the verify gate from the corresponding lab — you have already run these. If one
fails now, the problem is in the same place it was during that lab.

### Step 4 — Run the full PRR

```bash
npm run readiness
```

This runs all 14 checks in sequence. The output is a table of `✓ product-grade` / `✗ not yet` /
`• pending` badges. All 14 must be green for the gate to pass (exit 0).

Read the final line:

```
14 product-grade · 0 not yet · 0 pending
```

This is the Production Readiness Review passing. Tracer is a product.

### Step 5 — Run it twice

Run `npm run readiness` a second time. If it was green the first time, it must be green again
— the checks must be idempotent (no side effects that break on re-run). If a check fails on
the second run, it has a hidden side effect; find and fix it before signing off.

### Step 6 — Reflect on the arc

Take 10 minutes to walk the arc from Lab 01 to Lab 10:

- **Lab 01**: Named the target. The charter is the promise; Lab 10 is the proof.
- **Labs 02–05**: Made the app runnable on any computer (twelve-factor) and testable,
  deliverable, and promotable (pipeline + environments).
- **Lab 06**: Made the infrastructure trustworthy as code.
- **Lab 07**: Made the running system observable.
- **Lab 08**: Made the team capable of handling failure.
- **Lab 09**: Made the attack surface defensible.
- **Lab 10**: Verified the whole.

The inner ring (code quality, lib boundaries, Zod schemas, basic tests) was there from the seed.
The outer ring is what this course built. The two rings together is what "production-ready" means.

## Exercise

Pick the one delta you found hardest to get to product-grade and write a one-paragraph
retrospective: what was the hardest part? What would you do differently next time? What would you
automate further? This is not checked — it is the postmortem for your own learning. Keep it in
`docs/retro-lab10.md` (not committed, just for yourself).

## Verify

```bash
npm run readiness
```

Exit 0 with 14 `✓ product-grade` badges is the only acceptable result.

```bash
# Second run (idempotency check):
npm run readiness
```

Both runs must exit 0.

## Compare

```bash
npm run module:compare 10
```

At `10-complete`, the tree is identical to `reference-complete`. The diff should be empty (or
show only files you chose to add during the exercises). If there are unexplained diffs, review
them against the reference before treating the PRR as signed off.

## Cheat sheet

| Command | What it does |
|---|---|
| `npm run readiness` | Full PRR — all R01–R14 checks, exits 0 if all green |
| `npm run readiness:status` | Same table, always exits 0 (informational) |
| `npm run readiness:check R0x` | Run one or more delta checks |
| `npm run module:compare 10` | Diff your tree against the answer key |
| `docker compose up -d` | Start Postgres + LGTM (needed for R04, R05, R10) |
| `terraform -chdir=infra apply -auto-approve` | Stand up the dev environment (needed for R09) |

**The full PRR pre-flight checklist:**
- [ ] `docker compose up -d` → both services healthy
- [ ] `terraform -chdir=infra workspace select dev && terraform -chdir=infra apply` → applied
- [ ] `dist/apps/api/main.js` exists (run `npx nx build api` if not)
- [ ] `deploy/deployments.ndjson` has at least one prod entry (run `node deploy/promote.mjs`)
- [ ] `reports/incident.json` exists (run `node scripts/adversary/gameday-inject.mjs`)
- [ ] `reports/sbom.json` exists (run `npm run sbom`)

**Gotcha:** The R09 check creates and destroys a `probe` Terraform workspace. If a previous probe
run left orphaned containers (`tracer-probe-*`), run `terraform -chdir=infra workspace select
probe && terraform -chdir=infra destroy -auto-approve` to clean up.

**Gotcha:** R10 checks that the Grafana alerting API can see the "Redirect p99 SLO burn" alert
rule. If the LGTM container was restarted after the provisioning volumes changed, the alert rule
may not be loaded — restart the container: `docker compose restart lgtm`.

**Gotcha:** The readiness runner has a 15-minute timeout per check (`timeout: 15 * 60 * 1000` in
`scripts/readiness.mjs`). Checks that spin up containers (R09) or run the full test suite (R06)
can take 2–5 minutes. This is expected.

---

Congratulations — `npm run readiness` all-green means Tracer has crossed from project to product.
