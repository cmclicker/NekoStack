# @nekostack/events

> Event sourcing / CQRS scaffolding. Event-as-source-of-truth state. **Distinct from `telemetry`** (observability events) and **`audit`** (compliance log).

## Quick reference

| | |
|---|---|
| **Build tier** | Data layer |
| **Depends on** | `schema` (event shape), `storage` (event log persistence), `audit` (event log audit), `time` |
| **Used by** | `flow` (workflows are event-sourced), `replay` (game replay = event re-execution), any product wanting source-of-truth event sourcing |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 10â€“16 weeks focused |

## Why this exists

Three "event" packages, distinct shapes:

- **`telemetry`** â€” observability events ("user clicked X"). Sampled, lossy, analytics.
- **`audit`** â€” compliance log ("user X performed action Y"). Append-only, tamper-evident, regulatory.
- **`events`** â€” source-of-truth events ("order placed"). The state of the system is *derived* from these. Replayable, foundational.

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

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§24 for the full capability map.

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
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ definition/
â”‚   â”‚   â””â”€â”€ event.ts
â”‚   â”œâ”€â”€ store/
â”‚   â”‚   â”œâ”€â”€ append.ts
â”‚   â”‚   â””â”€â”€ read.ts
â”‚   â”œâ”€â”€ projection/
â”‚   â”‚   â”œâ”€â”€ compute.ts
â”‚   â”‚   â””â”€â”€ catchup.ts
â”‚   â”œâ”€â”€ cqrs/
â”‚   â”‚   â””â”€â”€ read-model.ts
â”‚   â”œâ”€â”€ replay/
â”‚   â”‚   â””â”€â”€ from-zero.ts
â”‚   â”œâ”€â”€ snapshot/
â”‚   â”‚   â””â”€â”€ compact.ts
â”‚   â”œâ”€â”€ aggregate/
â”‚   â”‚   â””â”€â”€ boundary.ts
â”‚   â””â”€â”€ cli.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Event definition + append-only store
### v0.2 â€” Projections
### v0.3 â€” Replay
### v0.4 â€” Snapshots
### v0.5 â€” Aggregates
### v0.6 â€” Schema versioning
### v1.0 â€” Stable API

## Product potential

**Internal:** Foundational for `flow` and `replay`.
**Open source release:** Plausible â€” TS-native ES libraries are sparse.
**Commercial:** Marginal â€” niche.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Data layer.
- **Estimated learning return:** Very high. Event sourcing + CQRS theory + projections â€” foundational data architecture.
