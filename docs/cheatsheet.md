# Cheat sheet

## Key ports

| Service | Host port | Notes |
|---|---|---|
| NestJS API | `:3000` | `npm run serve:api` |
| Angular web | `:4200` | `npm run serve:web` |
| Postgres | `:5433` | Not `:5432` — avoids clash with local Postgres |
| Grafana (LGTM) | `:3001` | `http://localhost:3001` · user: `admin` / `admin` |
| OTLP HTTP | `:4318` | OTel exporter target |
| Terraform dev (api) | `:13000` | |
| Terraform dev (web) | `:14200` | |
| Terraform dev (db) | `:15432` | |
| Terraform prod (api) | `:13001` (offset by 1) | Varies by `var.env_ports` |

## Setup and baseline

```bash
nvm use                        # Node 20 (.nvmrc)
npm install
npm run verify                 # typecheck + lint + test + build — must be green before Lab 01
```

## Start the app (dev)

```bash
npm run db:up                  # docker compose up -d postgres  →  :5433
npm run serve:api              # nx serve api  →  http://localhost:3000
npm run serve:web              # nx serve web  →  http://localhost:4200
npm start                      # both in parallel
```

## Module workflow

```bash
npm run module:begin NN        # checkout NN-start, create branch my/NN (clean tree required)
npm run module:compare NN      # git diff NN-complete (whole tree)
npm run module:compare NN apps/api/src   # scope diff to a path
npm run module:reset NN        # hard-reset my/NN back to NN-start
npm run module:status          # branch · nearest tag · clean/dirty
npm run rebuild-tags           # rebuild tags from scripts/modules.manifest.json
```

## Readiness checks

```bash
npm run readiness              # full PRR — all 14 deltas, exit 1 if any not green
npm run readiness:status       # same table, always exit 0 (informational)
npm run readiness:check R01    # check one delta
npm run readiness:check R02 R03 R04 R05  # check multiple deltas
```

## Lab → delta → verify

| Lab | Deltas | Verify command |
|---|---|---|
| 01 Readiness Charter | R01 | `npm run readiness:check R01` |
| 02 Twelve-Factor | R02 R03 R04 R05 | `npm run readiness:check R02 R03 R04 R05` |
| 03 Test Outer Ring | R06 | `npm run readiness:check R06` |
| 04 Delivery Pipeline | R07 | `npm run readiness:check R07` |
| 05 Environments | R08 | `npm run readiness:check R08` |
| 06 Infrastructure as Code | R09 | `npm run readiness:check R09` |
| 07 Observability | R10 | `npm run readiness:check R10` |
| 08 Incident Response | R11 | `npm run readiness:check R11` |
| 09 Security | R12 R13 | `npm run readiness:check R12 R13` |
| 10 PRR | R14 | `npm run readiness` |

## Tests

```bash
npm run test                   # nx run-many -t test  (unit + integration)
npm run typecheck              # nx run-many -t typecheck
npm run lint                   # nx run-many -t lint
npm run e2e                    # nx e2e web-e2e  (Playwright, all projects)
npm run e2e:bdd                # Playwright BDD suite only
npm run e2e:smoke              # smoke suite only
npm run mutation               # Stryker on libs/common-models
```

## Migrations

```bash
npm run migration:run          # apply pending migrations
npm run migration:generate -- --name AddFeatureFlags   # generate from entity diff
npm run migration:revert       # roll back last migration
```

## Security + supply chain

```bash
npm run sbom                   # CycloneDX SBOM → reports/sbom.json
npm run audit                  # npm audit --omit=dev --audit-level=critical
gitleaks detect --source . --log-opts HEAD   # scan git history for secrets
node scripts/adversary/open-redirect-poc.mjs # confirm open-redirect hardening
node scripts/adversary/ssrf-poc.mjs          # confirm SSRF hardening
node scripts/adversary/ratelimit-poc.mjs     # confirm rate-limit configuration
```

## CI — run locally with `act`

```bash
act push \
  -W .github/workflows/ci.yml \
  -P ubuntu-latest=catthehacker/ubuntu:act-latest
```

On Apple Silicon add `--container-architecture linux/amd64`.

## Terraform (Labs 05, 06, 10)

```bash
terraform -chdir=infra init
terraform -chdir=infra workspace list
terraform -chdir=infra workspace select -or-create dev
terraform -chdir=infra apply -auto-approve
terraform -chdir=infra plan              # drift detection
terraform -chdir=infra destroy -auto-approve
```

Set `DOCKER_HOST` if Terraform can't find the Docker socket:
```bash
export DOCKER_HOST=unix://$HOME/.docker/run/docker.sock
```

## Environments + deployment (Lab 05+)

```bash
docker build -f deploy/api.Dockerfile -t tracer-api:dev .
docker build -f deploy/web.Dockerfile -t tracer-web:dev .
node deploy/promote.mjs                                   # re-tag tracer-api:dev → tracer-api:prod
node deploy/feature-flag.mjs link_title_preview on        # toggle feature flag (no redeploy)
node deploy/rollback.mjs                                  # re-tag last good prod image
```

## Observability (Lab 07+)

```bash
docker compose up -d           # Postgres :5433 + LGTM (Grafana :3001, OTLP :4318)
docker compose ps
docker compose logs lgtm --tail=20
SLO_BURN_DELAY_MS=150 npm run serve:api   # inject latency to fire the SLO burn alert
```

## Incident + error budget (Lab 08)

```bash
node scripts/adversary/gameday-inject.mjs   # run full incident drill
node deploy/rollback.mjs                    # roll back prod to previous good image
node scripts/error-budget.mjs               # compute 30-day error budget + ship/freeze call
node scripts/dora.mjs                       # print DORA four metrics
tail -5 deploy/deployments.ndjson           # recent deployment ledger entries
```

## Key file locations

| Capability | Where |
|---|---|
| Readiness manifest | `scripts/readiness.manifest.json` |
| Readiness check scripts | `scripts/readiness/checks/r01.mjs` … `r14.mjs` |
| Module harness | `scripts/module.mjs` |
| Charter | `docs/charter.md` |
| SLO | `docs/slo.md` |
| Runbook | `docs/runbook.md` |
| Postmortem template | `docs/postmortem.template.md` |
| ASVS checklist | `docs/asvs-checklist.md` |
| Migrations | `apps/api/src/database/migrations/` |
| TypeORM data source | `apps/api/src/database/data-source.ts` |
| OTel bootstrap | `apps/api/src/tracing.ts` |
| URL safety (SSRF guard) | `libs/common-models/src/lib/url-safety.ts` |
| Adversary scripts | `scripts/adversary/` |
| Deployment ledger | `deploy/deployments.ndjson` |
| Terraform config | `infra/main.tf` |
| Dockerfiles | `deploy/api.Dockerfile`, `deploy/web.Dockerfile` |
| Grafana dashboard | `deploy/observability/dashboards/tracer.json` |
| SBOM output | `reports/sbom.json` |
| Incident report | `reports/incident.json` |
