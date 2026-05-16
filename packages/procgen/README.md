# @nekostack/procgen

> Procedural generation primitives: noise functions, wave function collapse, dungeon generation, name generation. Seeded for reproducibility.

## Quick reference

| | |
|---|---|
| **Build tier** | Game systems |
| **Depends on** | `schema`, `random` (seeded PRNG), `math`, `graph` (for graph-based generators) |
| **Used by** | NekoVibe (puzzle generators), Leytide (dungeon + world generation), NekoBattler (encounter variety), any procgen-using game |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 12–20 weeks focused |
| **Sellable?** | Plausible OSS — TS procgen library is undersupplied |

## Why this exists

Procgen is foundational for many games. Each genre has its own dominant approach:
- **Noise** (Perlin, Simplex) — terrain, clouds, organic patterns.
- **Wave function collapse** (WFC) — coherent tile-based generation.
- **Dungeon generators** (BSP, drunkard's walk, cellular automata).
- **Name generators** (Markov-chain, syllable-based).
- **Constraint solvers** (sudoku, crossword, logic puzzles — uses `random` + constraint propagation).

`procgen` is the kit. Each generator is seeded for reproducibility.

## Scope

### In scope
- Noise functions (Perlin, Simplex, Worley, value-noise).
- Wave function collapse.
- Dungeon generators (BSP partitioning, drunkard's walk, cellular automata, room-and-corridor).
- Name generators (Markov chain, syllable, frequency-based).
- Constraint solvers (DLX / exact cover — used in NekoVibe's puzzle engine).
- Maze generators (Prim, Kruskal, recursive backtracker).
- Distribution helpers (Poisson disk sampling).

### Out of scope
- Pathfinding (`pathfinding`).
- Tile rendering (`tilemap`).
- Content validation (`validator`).
- AI behavior (`ai`).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §85 (in BOUNDARIES.md).

### Owns
- Noise functions
- Wave function collapse
- Dungeon generators
- Name generators
- Constraint solvers
- Maze generators
- Distribution sampling

### Does NOT own
| Capability | Lives in |
|---|---|
| Pathfinding | `pathfinding` |
| Map rendering | `tilemap` |
| AI | `ai` |
| Content schema validation | `validator` |
| Generated content provenance | `provenance` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **noisejs / simplex-noise** | Mature noise libs. | Substrate. |
| **rot.js** | Roguelike toolkit. | Closer in spirit; older. |
| **fast-wfc** | WFC implementations. | Substrate. |
| **Custom per-game** | Common. | Reinvented per project. |

## How this fits the NekoStack

- **`random`** is the seed source.
- **`math`** for interpolation / distribution.
- **`graph`** for graph-based generators.
- **NekoVibe** uses constraint solvers (exact cover) for puzzles — already in production.

## Design philosophy

- **Seeded reproducibility.** Same seed → same output.
- **Composable generators.** Noise → biomes → features → dungeons; each layer is its own generator.
- **Validate output.** Generators can fail to produce valid output; we expose failure modes.

## Architecture sketch

```
packages/procgen/
├── src/
│   ├── noise/
│   │   ├── perlin.ts
│   │   ├── simplex.ts
│   │   ├── worley.ts
│   │   └── value.ts
│   ├── wfc/
│   │   └── collapse.ts
│   ├── dungeon/
│   │   ├── bsp.ts
│   │   ├── drunkard.ts
│   │   ├── cellular.ts
│   │   └── room-corridor.ts
│   ├── name/
│   │   ├── markov.ts
│   │   └── syllable.ts
│   ├── constraint/
│   │   ├── exact-cover.ts    # DLX (used by NekoVibe Sudoku)
│   │   └── propagation.ts
│   ├── maze/
│   │   ├── prim.ts
│   │   ├── kruskal.ts
│   │   └── backtracker.ts
│   ├── sample/
│   │   └── poisson-disk.ts
│   └── cli.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Noise functions
### v0.2 — Constraint solvers (DLX)
### v0.3 — Dungeon generators
### v0.4 — Wave function collapse
### v0.5 — Maze generators
### v0.6 — Name generators
### v0.7 — Distribution sampling
### v1.0 — Stable API

## Product potential

**Internal:** Powers many game projects.
**Open source release:** Plausible — TS procgen kit is undersupplied.
**Commercial:** Marginal.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Game systems.
- **Estimated learning return:** Very high. Multiple procgen paradigms — noise, WFC, constraint solving, cellular automata — all rich algorithmic territory.
