# @nekostack/fetch

> Typed HTTP client with retry / backoff / circuit-breaker / request coalescing / idempotency. The outbound counterpart to `api` (which is inbound).

## Quick reference

| | |
|---|---|
| **Build tier** | Data layer â€” networking |
| **Depends on** | `schema` (response validation), `telemetry` (request metrics), `errors` (typed network errors), `trace` (propagation) |
| **Used by** | `webhooks` (outbound dispatch), `billing` (Stripe API calls), `email` (Resend API), `notify` (push provider), any product calling external HTTP services |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 4â€“8 weeks focused |

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

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§32 for the full capability map.

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
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ client/
â”‚   â”‚   â”œâ”€â”€ fetch.ts
â”‚   â”‚   â””â”€â”€ typed.ts
â”‚   â”œâ”€â”€ retry/
â”‚   â”‚   â”œâ”€â”€ policy.ts
â”‚   â”‚   â””â”€â”€ backoff.ts
â”‚   â”œâ”€â”€ circuit/
â”‚   â”‚   â””â”€â”€ breaker.ts
â”‚   â”œâ”€â”€ coalesce/
â”‚   â”‚   â””â”€â”€ dedupe.ts
â”‚   â”œâ”€â”€ idempotency/
â”‚   â”‚   â””â”€â”€ key.ts
â”‚   â”œâ”€â”€ trace/
â”‚   â”‚   â””â”€â”€ propagate.ts
â”‚   â”œâ”€â”€ telemetry/
â”‚   â”‚   â””â”€â”€ emit.ts
â”‚   â”œâ”€â”€ interceptors/
â”‚   â”‚   â”œâ”€â”€ request.ts
â”‚   â”‚   â””â”€â”€ response.ts
â”‚   â””â”€â”€ timeout/
â”‚       â””â”€â”€ enforce.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Typed fetch + schema validation
### v0.2 â€” Retry + backoff
### v0.3 â€” Circuit breaker
### v0.4 â€” Request coalescing
### v0.5 â€” Idempotency keys
### v0.6 â€” Trace propagation
### v0.7 â€” Telemetry
### v1.0 â€” Stable API

## Product potential

**Internal:** Used everywhere.
**Open source release:** Marginal.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Data layer.
- **Estimated learning return:** High. Retry strategies, circuit breakers, request coalescing â€” production resilience patterns.
