# Lab 05 — Environments   ·   Capability: Environments   ·   Manifest: R08   ·   Ring: outer

## What you'll learn

How to stand up dev and prod environments with parity using Terraform workspaces and the Docker
provider, promote the *same* built image from dev to prod (build-once, promote-the-artifact), and
decouple deploy from release with a DB-backed feature flag — so you can ship code to production
without exposing an unfinished feature to users.

## The Other Computer Test

On your machine, "dev" and "prod" are the same computer — there is no parity problem because
there is only one environment. The moment you have a staging server and a production server (or
even two `docker compose` stacks), the question "are they running the same thing?" becomes real.
Build-once-promote is the answer: the artifact that passed CI is the artifact that goes to
production, re-tagged but never rebuilt.

## Where the seed leaves it  →  Where production needs it

| Dimension | Seed (dev-grade) | Product-grade |
|---|---|---|
| Environments | One local environment (`docker compose`) | dev + prod Terraform workspaces, identical topology |
| Image management | No Dockerfiles | Multi-stage `deploy/api.Dockerfile` + `deploy/web.Dockerfile` |
| Promotion | None — rebuild for every deployment | `node deploy/promote.mjs` re-tags the exact dev image as prod |
| Deploy vs release | Coupled | `node deploy/feature-flag.mjs link_title_preview on/off` toggles at runtime, no redeploy |

## Why it matters

Environment parity is the single biggest source of "works on staging, broken in prod" bugs. If
staging is rebuilt from source on every deploy and prod is not, or if they use different base
images, a class of bugs is invisible until production. Terraform workspaces enforce identical
topology; build-once-promote enforces identical artifacts.

Feature flags decouple the *deployment* decision (when to ship the code) from the *release*
decision (when to show the feature to users). This is the trunk-based development discipline in
miniature: merge when the code is correct, release when the product is ready.

## The principle (public anchor)

> **GitOps** (Weaveworks, 2017) + **Trunk-Based Development** (Hammant/Farley).
>
> - [gitops.tech](https://www.gitops.tech)
> - [trunkbaseddevelopment.com](https://trunkbaseddevelopment.com)
> - [developer.hashicorp.com/terraform/cli/workspaces](https://developer.hashicorp.com/terraform/cli/workspaces)

## Prerequisites

- Completed Lab 04 · `npm run module:begin 05`
- Docker running
- Terraform ≥ 1.6 installed: `brew install terraform` or [developer.hashicorp.com/terraform/install](https://developer.hashicorp.com/terraform/install)

## Walkthrough

### Build the container images

1. Build the API image (multi-stage — runs typecheck + webpack bundle + installs only prod deps):
   ```bash
   docker build -f deploy/api.Dockerfile -t tracer-api:dev .
   ```
   Review `deploy/api.Dockerfile`: the `builder` stage runs `nx typecheck api && nx build api`;
   the `runtime` stage copies only `dist/apps/api/` and installs externalized `node_modules`.
   The image self-migrates on boot (`migrationsRun: true`).

2. Build the web image (nginx serves the Angular static bundle):
   ```bash
   docker build -f deploy/web.Dockerfile -t tracer-web:dev .
   ```
   Review `deploy/nginx.conf` — it proxies `/api` to the `api` container and serves `index.html`
   for all other paths (Angular's HTML5 routing).

### Stand up the dev environment with Terraform

3. Inspect `infra/main.tf`. It uses the `kreuzwerker/docker` provider to declare three
   containers: `db` (postgres:16-alpine), `api` (tracer-api:dev), `web` (tracer-web:dev) on a
   dedicated Docker network. Port assignments are workspace-keyed (`var.env_ports`): dev gets
   `api=13000, web=14200, db=15432`.

4. Initialize and apply the dev workspace:
   ```bash
   terraform -chdir=infra init
   terraform -chdir=infra workspace select -or-create dev
   terraform -chdir=infra apply -auto-approve
   ```
   Visit `http://localhost:14200` — the Tracer UI served from the container. The API health
   check: `curl http://localhost:13000/api/health`.

### Promote the image dev → prod

5. Create the prod workspace and promote:
   ```bash
   terraform -chdir=infra workspace select -or-create prod
   node deploy/promote.mjs tracer-api:dev
   # Output: ✓ tracer-api:prod is the SAME image (sha256:…) — promoted, not rebuilt.
   ```
   `promote.mjs` re-tags `tracer-api:dev` as `tracer-api:prod` using `docker tag`, verifies the
   digest is identical, and appends a line to `deploy/deployments.ndjson` (feeds DORA in Lab 04).

6. Apply the prod workspace (uses `tracer-api:prod` and `tracer-web:dev`):
   ```bash
   terraform -chdir=infra apply -var="api_image=tracer-api:prod" -auto-approve
   ```
   Confirm the prod API: `curl http://localhost:13001/api/health`.

### Feature flag (deploy ≠ release)

7. The `link_title_preview` feature flag is seeded in the `feature_flags` table by the
   `AddFeatureFlags` migration. Toggle it at runtime:
   ```bash
   # Against the dev DB (port 15432):
   DATABASE_URL=postgres://tracer:tracer@localhost:15432/tracer \
     node deploy/feature-flag.mjs link_title_preview on
   ```
   Create a new link — if the flag is on, the API fetches the title from the target URL via
   `HttpUrlPreviewProvider`. Toggle it off — the title field is omitted. No redeploy required.

## Exercise

Check the dev and prod containers are running identical images:
```bash
docker inspect tracer-dev-api --format '{{.Image}}'
docker inspect tracer-prod-api --format '{{.Image}}'
```
The digests must match. If they differ, a rebuild happened somewhere — find it and fix it.

## Verify

```bash
npm run readiness:check R08
```

Green means:
- `deploy/promote.mjs` exits 0 and the promoted image digest matches the source.
- `deploy/feature-flag.mjs link_title_preview on` exits 0 without restarting any container.
- `deploy/deployments.ndjson` contains at least one prod deployment entry.

## Compare

```bash
npm run module:compare 05
```

Key diffs: `deploy/api.Dockerfile`, `deploy/web.Dockerfile`, `deploy/nginx.conf`, `infra/main.tf`
(workspaces, `env_ports`, container declarations), `deploy/promote.mjs`, `deploy/feature-flag.mjs`.

## Cheat sheet

| Command | What it does |
|---|---|
| `terraform -chdir=infra workspace list` | Show available workspaces |
| `terraform -chdir=infra workspace select dev` | Switch to dev workspace |
| `terraform -chdir=infra apply -auto-approve` | Apply the current workspace |
| `terraform -chdir=infra destroy -auto-approve` | Tear down the current workspace |
| `node deploy/promote.mjs` | Re-tag tracer-api:dev as tracer-api:prod (no rebuild) |
| `node deploy/feature-flag.mjs <key> <on\|off>` | Toggle a feature flag in the DB |

**Gotcha:** Terraform workspace state is stored in `infra/terraform.tfstate.d/`. Each workspace
gets its own state file. If you `destroy` the dev workspace, the prod state is untouched.

**Gotcha:** `promote.mjs` verifies the digest before and after `docker tag`. If they differ (which
should never happen with `docker tag`), it exits non-zero. This is the build-once guarantee.

**Gotcha:** Feature flags read from the DB on every request — there is no cache invalidation to
worry about. The flag takes effect within the next request cycle (~5 s) after the DB row is
updated.

## Next → [Lab 06](../06-infrastructure-as-code/README.md)
