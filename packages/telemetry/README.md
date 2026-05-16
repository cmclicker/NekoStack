# @nekostack/telemetry

> Typed event schemas, structured ingestion, time-series query, privacy-aware logging. The product-analytics layer. Distinct from `log` (runtime debug), `audit` (compliance-grade), `trace` (request spans), `metrics` (counters), and `events` (event sourcing source-of-truth).

## Quick reference

| | |
|---|---|
| **Build tier** | Force multiplier — build early, observability is a habit not a retrofit |
| **Depends on** | `schema` (event schemas), `lint` (enforces all events in `*.events.ts` registered to catalog), `secure` (PII scrubbing primitives) |
| **Used by** | `auth` (access-decision events), `audit` (subset), `rules` (fire events), `entitlements` (usage events), every product surface |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 6–12 weeks focused |
| **Sellable?** | Plausible OSS (typed-event-catalog niche undersupplied); commercial "self-hosted typed-events analytics" at sub-PostHog pricing tier |

## Why this exists

Most projects "do telemetry" by either:
1. Sprinkling `console.log` everywhere and grepping stdout, or
2. Renting Sentry / PostHog / Datadog and shipping `analytics.track('did_thing', { foo: bar })` everywhere with untyped property bags.

The first has no schema, no aggregation, no privacy story. The second hits the wall the moment you want to:
- Know which events exist without searching the codebase.
- Validate that an event's payload matches a schema.
- Replay events into a local environment for debugging.
- Audit which events contain PII.
- Stop renting and own the data.

`@nekostack/telemetry` is the typed-events-first answer. Every event is defined in a `*.events.ts` file with a schema. The catalog is centrally registered (enforced by `@nekostack/lint`). Emission is typed against the catalog — emitting an undeclared event is a compile error. Sinks (console, file, OpenTelemetry, custom) are pluggable. Time-series queries run against the local store or a remote backend.

Building this yourself rather than using Segment / PostHog / Sentry is justified because:
1. **Schema discipline.** Generic analytics libraries accept any property bag. Your events are typed and validated.
2. **Privacy by construction.** Every field is tagged as `pii` or `safe`. PII fields are scrubbed or hashed before egress.
3. **Local-first.** Telemetry data lives where you put it. SQLite or Parquet for local; OTLP for remote; either way you own it.
4. **No per-event pricing.** Datadog charges per custom metric. PostHog charges per event. Your own pipeline doesn't.

## Scope

### In scope
- Event schema definitions via `@nekostack/schema`.
- Centralized event catalog (every event in one queryable registry).
- Typed emission: `telemetry.emit('puzzle.completed', { ... })` with schema-validated payload.
- PII tagging per field.
- Sinks: console (pretty), file (NDJSON), SQLite, OpenTelemetry (OTLP), custom.
- Query API: filter by time range, event type, payload predicates.
- Privacy filters: scrub or hash PII before egress to remote sinks.
- Sampling: head-based sampling at emission, tail-based sampling at the query layer.
- Time-series aggregation: bucket by minute/hour/day, count/sum/avg.

### Out of scope
- Long-term cold storage (Parquet on S3, etc.) — could come later, not in v1.
- Real-time anomaly detection. Different package or external tool.
- APM-style distributed tracing — that's `@nekostack/trace`. Telemetry is for events; trace is for spans.
- Frontend session replay (Hotjar-style) — different shape.
- Marketing analytics dashboards. We provide the data; visualization is consumer-side.

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §16 for the full capability map. Critical clarification: telemetry, log, audit, trace, metrics, and events are all distinct.

### Owns
- Typed event catalog + centralized registry
- Schema-validated event emission
- Per-field PII tagging (`pii: 'scrub' | 'hash' | 'safe'`)
- Sinks: console (pretty), NDJSON file, SQLite, OTLP, custom
- Query API (filter + time-bucket aggregation)
- Head-based sampling
- Replay recorded events into a local environment

### Does NOT own
| Capability | Lives in |
|---|---|
| Structured runtime debug logging | `log` |
| Counter / gauge / histogram primitives | `metrics` |
| Distributed tracing spans + propagation | `trace` |
| Compliance-grade tamper-evident audit log | `audit` (we emit a subset; audit stores) |
| Event sourcing as source-of-truth state | `events` (we are observability; events are authoritative) |
| Error tracking + grouping | `errors` |
| Health probes | `health` |
| Performance benchmarks | `bench` |
| PII detection / scrubbing primitives | `secure` (we tag fields; secure scrubs at egress) |
| Frontend session replay (Hotjar-style) | out of scope |

## Competitors and adjacent tools

| Tool | What they do well | Where they fall short for us |
|---|---|---|
| **PostHog** | Excellent product analytics SaaS, also self-hostable. | Event property bags untyped. No first-class schema. Self-hosting is heavyweight. |
| **Segment** | Mature CDP. | Untyped events, pricey, fan-out hub model. |
| **Sentry** | Errors first, recent events support. | Error-focused; events are second-class. |
| **Datadog** | Mature, deep APM. | Enterprise pricing, lock-in. |
| **OpenTelemetry** | Open standard for instrumentation. | We *use* OpenTelemetry as a sink. Not competing. |
| **Mixpanel** | Product analytics. | Untyped, vendor-locked. |
| **Custom Postgres event log** | Cheap, integrated. | Manual schema enforcement, manual query layer. We're building a thin layer here. |

The right framing: `@nekostack/telemetry` is **the typed front-end** of an observability pipeline. The back-end can be SQLite for local dev, OTLP for production, or a custom sink. Schema and validation are ours; storage is plug-replaceable.

## How this fits the NekoStack

**Depends on:**
- `@nekostack/schema` — event schemas.
- `@nekostack/lint` — enforces that all events are registered in `*.events.ts` files.

**Used by:**
- `@nekostack/auth` — emits access-decision events.
- `@nekostack/audit` — audit events are a tagged subset of telemetry events.
- `@nekostack/rules` — emits rule-fire events.
- `@nekostack/entitlements` — emits usage events.
- Every product surface — `puzzle.completed`, `champion.balance.changed`, `agent.action.taken`, `order.placed`, etc.

## Design philosophy

- **Typed catalog or it didn't happen.** Every event has a schema and a name. Undeclared event names cause compile errors.
- **PII is tagged, never accidental.** Each schema field is `pii: 'scrub' | 'hash' | 'safe'`. The egress filter does the right thing.
- **Sinks are pluggable.** Local SQLite for dev, OTLP for prod, both for staging.
- **Sampling at the source.** Head sampling decides what's emitted; we don't ship everything to filter later.
- **Time is a first-class axis.** Time-bucket aggregation is built in; rolling up by hour/day is one call.
- **Replay-friendly.** Recorded events can be replayed into a local environment for debugging.

## Architecture sketch

```
packages/telemetry/
├── src/
│   ├── catalog/
│   │   ├── register.ts       # registerEvent(name, schema)
│   │   └── lookup.ts
│   ├── emit/
│   │   ├── core.ts           # emit() — validates + routes to sinks
│   │   └── batch.ts          # batching for high-throughput emission
│   ├── pii/
│   │   ├── scrub.ts          # redaction
│   │   └── hash.ts           # SHA-256 hashing of bounded identifiers
│   ├── sinks/
│   │   ├── console.ts        # pretty CLI
│   │   ├── ndjson.ts         # file-based NDJSON
│   │   ├── sqlite.ts         # local store
│   │   ├── otlp.ts           # OpenTelemetry OTLP
│   │   └── custom.ts         # plug-in contract
│   ├── query/
│   │   ├── filter.ts         # by time, type, predicate
│   │   └── aggregate.ts      # time-bucket aggregation
│   ├── sample/
│   │   └── head.ts           # head sampling strategies
│   └── replay/
│       └── replay.ts         # replay recorded events
├── tests/
└── README.md
```

Defining and emitting:

```ts
// puzzle.events.ts
import { defineEvent, s } from '@nekostack/telemetry';

export const PuzzleCompleted = defineEvent('puzzle.completed', {
  schema: s.object({
    userId: s.string().pii('hash'),
    gameKey: s.string(),
    dayKey: s.string(),
    durationSec: s.number(),
    mistakes: s.number(),
    hintsUsed: s.number(),
  }),
});

// somewhere in your code
telemetry.emit(PuzzleCompleted, {
  userId: actor.id,
  gameKey: 'sudoku',
  dayKey: '2026-05-15',
  durationSec: 412,
  mistakes: 0,
  hintsUsed: 0,
});
```

Querying (local SQLite sink):

```ts
const completions = await telemetry.query({
  type: 'puzzle.completed',
  since: '2026-05-01',
  filter: (e) => e.gameKey === 'sudoku',
});

const dailyCounts = telemetry.aggregate(completions, {
  by: 'day',
  metric: 'count',
});
```

## Roadmap

### v0.1 — Schema + emit
- `defineEvent`, `registerEvent`, `emit`.
- Console sink only.

### v0.2 — File sinks
- NDJSON file sink.
- SQLite sink with timestamped table.

### v0.3 — PII handling
- Field tagging.
- Scrub/hash egress filters.

### v0.4 — Sampling
- Head sampling configuration.

### v0.5 — Query layer
- Filter API, time-range, predicate.
- Time-bucket aggregation.

### v0.6 — OTLP sink
- OpenTelemetry export for production.

### v0.7 — Replay
- Recorded-event replay tool (`neko telemetry replay`).

### v1.0 — Stable API
- Documentation site with patterns: product analytics, audit, anti-cheat signals.
- Performance benchmarks (events/sec at each sink).

## Product potential

**Internal use:** Very high. The shared observability backbone.

**Open source release:** Plausible. The typed-event-catalog pattern is genuinely undersupplied in JS observability. Most tools are either too generic (Segment) or too heavy (PostHog). A small typed-first library could attract users. MIT release.

**Commercial product:** Plausible as **"hosted typed-events analytics"** at a friendlier price point than PostHog. Niche but real. Alternatively, as a self-hosted appliance.

**Estimated effort to v1.0:** 6-12 weeks of focused work. Core is small; the sinks and the query layer are where time goes.

## Status

- **Current:** Empty placeholder. Not started.
- **Owner:** Cody (solo dev project).
- **Priority tier:** Force multiplier. Build early — observability is a habit, and if it's not there from day one it never gets retrofitted properly.
- **Estimated learning return:** High. Event schema design, time-series patterns, sink architecture, PII discipline, sampling strategies — all transferable to any future data-pipeline work.
