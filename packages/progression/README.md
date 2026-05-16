# @nekostack/progression

> Unlock graphs, leveling curves, skill trees, achievement systems. The "what's unlocked when?" layer. Works in games + EdTech (where "skills" are learning content).

## Quick reference

| | |
|---|---|
| **Build tier** | Game systems |
| **Depends on** | `schema`, `graph` (unlock DAG), `math` (curves), `telemetry` (progression events), `audit` (unlocks audited) |
| **Used by** | NekoBattler (champion unlocks, season pass), Leytide (skill tree, level-up), NekoGacha (collection completion), EdTech (curriculum mastery), gamified apps |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 6–10 weeks focused |
| **Sellable?** | Plausible OSS — TS progression library is undersupplied |

## Why this exists

Progression is everywhere: levels, skill trees, achievements, season passes, curriculum, unlocks. Every product reinvents the patterns. `progression` provides primitives:
- Unlock graphs (DAG of prerequisites).
- Leveling curves (linear / log / exp / piecewise).
- Skill trees (graph + spend mechanics).
- Achievements (event-driven unlock triggers).
- Mastery progression (for EdTech: "concept X mastered when 10 successful attempts").
- Season passes (cadence-based content unlocks).

## Scope

### In scope
- Unlock graph definitions.
- Prerequisite resolution (what's unlockable given current state).
- Leveling curve functions.
- Skill-tree primitives (spend points, branch).
- Achievement definitions (event-triggered).
- Mastery state machines.
- Season-pass scheduling (via `time`).
- Progression telemetry (unlock events).

### Out of scope
- Currency mechanics (`economy`).
- Game-specific content (consuming product).
- Curriculum content (EdTech-specific consumer).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §43 (progression row).

### Owns
- Unlock graph definitions
- Prerequisite resolution
- Leveling curves
- Skill-tree primitives
- Achievement definitions
- Mastery state machines
- Season-pass scheduling
- Progression events

### Does NOT own
| Capability | Lives in |
|---|---|
| Currency / economy | `economy` |
| Game content (champion definitions etc.) | consuming game |
| Curriculum content | EdTech consumer |
| Generic graph primitives | `graph` |
| Math / curve functions | `math` |
| Time / season schedules | `time` |

## How this fits the NekoStack

- **`graph`** for unlock DAGs.
- **`math`** for curve functions.
- **`telemetry`** for unlock events.
- **`time`** for season pass cadence.

## Design philosophy

- **Graph-shaped.** Unlocks form a DAG; same primitives work for skill trees, curriculums, achievements.
- **Curves are configurable.** Linear / log / exp / piecewise.
- **Mastery is real progress.** EdTech mastery isn't "did X once" — it's "demonstrated proficiency."
- **Achievements are event-driven.** Listen for events, trigger unlocks.

## Architecture sketch

```
packages/progression/
├── src/
│   ├── unlock-graph/
│   │   ├── graph.ts
│   │   └── resolve.ts
│   ├── curve/
│   │   ├── linear.ts
│   │   ├── log.ts
│   │   └── piecewise.ts
│   ├── skill-tree/
│   │   ├── tree.ts
│   │   └── spend.ts
│   ├── achievement/
│   │   ├── definition.ts
│   │   └── trigger.ts
│   ├── mastery/
│   │   └── state-machine.ts
│   ├── season-pass/
│   │   └── schedule.ts
│   └── telemetry/
│       └── emit.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Unlock graph + prerequisite resolution
### v0.2 — Leveling curves
### v0.3 — Skill trees
### v0.4 — Achievement definitions
### v0.5 — Mastery state machines
### v0.6 — Season-pass scheduling
### v1.0 — Stable API

## Product potential

**Internal:** Used by every game + EdTech project.
**Open source release:** Plausible — niche is empty.
**Commercial:** Marginal.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Game systems.
- **Estimated learning return:** High. Unlock graphs, curve design, mastery models — broadly applicable to games + EdTech + gamification.
