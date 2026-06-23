# Troubleshooting

## Docker and Postgres

**Docker is not running.**
`module:begin` and the readiness checks for R04, R06, R09, R10, and R11 all require
Docker. Start Docker Desktop (or your Docker daemon) before running any lab that touches
containers.

**Postgres on `:5433`, not `:5432`.**
The compose file binds Postgres to host port `5433` deliberately, to avoid colliding
with any local Postgres you already have. If your `DATABASE_URL` says `:5432`, change it
to `:5433`.

```bash
npm run db:up           # docker compose up -d postgres
docker compose ps       # confirm it's healthy
docker compose logs postgres --tail=20
```

**Port `:3000` is already in use.**
Another dev server (or a previous `npm run serve:api` that didn't shut down cleanly) is
listening on `:3000`. Find and stop it:
```bash
lsof -i :3000 | grep LISTEN
kill <PID>
```
The API binds to `:3000` by default. The web dev server binds to `:4200`. Grafana
(LGTM) binds to `:3001` (host port — not `:3000`).

**Postgres container exits immediately on `db:up`.**
Check for a volume permission issue:
```bash
docker compose down -v    # remove volume
npm run db:up             # fresh start
```
The migrations run on API boot when `migrationsRun: true` is set (after Lab 02).

## Module harness

**`module:begin` says "Working tree has uncommitted changes."**
Commit or stash first. The clean-tree requirement is what makes `module:reset` a safe,
reversible undo. Even a partially implemented change should be committed conventionally
(`fix: wip` is fine) before switching labs.

**`Tag 'NN-start' does not exist.`**
The tags were lost — usually after a `git fetch` that didn't pull tags, or after
re-cloning without `--tags`:
```bash
git fetch --tags
npm run rebuild-tags   # rebuilds from scripts/modules.manifest.json
```

**`module:compare` shows an unexpectedly large diff.**
The diff covers the whole tree by default (because work spans `apps/` and `libs/`).
Narrow it to the area you changed:
```bash
npm run module:compare 02 apps/api/src
npm run module:compare 03 libs/common-models
```

**`module:reset` says you're on the wrong branch.**
You must be on `my/NN` before resetting. Run `module:begin NN` first (it will switch to
the existing branch without touching your work).

## Readiness checks

**A check reports `• pending`.**
The check script for that delta hasn't been built yet — it will exist only after you
complete the lab that introduces it. This is expected for labs you haven't reached.

**R06 (tests) is slow — 2–5 minutes.**
The integration suite uses `@testcontainers/postgresql`, which pulls `postgres:16-alpine`
on first run (one-time download, ~60 MB). Subsequent runs use the cached image.
Coverage and Stryker mutation both run as part of R06 — together they take 3–5 minutes
on a first run.

**R09 (Terraform) probe workspace fails.**
The R09 check spins up a `probe` Terraform workspace (api=13002, web=14202, db=15434)
and tears it down. Common causes:
- Docker is not running.
- The `infra/main.tf` port variables conflict with something already on those ports.
- A previous failed run left `tracer-probe-*` containers running:
  ```bash
  docker ps --filter name=tracer-probe
  docker rm -f tracer-probe-api tracer-probe-web tracer-probe-db
  terraform -chdir=infra workspace select probe
  terraform -chdir=infra destroy -auto-approve
  terraform -chdir=infra workspace delete probe
  ```

**R10 (observability) fails — LGTM not reachable.**
The check expects Grafana at `http://localhost:3001` and the alert rule to be
provisioned. Start LGTM:
```bash
docker compose up -d     # starts both Postgres and LGTM
docker compose ps        # confirm lgtm is healthy (can take 30–60 s to boot)
curl http://localhost:3001/api/health
```
If provisioning volumes changed (e.g. you added a dashboard after initial boot), restart:
```bash
docker compose restart lgtm
```
The OTel SDK exports metrics on a 3-second interval. Allow a few seconds after starting
the API for data to appear in Grafana.

**R11 (incident) fails — `reports/incident.json` missing.**
Run the game day script from Lab 08:
```bash
node scripts/adversary/gameday-inject.mjs
```
The script requires `dist/apps/api/main.js` to exist. Build first if needed:
```bash
nx build api --configuration=production
```

## `act` (Lab 04)

**First `act` run downloads ~1 GB.**
The `catthehacker/ubuntu:act-latest` runner image is large. After the first pull, use
`--pull=false` to skip the check:
```bash
act push -W .github/workflows/ci.yml \
  -P ubuntu-latest=catthehacker/ubuntu:act-latest \
  --pull=false
```

**`act` on Apple Silicon.**
The runner image requires an explicit architecture flag, otherwise `act` may attempt
to pull an arm64 image that isn't available:
```bash
act push \
  -W .github/workflows/ci.yml \
  -P ubuntu-latest=catthehacker/ubuntu:act-latest \
  --container-architecture linux/amd64
```

**`dist/` is absent inside the runner.**
`dist/` is in `.gitignore`. The pipeline's `build` step produces it — that's correct
behaviour. Don't try to mount `dist/` into the runner.

**`scripts/dora.mjs` fails — no prod entries.**
The DORA metrics script reads `deploy/deployments.ndjson`. It needs at least one entry
with `"env": "prod"`. Add one by running a promotion (`node deploy/promote.mjs`) or
by adding a hand-crafted entry to the ledger.

## Terraform (Labs 05, 06, 10)

**Terraform can't find the Docker socket.**
Docker Desktop on macOS uses a socket at `~/.docker/run/docker.sock`. Set:
```bash
export DOCKER_HOST=unix://$HOME/.docker/run/docker.sock
```

**`terraform apply` fails with "image not found".**
Build the images before applying:
```bash
docker build -f deploy/api.Dockerfile -t tracer-api:dev .
docker build -f deploy/web.Dockerfile -t tracer-web:dev .
```

**Terraform workspace state is stale after a `destroy`.**
State lives in `infra/terraform.tfstate.d/<workspace>/`. If you see phantom resources,
run `terraform apply` to reconcile rather than editing state manually.

## Tests, coverage, and mutation

**Integration tests fail with a connection error.**
The testcontainer spins up its own Postgres on a random port — it does not use the
`:5433` compose Postgres. If it fails, Docker is not running or the pull of
`postgres:16-alpine` timed out. Confirm Docker is healthy and retry.

**Coverage check fails.**
The threshold is set in `vitest.config.ts`. If you're below the floor, either add tests
or (temporarily, to understand the gap) lower the threshold and see which paths are
uncovered in the HTML report at `coverage/index.html`.

**Stryker fails or times out.**
Stryker runs against `libs/common-models`. If it hangs, kill it and run with a single
thread:
```bash
stryker run libs/common-models/stryker.config.mjs --concurrency 1
```

**Playwright E2E fails — `ERR_CONNECTION_REFUSED`.**
The E2E suite requires both the API (`:3000`) and web (`:4200`) to be running. Start
them before running `npm run e2e`:
```bash
npm run db:up
npm run serve:api &
npm run serve:web &
npm run e2e
```

**`npx bddgen` warning after adding Gherkin steps.**
Run `npm run e2e:bdd:gen` (wraps `nx run web-e2e:bdd-gen`) to regenerate the step
glue files after editing `.feature` files.

## Observability

**LGTM internal ports — don't query directly.**
LGTM exposes Loki, Tempo, and Prometheus internally on standard ports (3100, 3200,
9090) but these are **container-internal**. Query them through Grafana's Explore view
at `http://localhost:3001`, not by hitting those ports directly from your host.

**Traces not appearing in Tempo.**
`apps/api/src/tracing.ts` must be the **first import** in `main.ts`, before
`reflect-metadata`. If it appears after, OpenTelemetry auto-instrumentation misses the
NestJS bootstrap. Check `main.ts` import order.

**Alert stays in "Normal" state even after injecting latency.**
The alert evaluation interval is 1 minute. After starting the API with
`SLO_BURN_DELAY_MS=150`, generate traffic for at least 90 seconds and then check the
alert state in Grafana → Alerting → Alert rules.

## Security (Lab 09)

**Adversary scripts still print `VULNERABLE` after implementing the guards.**
Check that:
1. `isSafeTargetUrl` is wired via `.refine(...)` in `link.schema.ts`.
2. The API has been restarted after the change.
3. `ThrottlerModule.forRoot` is configured and `ThrottlerGuard` is registered in
   `APP_GUARD` (before `JwtAuthGuard`).

**`gitleaks` reports a finding on `.env`.**
Add `.env` to `.gitignore` and remove it from git tracking:
```bash
git rm --cached .env
git commit -m "chore: stop tracking .env"
gitleaks detect --source . --log-opts HEAD   # should now be clean
```
`.env.example` (no real secrets) should remain tracked.
