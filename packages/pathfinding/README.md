# @nekostack/pathfinding

> A*, Dijkstra, jump-point search, navmesh, hierarchical pathfinding. Spatial path-planning algorithms. Distinct from `graph` (generic graph) â€” pathfinding is spatial-aware.

## Quick reference

| | |
|---|---|
| **Build tier** | Game systems |
| **Depends on** | `schema`, `graph` (substrate for graph-shaped maps), `tilemap` (spatial grid representation) |
| **Used by** | Leytide (NPC + player navigation), tower defense, any game with worlds bigger than a screen |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 6â€“10 weeks focused |

## Why this exists

Pathfinding is well-studied. JS implementations exist but are mostly toys. Real games need:
- A* with custom heuristics.
- Jump-point search (faster on grids).
- Navmesh (for non-grid worlds).
- Hierarchical pathfinding (HPA* â€” cluster-then-refine for huge worlds).
- Dynamic re-planning on obstacle changes.

`pathfinding` is the TS implementation.

## Scope

### In scope
- A* with pluggable heuristics.
- Dijkstra (no heuristic).
- Jump-point search (grid-optimized).
- Navmesh + navmesh-A*.
- Hierarchical pathfinding (HPA*).
- Dynamic re-planning.
- Path smoothing.
- Multi-agent pathfinding (cooperative A*).

### Out of scope
- AI decision-making (`ai`).
- Map / tile rendering (`tilemap` / `map`).
- Procedural generation of maps (`procgen`).
- Physics simulation.

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§43 for the full capability map.

### Owns
- A* / Dijkstra / JPS
- Navmesh + navmesh-A*
- Hierarchical pathfinding
- Path smoothing
- Multi-agent pathfinding
- Dynamic re-planning

### Does NOT own
| Capability | Lives in |
|---|---|
| AI decision-making | `ai` |
| Map rendering | `tilemap` / `map` |
| Procedural map generation | `procgen` |
| Generic graph algorithms (non-spatial) | `graph` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **easystarjs** | TS A*. | Just A*; no JPS / navmesh. |
| **PathFinding.js** | TS pathfinding. | Stale, just basic algorithms. |
| **Recast/Detour** | Industry navmesh. | C++; we'd wrap. |

## How this fits the NekoStack

- **`graph`** for non-spatial graph algos.
- **`tilemap`** for grid maps.
- **`ai`** uses us for movement planning.
- **`procgen`** generates the maps we navigate.

## Design philosophy

- **Multiple algorithms.** Right tool for the map (grid â†’ JPS; mesh â†’ navmesh-A*; huge â†’ HPA*).
- **Custom heuristics.** Plug in distance functions.
- **Dynamic re-plan.** Obstacles appear; recompute affected paths.

## Architecture sketch

```
packages/pathfinding/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ a-star/
â”‚   â”‚   â”œâ”€â”€ search.ts
â”‚   â”‚   â””â”€â”€ heuristic.ts
â”‚   â”œâ”€â”€ dijkstra/
â”‚   â”‚   â””â”€â”€ search.ts
â”‚   â”œâ”€â”€ jps/
â”‚   â”‚   â””â”€â”€ jump-point.ts
â”‚   â”œâ”€â”€ navmesh/
â”‚   â”‚   â”œâ”€â”€ mesh.ts
â”‚   â”‚   â””â”€â”€ search.ts
â”‚   â”œâ”€â”€ hierarchical/
â”‚   â”‚   â””â”€â”€ hpa.ts
â”‚   â”œâ”€â”€ smooth/
â”‚   â”‚   â””â”€â”€ path.ts
â”‚   â”œâ”€â”€ multi-agent/
â”‚   â”‚   â””â”€â”€ cooperative.ts
â”‚   â””â”€â”€ dynamic/
â”‚       â””â”€â”€ replan.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” A* + heuristics
### v0.2 â€” Dijkstra
### v0.3 â€” JPS for grids
### v0.4 â€” Navmesh
### v0.5 â€” Path smoothing
### v0.6 â€” HPA*
### v0.7 â€” Dynamic re-planning
### v0.8 â€” Multi-agent
### v1.0 â€” Stable API

## Product potential

**Internal:** Critical for Leytide.
**Open source release:** Plausible â€” TS pathfinding gap.
**Commercial:** Marginal.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Game systems.
- **Estimated learning return:** Very high. A* / heuristics / JPS / navmesh â€” classic and important CS.
