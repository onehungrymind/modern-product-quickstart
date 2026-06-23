# Phase B — Lab-scaffold design

The reference (`reference-complete`) is the answer key — all 14 deltas product-grade. The labs build
that up from `seed` in lab order, one capability at a time. Tags: `seed → 01-start → 01-complete → … →
10-complete (= reference-complete)`. Each `NN-start` = `NN-1-complete` + the lab README (+ any scaffold
the learner works from); each `NN-complete` = `NN-start` + the promoted delta(s).

Because the history builds *up* from `seed` (outer ring absent/dev-grade), each `NN-start` naturally lacks
the later deltas — there's no "de-hardening" to do. The two **adversarial** labs (08, 09) additionally ship
a *working* failure/exploit in their `-start` for the learner to defeat.

Verify gate per lab = the readiness probe(s) flip to green: `npm run readiness:check R0x`.

| Lab | Dir | Promotes | Anchor | `NN-start` gives the learner | Learner builds (→ `NN-complete`) | Verify |
|---|---|---|---|---|---|---|
| 01 | readiness-charter | R01 | Well-Architected · SRE PRR | seed + the readiness harness (`scripts/readiness.*`, manifest of all 14 deltas) — **no charter** | `docs/charter.md`: SLOs (redirect p99<100ms, 99.9%), the 2 critical workflows, the delta inventory | `readiness:check R01` |
| 02 | twelve-factor | R02–R05 | The Twelve-Factor App | 01-complete (config defaults-in-code, `.env` committed, `synchronize:true`, Nest default logger) | env-only config (Zod validate), externalized secrets (.env untracked + gitleaks), `synchronize:false`+migrations+restart-survival, pino JSON + correlation ids | `readiness:check R02 R03 R04 R05` |
| 03 | test-outer-ring | R06 | Testing pyramid (Cohn/Fowler) | 02-complete (basic CLI unit specs only) | integration vs Postgres testcontainer, 2 BDD E2E (create+resolve), coverage floor, fast-check on slug, Stryker mutation | `readiness:check R06` |
| 04 | delivery-pipeline | R07 | Continuous Delivery · DORA | 03-complete (no `.github/workflows`) | `ci.yml` gating lint→test→build-once, run via `act`, emit the four DORA metrics | `readiness:check R07` (act) |
| 05 | environments | R08 | GitOps · trunk-based | 04-complete (one local env, no Dockerfiles/Terraform) | Dockerfiles for both apps; dev+prod **Terraform workspaces** (parity); build-once **image promotion**; a **feature flag** (deploy≠release) | `readiness:check R08` |
| 06 | infrastructure-as-code | R09 | IaC (Morris) | 05-complete (infra exists but not treated as code) | make the infra **declarative, immutable, drift-checked**: `destroy`+`apply` reproduces; a manual `docker` change is flagged as **drift** | `readiness:check R09` |
| 07 | observability | R10 | Google SRE · OpenTelemetry | 06-complete (logs only, no OTel) | wire OTel logs+metrics+traces → `grafana/otel-lgtm`; SLIs/SLOs from the charter; a **dashboard + an alert** | `readiness:check R10` |
| 08 | incident-response | R11 | Google SRE (incident mgmt) | 07-complete + **`gameday-inject.mjs` (the instructor injects a failure)** | detect via R10, roll back via R07, write the **runbook + blameless postmortem**, make the **error-budget** call; TTR recorded | `readiness:check R11` |
| 09 | security | R12, R13 | OWASP Top 10:2025 · ASVS · SLSA | 08-complete with the **naive `HttpUrlPreviewProvider` + unconfigured throttler** and the **working exploits** (`scripts/adversary/*` that SUCCEED) | kill open-redirect + SSRF (scheme allowlist + private-addr guard), configure the throttler, pin deps + **SBOM** + **dep-scan in CI**, audit with **ASVS** | `readiness:check R12 R13` (exploits now 4xx/429) |
| 10 | production-readiness-review | R14 | Google SRE PRR · Well-Architected | 09-complete | run the full **PRR**: every delta product-grade, every SLO instrumented, every workflow tested + observable | `npm run readiness` (all R01–R14) |

## Resolved design decision — Lab 05 (R08) vs Lab 06 (R09) ordering

R08 (image promotion + dev/prod parity) physically needs containers + Terraform, which is "infrastructure"
— yet the plan orders **05 Environments** before **06 IaC**. Resolution (keeps the locked §5 order + anchors):

- **Lab 05 Environments** is where the infra is first *created* in service of **environments**: the learner
  writes the Dockerfiles + the `infra/` Terraform with **dev/prod workspaces**, then **promotes one image**
  dev→prod and adds the **feature flag**. The lens is *running the same artifact in parity environments and
  decoupling deploy from release* (R08).
- **Lab 06 Infrastructure as Code** turns that infra into *code you can trust*: **reproducibility**
  (`destroy`+`apply` rebuilds it bit-for-bit) and **drift detection** (a manual `docker` change is caught by
  `terraform plan`). The lens is *immutability + drift* (R09) — the IaC discipline, applied to the infra
  Lab 05 stood up.

So Lab 05 = "stand up parity environments + promote + flag"; Lab 06 = "make that infra declarative,
immutable, and drift-checked." Both use the same `infra/` + Dockerfiles; the *learner work* differs.

## Adversarial labs (Opus-designed)

- **Lab 08 Game Day**: `08-start` ships `scripts/adversary/gameday-inject.mjs` ready to fire. The lab is run
  as a drill — inject → detect (R10) → roll back (R07) → postmortem + error budget. `readiness:check R11`
  asserts the lifecycle (TTR recorded, recovered) + the artifacts.
- **Lab 09 Security**: `09-start` ships the **vulnerable** `HttpUrlPreviewProvider` (the seed's naive fetch),
  the unconfigured throttler, no SBOM/dep-scan, AND the **working** `scripts/adversary/{open-redirect,ssrf,
  ratelimit}-poc.mjs` (they SUCCEED at start). The learner defeats them; `09-complete` has the exploits
  returning 4xx/429, the SBOM + dep-scan wired. This is the one lab where `-start` is a believable POC and the
  work is to harden.

## Tag reconstruction plan (Phase B.4 — destructive, checkpoint first)

The current `main` is build-order clustered (R02–R05, R06, R07–R09, R10, R11–R13, R01+R14). The lab model
needs a **lab-ordered** linear history. Build a fresh linear history from `seed`, applying each lab's delta
in order, with correct intermediate trees for the shared files that accumulate (`app.module.ts`, `main.ts`,
`package.json`, `ci.yml`, `redirect.service.ts`, …). Tag `NN-start`/`NN-complete` at each step; record the
SHAs in `scripts/modules.manifest.json`; `10-complete` must have the **same tree** as `reference-complete`.
This rewrites tagged history, so it is checkpointed before execution.
