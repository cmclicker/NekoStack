# @nekostack/metrics

> Counter / gauge / histogram primitives. Metric definitions, SLO declarations, exporters (Prometheus / OTLP). **Distinct from `telemetry`** (typed events for analytics) â€” metrics are numerical counters/gauges/histograms.

## Quick reference

| | |
|---|---|
| **Build tier** | Observability |
| **Depends on** | `schema` (metric definitions), `tenant` (per-tenant scoping); external: prom-client or OpenTelemetry metrics SDK |
| **Used by** | every backend (request counters, latency histograms); `health` (some health checks use metrics); `bench` (compares metric values across runs) |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 4â€“8 weeks focused |

## Why this exists

Telemetry events are good for "user clicked X" â€” categorical, often high-cardinality, sampled. Metrics are good for "5,432 requests served in the last minute with p99 latency 245ms" â€” numerical, aggregated, dimensional.

Mixing them leads to: storing per-event records when a counter would do, or losing high-cardinality detail when only aggregate-numerical was needed.

`metrics` is the numerical aggregation layer.

## Scope

### In scope
- Counter / gauge / histogram / summary primitives.
- Typed metric definitions (registered names + labels).
- Metric labels (low-cardinality dimensions).
- Aggregation (sum, avg, percentiles).
- Exporters: Prometheus pull endpoint, OTLP push.
- SLO / SLI definitions.
- Per-tenant metric scoping.

### Out of scope
- Typed event analytics (`telemetry`).
- Tracing spans (`trace`).
- Errors (`errors`).
- Logs (`log`).
- Audit (`audit`).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§17 for the full capability map.

### Owns
- Counter / gauge / histogram primitives
- Metric definitions registry
- Metric labels (low-cardinality)
- Aggregation
- Exporters (Prometheus / OTLP)
- SLO / SLI definitions
- Per-tenant scoping

### Does NOT own
| Capability | Lives in |
|---|---|
| Typed event analytics | `telemetry` |
| Distributed tracing | `trace` |
| Error tracking | `errors` |
| Logs | `log` |
| Audit | `audit` |
| Performance benchmarks | `bench` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **prom-client** | Prometheus client. | Substrate; we wrap. |
| **OpenTelemetry metrics SDK** | Modern standard. | Substrate; we wrap. |
| **Datadog metrics** | Hosted. | Vendor lock. |

## How this fits the NekoStack

- **`schema`** for metric definitions.
- **`tenant`** for per-tenant scoping.
- **`health`** consumes some metric values.
- **`bench`** captures snapshots over time.

## Design philosophy

- **Low-cardinality only.** Labels with high cardinality (user IDs) cause prometheus cardinality explosion. We enforce.
- **Typed registration.** Metrics are registered up-front, not invented inline.
- **SLOs as code.** SLO definitions live in the codebase, not in a dashboard config.

## Architecture sketch

```
packages/metrics/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ primitives/
â”‚   â”‚   â”œâ”€â”€ counter.ts
â”‚   â”‚   â”œâ”€â”€ gauge.ts
â”‚   â”‚   â”œâ”€â”€ histogram.ts
â”‚   â”‚   â””â”€â”€ summary.ts
â”‚   â”œâ”€â”€ registry/
â”‚   â”‚   â””â”€â”€ register.ts
â”‚   â”œâ”€â”€ labels/
â”‚   â”‚   â””â”€â”€ cardinality.ts    # enforce low-cardinality
â”‚   â”œâ”€â”€ aggregate/
â”‚   â”‚   â””â”€â”€ percentile.ts
â”‚   â”œâ”€â”€ exporters/
â”‚   â”‚   â”œâ”€â”€ prometheus.ts
â”‚   â”‚   â””â”€â”€ otlp.ts
â”‚   â”œâ”€â”€ slo/
â”‚   â”‚   â””â”€â”€ define.ts
â”‚   â””â”€â”€ cli.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Counter / gauge / histogram primitives
### v0.2 â€” Registry + label-cardinality enforcement
### v0.3 â€” Prometheus exporter
### v0.4 â€” OTLP exporter
### v0.5 â€” SLO definitions
### v0.6 â€” Tenant scoping
### v1.0 â€” Stable API

## Product potential

**Internal:** Used by every backend.
**Open source release:** Marginal.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Observability.
- **Estimated learning return:** Moderate. Counter / gauge / histogram semantics, cardinality discipline, SLO design.
