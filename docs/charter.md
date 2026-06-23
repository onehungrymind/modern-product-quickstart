# Tracer — Production Readiness Charter

> The **definition of done** for crossing from project to product (delta **R01**). Authored *before*
> touching the outer ring: it names what "ready" means, so every later lab has a target to hit. The
> machine-checkable inventory below is the spine — assembled and all-green, it **is** the Production
> Readiness Review (`npm run readiness`).

Anchors: AWS Well-Architected · Google SRE (Production Readiness Review).

## Service Level Objectives (SLOs)

The hot path is the redirect (`GET /:slug`). Its SLOs are the contract:

| SLO | Target | SLI | Where measured |
|---|---|---|---|
| **Redirect latency** | p99 **< 100 ms** | `histogram_quantile(0.99, rate(tracer_redirect_duration_ms_milliseconds_bucket[1m]))` | OTel → Prometheus (R10) |
| **Redirect availability** | **99.9%** (30-day window) | `1 - rate(tracer_redirect_errors_total[…]) / rate(tracer_redirects_total[…])` | OTel → Prometheus (R10) |

Error budget: 99.9% over 30 days ⇒ **43.2 minutes/month** of allowed unavailability
(`scripts/error-budget.mjs`). Burning it triggers the freeze call in the runbook (R11).
Full SLO→SLI mapping in [`slo.md`](./slo.md).

## Critical workflows (must never silently break)

1. **Create** — `POST /api/links` mints a unique `slug` for a `target_url` (optionally fetching its
   title via `UrlPreviewProvider`, gated by the `link_title_preview` flag). Covered by the `@create`
   E2E and the integration suite (R06).
2. **Resolve** — `GET /:slug` (root, outside `/api`) issues a `302` to `target_url` **and** records a
   `Click`. The hot path; home of the SLOs above. Covered by the `@resolve` E2E (R06).

A non-critical third workflow — **Analytics** (`GET /api/links/:id/clicks`) — feeds the detail view and
gives observability something to show.

## The delta inventory — the Readiness Manifest

The outer-ring capabilities that turn the seed into a product. Each is a delta with a seed grade, a
product-grade target, the lab that promotes it, and a `check` whose exit code proves it
(`scripts/readiness.manifest.json`). The full PRR is `npm run readiness`.

| ID | Capability | Lab |
|---|---|---|
| R01 | Definition of done (this charter) | 01 |
| R02 | Config — 12-factor, env-only | 02 |
| R03 | Secrets — externalized | 02 |
| R04 | Persistence — migrations, stateless, survives restart | 02 |
| R05 | Logs — structured JSON + correlation ids | 02 |
| R06 | Test outer-ring — integration + E2E + coverage + mutation | 03 |
| R07 | Delivery pipeline — CI gate, build-once, DORA | 04 |
| R08 | Environments — dev/prod parity, promotion, feature flag | 05 |
| R09 | Infrastructure — declarative IaC, drift-checked | 06 |
| R10 | Observability — OTel logs+metrics+traces, dashboard + alert | 07 |
| R11 | Incident response — rollback, runbook, postmortem, error budget | 08 |
| R12 | App security — SSRF/redirect guard, rate limiting, ASVS | 09 |
| R13 | Supply chain — pinned deps, SBOM, dep-scan gate | 09 |
| R14 | Readiness gate — the full PRR passes | 10 |

## Definition of done

Tracer is a **product** when `npm run readiness` is all-green: every delta at product-grade, both
critical workflows tested and observable, every SLO instrumented with a dashboard and an alert.
