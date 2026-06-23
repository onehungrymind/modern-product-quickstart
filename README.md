# modern-production-quickstart — Tracer

> **Volume I — Production** of the *Project to Product Playbook*, made executable. Take **Tracer**, a
> link shortener built to inner-ring best practice, and promote it across the **outer ring** —
> containers, CI/CD, environments, IaC, observability, incident response, security — one lab at a time,
> diffing your work against a canonical answer key. Sibling to
> [`modern-coding-quickstart`](../modern-coding-quickstart) and
> [`modern-e2e-quickstart`](../modern-e2e-quickstart).

New here? Start with [`docs/intro.md`](./docs/intro.md). The Readiness Manifest (the outer-ring deltas
R01–R14 the labs promote to product-grade) lives in [`scripts/readiness.manifest.json`](./scripts/readiness.manifest.json);
the full build plan and design rationale are in [`_internal/`](./_internal) (`MODERN-PRODUCTION-PLAN.md`,
`LAB-DESIGN.md`).

## Tracer, the app

A link shortener with click analytics:

- **Create** — `POST /api/links` mints a unique slug for a target URL.
- **Resolve** — `GET /:slug` (root, the hot path) 302-redirects and records a `Click`.
- **Analytics** — `GET /api/links/:id/clicks` feeds the detail view.

Three thin entities (`User`, `Link`, `Click`); no state machine (a link is active until `expires_at`
passes). An Nx monorepo: separated **Angular** web (zoneless, NgRx `links` feature) + **NestJS** API
(TypeORM/Postgres, JWT, Zod-first contracts in `@tracer/common-models`).

## The `seed` tag — where you start

`seed` is the honest CLI-standard app: **inner ring done well, outer ring dev-grade or absent**. It runs
and is well-built — it simply isn't a product yet. Deliberately dev-grade at the seed (the labs harden
these): `synchronize: true` (no migrations), Nest default logger, `.env` committed with defaults,
`@nestjs/throttler` installed but unconfigured, no CI/IaC/observability.

## Prerequisites

- **Node 20** (`.nvmrc`) and npm
- **Docker** — for local Postgres (and, in later labs, the observability stack, Terraform, `act`)

## Run it

```bash
npm install
npm run db:up                 # Postgres on localhost:5433 (host 5432 is often taken)
npm run serve:api             # NestJS on :3000 (synchronize:true auto-creates tables)
npm run serve:web             # Angular on :4200 (proxies /api → :3000)
# open http://localhost:4200
```

## Verify

```bash
npm run verify                # typecheck + lint + test + build across all projects
```

## Workshop

Each lab promotes one outer-ring capability. Use the tag harness:

```bash
npm run module:begin NN       # check out lab NN's starting point on a my/NN branch
npm run module:compare NN     # diff your work against the canonical NN-complete
```

_License: MIT._
