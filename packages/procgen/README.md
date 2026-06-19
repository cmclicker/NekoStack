# @nekostack/procgen

> Procedural generation primitives: noise functions, wave function collapse, dungeon generation, name generation. Seeded for reproducibility.

## Quick reference

| | |
|---|---|
| **Build tier** | Game systems |
| **Depends on** | `schema`, `random` (seeded PRNG), `math`, `graph` (for graph-based generators) |
| **Used by** | NekoVibe (puzzle generators), Leytide (dungeon + world generation), NekoBattler (encounter variety), any procgen-using game |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 12â€“20 weeks focused |

## Why this exists

Procgen is foundational for many games. Each genre has its own dominant approach:
- **Noise** (Perlin, Simplex) â€” terrain, clouds, organic patterns.
- **Wave function collapse** (WFC) â€” coherent tile-based generation.
- **Dungeon generators** (BSP, drunkard's walk, cellular automata).
- **Name generators** (Markov-chain, syllable-based).
- **Constraint solvers** (sudoku, crossword, logic puzzles â€” uses `random` + constraint propagation).

`procgen` is the kit. Each generator is seeded for reproducibility.

## Scope

### In scope
- Noise functions (Perlin, Simplex, Worley, value-noise).
- Wave function collapse.
- Dungeon generators (BSP partitioning, drunkard's walk, cellular automata, room-and-corridor).
- Name generators (Markov chain, syllable, frequency-based).
- Constraint solvers (DLX / exact cover â€” used in NekoVibe's puzzle engine).
- Maze generators (Prim, Kruskal, recursive backtracker).
- Distribution helpers (Poisson disk sampling).

### Out of scope
- Pathfinding (`pathfinding`).
- Tile rendering (`tilemap`).
- Content validation (`validator`).
- AI behavior (`ai`).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§85 (in BOUNDARIES.md).

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
- **NekoVibe** uses constraint solvers (exact cover) for puzzles â€” already in production.

## Design philosophy

- **Seeded reproducibility.** Same seed â†’ same output.
- **Composable generators.** Noise â†’ biomes â†’ features â†’ dungeons; each layer is its own generator.
- **Validate output.** Generators can fail to produce valid output; we expose failure modes.

## Architecture sketch

```
packages/procgen/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ noise/
â”‚   â”‚   â”œâ”€â”€ perlin.ts
â”‚   â”‚   â”œâ”€â”€ simplex.ts
â”‚   â”‚   â”œâ”€â”€ worley.ts
â”‚   â”‚   â””â”€â”€ value.ts
â”‚   â”œâ”€â”€ wfc/
â”‚   â”‚   â””â”€â”€ collapse.ts
â”‚   â”œâ”€â”€ dungeon/
â”‚   â”‚   â”œâ”€â”€ bsp.ts
â”‚   â”‚   â”œâ”€â”€ drunkard.ts
â”‚   â”‚   â”œâ”€â”€ cellular.ts
â”‚   â”‚   â””â”€â”€ room-corridor.ts
â”‚   â”œâ”€â”€ name/
â”‚   â”‚   â”œâ”€â”€ markov.ts
â”‚   â”‚   â””â”€â”€ syllable.ts
â”‚   â”œâ”€â”€ constraint/
â”‚   â”‚   â”œâ”€â”€ exact-cover.ts    # DLX (used by NekoVibe Sudoku)
â”‚   â”‚   â””â”€â”€ propagation.ts
â”‚   â”œâ”€â”€ maze/
â”‚   â”‚   â”œâ”€â”€ prim.ts
â”‚   â”‚   â”œâ”€â”€ kruskal.ts
â”‚   â”‚   â””â”€â”€ backtracker.ts
â”‚   â”œâ”€â”€ sample/
â”‚   â”‚   â””â”€â”€ poisson-disk.ts
â”‚   â””â”€â”€ cli.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Noise functions
### v0.2 â€” Constraint solvers (DLX)
### v0.3 â€” Dungeon generators
### v0.4 â€” Wave function collapse
### v0.5 â€” Maze generators
### v0.6 â€” Name generators
### v0.7 â€” Distribution sampling
### v1.0 â€” Stable API

## Product potential

**Internal:** Powers many game projects.
**Open source release:** Plausible â€” TS procgen kit is undersupplied.
**Commercial:** Marginal.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Game systems.
- **Estimated learning return:** Very high. Multiple procgen paradigms â€” noise, WFC, constraint solving, cellular automata â€” all rich algorithmic territory.
