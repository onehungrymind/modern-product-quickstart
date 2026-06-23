# modern-production-quickstart — Build Plan

> A self-paced, hands-on workshop that teaches **how to cross from a project to a product**: taking a
> competently-built early-stage app and adding the **outer ring** — containers, CI/CD, environments,
> infrastructure as code, observability, incident response, security, and a Production Readiness Review.
> This is **Volume I — Production** of the *Project to Product Playbook*, made executable.
> Learners take **Tracer** — a link shortener scaffolded to inner-ring best practices but with no
> production surface — and promote each capability to product-grade, lab by lab, diffing their work
> against a canonical answer key. Sibling to [`modern-coding-quickstart`](../modern-coding-quickstart)
> and [`modern-e2e-quickstart`](../modern-e2e-quickstart): coding teaches the inner ring
> (construction-quality), this one teaches the outer ring (operability).

---

## How to use this document

This file is the complete build plan. Open Claude Code **inside this directory** and hand it this file:

```
Follow PLAN.md. Resolve the Open Questions (§12) with me first, then build Phase A. Ask before moving between phases.
```

Decisions in §2 are **locked**. §12 items are **resolved along recommended lines** and folded into §2 —
revisit only if the Phase A stack spike contradicts one. If you find an ambiguity not covered here, ask
before inventing.

### The organizing idea — two rings, one gate

Every capability in software sits in one of two rings, and a single question sorts them:

> **The Other Computer Test —** *does this concern become important the moment the app runs on a
> computer that isn't mine?*

- **No → the inner ring.** Local concerns: code structure, lib boundaries, component design, type
  safety, basic tests. The stuff in a framework's style guide. The CLIs (Nx, Nest, Angular) give you
  most of this for free, and the seed has it done properly.
- **Yes → the outer ring.** External-surface concerns: integration, deployment, performance under load,
  observability, security against strangers, recoverability. No `nx generate` produces a Dockerfile
  that survives a restart test, a pipeline that blocks a red commit, or a trace that reaches a
  dashboard. **This ring is the course.**

This reframes the whole volume non-morally. The seed isn't broken or hobbled — it's *good code that
isn't a product yet*, which is the true state of nearly every codebase a consultant inherits. Each lab
promotes one outer-ring capability from where the CLIs leave it to where production needs it. The work
of crossing the rings *is* the product.

### Owner decisions already locked
1. **Reference app** — **Tracer**, a link shortener with click analytics. Small enough to fully
   productionize in a course; the redirect hot path is a natural SLO home; the server-side URL preview
   is a real SSRF surface.
2. **Stack** — the owner's enterprise stack (see §2): Nx monorepo, **separated** Angular web + NestJS
   API, Postgres/TypeORM, Zod-first portable core. Web and API are distinct apps — the separation is a
   deliberate inner-ring best practice, not an accident.
3. **The seed is the honest CLI scaffold.** Inner ring done to best practice (lib boundaries,
   component-driven Angular, Zod-first `common-models`, basic specs); outer ring entirely absent or
   dev-grade. The seed *runs and is well-built* — it simply isn't a product.
4. **The spine is the Readiness Manifest** — a machine-checkable inventory of outer-ring capability
   deltas, each with a `check` whose exit code proves it has reached product-grade. Assembled, the
   manifest *is* the Production Readiness Review.
5. **Progression mechanics** — mirror the family tag harness (`NN-start` / `NN-complete`,
   `scripts/module.mjs`, `modules.manifest.json`), plus `scripts/readiness.mjs` +
   `readiness.manifest.json` for the delta checks.

---

## 1. What we're building

Two things in one repo:

1. **A reference application** — Tracer, scaffolded to inner-ring best practice and then hardened to
   **product-grade** across the outer ring: it passes its own Production Readiness Review. The answer key.
2. **A 10-lab workshop** — each lab promotes one outer-ring capability, delivered as tagged commits on
   a linear `main`.

The starting point is the `seed` tag: the CLI-standard app with the inner ring done and the outer ring
absent. Unlike a "deliberately broken" seed, this one is honestly good — the labs are the climb from
*runs-on-my-machine* to *runs-on-anyone's*.

Every capability is anchored to a **publicly published framework** so a consultant can trace the work to
an accepted source. Pin each to its current edition at build time (OWASP shipped its 2025 edition this
cycle; DORA publishes annually).

---

## 2. Locked decisions

Stack mirrors the owner's reference architecture (`action-factory` / SEALD lineage), scaled down to the
Tracer domain per the "drop what the domain doesn't need" discipline.

| Topic | Decision |
|---|---|
| Monorepo | **Nx** — `apps/` + `libs/`, enforced module boundaries, project-graph caching |
| Language | **TypeScript** strict, `nodenext` → **ESM with `.js` import specifiers** |
| Runtime | **Node 20 LTS**; `.nvmrc` + `engines.node` pinned |
| Web | **Angular ~21** — standalone, **zoneless**, signals, `inject()`; one **NgRx** feature (`links`) for the master list; facade-only component access |
| API | **NestJS ^11** — modular, constructor DI, the module quartet (`*.module/controller/service` + `entities/` + `dto/`); **separate app from web** |
| ORM / DB | **TypeORM + Postgres** (`pg`); `synchronize:false` + migrations at product-grade; `uuid` PKs, `timestamptz`, soft-delete |
| Validation | **Zod-first** (`nestjs-zod`): one schema → wire contract + DTO + inferred type, in `@tracer/common-models` |
| Portable core | **`@tracer/common-models`** depends on **zod only** — no Angular, no Nest, no TypeORM. Both apps depend on it; it depends on neither |
| Ports | one justified port — **`UrlPreviewProvider`** (real adapter fetches target-URL metadata server-side; **stub** for tests). It is also Lab 09's SSRF target |
| Auth | Passport JWT + bcrypt, global `JwtAuthGuard`, `@Public()` opt-out, `helmet`, `cookie-parser` (inner-ring; not graded) |
| Logging | **pino / nestjs-pino** at product-grade (structured JSON + correlation IDs); Nest default logger at seed |
| Rate limit | **`@nestjs/throttler`** present but unconfigured at seed; wired + tuned in Lab 09 |
| Tests | **Vitest** (unit/integration) + Postgres **testcontainer** + **Playwright** (+ playwright-bdd) + **fast-check** (property) + **StrykerJS** (mutation) |
| Hermeticity | **Hermetic-first** — runs from a fresh clone with **Docker** + Node; no cloud account required |
| Observability | **OpenTelemetry SDK → `grafana/otel-lgtm`** (single container) via Docker Compose |
| IaC | **Terraform + Docker provider** — declarative local environment; LocalStack/AWS is a bonus |
| CI | **GitHub Actions**, run locally via **`act`**; a real remote PR + Actions run is the bonus |
| Security tooling | exploit kit (`scripts/adversary/*.mjs`), **gitleaks**, **`npm audit`** + **CycloneDX** SBOM, **OWASP ASVS** checklist |
| Package scope | **`@tracer/*`** |
| Workshop delivery | tagged commits on linear `main`; learner branches via the harness |
| Repo scripts | Node ESM (`.mjs`) only — cross-platform, no bash |
| Manifest naming | **Readiness Manifest**; entries are **deltas** (`R01`…`R14`) with a **Ring**, a seed grade, a product grade, and a `check` |
| Repo identity | `modern-production-quickstart`, MIT |

---

## 3. Reference app spec

### 3.1 Domain (Tracer)

Three entities — deliberately thin, so the course is about operability, not domain modeling:

- **User** — `id, email, passwordHash, name, createdAt` (JWT login; inner-ring; not graded)
- **Link** — `id, slug, targetUrl, title?, ownerId, createdAt, expiresAt?`
- **Click** — `id, linkId, occurredAt, ipHash?, userAgent?, referrer?, country?`

No formal state machine — a link is simply active unless `expiresAt` has passed. (This is the §7
discipline in miniature: the reference architecture's state-machine spine is *dropped* because the
domain doesn't earn it. Worth a one-line note in the docs so learners see the scaling-down decision.)

The two **critical workflows** (named in the Lab 01 charter; must never silently break):
1. **Create** — `POST /api/links` → mint a unique `slug` for a `targetUrl` (optionally fetch its title
   via `UrlPreviewProvider`).
2. **Resolve** — `GET /:slug` (root, outside `/api`) → `302` to `targetUrl` **and** record a `Click`.
   The hot path; home of the SLO (e.g. *p99 < 100ms; 99.9% available*).

Third, non-critical: **Analytics** — `GET /api/links/:id/clicks` — feeds the detail view and gives
observability something to show.

### 3.2 Web app — basic master-detail (inner ring)

One Angular app, authed user sees their own links:

- **Master** — `links/` list (the `links` NgRx feature: entity adapter, facade, `list$/loading$/error$`).
- **Detail** — `links/:id` — the link plus its click analytics (loaded via `core-data`, not its own
  feature — mirrors the "one feature, spine only" discipline).
- **Create** — a dialog/form on the master view.

Component-driven, facade-only, `@tracer/material` + `@tracer/design-tokens` for UI. This is the inner
ring; it ships done in the seed.

### 3.3 The Readiness Manifest (the spine)

The product analogue of `enforce-module-boundaries` — what makes each lab a **check**, not an opinion.
Lives at `scripts/readiness.manifest.json`; each delta carries `{ id, capability, ring, seedGrade,
productGrade, lab, check }`. A lab may promote several deltas.

| ID | Capability | Ring | Seed grade (where the CLIs leave it) | Product-grade target | Lab | Check |
|---|---|---|---|---|---|---|
| **R01** | Definition of done | outer | absent | Readiness charter: SLOs + critical workflows + delta inventory | 01 | charter parses; SLOs + both workflows present |
| **R02** | Config | outer | dev-grade — defaults in code, `.env` committed | 12-factor, env-only, no committed config | 02 | no literal config; boots from env alone |
| **R03** | Secrets | outer | dev-grade — in `.env`/source | externalized; nothing in source | 02 (+ 09) | `gitleaks` clean; app reads from store |
| **R04** | Persistence | outer | dev-grade — TypeORM+Postgres, `synchronize:true`, local DB | `synchronize:false`, migrations-only, containerized, stateless, survives restart | 02 | kill+restart → no data loss; 2 replicas share state; migration is the only schema path |
| **R05** | Logs | outer | dev-grade — Nest default logger | pino structured JSON + correlation ids | 02 → 07 | logs parse as JSON; request id present |
| **R06** | Test outer-ring | outer | dev-grade — CLI basic unit/component specs (inner ring) | integration vs testcontainer + 2 E2E (Playwright/BDD) + coverage floor + mutation | 03 | suite green; coverage ≥ floor; Stryker ≥ floor; breaking a workflow fails an E2E |
| **R07** | Delivery pipeline | outer | absent | CI gates lint+test+build; build-once-promote; DORA | 04 | `act` blocks a red commit; DORA emitted |
| **R08** | Environments | outer | absent (one local) | dev + prod parity, promotion path, feature flag | 05 | same image promotes dev→prod; flag toggles release w/o redeploy |
| **R09** | Infrastructure | outer | absent | declarative IaC, immutable, drift-checked | 06 | `destroy`+`apply` reproduces; manual change flagged as drift |
| **R10** | Observability | outer | absent (logs only) | OTel logs+metrics+traces; SLIs/SLOs; dashboard + alert | 07 | "healthy?" answered from dashboard; synthetic SLO burn fires alert |
| **R11** | Incident response | outer | absent | rollback path, runbook, blameless postmortem, error budget | 08 | injected failure detected via R10, rolled back via R07; TTR recorded; postmortem present |
| **R12** | App security | outer | dev-grade — Zod validation + JWT (inner); throttler unconfigured; no SSRF/redirect guard | scheme allowlist, SSRF guard, rate limiting, ASVS pass | 09 | exploit kit returns 4xx; rate-limit 429; ASVS complete |
| **R13** | Supply chain | outer | absent | pinned deps, SBOM, dep-scan gates the pipeline | 09 | lockfile pinned; SBOM emitted; pipeline blocks a known-vuln dep |
| **R14** | Readiness gate | outer | absent | full PRR passes; every delta product-grade | 10 | `npm run readiness` all green |

Note the honest middle rung: R02–R06 and R12 read **dev-grade → production-grade** (the capability
exists locally; the lab makes it operable), while R07–R11, R13–R14 are greenfield outer-ring. The inner
ring (lib boundaries, components, Zod core, basic specs) isn't in the manifest at all — it's the floor
the seed already meets.

### 3.4 The portable core & dependency graph

```
@tracer/common-models  (zod only) ── link/click/user schemas, slug logic, expiry guard (pure)
        ▲                    ▲                         ▲
   apps/api (Nest,      core-data (Angular        core-state (NgRx `links`)
   TypeORM)            HttpClient + interceptors)        ▲
                             ▲                            │
                       apps/web → core-state, core-data, common-models, material, design-tokens
```

Acyclic, one-way: apps depend on libs; libs depend on `common-models`; `common-models` depends on no
one. Enforced by Nx tags / `tsconfig.base.json` paths (inner-ring; carried from the reference).

---

## 4. Repo scaffold

```
modern-production-quickstart/
├── apps/
│   ├── web/                       # Angular master-detail (links list → detail+analytics)
│   ├── api/                       # NestJS REST API + GET /:slug hot path + /healthz
│   └── web-e2e/                   # Playwright + BDD (the two critical workflows)
├── libs/
│   ├── common-models/             # ★ zod-only portable core
│   ├── core-data/                 # Angular HTTP services, interceptors, guards
│   ├── core-state/                # NgRx `links` feature + facade
│   ├── material/  design-tokens/  # leaf UI libs
├── labs/                          # 01-readiness-charter … 10-production-readiness-review
├── infra/                         # Terraform (Docker provider): dev + prod workspaces
├── deploy/
│   ├── docker-compose.yml         # api + web + postgres + grafana/otel-lgtm
│   └── otel-collector.yaml
├── .github/workflows/ci.yml       # run locally via `act` (Lab 04)
├── docs/
│   ├── intro.md  charter.template.md  runbook.template.md  postmortem.template.md
│   ├── asvs-checklist.md  participant-workflow.md  cheatsheet.md  troubleshooting.md
├── scripts/
│   ├── modules.manifest.json  rebuild-tags.mjs  module.mjs
│   ├── readiness.manifest.json  readiness.mjs  readiness/checks/*.mjs
│   └── adversary/ open-redirect-poc.mjs  ssrf-poc.mjs  ratelimit-poc.mjs  gameday-inject.mjs
├── .nvmrc  .gitattributes  eslint.config.mjs  tsconfig.base.json  nx.json
├── package.json  README.md  PLAN.md
```

---

## 5. Lab curriculum (locked)

Ordered for build-up; runs completion-backwards (Lab 01 authors the target, Lab 10 runs it).

| # | Lab | Capability | What the learner does | Promotes | Anchor |
|---|---|---|---|---|---|
| 01 | Readiness charter | Definition of done | Tour the seed; author the charter — SLOs, the two critical workflows, the delta inventory — **before** touching code | R01 | Well-Architected; SRE (PRR) |
| 02 | Twelve-factor | Config/secrets/state/logs | Pull config to env, externalize secrets, `synchronize:false` + migrations + container, stateless, pino + correlation ids | R02–R05 | The Twelve-Factor App |
| 03 | Test outer-ring | Tests | Add integration vs a Postgres testcontainer, 2 E2E (BDD) for the critical workflows, a coverage floor, fast-check property tests on slug logic, Stryker mutation | R06 | Testing pyramid (Cohn/Fowler) |
| 04 | Delivery pipeline | CI/CD | Author `ci.yml` (lint→test→build-once), gate on Lab 03, run it via `act`, emit the four DORA metrics | R07 | Continuous Delivery; DORA |
| 05 | Environments & promotion | Environments | dev + prod Terraform workspaces with parity, image promotion, a feature flag decoupling deploy from release | R08 | GitOps; trunk-based dev |
| 06 | Infrastructure as code | Infrastructure | Containerize both apps; declare the environment in Terraform (Docker provider); immutable; drift check | R09 | Infrastructure as Code (Morris) |
| 07 | Observability | Observability | Wire OTel logs+metrics+traces to the local LGTM stack; SLIs/SLOs from the charter; dashboard + one alert | R10 | Google SRE; OpenTelemetry |
| 08 | Incident response (Game Day) | Reliability | Instructor injects a failure; detect via R10, roll back via R07, write runbook + blameless postmortem + error-budget call | R11 | Google SRE (incident mgmt) |
| 09 | Security | App security / supply chain | Kill open-redirect + SSRF (in `UrlPreviewProvider`), configure throttler + scheme allowlist, externalize+scan secrets, pin deps, emit SBOM, add dep-scan to CI; audit with ASVS | R12, R13 | OWASP Top 10:2025; ASVS; SLSA |
| 10 | Production Readiness Review | Readiness gate | Run the full PRR: every delta product-grade, every SLO instrumented, every workflow tested and observable | R14 | Google SRE (PRR); Well-Architected |

`labs/NN-name/README.md` template:

```markdown
# Lab NN — <Title>   ·   Capability: <name>   ·   Manifest: <R-ids>   ·   Ring: outer

## What you'll learn
## The Other Computer Test
(why this concern only appears once the app runs on someone else's computer)
## Where the seed leaves it  →  Where production needs it
(dev-grade vs absent → product-grade)
## Why it matters
## The principle (public anchor)
> framework reference + link
## Prerequisites
- Completed Lab NN-1 · `npm run module:begin NN`
## Walkthrough
## Exercise
## Verify
(the objective gate: `readiness:check R0x`, an `act` run, a `terraform` reproduce, or an adversary script)
## Compare
npm run module:compare NN
## Cheat sheet
## Next → [Lab NN+1](../NN+1-name/README.md)
```

---

## 6. Tag strategy & learner workflow

Linear `main`:

```
seed → 01-start → 01-complete → 02-start → 02-complete → … → 10-complete (= reference-complete)
```

- `seed` = the CLI-standard inner-ring app: runs, well-built, outer ring absent/dev-grade.
- `NN-start` = previous `NN-1-complete` + a commit adding the lab README and any scaffold the learner
  works from (failing test, empty Terraform module, a working exploit to be defeated).
- `NN-complete` = `NN-start` + commits promoting that lab's delta(s).

`scripts/module.mjs` (begin/compare/reset/status) is reused **verbatim** from the family;
`module:compare` diffs the whole tree (work spans `apps/**`, `libs/**`, `infra/**`, `deploy/**`).
`scripts/readiness.mjs` is the new, central runner:

```
npm run readiness            # full PRR — every R0x check, manifest red→green
npm run readiness:status     # current grade per delta
npm run readiness:check R06  # one delta's probe
```

---

## 7. Per-lab verification (heterogeneous — the key difference from the inner-ring courses)

| Lab | Primary verify |
|---|---|
| 01 | `readiness:check R01` (charter parses; SLOs + workflows present) |
| 02 | `readiness:check R02 R03 R04 R05` (env-boot; gitleaks; kill+restart no data loss; migration-only) |
| 03 | `nx test` + coverage gate + `npx stryker run` |
| 04 | `act` runs `ci.yml`; a red commit is blocked; DORA emitted |
| 05 | promote script moves one image dev→prod; feature-flag toggle test |
| 06 | `terraform -chdir=infra destroy && … apply` reproduces; `plan` flags injected drift |
| 07 | dashboard-provisioned check; synthetic SLO burn fires the alert |
| 08 | `npm run gameday` injects failure; learner restores; TTR logged; postmortem present |
| 09 | `adversary/*` return 4xx/429; ASVS complete; SBOM emitted; dep-scan trips on a planted vuln |
| 10 | `npm run readiness` (all R01–R14) |

`npm run verify` = typecheck + lint + test + build (CI parity). `npm run readiness` = the PRR gate.

---

## 8. Build phases

Build a complete, correct reference first, then carve labs from the gap. **No de-hardening phase** — the
seed is the honest CLI scaffold, and Phase A hardens *forward* from it.

### Phase A — Reference: seed → product-grade (most of the work)

1. **Step 0 — stack spike.** Prove the riskiest integrations on pinned versions before scaffolding
   everything: (a) the Nest API exporting OTel traces/metrics/logs into a running `grafana/otel-lgtm`
   container, visible on a Grafana dashboard; (b) `terraform apply` (Docker provider) standing up
   api+web+Postgres, then `destroy`; (c) `act` running `ci.yml` locally. These three are the novel
   combination here. If any fights the pins, **stop and flag**.
2. **Scaffold the inner-ring seed** the standard way: Nx workspace; Angular web (standalone, zoneless,
   the `links` master-detail + NgRx feature + facade); Nest API (modules, the two workflows, `GET /:slug`
   hot path, JWT, `/healthz`); `@tracer/common-models` (Zod schemas, slug + expiry logic);
   `UrlPreviewProvider` port + stub; basic CLI unit/component specs; enforced lib boundaries. **Tag
   `seed`** — and confirm it's genuinely good: `nx run-many -t lint typecheck test build` green; the app
   runs; the master-detail works.
3. **Harden forward to product-grade** across the outer ring — every Readiness Manifest delta: env
   config, externalized secrets, `synchronize:false` + migrations + container + stateless, pino, the
   outer test ring (testcontainer + Playwright/BDD + coverage + Stryker), `ci.yml`, Terraform dev+prod,
   feature flag, observability, security hardening (scheme allowlist + SSRF guard + throttler), pinned
   deps + SBOM.
4. Author the charter, runbook, postmortem template, ASVS checklist, and the adversary kit (exploits
   that **fail** against the hardened reference).
5. Write `readiness.manifest.json` and every `readiness/checks/*.mjs` probe.
6. Manual smoke (create→resolve→analytics; kill+restart; trigger an alert; run an exploit, watch it
   fail). `npm run readiness` green twice. Tag `reference-complete`.

**Exit criteria:** `seed` is lint/typecheck/test/build green and runs; `reference-complete` passes
`npm run readiness` twice; the Step 0 spike passed; every adversary script fails against the reference.

**Gate A → B is open** — proceed autonomously once exit criteria pass.

### Phase B — Lab content + tagging

1. For each lab 01–10, design the `NN-start` scaffold (which promotion, what the learner starts from) so
   the tree stays coherent with exactly one capability to promote.
2. Write all `labs/NN-name/README.md` against the reference, following the §5 template; cite the public
   anchor and frame each via the Other Computer Test.
3. Special cases: Lab 04 wires `act`; Lab 08 drives `gameday-inject.mjs` + the postmortem; Lab 09's
   deliverable is partly process (ASVS + PR), so script its verification.
4. Build `modules.manifest.json`, `rebuild-tags.mjs`; tag every `NN-start`/`NN-complete`.
5. Test the learner workflow: `module:begin 03` → implement → `module:compare 03` → `readiness:check R06`.

**Gate B → C is closed** — stop and ask. Designing the lab scaffolds and the adversarial labs (Game Day,
Security) is teaching judgment that wants human review.

### Phase C — Polish + dry run

1. Write the docs; top-level `README.md` (with the Docker prerequisite called out prominently).
2. Dry-run all labs from a fresh clone: each `NN-start` → follow README → `module:compare` clean **and**
   the lab's `readiness:check` flips to product-grade.
3. Log friction, fix, re-tag; second clean dry run.

**Exit criteria:** a developer who has never seen the manifest can complete all 10 labs from a fresh
clone with no outside help and end with `npm run readiness` all-green.

---

## 9. Production Readiness Review checklist (the capstone gate)

Generated from the Readiness Manifest — Lab 10 and every `NN-complete` must satisfy:

- [ ] **R01** Charter: SLOs + both critical workflows + delta inventory
- [ ] **R02** Config env-only; no literals
- [ ] **R03** No secrets in source (`gitleaks` clean); externalized
- [ ] **R04** `synchronize:false` + migrations-only; stateless; survives kill+restart; scales to 2 replicas
- [ ] **R05** Structured JSON logs with correlation ids (pino)
- [ ] **R06** Outer test ring: integration + 2 E2E green; coverage ≥ floor; mutation ≥ floor
- [ ] **R07** Pipeline gates lint+test+build; a red commit can't deploy; DORA emitted
- [ ] **R08** dev+prod parity; same image promotes; feature flag decouples deploy from release
- [ ] **R09** Declarative IaC; `destroy`+`apply` reproduces; drift detected
- [ ] **R10** OTel logs+metrics+traces; SLOs defined; dashboard + a real alert
- [ ] **R11** Rollback + runbook + blameless postmortem; TTR measured; error-budget call
- [ ] **R12** Open-redirect + SSRF closed; rate limiting on; ASVS passed
- [ ] **R13** Deps pinned; SBOM emitted; dep-scan gates the pipeline
- [ ] **R14** `npm run readiness` all-green

---

## 10. Conventions (the reference practices what it preaches)

**Inner ring (the seed already obeys; carried from the reference architecture):** Nx lib boundaries
enforced in lint; Zod-first one-schema-three-consumers; `common-models` depends on zod only; ESM `.js`
specifiers + `@tracer/*` aliases; wire snake_case ↔ entity camelCase; Angular standalone/zoneless,
`inject()`, facade-only components; Nest constructor DI, the module quartet; conventional commits;
`.husky` hooks respected.

**Outer ring (the reference adds; the labs teach):** the reference's own infra is Terraform, never
clicked-together; logs structured; the app is observable about itself; secrets externalized; deps pinned
with an SBOM.

**The one deliberate prerequisite the inner-ring siblings avoid: Docker** (Postgres, the LGTM stack,
Terraform-Docker, `act`). You cannot teach the outer ring hermetically-pure — but everything still runs
from a fresh clone with no cloud account. Call this out in the README.

---

## 11. First actions for Claude Code

1. Confirm the directory contains only `PLAN.md` (and optionally `CLAUDE.md`).
2. Read `PLAN.md`; skim the sibling plans and `scripts/module.mjs` (harness reused verbatim); skim the
   owner's `ARCHITECTURE.md` for the inner-ring conventions to scaffold the seed against.
3. §12 is resolved — proceed; re-confirm only if the spike contradicts.
4. Run the Phase A **Step 0 stack spike** (OTel→LGTM, Terraform-Docker, `act`) before full scaffolding.
5. Track progress with TaskCreate/TaskUpdate — one task per phase.

Spawn `model: "sonnet"` subagents for mechanical work (scaffolding, boilerplate, lab READMEs from an
outline, delta-check probes). Reserve Opus for architectural calls, the lab-scaffold design, and the
adversarial labs.

---

## 12. Resolved decisions

Resolved along recommended lines, folded into §2, recorded with rationale. Revisit only if the Phase A
spike contradicts.

**Q1 — Stack → the owner's Angular + Nest + Nx separated stack** (not Fastify, not Next.js). Full web/API
separation is a deliberate inner-ring best practice the owner already runs in production (SEALD /
`action-factory`). It resolves the earlier Fastify-vs-Next question: the separation Fastify was reaching
for is what Nest+Angular provide, with far more structure, in the owner's own idiom. A course taught
under Presolved should be native to the owner's practice.

**Q2 — Seed → the honest CLI scaffold, inner ring done to best practice.** Not a deliberately-broken or
hobbled app (artificial), and not a scrappy single-file hack (unfaithful to the stack). A competent
early-stage product whose outer ring was never built — the true state of most inherited codebases. This
retires the "believable POC" problem and the Phase A.2 de-hardening step entirely.

**Q3 — Ring boundary → the Other Computer Test.** "Does this matter once the app runs on a computer that
isn't mine?" No → inner ring (seed has it); yes → outer ring (the labs). Sorts every ambiguous case
(logs, tests, persistence, security) cleanly and non-morally.

**Q4 — App surface → basic master-detail** (links list → link detail + analytics) + the API redirect hot
path. One NgRx feature, no state machine — the domain doesn't earn the reference's spine, so it's dropped
(§7 discipline). Keeps the labs about the outer ring, not app-building.

**Q5 — Hermeticity → hermetic-first, Docker required, no cloud.** Keeps Tracer fresh-clone-runnable;
real cloud (AWS, Grafana Cloud, a real remote PR) is the documented bonus.

**Q6 — Observability → `grafana/otel-lgtm`; IaC → Terraform+Docker provider; CI → `act`.** All chosen to
make outer-ring skills teachable fully offline; vendor-neutral via OpenTelemetry so the skill transfers.

**Q7 — Manifest naming → Readiness Manifest; entries are deltas with a Ring + a seed-grade + a
product-grade.** Maturation, not remediation: a dev-grade capability isn't wrong, its context is about to
change. "Readiness" traces to the capstone PRR and to public maturity vocabulary.

**Q8 — Repo identity → `modern-production-quickstart`, MIT.** Tracer is the app; this is Volume I of the
Project to Product Playbook made executable, and the operability sibling to the e2e/coding quickstarts.

---

*End of plan.*
