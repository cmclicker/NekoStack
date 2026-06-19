# @nekostack/graph

> Generic graph primitives: DAG, cycle detection, topological sort, traversal, shortest path (non-spatial), diffing. The "non-spatial-graph algorithms" foundation.

## Quick reference

| | |
|---|---|
| **Build tier** | Utility primitives |
| **Depends on** | `schema` (graph type definitions) |
| **Used by** | `codex` (entity graph), `decision` (decision dependency graph), `workspace` (package dependency graph), `path` (roadmap milestone graph), `progression` (unlock graph), `taxonomy` (hierarchy) |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 4â€“8 weeks focused |

## Why this exists

Many packages need graph algorithms: dependency resolution, cycle detection, topological order, traversal. Each reinvents. `graph` provides the algorithms once.

Note: `pathfinding` is for **spatial** paths (A* on maps). `graph` is for non-spatial graphs (DAGs, dependency, hierarchy).

## Scope

### In scope
- DAG primitives.
- Cycle detection.
- Topological sort.
- BFS / DFS traversal.
- Shortest path (non-spatial â€” Dijkstra over arbitrary edge weights).
- Graph diffing (compare two graphs).
- Graph serialization (DOT / JSON).

### Out of scope
- Spatial pathfinding (`pathfinding`).
- Typed entity graph (`codex` â€” uses us).
- Visualization rendering (`canvas` / external).

## Boundary

### Owns
- DAG primitives
- Cycle detection
- Topological sort
- Traversal
- Non-spatial shortest path
- Graph diffing
- Serialization

### Does NOT own
| Capability | Lives in |
|---|---|
| Spatial pathfinding | `pathfinding` |
| Typed entity graph | `codex` |
| Visualization | `canvas` / external |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **graphlib** | Mature. | Older. |
| **ngraph** | Modular. | Light. |
| **Custom adjacency lists** | Common. | Reinvented. |

## How this fits the NekoStack

- **`codex`** typed entity graph builds on us.
- **`decision`** decision dependency graph.
- **`workspace`** package dependency graph.
- **`path`** milestone graph.
- **`progression`** unlock graph.

## Design philosophy

- **Algorithms, not opinions.** Just the primitives; consumers wrap.
- **Non-spatial only.** Spatial is `pathfinding`.

## Architecture sketch

```
packages/graph/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ dag/
â”‚   â”‚   â””â”€â”€ primitives.ts
â”‚   â”œâ”€â”€ cycle/
â”‚   â”‚   â””â”€â”€ detect.ts
â”‚   â”œâ”€â”€ topo-sort/
â”‚   â”‚   â””â”€â”€ sort.ts
â”‚   â”œâ”€â”€ traverse/
â”‚   â”‚   â”œâ”€â”€ bfs.ts
â”‚   â”‚   â””â”€â”€ dfs.ts
â”‚   â”œâ”€â”€ shortest-path/
â”‚   â”‚   â””â”€â”€ dijkstra.ts
â”‚   â”œâ”€â”€ diff/
â”‚   â”‚   â””â”€â”€ compare.ts
â”‚   â””â”€â”€ serialize/
â”‚       â”œâ”€â”€ dot.ts
â”‚       â””â”€â”€ json.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” DAG primitives + cycle detection
### v0.2 â€” Topological sort
### v0.3 â€” Traversal (BFS/DFS)
### v0.4 â€” Shortest path
### v0.5 â€” Diffing
### v0.6 â€” Serialization
### v1.0 â€” Stable API

## Product potential

**Internal:** Used by many packages.
**Open source release:** Marginal.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Utility primitives.
- **Estimated learning return:** Very high. Classic graph algorithms â€” DAG, topological sort, traversal, shortest path â€” fundamental CS.
