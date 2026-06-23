# Tracer API — SLO / SLI Reference

## Redirect Hot-Path SLOs

The redirect hot path (`GET /:slug → 302`) is the core user-facing operation.

| SLO | Target | SLI Metric | PromQL |
|-----|--------|-----------|--------|
| **p99 latency** | < 100 ms | `tracer_redirect_duration_ms` (histogram) | `histogram_quantile(0.99, sum by (le) (rate(tracer_redirect_duration_ms_milliseconds_bucket[1m])))` |
| **Availability** | 99.9% | `tracer_redirects_total` (counter, outcome label) | `sum(rate(tracer_redirects_total{outcome="redirect"}[5m])) / sum(rate(tracer_redirects_total[5m]))` |

## Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `tracer_redirects_total` | Counter | `outcome=redirect\|not_found\|error` | Every `resolveTarget` call |
| `tracer_redirect_duration_ms` | Histogram | `outcome=redirect\|not_found\|error` | Wall-clock duration of `resolveTarget` |
| `tracer_redirect_errors_total` | Counter | — | Thrown errors (DB failures, unhandled exceptions) |

## Alert

**Redirect p99 SLO burn** — fires when
`histogram_quantile(0.99, ..., tracer_redirect_duration_ms_milliseconds_bucket[1m]) > 100`
for ≥ 1 minute. Provisioned in `deploy/observability/provisioning/alerting/tracer-slo.yaml`.

## Burn Test

Set `SLO_BURN_DELAY_MS=<N>` (e.g. `150`) when starting the API to inject artificial latency.
**This env var must never be set in production.** It exists solely to let the readiness probe
verify that the Grafana SLO alert fires correctly.
