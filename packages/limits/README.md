# @nekostack/limits

> Rate limiting, concurrency caps, abuse detection. The "too much, slow down" layer. Feeds denial input into `auth.AccessDecision`.

## Quick reference

| | |
|---|---|
| **Build tier** | Security |
| **Depends on** | `schema` (limit policies), `auth` (rate-limit denials feed AccessDecision), `tenant` (per-tenant limits), `entitlements` (plan-based limits), `cache` / Redis (counters), `telemetry` (rate-limit hits) |
| **Used by** | `api` (per-endpoint rate limiting), `auth` (login attempt limits), `webhooks` (per-source limits), `email` (send-rate limits), any product with abuse exposure |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 4–8 weeks focused |
| **Sellable?** | Low — rate-limiter-flexible / Upstash dominate; library-level addition |

## Why this exists

Rate limits gate "too many requests" rather than "no permission." They're distinct from auth (role-based) and entitlements (plan-based). Common needs:

- "Max 100 API requests per IP per minute."
- "Max 5 login attempts per email per hour."
- "Max 10 webhook deliveries per second to a single endpoint."
- "Pro tier: 1000 req/min; Free tier: 60 req/min" (entitlement-aware).

`limits` is the policy + enforcement layer.

## Scope

### In scope
- Rate limit policies (per-IP, per-user, per-tenant, per-API-key).
- Token bucket + sliding window algorithms.
- Concurrency limits (max in-flight requests).
- Burst windows.
- Entitlement-aware limits (plan determines cap).
- Abuse detection heuristics (spike detection, repeat-offender flagging).
- Denial input feeding `auth.AccessDecision`.
- Framework middleware adapters.

### Out of scope
- Authorization (`permissions`).
- Plan logic itself (`entitlements`).
- Webhook delivery retries (`webhooks`).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §13 for the full capability map.

### Owns
- Rate limit policies + algorithms
- Concurrency limits
- Burst windows
- Tenant-specific limits
- Entitlement-aware limits
- Abuse detection
- Rate-limit denial input

### Does NOT own
| Capability | Lives in |
|---|---|
| Authentication | `auth` |
| Permissions | `permissions` |
| Plan logic | `entitlements` |
| Counter substrate | `cache` / Redis |
| Audit | `audit` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **express-rate-limit** | Mature. | Express-only, no tenant/entitlement awareness. |
| **rate-limiter-flexible** | Modern, multi-store. | Substrate. |
| **Upstash Ratelimit** | Hosted Redis. | Vendor-coupled. |

## How this fits the NekoStack

- **`auth`** consumes our denial input.
- **`tenant`** scopes limits.
- **`entitlements`** sets per-plan caps.
- **`cache`** / Redis is the counter substrate.
- **`telemetry`** receives rate-limit-hit events.

## Design philosophy

- **Multiple algorithms.** Token bucket and sliding window for different use cases.
- **Tenant + plan aware.** Limits scale with plan.
- **Abuse detection beyond rate.** Spike heuristics catch what flat rate limits miss.

## Architecture sketch

```
packages/limits/
├── src/
│   ├── policy/
│   │   └── policy.ts
│   ├── algorithms/
│   │   ├── token-bucket.ts
│   │   └── sliding-window.ts
│   ├── concurrency/
│   │   └── cap.ts
│   ├── burst/
│   │   └── window.ts
│   ├── abuse/
│   │   ├── spike.ts
│   │   └── repeat-offender.ts
│   ├── decision/
│   │   └── input.ts          # feeds auth
│   ├── adapters/
│   │   ├── nest.ts
│   │   └── express.ts
│   └── cli.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Token bucket
### v0.2 — Sliding window
### v0.3 — Tenant + entitlement awareness
### v0.4 — Concurrency limits
### v0.5 — Abuse detection
### v0.6 — Framework adapters
### v1.0 — Stable API

## Product potential

**Internal:** Required for any public-facing product.
**Open source release:** Modest.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Security.
- **Estimated learning return:** High. Rate-limit algorithms, abuse detection, distributed counter patterns.
