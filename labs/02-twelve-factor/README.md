# Lab 02 — Twelve-Factor   ·   Capability: Config / Secrets / Persistence / Logs   ·   Manifest: R02 R03 R04 R05   ·   Ring: outer

## What you'll learn

Four outer-ring promotions in one lab — the four factors that together make the app *runnable on
any computer*: environment-only configuration (Zod-validated), externalized secrets (gitleaks
clean), migration-only persistence (`synchronize:false` + restart-survival), and structured JSON
logs with correlation IDs (pino).

## The Other Computer Test

On your machine `DATABASE_URL` is hardcoded, `.env` is committed, TypeORM auto-syncs the schema
on boot, and the logger prints colorized text. None of that survives a handoff: a colleague gets
a DB with schema drift, a CI runner gets your credentials, a log aggregator gets human-readable
noise it cannot parse. The four factors in this lab are all about making the app's operational
seams explicit so any computer can host it safely.

## Where the seed leaves it  →  Where production needs it

| Delta | Seed (dev-grade) | Product-grade |
|---|---|---|
| R02 Config | Defaults hard-coded; env vars optional | `ConfigModule.forRoot({ validate })` + Zod `envSchema` — boot fails loud if any required var is absent |
| R03 Secrets | `.env` committed to git | `.env` in `.gitignore`; `.env.example` (no values); `gitleaks` clean on `git log` |
| R04 Persistence | `synchronize: true` — TypeORM mutates the schema on every boot | `synchronize: false`; `migrationsRun: true`; explicit migration classes; kill + restart loses no data |
| R05 Logs | Nest default logger — human text, no request ID | `nestjs-pino` JSON; `genReqId` from `x-request-id` header or `crypto.randomUUID()`; every log line carries `requestId` |

## Why it matters

These four factors are the baseline operational contract any cloud or containerized runtime
expects. A app that auto-syncs its schema will corrupt production data if two instances boot
simultaneously. An app with committed secrets will have those secrets in `git log` forever. An app
whose logs can't be parsed by a log aggregator is invisible when it fails.

Addressing all four before writing any outer-ring tooling means every subsequent lab (containers,
CI, observability) starts from a solid, portable base.

## The principle (public anchor)

> **The Twelve-Factor App** — Adam Wiggins, Heroku (2011, still canonical).
>
> - [12factor.net](https://12factor.net) — factors III (Config), IV (Backing services), XI (Logs)
> - Factors addressed: III (Config), IV (Backing services via migrations), VI (Processes/stateless), XI (Logs)

## Prerequisites

- Completed Lab 01 · `npm run module:begin 02`
- Postgres running on `localhost:5433` (via `docker compose up -d postgres` from the repo root)

## Walkthrough

### R02 — Environment-only config

1. Open `apps/api/src/config/env.schema.ts`. The Zod `envSchema` already declares all required
   variables: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `NODE_ENV`, `LOG_LEVEL`, `URL_PREVIEW`,
   `CORS_ORIGINS`. In `02-start`, these are absent or defaulted in code.

2. Wire the schema into `ConfigModule.forRoot({ validate: (raw) => validateEnv(raw) })` in
   `apps/api/src/app/app.module.ts`. After this change, starting the API without `DATABASE_URL`
   set should throw a Zod parse error and exit — *loud failure over silent misconfiguration*.

3. Create `.env.example` listing every variable name with a comment but no real value. Ensure
   `.env` is in `.gitignore`.

### R03 — Externalized secrets

4. Run `gitleaks detect --source . --log-opts HEAD` — it should find the committed `.env`.
   Remove `.env` from git tracking (`git rm --cached .env`), add it to `.gitignore`, re-run
   gitleaks: clean.

### R04 — Migrations + restart-survival

5. In `apps/api/src/database/data-source.ts`, set `synchronize: false` and `migrationsRun: true`.
   The two migration classes (`InitialSchema1782220891606`, `AddFeatureFlags1782300000000`) in
   `apps/api/src/database/migrations/` are already written; register them in the `migrations`
   array.

6. Test restart-survival: create a link, kill the API process (`Ctrl-C`), restart it, confirm the
   link still resolves. The migration check also runs `npm run migration:run` against a fresh DB
   and verifies the schema is correct.

7. Explore the `migration:generate` and `migration:run` scripts in `package.json` — these are the
   only path to future schema changes.

### R05 — Pino structured logs

8. Replace `NestFactory.create(AppModule)` with `NestFactory.create(AppModule, { bufferLogs: true
   })` and call `app.useLogger(app.get(Logger))` (from `nestjs-pino`). In `app.module.ts`, add
   `LoggerModule.forRootAsync(...)` with `genReqId` reading `x-request-id` or generating a UUID.

9. Make a request: `curl -H "x-request-id: my-trace-id" http://localhost:3000/api/health`. Pipe
   the API output through `jq` — every log line should be a JSON object with `"requestId":
   "my-trace-id"`.

## Exercise

Run the API with a deliberately wrong `DATABASE_URL` (e.g. `DATABASE_URL=bad node dist/...`) and
confirm it exits with a clear Zod validation error rather than a cryptic TypeORM connection
failure. Document the error message in a comment in `env.schema.ts`.

## Verify

```bash
npm run readiness:check R02 R03 R04 R05
```

All four checks must be green:
- **R02**: API boots from env alone; no literal config values found by the probe.
- **R03**: `gitleaks detect` exits 0 (clean); `.env` not tracked by git.
- **R04**: Kill + restart cycle with Postgres running — all links survive; `synchronize: false`
  confirmed in `data-source.ts`.
- **R05**: A request to `/api/health` produces a JSON log line with a `requestId` field.

## Compare

```bash
npm run module:compare 02
```

Key diffs to review: `app.module.ts` (ConfigModule + LoggerModule + ThrottlerModule wiring),
`data-source.ts` (`synchronize: false`, `migrationsRun: true`, explicit migration classes),
`env.schema.ts` (Zod schema + `validateEnv`), `.gitignore` (`.env` entry), `.env.example`.

## Cheat sheet

| Command | What it does |
|---|---|
| `docker compose up -d postgres` | Start Postgres on 5433 |
| `npm run migration:run` | Apply pending migrations |
| `npm run migration:generate -- --name Foo` | Generate a new migration from entity diff |
| `npm run migration:revert` | Roll back the last migration |
| `gitleaks detect --source . --log-opts HEAD` | Scan git history for secrets |
| `curl ... \| jq .` | Pretty-print a JSON log line |

**Gotcha:** `migrationsRun: true` runs migrations *in the app process* on boot — not via a
separate `typeorm migration:run` step. This means a fresh container self-migrates. The CLI
(`migration:run`) is for manual one-off runs and for the readiness check.

**Gotcha:** `LoggerModule.forRootAsync` must be imported *before* other modules that use the
logger, or Nest will fall back to the default logger for early bootstrap messages.

## Next → [Lab 03](../03-test-outer-ring/README.md)
