# @nekostack/metrics

> Counter / gauge / histogram primitives. Metric definitions, SLO declarations, exporters (Prometheus / OTLP). **Distinct from `telemetry`** (typed events for analytics) — metrics are numerical counters/gauges/histograms.

## Quick reference

| | |
|---|---|
| **Build tier** | Observability |
| **Depends on** | `schema` (metric definitions), `tenant` (per-tenant scoping); external: prom-client or OpenTelemetry metrics SDK |
| **Used by** | every backend (request counters, latency histograms); `health` (some health checks use metrics); `bench` (compares metric values across runs) |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 4–8 weeks focused |
| **Sellable?** | Low — Prometheus / OTel dominate; library-level addition |

## Why this exists

Telemetry events are good for "user clicked X" — categorical, often high-cardinality, sampled. Metrics are good for "5,432 requests served in the last minute with p99 latency 245ms" — numerical, aggregated, dimensional.

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

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §17 for the full capability map.

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
├── src/
│   ├── primitives/
│   │   ├── counter.ts
│   │   ├── gauge.ts
│   │   ├── histogram.ts
│   │   └── summary.ts
│   ├── registry/
│   │   └── register.ts
│   ├── labels/
│   │   └── cardinality.ts    # enforce low-cardinality
│   ├── aggregate/
│   │   └── percentile.ts
│   ├── exporters/
│   │   ├── prometheus.ts
│   │   └── otlp.ts
│   ├── slo/
│   │   └── define.ts
│   └── cli.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Counter / gauge / histogram primitives
### v0.2 — Registry + label-cardinality enforcement
### v0.3 — Prometheus exporter
### v0.4 — OTLP exporter
### v0.5 — SLO definitions
### v0.6 — Tenant scoping
### v1.0 — Stable API

## Product potential

**Internal:** Used by every backend.
**Open source release:** Marginal.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Observability.
- **Estimated learning return:** Moderate. Counter / gauge / histogram semantics, cardinality discipline, SLO design.
