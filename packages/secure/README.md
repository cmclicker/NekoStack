# @nekostack/secure

> Security headers (CSP/HSTS/etc.), CSRF, CORS, input sanitization, PII redaction. The cross-cutting web-security middleware layer. Distinct from `crypto` (primitives), `secrets` (lifecycle), and `auth` (login).

## Quick reference

| | |
|---|---|
| **Build tier** | Security |
| **Depends on** | `schema` (sanitization rules), `audit` (security events), `log` (redaction integration), `telemetry` (redaction integration) |
| **Used by** | every backend (HTTP middleware), `log` (redaction calls), `telemetry` (egress scrubbing), `export` (redaction during egress) |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 6–10 weeks focused |
| **Sellable?** | Low — helmet / cors / etc. cover the niches; integration value |

## Why this exists

Generic security middleware exists (helmet, cors, csurf) but is fragmented and unopinionated. Each project re-decides what CSP allowlist looks like, how CSRF tokens are issued, what gets redacted from logs.

`secure` is the opinionated NekoStack-default middleware. Use it; get the right defaults. Customize when needed.

## Scope

### In scope
- Security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy).
- CSRF protection (double-submit cookie pattern).
- CORS configuration with sensible defaults.
- Input sanitization helpers (HTML, SQL-injection-resistant builders).
- PII detection (heuristic + tagged-field).
- Redaction (scrub / hash) at egress.
- Content Security Policy nonce generation.
- Framework adapters (Nest middleware, Express middleware, Next.js, Hono, Fastify).

### Out of scope
- Login / session (`auth`).
- Cryptographic primitives (`crypto`).
- Secret lifecycle (`secrets`).
- Rate limiting (`limits`).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §33 for the full capability map.

### Owns
- Security headers middleware
- CSRF protection
- CORS configuration
- Input sanitization
- PII detection + redaction primitives
- CSP nonce generation
- Framework adapters

### Does NOT own
| Capability | Lives in |
|---|---|
| Cryptographic primitives | `crypto` |
| Secret lifecycle | `secrets` |
| Login / session | `auth` |
| Rate limiting | `limits` |
| Audit log | `audit` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **helmet** | Mature headers middleware. | Just headers; we orchestrate broader. |
| **cors** | Standard CORS middleware. | Just CORS. |
| **csurf** | CSRF middleware. | Old, unmaintained. |
| **DOMPurify** | HTML sanitization. | Substrate. |

## How this fits the NekoStack

- **`log`** redacts via us.
- **`telemetry`** scrubs egress via us.
- **`export`** redacts via us.
- **`api`** mounts us as middleware.

## Design philosophy

- **Opinionated defaults.** Use NekoStack defaults; customize when needed.
- **Egress scrubbing automatic.** Redaction happens at log/telemetry/error boundaries without per-call effort.
- **PII detection is heuristic + tagged.** Schema-tagged PII is scrubbed for sure; heuristic catches stray fields.

## Architecture sketch

```
packages/secure/
├── src/
│   ├── headers/
│   │   ├── csp.ts
│   │   ├── hsts.ts
│   │   └── all.ts
│   ├── csrf/
│   │   └── double-submit.ts
│   ├── cors/
│   │   └── config.ts
│   ├── sanitize/
│   │   ├── html.ts
│   │   └── sql.ts
│   ├── pii/
│   │   ├── detect.ts
│   │   ├── scrub.ts
│   │   └── hash.ts
│   ├── nonce/
│   │   └── generate.ts
│   ├── adapters/
│   │   ├── nest.ts
│   │   ├── express.ts
│   │   ├── nextjs.ts
│   │   ├── hono.ts
│   │   └── fastify.ts
│   └── cli.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Headers middleware
### v0.2 — CORS
### v0.3 — CSRF
### v0.4 — PII redaction
### v0.5 — Input sanitization
### v0.6 — Framework adapters
### v1.0 — Stable API

## Product potential

**Internal:** Used by every backend.
**Open source release:** Marginal — niches covered.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Security.
- **Estimated learning return:** High. CSP semantics, CSRF patterns, redaction strategies — production security baseline.
