# @nekostack/trace

> Distributed tracing (OpenTelemetry-compatible). Spans, propagation, baggage, sampling. The "where did this request go and how long did each step take?" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Observability |
| **Depends on** | external: OpenTelemetry SDK; integrates with `log` (correlation), `errors` (error spans), `fetch` (outbound span propagation), `api` (inbound span creation), `realtime` (per-message spans) |
| **Used by** | every backend; `log` for correlation IDs; debugging slow requests; cross-service request tracking |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 6â€“10 weeks focused |

## Why this exists

OpenTelemetry is the standard for distributed tracing. NekoStack wraps it with conventional configuration:
- Auto-instrumentation for common substrates (HTTP, Prisma, Redis).
- NekoStack-specific span naming.
- Trace â†” log correlation built in.
- Sampling defaults that work for solo-dev scale.

## Scope

### In scope
- Span creation + propagation.
- W3C traceparent header handling.
- Span baggage (cross-span context).
- Sampling (head + tail).
- Auto-instrumentation adapters.
- OTLP export.
- Trace â†” log correlation.
- Error span integration.

### Out of scope
- Metrics (`metrics`).
- Logs (`log`).
- Errors (`errors`, though we span them).
- Audit (`audit`).
- Telemetry events (`telemetry`).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§18 for the full capability map.

### Owns
- Span creation / propagation
- W3C traceparent
- Baggage
- Sampling (head + tail)
- OTLP export
- Trace â†” log correlation
- Auto-instrumentation adapters

### Does NOT own
| Capability | Lives in |
|---|---|
| Metrics | `metrics` |
| Logs | `log` |
| Errors | `errors` |
| Audit | `audit` |
| Telemetry events | `telemetry` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **OpenTelemetry SDK** | Standard. | Substrate; we wrap. |
| **Honeycomb** | Tracing-focused observability. | Vendor. |
| **Datadog APM** | Hosted. | Vendor. |
| **Tempo / Jaeger** | OSS backends. | Backend; we send to them. |

## How this fits the NekoStack

- **`log`** injects correlation IDs.
- **`fetch`** propagates spans outbound.
- **`api`** creates inbound spans.
- **`realtime`** can span per-message handling.
- **`errors`** integrates with error spans.

## Design philosophy

- **Wrap OpenTelemetry; don't reinvent.**
- **Correlation is automatic.**
- **Sample for cost, but keep the interesting traces.**

## Architecture sketch

```
packages/trace/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ span/
â”‚   â”‚   â”œâ”€â”€ create.ts
â”‚   â”‚   â””â”€â”€ propagate.ts
â”‚   â”œâ”€â”€ traceparent/
â”‚   â”‚   â””â”€â”€ w3c.ts
â”‚   â”œâ”€â”€ baggage/
â”‚   â”‚   â””â”€â”€ context.ts
â”‚   â”œâ”€â”€ sample/
â”‚   â”‚   â”œâ”€â”€ head.ts
â”‚   â”‚   â””â”€â”€ tail.ts
â”‚   â”œâ”€â”€ exporters/
â”‚   â”‚   â””â”€â”€ otlp.ts
â”‚   â”œâ”€â”€ instrumentation/
â”‚   â”‚   â”œâ”€â”€ http.ts
â”‚   â”‚   â”œâ”€â”€ prisma.ts
â”‚   â”‚   â””â”€â”€ redis.ts
â”‚   â””â”€â”€ correlation/
â”‚       â””â”€â”€ log.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” OpenTelemetry SDK wrapper
### v0.2 â€” W3C propagation
### v0.3 â€” Auto-instrumentation
### v0.4 â€” Sampling
### v0.5 â€” Log correlation
### v0.6 â€” OTLP export
### v1.0 â€” Stable API

## Product potential

**Internal:** Used by every backend at scale.
**Open source release:** Marginal.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Observability.
- **Estimated learning return:** High. Distributed tracing, span propagation, sampling strategies, OpenTelemetry internals.
