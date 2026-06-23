# Lab 06 — Infrastructure as Code   ·   Capability: Infrastructure   ·   Manifest: R09   ·   Ring: outer

## What you'll learn

How to make the infrastructure that Lab 05 stood up *trustworthy as code*: reproducible
(`terraform destroy && apply` rebuilds it bit-for-bit) and drift-detected (a manual `docker`
change made outside Terraform is flagged by `terraform plan`). The difference between having
Terraform files and practicing IaC is this discipline.

## The Other Computer Test

On your machine you know what state the infrastructure is in because you made every change. On any
other computer — a colleague's laptop, a second server, a disaster-recovery environment — the only
source of truth is the declared state in code. If the running infrastructure has diverged from
that code, you have an undetected bug waiting to surface. Drift detection closes this gap.

## Where the seed leaves it  →  Where production needs it

| Dimension | Lab 05 (infra exists) | Lab 06 product-grade |
|---|---|---|
| Reproducibility | Infra was applied once; unclear if it can be rebuilt | `destroy` + `apply` reproduces the environment identically from the `infra/` directory alone |
| Drift | Undetected — any `docker` command can modify state | `terraform plan` reports any deviation as a change, even if Terraform didn't make it |
| Immutability | Containers are mutable (you could `docker exec` and change files) | Terraform declares the entire desired state; any out-of-band change is an anomaly |
| Source of truth | The running containers | `infra/main.tf` — the running containers must match it |

## Why it matters

Terraform files that have never been destroyed-and-recreated are untested. The first time the
reproduction matters is during an incident — exactly when you have no time to discover that
`terraform apply` doesn't work from scratch because someone manually added a network alias two
weeks ago.

Drift detection is the IaC equivalent of a type checker: it turns "I think the infra matches the
code" into "the infra matches the code, or the plan tells me what differs."

## The principle (public anchor)

> **Infrastructure as Code** — Kief Morris (2nd ed., 2021, O'Reilly).
>
> - [infrastructure-as-code.com](https://infrastructure-as-code.com) — Kief Morris's companion site
> - [developer.hashicorp.com/terraform/docs](https://developer.hashicorp.com/terraform/docs)
> - IaC principles: declarative over imperative; immutable over mutable; source of truth in version control

## Prerequisites

- Completed Lab 05 · `npm run module:begin 06`
- Docker running
- Terraform ≥ 1.6 installed
- Both workspaces applied from Lab 05 (`dev` and `prod` containers running)

## Walkthrough

### Prove reproducibility

1. With the dev environment applied, destroy it completely:
   ```bash
   terraform -chdir=infra workspace select dev
   terraform -chdir=infra destroy -auto-approve
   ```
   All three containers (`tracer-dev-db`, `tracer-dev-api`, `tracer-dev-web`) and the network
   (`tracer-dev-net`) should be removed. Confirm: `docker ps --filter name=tracer-dev`.

2. Re-apply from scratch:
   ```bash
   terraform -chdir=infra apply -auto-approve
   ```
   The containers come back. The API self-migrates (`migrationsRun: true`) — no separate
   migration step needed. Confirm: `curl http://localhost:13000/api/health`.

3. Create a link via the UI, destroy again, re-apply, confirm the link is gone. This proves the
   infrastructure is *stateless* (data lives in the Postgres volume, but the volume is managed by
   Terraform too — `docker_volume.postgres_data`). If you need data persistence across destroy-
   apply cycles, the volume must be declared separately and not destroyed with the stack.

### Inject drift and detect it

4. While the dev environment is running, make a manual change outside Terraform:
   ```bash
   docker rename tracer-dev-api tracer-dev-api-renamed
   ```
   (Or add an environment variable to the running container, or change a port mapping.)

5. Run `terraform plan`:
   ```bash
   terraform -chdir=infra workspace select dev
   terraform -chdir=infra plan
   ```
   Terraform compares the declared state in `infra/main.tf` against the running Docker state and
   reports the drift. The output should show a resource that needs to be replaced or updated.

6. Revert the drift manually (`docker rename tracer-dev-api-renamed tracer-dev-api`) or by
   running `terraform apply` to let Terraform restore the declared state.

### Understand what makes `main.tf` idempotent

7. Review `infra/main.tf`:
   - `local.env` is derived from the workspace name — no per-environment branches, one
     declaration serves both workspaces.
   - `var.env_ports` maps workspace → port assignments, so dev and prod never collide on the host.
   - `restart = "on-failure"` + `max_retry_count = 10` on the API container handles the DB warmup
     race without a separate health-gate step.
   - `keep_locally = true` on image resources means `destroy` doesn't delete local Docker images
     — only the containers are removed.

## Exercise

Add a `docker_volume` resource to `infra/main.tf` for the Postgres data volume, so the volume
is declared in Terraform state. Then destroy and re-apply: the data volume should be recreated
by Terraform but be empty (demonstrating that declared state ≠ persistent data without additional
backup tooling). Document this finding in a comment in `main.tf`.

## Verify

```bash
npm run readiness:check R09
```

The R09 check:
1. Applies the `probe` workspace (`env_ports.probe`: api=13002, web=14202, db=15434).
2. Verifies the API health endpoint at `http://localhost:13002/api/health` returns `{"status":"ok"}`.
3. Destroys the `probe` workspace.
4. Passes if both apply and destroy succeed without error.

Green means: `infra/main.tf` can stand up a fresh environment from zero and tear it down cleanly.

## Compare

```bash
npm run module:compare 06
```

This lab's diff is intentionally small — the `infra/main.tf` from Lab 05 is already correct. The
work is in the *practice* (destroy + apply, drift detection), not the file content. The diff shows
any comments or annotations you added.

## Cheat sheet

| Command | What it does |
|---|---|
| `terraform -chdir=infra workspace select dev` | Switch to dev workspace |
| `terraform -chdir=infra plan` | Show what would change (drift detection) |
| `terraform -chdir=infra apply -auto-approve` | Apply declared state |
| `terraform -chdir=infra destroy -auto-approve` | Remove all resources in this workspace |
| `terraform -chdir=infra workspace list` | List workspaces |
| `docker ps --filter name=tracer` | See running Tracer containers |

**Gotcha:** `terraform destroy` removes the containers but *not* named Docker volumes declared
outside Terraform's state (e.g. the `postgres_data` volume in `docker-compose.yml`). Terraform
only manages resources it declared. If you want data to survive `destroy`, declare the volume as a
`docker_volume` resource and do not include it in the `docker_container` `volumes` destroy scope.

**Gotcha:** Drift detection works because the `kreuzwerker/docker` provider reads live Docker API
state on every `plan`. It does not poll continuously — you must run `plan` to detect drift.

**Gotcha:** If `terraform state` shows a container as "tainted" (previous apply partially failed),
run `terraform apply` to clean it up before running `destroy`.

## Next → [Lab 07](../07-observability/README.md)
