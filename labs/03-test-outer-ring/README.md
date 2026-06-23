# Lab 03 — Test Outer Ring   ·   Capability: Tests   ·   Manifest: R06   ·   Ring: outer

## What you'll learn

How to build the outer test ring: integration tests that run against a real Postgres testcontainer
(no mocks), two end-to-end BDD tests that cover the Create and Resolve critical workflows
(Playwright + playwright-bdd), a coverage floor that gates the build, property-based tests for
slug uniqueness (fast-check), and mutation testing (Stryker) that verifies the suite actually
catches regressions.

## The Other Computer Test

Unit tests pass on your machine because you wrote them to match your implementation. The outer
ring fails the moment the app runs on someone else's computer: the database has a different schema,
the network stack behaves differently, the browser rendering engine differs. Integration and E2E
tests that run against real dependencies are the only evidence that the two critical workflows
work end-to-end — not in theory, but in fact.

## Where the seed leaves it  →  Where production needs it

| Dimension | Seed (dev-grade) | Product-grade |
|---|---|---|
| Scope | CLI unit/component specs (inner ring only) | Integration vs Postgres testcontainer + 2 BDD E2E |
| Critical workflows | Untested end-to-end | `@create` and `@resolve` Playwright scenarios green |
| Coverage | No floor | Configured floor (e.g. 80% statements); build fails below it |
| Property tests | None | fast-check on slug generation (uniqueness, length, charset) |
| Mutation | None | Stryker score ≥ floor; suite detects real regressions |

## Why it matters

The seed's inner-ring specs prove the code compiles and the logic is internally consistent. They
do not prove the two critical workflows run end-to-end against a real database, real HTTP, and a
real browser. When you break the redirect path by changing a migration column name, an integration
test catches it in CI. When a slug collision bug slips through review, fast-check finds the
counter-example. When mutation testing reveals that removing a `!== null` check doesn't break any
test, you know the suite has a blind spot.

## The principle (public anchor)

> **The Testing Pyramid** — Mike Cohn / Martin Fowler / Google SRE.
>
> - [martinfowler.com/articles/practical-test-pyramid.html](https://martinfowler.com/articles/practical-test-pyramid.html)
> - [sre.google/books/building-secure-reliable-systems](https://sre.google/books/building-secure-reliable-systems/) — Chapter 14, Testing Reliability
> - [fast-check.dev](https://fast-check.dev) — property-based testing
> - [stryker-mutator.io](https://stryker-mutator.io) — mutation testing

## Prerequisites

- Completed Lab 02 · `npm run module:begin 03`
- Docker running (testcontainers pulls `postgres:16-alpine` on first run)

## Walkthrough

### Integration tests (testcontainer)

1. Look at `apps/api/src/links/links.service.spec.ts` (or the equivalent integration spec in
   `02-start`). It uses the Nest default logger and no real database.

2. Refactor the integration suite to use `@testcontainers/postgresql`: spin up a real Postgres
   container in `beforeAll`, run migrations against it, tear it down in `afterAll`. This pattern
   is already wired in the `03-start` scaffold — fill in the missing assertions.

3. Write at minimum: a test that creates a link, then resolves it via `RedirectService`, and
   asserts the returned URL matches and a `Click` was recorded.

### BDD E2E (Playwright + playwright-bdd)

4. The `apps/web-e2e/` directory contains Gherkin feature files tagged `@create` and `@resolve`.
   In `03-start` the step implementations are empty (`pending`). Implement the steps:
   - `@create`: log in, create a link via the Angular UI, assert the slug appears in the list.
   - `@resolve`: follow the short URL (without the `/api` prefix), assert the browser lands on
     `example.com` and the click count increments in the detail view.

5. The API's `/api/test/reset` endpoint (non-prod only) truncates the DB — call it in
   `beforeEach` so E2E tests are hermetic.

### Coverage floor

6. In `vitest.config.ts` (or the Nx project config), set `coverage.thresholds` to `{ statements:
   80, branches: 75 }`. Run `nx run-many -t test --coverage`; the build fails if the floor is
   not met.

### Property tests (fast-check)

7. In `libs/common-models/src/lib/slug.spec.ts`, add a fast-check property: for any two
   independently generated slugs, they must not be equal (uniqueness under seeded randomness).
   Also assert the charset is `[a-z2-7]` (base32) and the length is between 4 and 32 characters.

### Mutation testing (Stryker)

8. `npm run mutation` runs StrykerJS. The config is in `stryker.config.mjs` (provided in the
   `03-start` scaffold). Review the HTML report in `reports/mutation/` — find one surviving
   mutant and add a test to kill it.

## Exercise

Add a third fast-check property: for any valid slug, `isActive({ expires_at: null })` returns
`true` (a link with no expiry is always active), and for any past ISO timestamp,
`isActive({ expires_at: past })` returns `false`. This exercises the expiry guard in
`@tracer/common-models` without mocking.

## Verify

```bash
npm run readiness:check R06
```

Green means:
- `nx run-many -t test` exits 0
- Coverage is at or above the configured floor
- `npx stryker run` exits 0 with score ≥ floor
- Breaking the `POST /api/links` body (`slug` missing) makes the `@create` E2E fail

The R06 check runs the full suite inside the probe; it may take 2–3 minutes on first run as the
testcontainer image is pulled.

## Compare

```bash
npm run module:compare 03
```

Key diffs: `apps/web-e2e/` step implementations, `apps/api/src/**/*.spec.ts` (testcontainer
pattern), `libs/common-models/src/lib/slug.spec.ts` (fast-check), `stryker.config.mjs`.

## Cheat sheet

| Command | What it does |
|---|---|
| `nx run-many -t test` | Run all unit + integration tests |
| `nx run-many -t test --coverage` | Run with coverage report |
| `npx nx e2e web-e2e` | Run Playwright E2E suite |
| `npm run mutation` | Run Stryker mutation testing |
| `docker ps` | Confirm testcontainer Postgres started |

**Gotcha:** Testcontainers uses Docker to pull and run `postgres:16-alpine`. On first run this
adds 30–60 seconds. Subsequent runs use the cached image.

**Gotcha:** The `/api/test/reset` endpoint is gated to non-production environments by
`assertNonProd()`. If `NODE_ENV=production` the endpoint returns 403 — always run E2E against
`NODE_ENV=test`.

**Gotcha:** Playwright-bdd generates step scaffolding from the Gherkin files. If you add a new
`When` step, run `npx bddgen` first to regenerate the test runner files.

## Next → [Lab 04](../04-delivery-pipeline/README.md)
