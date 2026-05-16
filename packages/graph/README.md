# @nekostack/graph

> Generic graph primitives: DAG, cycle detection, topological sort, traversal, shortest path (non-spatial), diffing. The "non-spatial-graph algorithms" foundation.

## Quick reference

| | |
|---|---|
| **Build tier** | Utility primitives |
| **Depends on** | `schema` (graph type definitions) |
| **Used by** | `codex` (entity graph), `decision` (decision dependency graph), `workspace` (package dependency graph), `path` (roadmap milestone graph), `progression` (unlock graph), `taxonomy` (hierarchy) |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 4–8 weeks focused |
| **Sellable?** | Low — substrate |

## Why this exists

Many packages need graph algorithms: dependency resolution, cycle detection, topological order, traversal. Each reinvents. `graph` provides the algorithms once.

Note: `pathfinding` is for **spatial** paths (A* on maps). `graph` is for non-spatial graphs (DAGs, dependency, hierarchy).

## Scope

### In scope
- DAG primitives.
- Cycle detection.
- Topological sort.
- BFS / DFS traversal.
- Shortest path (non-spatial — Dijkstra over arbitrary edge weights).
- Graph diffing (compare two graphs).
- Graph serialization (DOT / JSON).

### Out of scope
- Spatial pathfinding (`pathfinding`).
- Typed entity graph (`codex` — uses us).
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
├── src/
│   ├── dag/
│   │   └── primitives.ts
│   ├── cycle/
│   │   └── detect.ts
│   ├── topo-sort/
│   │   └── sort.ts
│   ├── traverse/
│   │   ├── bfs.ts
│   │   └── dfs.ts
│   ├── shortest-path/
│   │   └── dijkstra.ts
│   ├── diff/
│   │   └── compare.ts
│   └── serialize/
│       ├── dot.ts
│       └── json.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — DAG primitives + cycle detection
### v0.2 — Topological sort
### v0.3 — Traversal (BFS/DFS)
### v0.4 — Shortest path
### v0.5 — Diffing
### v0.6 — Serialization
### v1.0 — Stable API

## Product potential

**Internal:** Used by many packages.
**Open source release:** Marginal.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Utility primitives.
- **Estimated learning return:** Very high. Classic graph algorithms — DAG, topological sort, traversal, shortest path — fundamental CS.
