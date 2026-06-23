# Lab 09 — Security   ·   Capability: App security / Supply chain   ·   Manifest: R12 R13   ·   Ring: outer

## What you'll learn

How to defeat three working exploits: an open-redirect attack (`javascript:` scheme injection), a
Server-Side Request Forgery attack (internal network access via `target_url`), and a rate-limit
bypass (DoS via unauthenticated burst). You will wire the scheme allowlist and SSRF guard
(`libs/common-models/src/lib/url-safety.ts`), configure `@nestjs/throttler`, add a CycloneDX
SBOM, and gate the pipeline on `npm audit`. The lab starts with the exploits *succeeding* — your
job is to make them fail.

## The Other Computer Test

On your machine you control every request. On any other computer — the internet — strangers send
requests you did not anticipate. The open-redirect bug lets an attacker create a Tracer short URL
that phishes users. The SSRF bug lets them use your server to probe your internal network and AWS
IMDS. The missing rate limit lets them bring the redirect SLO down with a burst. These are not
theoretical: SSRF is OWASP A10:2021 / A05:2025; open-redirect is A01:2021; missing rate limiting
is A04:2021. They are the outer ring's security concerns — invisible on your machine, exploitable
on any other.

## Where the seed leaves it  →  Where production needs it

| Delta | `09-start` state (vulnerable) | Product-grade (hardened) |
|---|---|---|
| R12 Open-redirect | `javascript:`, `data:`, `file:` URLs accepted by `POST /api/links` | `CreateLinkSchema` refines `target_url` with `isSafeTargetUrl()` — scheme allowlist rejects all non-http/https |
| R12 SSRF | Private IPs (`127.0.0.1`, `10.0.0.1`, `169.254.169.254`) accepted | `isSafeTargetUrl()` + DNS-resolution guard in `HttpUrlPreviewProvider` + `maxRedirects: 0` |
| R12 Rate limit | `ThrottlerModule` imported but not configured; no `ThrottlerGuard` | `ThrottlerModule.forRoot([{ ttl: 60_000, limit: 200 }])` + `ThrottlerGuard` registered before `JwtAuthGuard` |
| R13 SBOM | None | `npm run sbom` → `reports/sbom.json` (CycloneDX format) |
| R13 Dep scan | Not in CI | `supply-chain` job in `ci.yml` runs `npm run audit` — exits non-zero on critical vulns |

## Why it matters

The seed has good inner-ring security (Zod validation, JWT, bcrypt, helmet, CORS). But outer-ring
security is about what happens when the app runs on a public network against adversarial input.
The URL preview port is a real SSRF surface: if the API fetches a URL you supply and that URL
points at `169.254.169.254` (AWS IMDS), an attacker can read instance credentials. The exploit
scripts in `scripts/adversary/` demonstrate this concretely — they succeed against `09-start` and
fail against `09-complete`.

Supply chain security (R13) is separate but equally outer-ring: your dependencies have
vulnerabilities that appear after you ship. An SBOM + `npm audit` in CI means a newly published
CVE on a runtime dependency fails the pipeline before it ships.

## The principle (public anchor)

> **OWASP Top 10:2025** + **OWASP ASVS** (Application Security Verification Standard) + **SLSA** (Supply-chain Levels for Software Artifacts).
>
> - [owasp.org/Top10](https://owasp.org/Top10/) — 2025 edition
> - [owasp.org/www-project-application-security-verification-standard](https://owasp.org/www-project-application-security-verification-standard/)
> - [slsa.dev](https://slsa.dev) — supply chain integrity levels
> - [cyclonedx.org](https://cyclonedx.org) — SBOM standard

## Prerequisites

- Completed Lab 08 · `npm run module:begin 09`
- The `09-start` tag ships the **naive** `HttpUrlPreviewProvider` (no SSRF guard) and the working
  exploit scripts. Do not apply the answer key before running the exploits.

## Walkthrough

### Step 0 — Confirm the exploits succeed (in `09-start`)

Start the API and run the three adversary scripts:

```bash
# In one terminal: start the API (09-start state, no hardening)
DATABASE_URL=postgres://tracer:tracer@localhost:5433/tracer \
JWT_SECRET=local-dev-secret-32-chars-min \
npm run serve:api

# In another terminal:
node scripts/adversary/open-redirect-poc.mjs   # → should print VULNERABLE
node scripts/adversary/ssrf-poc.mjs            # → should print VULNERABLE
node scripts/adversary/ratelimit-poc.mjs       # → should print VULNERABLE (no 429)
```

Each script registers a user, logs in, and attempts the attack. At `09-start`, they succeed —
the server accepts the malicious URLs and returns 201, and burst requests return 200 rather than
429. This is the starting state the lab exists to fix.

### R12 — Open-redirect + SSRF guard

1. Open `libs/common-models/src/lib/url-safety.ts`. The `isSafeTargetUrl(url: string): boolean`
   function is already written in the reference. In `09-start`, it may be absent or a stub that
   returns `true`. Implement or complete it:
   - **Scheme allowlist**: reject anything that is not `http:` or `https:`.
   - **Localhost/loopback hostname**: reject `localhost` and `*.localhost`.
   - **Private IPv4 literals**: reject `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`,
     `192.168.0.0/16`, `169.254.0.0/16` (AWS IMDS lives here).
   - **Private IPv6 literals**: reject `::1`, `fc00::/7`, `fe80::/10`, and IPv4-mapped addresses.

2. Wire `isSafeTargetUrl` into the link creation schema in
   `libs/common-models/src/lib/link.schema.ts`:
   ```ts
   target_url: z.string().url().refine(isSafeTargetUrl, {
     message: 'URL must use http/https and must not target private addresses',
   }),
   ```
   Because `common-models` is the portable core (no framework dependencies), this validation runs
   on every `POST /api/links` via `ZodValidationPipe` — zero extra wiring needed.

3. Open `apps/api/src/ports/url-preview/http-url-preview.provider.ts`. Add the DNS-resolution
   guard (second layer of SSRF defence):
   - After the `isSafeTargetUrl` check, resolve the hostname with `dns.resolve4` / `dns.resolve6`
     and reject any address that lands in a private range (call `isSafeTargetUrl` on the resolved
     IP, e.g. `isSafeTargetUrl('http://' + addr + '/')`).
   - Set `maxRedirects: 0` on the axios call so the provider never follows a redirect into
     internal space.

### R12 — Rate limiting

4. In `apps/api/src/app/app.module.ts`, the `ThrottlerModule` import may be missing or
   unconfigured. Add:
   ```ts
   ThrottlerModule.forRoot([{ ttl: 60_000, limit: 200 }]),
   ```
   In `providers`, register `ThrottlerGuard` *before* `JwtAuthGuard` (order matters — the rate
   limit must fire before auth, so unauthenticated bursts on `/api/auth/login` are throttled):
   ```ts
   { provide: APP_GUARD, useClass: ThrottlerGuard },
   { provide: APP_GUARD, useClass: JwtAuthGuard },
   ```

### R13 — SBOM + dep scan

5. Generate the SBOM:
   ```bash
   npm run sbom
   # Writes reports/sbom.json (CycloneDX JSON format, lists all 1st + transitive deps)
   ```
   Review the SBOM — it lists every runtime dependency with its version and license. This is the
   artifact you would submit to a compliance team or publish alongside a release.

6. Confirm the `supply-chain` job in `.github/workflows/ci.yml` runs `npm run sbom` and then
   `npm run audit`. The `audit` script is `npm audit --audit-level=critical` — it exits non-zero
   only on critical-severity vulnerabilities, so the pipeline is not broken by every advisory.

7. Test the dep-scan gate:
   ```bash
   # The scripts/adversary/vuln-fixture/ directory contains a package with a planted vuln.
   # The R13 check seeds npm audit with a critical advisory to verify the gate fires.
   npm run audit   # should exit 0 against the current clean lockfile
   ```

### ASVS audit

8. Open `docs/asvs-checklist.md` and work through each row. The reference implementation covers:
   - V2 Authentication (bcrypt, JWT, `httpOnly` cookie, global guard, `@Public()` opt-out)
   - V4 Access Control + Rate Limiting
   - V5 Validation (Zod + `isSafeTargetUrl`)
   - V6 Cryptography (no hard-coded secrets)
   - V9 Communications (helmet, CORS)
   - V13 API security (global prefix, `ZodValidationPipe`, SSRF two-layer defence)
   Mark any item you cannot verify as `⚠️ Partial` with a note.

### Step N — Confirm the exploits are defeated

```bash
node scripts/adversary/open-redirect-poc.mjs   # → DEFEATED (all 4xx)
node scripts/adversary/ssrf-poc.mjs            # → DEFEATED (all 4xx)
node scripts/adversary/ratelimit-poc.mjs       # → at least one 429
```

## Exercise

The SSRF guard in `http-url-preview.provider.ts` catches hostnames that DNS-resolve to private
IPs. Write a unit test (with a DNS mock) that verifies a hostname resolving to `169.254.169.254`
returns `null` from `fetchTitle()`. This tests the DNS-rebinding guard — the scenario where an
attacker controls a DNS record that initially resolves to a public IP but then flips to an internal
one.

## Verify

```bash
npm run readiness:check R12 R13
```

Green means:
- `open-redirect-poc.mjs` exits 0 (all attempts 4xx — DEFEATED)
- `ssrf-poc.mjs` exits 0 (all attempts 4xx — DEFEATED)
- `ratelimit-poc.mjs` exits 0 (burst receives at least one 429)
- `reports/sbom.json` exists and is valid CycloneDX JSON
- `npm run audit` exits 0 against the current lockfile

## Compare

```bash
npm run module:compare 09
```

Key diffs: `libs/common-models/src/lib/url-safety.ts` (the full `isSafeTargetUrl` implementation),
`libs/common-models/src/lib/link.schema.ts` (the `.refine()` call), `apps/api/src/ports/url-
preview/http-url-preview.provider.ts` (DNS guard + `maxRedirects: 0`), `apps/api/src/app/
app.module.ts` (ThrottlerModule + guard ordering), `docs/asvs-checklist.md` (filled).

## Cheat sheet

| Command | What it does |
|---|---|
| `node scripts/adversary/open-redirect-poc.mjs` | Test open-redirect hardening |
| `node scripts/adversary/ssrf-poc.mjs` | Test SSRF hardening |
| `node scripts/adversary/ratelimit-poc.mjs` | Test rate-limit configuration |
| `npm run sbom` | Generate CycloneDX SBOM → `reports/sbom.json` |
| `npm run audit` | `npm audit --audit-level=critical` |
| `gitleaks detect --source .` | Scan for committed secrets |

**Gotcha:** `isSafeTargetUrl` lives in `@tracer/common-models` — the zero-framework portable
core. It must not import from Node.js built-ins (no `dns`, no `net`). DNS resolution belongs in
the API layer (`HttpUrlPreviewProvider`), not in `common-models`.

**Gotcha:** `ThrottlerGuard` uses in-memory storage by default. The rate-limit count resets when
the API restarts. This is acceptable for this tier; production would use a Redis-backed
`ThrottlerStorageRedisService`.

**Gotcha:** `npm audit --audit-level=critical` exits non-zero only for `critical` severity. Adjust
to `--audit-level=high` if your organization's policy requires it — but expect more false positives
from transitive dev dependencies.

**Gotcha:** The DNS-resolution guard in `HttpUrlPreviewProvider` uses `dns.resolve4` then falls
back to `dns.resolve6`. On CI runners, IPv6 DNS may be unreliable — the guard catches an error
and returns `null` (safe-to-skip), never bypasses the block.

## Next → [Lab 10](../10-production-readiness-review/README.md)
