# Lab 04 — Delivery Pipeline   ·   Capability: CI/CD   ·   Manifest: R07   ·   Ring: outer

## What you'll learn

How to wire a delivery pipeline that gates every commit on lint → typecheck → test → build-once,
run it locally with `act` so the pipeline is testable without pushing to GitHub, and emit the
four DORA metrics from the deployment ledger — turning the pipeline from a best-effort script
into a measurable engineering system.

## The Other Computer Test

On your machine you can run `nx run-many -t lint test build` before every push — but you won't
always remember to, and your colleagues won't either. The moment the app runs on a CI server that
*anyone* can push to, a bad commit can break the deployment. The pipeline is the automated
enforcement that turns "we try to keep main green" into "main is always green — the machine
guarantees it."

## Where the seed leaves it  →  Where production needs it

| Dimension | Seed (dev-grade) | Product-grade |
|---|---|---|
| Pipeline | None | `.github/workflows/ci.yml`: lint → typecheck → test → build-once |
| Local execution | Push to GitHub to see results | `act push` runs the full pipeline locally |
| Gating | None | A commit that fails lint/test/build cannot be promoted |
| DORA metrics | None | `scripts/dora.mjs` reads `deploy/deployments.ndjson` and emits all four |

## Why it matters

A pipeline that isn't run locally is a pipeline that is tested in production. `act` closes this
gap: you author the YAML, run it on your laptop, catch the typo in the step name, then push. The
pipeline is now part of the codebase — testable, versioned, reviewable.

DORA metrics (Deployment Frequency, Lead Time, Change Failure Rate, Time to Restore) turn the
pipeline from infrastructure into a measurement instrument. A team that can't answer "how often do
we deploy?" cannot improve its delivery.

## The principle (public anchor)

> **Continuous Delivery** — Jez Humble & David Farley (2010).
> **DORA State of DevOps Report** — annual (2024 edition current).
>
> - [continuousdelivery.com](https://continuousdelivery.com)
> - [dora.dev](https://dora.dev) — the four key metrics
> - [github.com/nektos/act](https://github.com/nektos/act) — run GitHub Actions locally

## Prerequisites

- Completed Lab 03 · `npm run module:begin 04`
- Docker running (act uses Docker to simulate the GitHub Actions runner)
- `act` installed: `brew install act` or see [nektos/act](https://github.com/nektos/act)

## Walkthrough

### Author `.github/workflows/ci.yml`

1. The `04-start` scaffold has an empty `.github/workflows/ci.yml`. Fill in three jobs:

   **`verify`** (the gate):
   ```
   steps: checkout → setup-node (v20) → npm ci → nx lint → nx typecheck → nx test
          → nx build api web --configuration=production
   ```
   Any failing step fails the job. A failing job blocks promotion.

   **`supply-chain`** (R13, wired now, checks added in Lab 09):
   ```
   steps: checkout → setup-node → npm ci → npm run sbom → upload artifact → npm run audit
   ```

   **`dora`** (runs after `verify`):
   ```
   steps: checkout → setup-node → node scripts/dora.mjs
   ```

2. The `build` step produces artifacts in `dist/`. It must use
   `--configuration=production` so the Angular web app tree-shakes properly. This is the artifact
   that `deploy/promote.mjs` will later tag and promote — build once, promote the same artifact.

### Run locally with `act`

3. Run the pipeline locally:
   ```bash
   act push -W .github/workflows/ci.yml \
     -P ubuntu-latest=catthehacker/ubuntu:act-latest
   ```
   The first run pulls the runner image (~1 GB); subsequent runs are fast.

4. Deliberately break a test to confirm the gate works:
   ```bash
   # In any *.spec.ts, add: expect(1).toBe(2);
   act push -W .github/workflows/ci.yml -P ubuntu-latest=catthehacker/ubuntu:act-latest
   # → verify job fails; dora job is skipped
   ```
   Revert the break.

### Emit DORA metrics

5. Run `node deploy/promote.mjs` at least once (see Lab 05 for full promotion; for now, build the
   API image first: `docker build -f deploy/api.Dockerfile -t tracer-api:dev .`).

6. Run `node scripts/dora.mjs`. It reads `deploy/deployments.ndjson` and prints the four metrics
   as JSON. Review the output — `deployment_frequency_per_day`, `lead_time_for_changes_hours`,
   `change_failure_rate`, `time_to_restore_hours`. The values will be small (this is a lab
   environment) but the structure is production-grade.

## Exercise

Add a `name:` to each step in the `verify` job so the GitHub Actions UI shows meaningful step
names rather than the raw command. Then add a `timeout-minutes: 15` to the `verify` job so a
hanging test doesn't consume unlimited runner time. Re-run with `act` to confirm both changes
appear in the output.

## Verify

```bash
# 1. Run the pipeline via act (the primary gate):
act push -W .github/workflows/ci.yml -P ubuntu-latest=catthehacker/ubuntu:act-latest

# 2. Check R07:
npm run readiness:check R07
```

Green means: `act` exits 0 for a clean commit, exits non-zero when a test is broken; `dora.mjs`
emits all four metrics to `reports/dora.json`.

## Compare

```bash
npm run module:compare 04
```

Key diffs: `.github/workflows/ci.yml` (three jobs, correct step order), `package.json` (`dora`,
`sbom`, `audit` scripts).

## Cheat sheet

| Command | What it does |
|---|---|
| `act push -W .github/workflows/ci.yml -P ubuntu-latest=catthehacker/ubuntu:act-latest` | Run the full CI pipeline locally |
| `node scripts/dora.mjs` | Print DORA metrics from `deploy/deployments.ndjson` |
| `npm run sbom` | Generate CycloneDX SBOM to `reports/sbom.json` |
| `npm run audit` | `npm audit --audit-level=critical` (exits non-zero on critical vulns) |

**Gotcha:** The first `act` run downloads the `catthehacker/ubuntu:act-latest` image (~1 GB).
Pass `--pull=false` on subsequent runs to skip the pull check and save 5–10 seconds.

**Gotcha:** `act` mounts the repo as a volume. Files in `.gitignore` (like `dist/`) are not
present inside the runner — `npm ci` and the build run fresh, exactly as in GitHub Actions.

**Gotcha:** `scripts/dora.mjs` requires at least one prod entry in `deploy/deployments.ndjson`.
Run `node deploy/promote.mjs` first, or the script exits with an error.

## Next → [Lab 05](../05-environments/README.md)
