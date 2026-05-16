# @nekostack/fetch

> Typed HTTP client with retry / backoff / circuit-breaker / request coalescing / idempotency. The outbound counterpart to `api` (which is inbound).

## Quick reference

| | |
|---|---|
| **Build tier** | Data layer — networking |
| **Depends on** | `schema` (response validation), `telemetry` (request metrics), `errors` (typed network errors), `trace` (propagation) |
| **Used by** | `webhooks` (outbound dispatch), `billing` (Stripe API calls), `email` (Resend API), `notify` (push provider), any product calling external HTTP services |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 4–8 weeks focused |
| **Sellable?** | Low — axios / ky / undici dominate; library-level addition niche |

## Why this exists

`fetch()` is fine for simple cases. Real production HTTP clients need:
- Retry with exponential backoff (for transient errors).
- Circuit breaker (stop hammering a dead service).
- Request deduplication (coalesce concurrent identical requests).
- Idempotency keys (safe retries for non-idempotent endpoints like Stripe POSTs).
- Typed response validation (response shape matches expected schema).
- Distributed tracing propagation (span headers).
- Telemetry on every request.

Every product reimplements a subset of these. `fetch` solves them once.

## Scope

### In scope
- Typed `fetch<T>` with schema-validated response.
- Retry with exponential backoff.
- Circuit breaker per endpoint.
- Request coalescing (dedupe concurrent identical requests).
- Idempotency-key generation + injection.
- Trace propagation (W3C traceparent headers via `trace`).
- Telemetry on every request.
- Request/response interceptors.
- Timeout enforcement.

### Out of scope
- HTTP server (`api`).
- WebSocket / SSE (`realtime`).
- GraphQL client (out of scope).
- Browser-only optimizations (universal client).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §32 for the full capability map.

### Owns
- Typed HTTP client wrapper
- Retry + exponential backoff
- Circuit breaker
- Request coalescing
- Idempotency key handling
- Trace propagation
- Telemetry emission
- Timeout enforcement

### Does NOT own
| Capability | Lives in |
|---|---|
| HTTP server | `api` |
| WebSocket / realtime | `realtime` |
| Webhook outbound dispatch (uses us) | `webhooks` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **fetch (native)** | Universal. | No retry, circuit-breaker, validation. |
| **axios** | Mature. | No first-class circuit-breaker / coalescing. |
| **ky** | Modern fetch wrapper. | Closer; no validation / circuit-breaker. |
| **undici** | Fast native. | Substrate. |
| **got** | Node-only. | Node-only. |

## How this fits the NekoStack

- **`webhooks`** dispatches outbound via us.
- **`billing`** calls Stripe via us.
- **`email`** calls Resend via us.
- **`trace`** propagates spans.
- **`telemetry`** receives per-request metrics.

## Design philosophy

- **Typed responses.** Schema-validated; runtime errors on shape mismatch.
- **Retries are smart.** Only retry idempotent + transient errors.
- **Circuit breaker per endpoint.** A dead service doesn't take down the rest.
- **Tracing free.** Every request carries trace headers.

## Architecture sketch

```
packages/fetch/
├── src/
│   ├── client/
│   │   ├── fetch.ts
│   │   └── typed.ts
│   ├── retry/
│   │   ├── policy.ts
│   │   └── backoff.ts
│   ├── circuit/
│   │   └── breaker.ts
│   ├── coalesce/
│   │   └── dedupe.ts
│   ├── idempotency/
│   │   └── key.ts
│   ├── trace/
│   │   └── propagate.ts
│   ├── telemetry/
│   │   └── emit.ts
│   ├── interceptors/
│   │   ├── request.ts
│   │   └── response.ts
│   └── timeout/
│       └── enforce.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Typed fetch + schema validation
### v0.2 — Retry + backoff
### v0.3 — Circuit breaker
### v0.4 — Request coalescing
### v0.5 — Idempotency keys
### v0.6 — Trace propagation
### v0.7 — Telemetry
### v1.0 — Stable API

## Product potential

**Internal:** Used everywhere.
**Open source release:** Marginal.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Data layer.
- **Estimated learning return:** High. Retry strategies, circuit breakers, request coalescing — production resilience patterns.
