# Introduction — modern-production-quickstart (Tracer)

> **Volume I — Production** of the *Project to Product Playbook*, made executable.
> Take **Tracer**, a link shortener built to inner-ring best practice, and promote it
> across the **outer ring** — one lab at a time, diffing your work against a canonical
> answer key.

## What this workshop is

Software that works on your machine is a project. Software that works on **any other
computer** — a colleague's laptop, a CI runner, a production container, a load-testing
rig — is a **product**. That gap is the outer ring.

The **Other Computer Test** is the litmus: *can a stranger stand up and operate this
system without you in the room?* Every lab is structured around that question.

The app starts at the `seed` tag: inner ring done well (Zod contracts, JWT auth, NgRx
state, TypeORM entities, clean architecture). The outer ring is dev-grade or absent —
no migrations, no CI, no observability, secrets in `.env`, `synchronize: true`. The
`seed` runs fine. It just isn't a product yet.

Ten labs promote it across 14 outer-ring capability deltas (R01–R14). When all 14 are
green, `npm run readiness` exits 0 and Tracer has passed its Production Readiness Review.

## Who this is for

Engineers who want a hands-on answer to: *what specifically does it mean to take a
well-built app to production?* No cloud account is needed. Everything runs on your local
machine with Docker. The workshop is tool-fluent (NestJS, Angular, Terraform, Docker,
Playwright, Stryker, OpenTelemetry) but does not assume prior knowledge of any one tool —
each lab introduces what it uses.

## The reference app — Tracer

A link shortener with click analytics:

| Endpoint | What it does |
|---|---|
| `POST /api/links` | Create — mints a unique slug for a target URL |
| `GET /:slug` | Resolve — 302-redirects and records a `Click` (the hot path) |
| `GET /api/links/:id/clicks` | Analytics — feeds the detail view |

Three entities (`User`, `Link`, `Click`). An Nx monorepo: **Angular** web (zoneless,
NgRx `links` feature) + **NestJS** API (TypeORM/Postgres, JWT, Zod-first contracts in
`@tracer/common-models`), plus three shared libs (`common-models`, `common-testing`,
`common-ui`).

The SLO for the redirect hot path: **p99 < 100 ms; availability 99.9%** (30-day window,
43.2-minute error budget). These numbers appear in the charter (Lab 01) and are
machine-checked throughout (R10, R11).

## The 14 deltas → 10 labs

| Lab | Deltas | Capability |
|---|---|---|
| 01 Readiness Charter | R01 | Definition of done — SLOs, critical workflows, delta inventory |
| 02 Twelve-Factor | R02 R03 R04 R05 | Config · Secrets · Persistence · Logs |
| 03 Test Outer Ring | R06 | Integration + E2E + coverage floor + mutation |
| 04 Delivery Pipeline | R07 | CI gate (lint → test → build), `act`, DORA |
| 05 Environments | R08 | dev + prod parity, build-once-promote, feature flags |
| 06 Infrastructure as Code | R09 | Declarative IaC, immutable, drift-detected |
| 07 Observability | R10 | OTel logs + metrics + traces, SLI dashboard, SLO alert |
| 08 Incident Response | R11 | Rollback, runbook, postmortem, error-budget call |
| 09 Security | R12 R13 | App security (SSRF/open-redirect/rate-limit) + supply chain (SBOM) |
| 10 Production Readiness Review | R14 | Full PRR all-green |

## How the tag and lab model works

The repository has a linear tagged history:

```
seed → 01-start → 01-complete → 02-start → 02-complete → … → 10-complete
```

Each lab is a pair of tags. `NN-start` gives you the module README and the tree in its
"before" state. `NN-complete` is the canonical answer. You work on a personal branch
(`my/NN`), implement the delta, verify with `npm run readiness:check R0x`, then compare
against the answer key with `npm run module:compare NN`.

The four workshop commands are: `module:begin`, `module:compare`, `module:reset`,
`module:status`. See [participant-workflow.md](./participant-workflow.md) for the full
mechanics.

## Prerequisites

- **Node 20** (`.nvmrc` — run `nvm use`)
- **Docker Desktop** (or equivalent) — for Postgres on `:5433`, the LGTM observability
  stack, and Terraform's Docker provider
- **Terraform ≥ 1.6** — for Labs 05, 06, and 10
- **`act`** — for Lab 04 (local CI): `brew install act` on macOS

No cloud account. No paid tooling.

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Confirm a green baseline
npm run verify

# 3. Start Lab 01
npm run module:begin 01
```

Then open [`labs/01-readiness-charter/README.md`](../labs/01-readiness-charter/README.md)
and follow the walkthrough.

The Postgres container starts on `:5433` (not the default `:5432` — avoids collisions
with any local Postgres you already have running):

```bash
npm run db:up          # docker compose up -d postgres
npm run serve:api      # nx serve api  →  http://localhost:3000
npm run serve:web      # nx serve web  →  http://localhost:4200
```

Next: [participant-workflow.md](./participant-workflow.md) — the full learner mechanics.
