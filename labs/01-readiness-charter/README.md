# Lab 01 — Readiness Charter   ·   Capability: Definition of done   ·   Manifest: R01   ·   Ring: outer

## What you'll learn

How to name what "production-ready" means for Tracer *before* touching any code — in the form of
a machine-checkable charter that every later lab targets. You will author `docs/charter.md`: SLOs
for the redirect hot path, the two critical workflows that must never silently break, and the
complete delta inventory that is the spine of the course.

## The Other Computer Test

On your machine you know instinctively whether the app is "working." The moment it runs on someone
else's computer — a server, a teammate's laptop, a CI runner — you need an *explicit, shared
definition* of what "working" means. Without a charter, there is no way to tell whether a lab's
change actually made the app more production-ready, or just changed it.

## Where the seed leaves it  →  Where production needs it

| Dimension | Seed (dev-grade) | Product-grade target |
|---|---|---|
| Definition of done | Implicit — "it ran on my machine" | Explicit charter: SLOs, critical workflows, delta inventory |
| SLO | None | Redirect p99 < 100 ms; 99.9% availability (30-day window) |
| Critical workflows | Undocumented | Create (`POST /api/links`) and Resolve (`GET /:slug`) named and tested |
| Delta inventory | None | R01–R14 listed with check commands |

## Why it matters

A PRR without a written charter is a conversation, not a gate. The charter is the spec that makes
every subsequent readiness check a binary pass/fail rather than an opinion. When `npm run
readiness` turns all-green in Lab 10, you are not celebrating aesthetics — you are certifying
that every promise made in this document has been kept.

Authoring the charter *first* also forces the conversation about SLOs before the code is written.
That is the point: the SLO shapes the instrumentation (Lab 07), the error budget (Lab 08), and the
incident protocol (Lab 08) — not the other way around.

## The principle (public anchor)

> **AWS Well-Architected Framework** (Operational Excellence pillar) + **Google SRE — Production
> Readiness Review**.
>
> - [sre.google/books/site-reliability-engineering](https://sre.google/books/site-reliability-engineering/) — Chapter 32, "The Production Readiness Review"
> - [docs.aws.amazon.com/wellarchitected/latest/framework](https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html)

## Prerequisites

- Completed `npm run module:begin 01` (places you at the `01-start` tag — the seed + the readiness
  harness but no charter)
- Docker running (needed from Lab 02 onward; confirm now with `docker info`)

## Walkthrough

1. **Tour the seed.** Run `npm run dev` (or `npx nx serve api` + `npx nx serve web`) and exercise
   both critical workflows manually: create a link, follow the short URL, watch the click recorded.
   Note what is missing: no SLO, no structured logs, no CI, no containers.

2. **Open `docs/charter.template.md`** (provided in the seed). It has the section headings;
   you fill in the values.

3. **Define the SLOs.** The redirect hot path (`GET /:slug`) is the only user-facing latency-
   sensitive route. Set:
   - Latency SLO: p99 < 100 ms
   - Availability SLO: 99.9% over a 30-day rolling window
   Compute the error budget: `(1 − 0.999) × 30 × 24 × 60 = 43.2 minutes/month`. Record this.

4. **Name the critical workflows.** Two workflows must never silently break:
   - **Create** — `POST /api/links` mints a unique `slug`; the `link_title_preview` flag gates the
     optional `UrlPreviewProvider` fetch.
   - **Resolve** — `GET /:slug` issues a `302` to `target_url` **and** records a `Click`. The hot
     path; home of the SLOs.

5. **Build the delta inventory.** List all 14 deltas (R01–R14) with their capability names and
   the lab that promotes each. This table is what `npm run readiness` will walk in Lab 10.

6. **Write `docs/charter.md`** from the template. The check (`scripts/readiness/checks/r01.mjs`)
   parses the file and asserts that both SLO targets and both workflow names are present.

## Exercise

Extend the charter with a brief *definition of done* paragraph in your own words: what does
"Tracer is a product" mean to you, and which of the 14 deltas would you prioritize if you could
only ship 5? (This is not checked by `readiness:check` — it is the thinking the charter is
designed to provoke.)

## Verify

```bash
npm run readiness:check R01
```

Green means: `docs/charter.md` parses as valid Markdown; both SLO targets (100 ms, 99.9%) and
both critical workflow names (Create, Resolve) are present; the delta inventory lists R01–R14.

## Compare

```bash
npm run module:compare 01
```

## Cheat sheet

| What | Where |
|---|---|
| Charter template | `docs/charter.template.md` |
| Finished charter (answer key) | `docs/charter.md` |
| SLO detail | `docs/slo.md` |
| Readiness check | `npm run readiness:check R01` |
| Error budget formula | `(1 − SLO) × window_minutes` → 43.2 min/month |

**Gotcha:** The R01 check is a text scan — it looks for the literal strings `100` (ms) and `99.9`
(%) and the words "Create" and "Resolve". Keep those in the charter; don't paraphrase them away.

## Next → [Lab 02](../02-twelve-factor/README.md)
