# @nekostack/ai

> **Game AI primitives** (FSM, behavior trees, GOAP, utility AI). Decision-making for NPCs, enemies, autobattler units. **NOT the LLM layer** — LLM provider abstraction lives in `prompts` + `tools` + `chat`.

## Quick reference

| | |
|---|---|
| **Build tier** | Game systems |
| **Depends on** | `schema` (AI state shape), `rules` (action triggers), `random` (decision noise), `sim` (AI runs inside a sim), `telemetry` |
| **Used by** | NekoBattler (champion combat AI), Leytide (NPC behavior), tower-defense modes, any game with non-player decision-makers |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 10–16 weeks focused |
| **Sellable?** | Plausible OSS — TS game AI libraries are sparse |

## Why this exists

Game AI is its own discipline with established patterns:
- **FSM** (Finite State Machine) — simple agents (patrol → chase → attack).
- **Behavior Tree** — hierarchical decision-making (used everywhere from Unreal to Halo).
- **GOAP** (Goal-Oriented Action Planning) — agents pick action sequences to achieve goals.
- **Utility AI** — score-based decision (Sims-style).

These are well-studied. JS implementations are sparse. `ai` brings them to NekoStack.

**Naming clarification:** This package is **game AI** only. The package for LLM stuff is `prompts` + `tools` + `chat` + `rag` + `memory` + `eval`. Different concepts; clear boundary in BOUNDARIES.md.

## Scope

### In scope
- FSM primitives.
- Behavior tree primitives (sequence, selector, parallel, decorator nodes).
- GOAP planner (A* over action graphs).
- Utility AI (action scoring + selection).
- Steering behaviors (for movement: seek, flee, wander, flock).
- Decision-tree primitives.
- AI debugging tools (visualize decision flow).

### Out of scope
- LLM provider abstraction (`prompts`).
- Pathfinding (`pathfinding`).
- Procedural generation (`procgen`).
- Real-time multiplayer netcode (`realtime`).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §43 for the full capability map.

### Owns
- FSM primitives
- Behavior tree primitives
- GOAP planner
- Utility AI
- Steering behaviors
- Decision trees
- AI debugging

### Does NOT own
| Capability | Lives in |
|---|---|
| LLM model abstraction | `prompts` |
| LLM tool registry | `tools` |
| Pathfinding | `pathfinding` |
| Game-specific behavior content (champion abilities) | consuming games |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **Unity Behavior Designer** | Mature visual BT editor. | Unity-coupled. |
| **GOAPlanner (Unreal)** | Mature GOAP. | Engine-coupled. |
| **mistreevous** | TS behavior tree. | Just BT; we want full kit. |
| **Custom switch-statement AI** | Common. | Doesn't scale. |

## How this fits the NekoStack

- **`rules`** for trigger conditions.
- **`random`** for non-determinism (when desired).
- **`sim`** is the environment AI runs inside.
- **`pathfinding`** complements (AI decides where to go; pathfinding plans how).

## Design philosophy

- **Multiple paradigms.** FSM for simple, BT for hierarchical, GOAP for planning, utility for fuzzy.
- **Deterministic by default.** With same seed, AI makes same decisions.
- **Debuggable.** Decision flow is inspectable, not opaque.

## Architecture sketch

```
packages/ai/
├── src/
│   ├── fsm/
│   │   ├── state.ts
│   │   └── transition.ts
│   ├── behavior-tree/
│   │   ├── node.ts
│   │   ├── sequence.ts
│   │   ├── selector.ts
│   │   ├── parallel.ts
│   │   └── decorator.ts
│   ├── goap/
│   │   ├── action.ts
│   │   ├── goal.ts
│   │   └── plan.ts           # A* over actions
│   ├── utility/
│   │   ├── score.ts
│   │   └── select.ts
│   ├── steering/
│   │   ├── seek.ts
│   │   ├── flee.ts
│   │   ├── wander.ts
│   │   └── flock.ts
│   ├── decision-tree/
│   │   └── tree.ts
│   └── debug/
│       └── trace.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — FSM primitives
### v0.2 — Behavior tree primitives
### v0.3 — Utility AI
### v0.4 — GOAP planner
### v0.5 — Steering behaviors
### v0.6 — Debug tools
### v1.0 — Stable API

## Product potential

**Internal:** Used by NekoBattler, Leytide, any game with AI agents.
**Open source release:** Plausible — TS game AI library gap.
**Commercial:** Marginal.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Game systems.
- **Estimated learning return:** Very high. Classic game AI patterns are rich CS — FSM theory, behavior trees, A* planning, utility functions, steering.
