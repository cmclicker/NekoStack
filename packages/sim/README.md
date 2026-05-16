# @nekostack/sim

> Simulation runner. Tick-based + event-based loops. State machines, deterministic seeding for replay, observability of long-running sims. The substrate beneath autobattler combat, business-ops simulations, balance-testing, AI training environments.

## Quick reference

| | |
|---|---|
| **Build tier** | Game systems |
| **Depends on** | `schema` (sim state shape), `rules` (rule engine the sim drives), `random` (deterministic PRNG), `events` (state changes as events), `telemetry`, `replay` (record/playback), `time` |
| **Used by** | NekoBattler (combat sim), NekoGacha (pull simulation), retail-ops simulator, business sandboxes, AI training environments, balance-testing for any game |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 10–16 weeks focused |
| **Sellable?** | Plausible OSS — deterministic sim runners for JS are rare |

## Why this exists

Lots of NekoStack projects need a deterministic simulation loop:
- Autobattler combat (units act, abilities trigger, state evolves).
- Business-ops sandbox (orders flow, employees serve, inventory depletes).
- Balance-testing runs (10,000 simulated matches with parameter sweeps).
- Procgen validation (generate 1000 dungeons, check distribution).

Hand-rolling per project means re-implementing tick scheduling, state-machine driving, determinism guarantees, and observability hooks. `sim` is the substrate.

## Scope

### In scope
- Tick-based simulation loop.
- Event-based simulation loop.
- Hybrid (tick + event) loops.
- State machine driving (delegate to `rules` for triggers).
- Deterministic seeding (any sim is reproducible).
- Observability hooks (per-tick events to `telemetry`, `replay`).
- Sim speed control (real-time / fast-forward / step).
- Batch sim runner (N parallel runs with parameter sweeps).

### Out of scope
- Rule engine itself (`rules`).
- Game AI (`ai`).
- Game-specific systems (combat, economy, progression — those compose us).
- Real-time multiplayer netcode (`realtime`).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §43 for the full capability map.

### Owns
- Tick + event sim loops
- State machine driving
- Deterministic seeding
- Sim speed control
- Batch parallel runs
- Observability hooks

### Does NOT own
| Capability | Lives in |
|---|---|
| Rule engine | `rules` |
| Game AI | `ai` |
| Replay format | `replay` |
| Deterministic PRNG | `random` |
| Event sourcing | `events` |

## How this fits the NekoStack

- **`rules`** is the trigger logic the sim drives.
- **`random`** provides deterministic PRNG.
- **`events`** records state transitions.
- **`replay`** uses sim recordings.
- **`telemetry`** observes batch-run results.

## Design philosophy

- **Determinism is non-negotiable.** Same seed + same inputs → same output, always.
- **Tick-based and event-based both supported.** Game combat is often hybrid.
- **Batch runs for balance.** "Run 10,000 sims with these parameters" is first-class.
- **Speed control.** Sims run at real-time during play, full-speed for headless balance testing.

## Architecture sketch

```
packages/sim/
├── src/
│   ├── loop/
│   │   ├── tick.ts
│   │   ├── event.ts
│   │   └── hybrid.ts
│   ├── state-machine/
│   │   └── drive.ts          # via rules
│   ├── determinism/
│   │   └── seed.ts           # via random
│   ├── speed/
│   │   └── control.ts
│   ├── batch/
│   │   └── parallel.ts
│   ├── observe/
│   │   ├── tick-event.ts     # to telemetry
│   │   └── record.ts         # to replay
│   └── cli.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Tick loop + determinism
### v0.2 — Event loop
### v0.3 — Speed control
### v0.4 — Batch runner
### v0.5 — Rule engine integration
### v0.6 — Replay recording
### v1.0 — Stable API

## Product potential

**Internal:** Critical for NekoBattler, NekoGacha, retail-ops, balance-testing.
**Open source release:** Plausible — gap in JS ecosystem.
**Commercial:** Marginal.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Game systems.
- **Estimated learning return:** Very high. Sim loop design, determinism, batch parameter sweeps, time control.
