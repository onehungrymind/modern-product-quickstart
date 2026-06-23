# OWASP ASVS Security Checklist — Tracer API

> Aligned with OWASP Application Security Verification Standard (ASVS) v4.0 and OWASP Top 10:2025.
> Each item shows its verification status and where the control is enforced in the codebase.

## Legend
- ✅ Implemented — control is enforced in code
- ⚠️ Partial — mitigation present; hardening opportunity noted
- ❌ Not applicable or out of scope for this tier

---

## V1 · Architecture, Design & Threat Modelling

| # | Requirement | Status | Enforcement |
|---|-------------|--------|-------------|
| 1.1 | Threat model documented (SSRF, open-redirect, DoS, auth bypass) | ✅ | This checklist + `docs/slo.md` |
| 1.2 | Layered defences (validation → DNS guard → fetch guard) | ✅ | `common-models/url-safety.ts` + `HttpUrlPreviewProvider` |
| 1.3 | Least-privilege DB user (`tracer` role, no superuser) | ✅ | `docker-compose.yml` |
| 1.4 | Secrets never committed; loaded from env | ✅ | `apps/api/src/config/env.schema.ts` (`JWT_SECRET`, `DATABASE_URL`) |

---

## V2 · Authentication (ASVS Chapter 2)

| # | Requirement | Status | Enforcement |
|---|-------------|--------|-------------|
| 2.1 | Passwords hashed with bcrypt (cost ≥ 10) | ✅ | `apps/api/src/auth/auth.service.ts` |
| 2.2 | JWT tokens with short expiry signed with HS256 + secret ≥ 32 bytes | ✅ | `apps/api/src/auth/jwt.strategy.ts`; env validation enforces `JWT_SECRET` |
| 2.3 | Auth token delivered via `httpOnly; sameSite=lax` cookie | ✅ | `apps/api/src/auth/auth.controller.ts` (`setAuthCookie`) |
| 2.4 | Logout clears the auth cookie server-side | ✅ | `auth.controller.ts` `POST /auth/logout` |
| 2.5 | Global JWT guard — all routes authenticated by default | ✅ | `app.module.ts` → `{ provide: APP_GUARD, useClass: JwtAuthGuard }` |
| 2.6 | `@Public()` decorator explicitly opts out of auth (opt-in security) | ✅ | `apps/api/src/auth/decorators/public.decorator.ts` |
| 2.7 | Rate limiting on login endpoint (anti brute-force) | ✅ | `ThrottlerGuard` global, 200 req/min per IP (see V4 below) |

---

## V3 · Session Management

| # | Requirement | Status | Enforcement |
|---|-------------|--------|-------------|
| 3.1 | Session token (JWT) unpredictable — `crypto.randomUUID()` seed | ✅ | NestJS JWT / jsonwebtoken |
| 3.2 | Cookie flags: `httpOnly`, `sameSite=lax`, `secure` in prod | ✅ | `auth.controller.ts` `setAuthCookie` |
| 3.3 | Token does not appear in URLs or logs | ✅ | Cookie-only delivery; pino config excludes cookie header from default serialisers |

---

## V4 · Access Control & Rate Limiting (OWASP A01 + A04:2021)

| # | Requirement | Status | Enforcement |
|---|-------------|--------|-------------|
| 4.1 | Ownership check on every resource access | ✅ | `links.service.ts` `findOne(id, ownerId)` — WHERE clause includes owner |
| 4.2 | Global rate limiting — prevents DoS / brute-force | ✅ | `ThrottlerModule.forRoot([{ ttl: 60_000, limit: 200 }])` + `APP_GUARD ThrottlerGuard` in `app.module.ts` |
| 4.3 | Rate limit applies before auth guard (login endpoint protected) | ✅ | `ThrottlerGuard` registered before `JwtAuthGuard` in providers array |
| 4.4 | Test-reset endpoint gated to non-production | ✅ | `test.controller.ts` `assertNonProd()` |

---

## V5 · Validation, Sanitisation & Encoding (OWASP A03:2021)

| # | Requirement | Status | Enforcement |
|---|-------------|--------|-------------|
| 5.1 | All API inputs validated via Zod schemas | ✅ | `ZodValidationPipe` global in `app.module.ts`; schemas in `@tracer/common-models` |
| 5.2 | `target_url` scheme allowlist: only `http` / `https` | ✅ | `CreateLinkSchema.target_url.refine(isSafeTargetUrl)` in `link.schema.ts` |
| 5.3 | Private/loopback/link-local IP literals blocked (SSRF A05:2025) | ✅ | `isSafeTargetUrl()` in `libs/common-models/src/lib/url-safety.ts` — covers 127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, ::1, fc00::/7, fe80::/10 |
| 5.4 | `localhost` / `*.localhost` hostnames blocked | ✅ | `isSafeTargetUrl()` hostname check |
| 5.5 | DNS-rebinding guard: hostname DNS-resolved and result checked | ✅ | `HttpUrlPreviewProvider.fetchTitle()` resolves hostname via `node:dns/promises` before fetching |
| 5.6 | `axios maxRedirects: 0` — never follow redirects into internal space | ✅ | `HttpUrlPreviewProvider` axios config |
| 5.7 | Slug format enforced (base32, 4–32 chars) | ✅ | `SLUG_PATTERN` regex in `CreateLinkSchema` |
| 5.8 | Email format and password minimum validated | ✅ | `RegisterSchema` / `LoginSchema` in `auth.schema.ts` |

---

## V6 · Cryptography

| # | Requirement | Status | Enforcement |
|---|-------------|--------|-------------|
| 6.1 | No hard-coded secrets in source | ✅ | All secrets via env; `env.schema.ts` enforces minimum length of `JWT_SECRET` |
| 6.2 | Passwords not logged or returned in API responses | ✅ | User schema excludes `password_hash`; pino redacts body on 401 |
| 6.3 | Correlation IDs use `crypto.randomUUID()` | ✅ | `app.module.ts` pino `genReqId` |

---

## V7 · Error Handling & Logging

| # | Requirement | Status | Enforcement |
|---|-------------|--------|-------------|
| 7.1 | Structured JSON logs with correlation IDs | ✅ | `nestjs-pino` + `LoggerModule` in `app.module.ts` |
| 7.2 | Errors do not leak internal stack traces to clients | ✅ | NestJS exception filters return standardised error shape; stack omitted in prod |
| 7.3 | SSRF guard returns `null` (no error detail) to caller | ✅ | `HttpUrlPreviewProvider` silently returns null on unsafe URL |

---

## V9 · Communications Security

| # | Requirement | Status | Enforcement |
|---|-------------|--------|-------------|
| 9.1 | Security headers set (XSS protection, content-type nosniff, frame deny) | ✅ | `helmet()` in `apps/api/src/main.ts` |
| 9.2 | CORS restricted to allowed origin | ✅ | `cors({ origin: FRONTEND_URL, credentials: true })` in `main.ts` |
| 9.3 | HTTPS enforced in production (TLS termination) | ⚠️ | TLS terminated at reverse-proxy / load-balancer (out of app scope); cookie `secure: true` enforced in prod |

---

## V13 · API & Web Service Security

| # | Requirement | Status | Enforcement |
|---|-------------|--------|-------------|
| 13.1 | All API routes under `/api` prefix | ✅ | `setGlobalPrefix('api')` in `main.ts` |
| 13.2 | Content-Type `application/json` validated | ✅ | NestJS / `ZodValidationPipe` rejects malformed bodies |
| 13.3 | Open-redirect blocked at link creation | ✅ | `CreateLinkSchema.target_url.refine(isSafeTargetUrl)` rejects `javascript:`, `data:`, `file:`, etc. |
| 13.4 | SSRF blocked at link creation AND at preview fetch | ✅ | Two-layer defence: schema validation + DNS-resolution guard in provider |

---

## Summary

| OWASP Top 10:2025 | Mitigation |
|-------------------|-----------|
| A01 Broken Access Control | Ownership checks on all link/click resources; JWT guard global |
| A02 Cryptographic Failures | bcrypt passwords; `httpOnly` JWT cookie; `JWT_SECRET` length enforced |
| A03 Injection | Zod input validation on all routes; TypeORM parameterised queries |
| A04 Insecure Design | Defence-in-depth SSRF guard (schema + DNS + axios redirect); rate limiting |
| A05 Security Misconfiguration | Helmet headers; CORS; test-reset non-prod gated; no auto-sync DB |
| A07 Identification & Authentication Failures | Rate limiting on login; `httpOnly` cookie; no session fixation |
| A09 Security Logging & Monitoring | Structured pino logs; OTel traces + metrics; SLO alert wired |
| A10 SSRF (Server-Side Request Forgery) | `isSafeTargetUrl` scheme/IP allowlist + DNS resolution guard + `maxRedirects: 0` |

> Last updated: 2026-06-23 · Tracer R12 hardening
