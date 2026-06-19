# @nekostack/progression

> Unlock graphs, leveling curves, skill trees, achievement systems. The "what's unlocked when?" layer. Works in games + EdTech (where "skills" are learning content).

## Quick reference

| | |
|---|---|
| **Build tier** | Game systems |
| **Depends on** | `schema`, `graph` (unlock DAG), `math` (curves), `telemetry` (progression events), `audit` (unlocks audited) |
| **Used by** | NekoBattler (champion unlocks, season pass), Leytide (skill tree, level-up), NekoGacha (collection completion), EdTech (curriculum mastery), gamified apps |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 6â€“10 weeks focused |

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

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§43 (progression row).

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
- **Mastery is real progress.** EdTech mastery isn't "did X once" â€” it's "demonstrated proficiency."
- **Achievements are event-driven.** Listen for events, trigger unlocks.

## Architecture sketch

```
packages/progression/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ unlock-graph/
â”‚   â”‚   â”œâ”€â”€ graph.ts
â”‚   â”‚   â””â”€â”€ resolve.ts
â”‚   â”œâ”€â”€ curve/
â”‚   â”‚   â”œâ”€â”€ linear.ts
â”‚   â”‚   â”œâ”€â”€ log.ts
â”‚   â”‚   â””â”€â”€ piecewise.ts
â”‚   â”œâ”€â”€ skill-tree/
â”‚   â”‚   â”œâ”€â”€ tree.ts
â”‚   â”‚   â””â”€â”€ spend.ts
â”‚   â”œâ”€â”€ achievement/
â”‚   â”‚   â”œâ”€â”€ definition.ts
â”‚   â”‚   â””â”€â”€ trigger.ts
â”‚   â”œâ”€â”€ mastery/
â”‚   â”‚   â””â”€â”€ state-machine.ts
â”‚   â”œâ”€â”€ season-pass/
â”‚   â”‚   â””â”€â”€ schedule.ts
â”‚   â””â”€â”€ telemetry/
â”‚       â””â”€â”€ emit.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Unlock graph + prerequisite resolution
### v0.2 â€” Leveling curves
### v0.3 â€” Skill trees
### v0.4 â€” Achievement definitions
### v0.5 â€” Mastery state machines
### v0.6 â€” Season-pass scheduling
### v1.0 â€” Stable API

## Product potential

**Internal:** Used by every game + EdTech project.
**Open source release:** Plausible â€” niche is empty.
**Commercial:** Marginal.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Game systems.
- **Estimated learning return:** High. Unlock graphs, curve design, mastery models â€” broadly applicable to games + EdTech + gamification.
