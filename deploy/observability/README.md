# Observability Provisioning

This directory contains Grafana provisioning files for the `grafana/otel-lgtm` stack.

## Directory Layout

```
deploy/
  docker-compose.yml                          # postgres + lgtm services
  observability/
    dashboards/
      tracer.json                             # Tracer API SLI dashboard
    provisioning/
      dashboards/
        tracer.yaml                           # Grafana dashboard provider config
      alerting/
        tracer-slo.yaml                       # Unified-alerting SLO burn rule
```

## Mount Paths (host → container)

| Host path (relative to deploy/) | Container path | Purpose |
|----------------------------------|----------------|---------|
| `./observability/provisioning/dashboards` | `/otel-lgtm/grafana/conf/provisioning/dashboards` | Tells Grafana where to load dashboard JSON from |
| `./observability/dashboards` | `/otel-lgtm/grafana/dashboards` | The actual dashboard JSON files |
| `./observability/provisioning/alerting` | `/otel-lgtm/grafana/conf/provisioning/alerting` | Unified-alerting rule provisioning |

## Bring Up

```bash
# From the repo root
docker compose -f deploy/docker-compose.yml up -d lgtm postgres
```

Grafana UI: http://localhost:3001 (admin:admin or anonymous Admin)

## Confirm Dashboard

```bash
curl -s 'http://admin:admin@localhost:3001/api/search?query=Tracer' | jq '.[].title'
```

Expected: `"Tracer API — SLI Dashboard"`

## Confirm Alert Rule

```bash
curl -s 'http://admin:admin@localhost:3001/api/v1/provisioning/alert-rules' | jq '.[].title'
```

Expected: `"Redirect p99 SLO burn"`

## Check Alert State

```bash
curl -s 'http://admin:admin@localhost:3001/api/alertmanager/grafana/api/v2/alerts' | jq '.[].labels'
# Or via the ruler API:
curl -s 'http://admin:admin@localhost:3001/api/ruler/grafana/api/v1/rules' | jq .
```

## Tear Down

```bash
docker compose -f deploy/docker-compose.yml down
```

## SLO Burn Test

Start the API with:

```bash
SLO_BURN_DELAY_MS=150 OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 npx nx serve api
```

Then generate redirect traffic. After ~1 minute the "Redirect p99 SLO burn" alert moves to
`Pending` → `Firing`. **Never set `SLO_BURN_DELAY_MS` in production.**
