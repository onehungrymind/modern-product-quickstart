# <Service> — Production Readiness Charter (template)

> Lab 01 deliverable. Author this BEFORE touching the outer ring. `readiness:check R01` requires the
> SLOs and BOTH critical workflows to be present.

## Service Level Objectives (SLOs)

| SLO | Target | SLI | Where measured |
|---|---|---|---|
| <latency SLO> | p99 < <N> ms | <PromQL> | <signal> |
| <availability SLO> | <N>.<N>% | <PromQL> | <signal> |

Error budget: <derive minutes/month from the availability SLO>.

## Critical workflows (must never silently break)

1. **<Workflow A>** — <endpoint + what it does>.
2. **<Workflow B>** — <endpoint + what it does>.

## The delta inventory

List the outer-ring capability deltas (R01…R14) — the Readiness Manifest your labs will promote to
product-grade. See `scripts/readiness.manifest.json`.

## Definition of done

The service is a product when `npm run readiness` is all-green.
