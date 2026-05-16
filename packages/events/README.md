# @nekostack/events

> Event sourcing / CQRS scaffolding. Event-as-source-of-truth state. **Distinct from `telemetry`** (observability events) and **`audit`** (compliance log).

## Quick reference

| | |
|---|---|
| **Build tier** | Data layer |
| **Depends on** | `schema` (event shape), `storage` (event log persistence), `audit` (event log audit), `time` |
| **Used by** | `flow` (workflows are event-sourced), `replay` (game replay = event re-execution), any product wanting source-of-truth event sourcing |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 10–16 weeks focused |
| **Sellable?** | Plausible OSS — TS-native event sourcing is undersupplied |

## Why this exists

Three "event" packages, distinct shapes:

- **`telemetry`** — observability events ("user clicked X"). Sampled, lossy, analytics.
- **`audit`** — compliance log ("user X performed action Y"). Append-only, tamper-evident, regulatory.
- **`events`** — source-of-truth events ("order placed"). The state of the system is *derived* from these. Replayable, foundational.

Event sourcing flips the usual database model: instead of storing current state and losing history, you store the events that produced the state. Current state is computed by replaying events. This enables: replay, time-travel, audit (free), workflow durability, CRDT-like merging.

## Scope

### In scope
- Event definition (typed schemas).
- Event store (append-only persistence).
- Projections (compute current state from events).
- CQRS read-model construction.
- Event replay (rebuild state from event log).
- Snapshots (compaction for performance).
- Aggregates / consistency boundaries.

### Out of scope
- Telemetry / analytics events (`telemetry`).
- Audit log (`audit`).
- Real-time messaging (`realtime`).
- Job queue (`queue`).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §24 for the full capability map.

### Owns
- Event sourcing primitives
- Event store (append-only)
- Projections / read-model construction
- CQRS scaffolding
- Replay
- Snapshots / compaction
- Aggregates

### Does NOT own
| Capability | Lives in |
|---|---|
| Telemetry / analytics events | `telemetry` |
| Audit / compliance log | `audit` |
| Real-time messaging | `realtime` |
| Job queue | `queue` |
| Workflow orchestration | `flow` (uses events as substrate) |
| Game replay specifics | `replay` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **EventStoreDB** | Mature event store. | Heavy, separate service. |
| **Marten** | .NET event sourcing on Postgres. | Wrong language. |
| **Apache Kafka** | Event log. | Operationally heavy, not source-of-truth-shaped for app data. |
| **Custom event tables** | Common. | No projections, no snapshots, no aggregate boundaries. |

## How this fits the NekoStack

- **`flow`** uses us for durable workflow state.
- **`replay`** uses us conceptually for game replay.
- **`storage`** is the persistence substrate.

## Design philosophy

- **Events are immutable.** Once recorded, never modified.
- **State is derived.** Projections compute current state from events.
- **Snapshots compact.** Old aggregates snapshot for replay performance.
- **Schema versioning is required.** Event schemas evolve; old events still readable.

## Architecture sketch

```
packages/events/
├── src/
│   ├── definition/
│   │   └── event.ts
│   ├── store/
│   │   ├── append.ts
│   │   └── read.ts
│   ├── projection/
│   │   ├── compute.ts
│   │   └── catchup.ts
│   ├── cqrs/
│   │   └── read-model.ts
│   ├── replay/
│   │   └── from-zero.ts
│   ├── snapshot/
│   │   └── compact.ts
│   ├── aggregate/
│   │   └── boundary.ts
│   └── cli.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Event definition + append-only store
### v0.2 — Projections
### v0.3 — Replay
### v0.4 — Snapshots
### v0.5 — Aggregates
### v0.6 — Schema versioning
### v1.0 — Stable API

## Product potential

**Internal:** Foundational for `flow` and `replay`.
**Open source release:** Plausible — TS-native ES libraries are sparse.
**Commercial:** Marginal — niche.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Data layer.
- **Estimated learning return:** Very high. Event sourcing + CQRS theory + projections — foundational data architecture.
