# @nekostack/tilemap

> Tile-based world representation + rendering. Grid storage, layers, chunked loading, collision queries. The substrate for tile-based games (Leytide world, NekoBattler combat board, retro-style games).

## Quick reference

| | |
|---|---|
| **Build tier** | Game systems |
| **Depends on** | `schema`, `canvas` (rendering), `assets` (tile sprites), `graph` (tile graph for pathfinding), `pathfinding` |
| **Used by** | Leytide (world maps), NekoBattler (combat grids), tower-defense, any tile-based game |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 8â€“14 weeks focused |

## Why this exists

Tile-based games need: storage of tile grids (potentially huge), efficient rendering of visible region, layer composition (terrain + entities + overlays), collision queries, chunked loading for big worlds.

Phaser / PixiJS have tile renderers but engine-coupled. `tilemap` is engine-agnostic.

## Scope

### In scope
- Tile grid storage (in-memory + chunked).
- Layers (terrain / objects / collision / overlays).
- Tiled (.tmx) format import.
- Visible-region culling.
- Rendering (via `canvas`).
- Collision queries.
- Chunked loading + unloading for huge worlds.
- Auto-tiling (variant selection based on neighbors).

### Out of scope
- Map editor UI (consumers may build one).
- Pathfinding (`pathfinding`).
- Procgen of maps (`procgen`).
- Physics simulation.

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§84 (in BOUNDARIES.md).

### Owns
- Tile grid storage
- Layers
- Tiled (.tmx) import
- Visible-region culling
- Rendering via canvas
- Collision queries
- Chunked loading
- Auto-tiling

### Does NOT own
| Capability | Lives in |
|---|---|
| Pathfinding | `pathfinding` |
| Procgen of maps | `procgen` |
| Tile asset pipeline | `assets` |
| Spatial UI (non-game) | `map` |
| Canvas rendering primitives | `canvas` (we use) |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **Phaser tilemap** | Mature. | Phaser-coupled. |
| **PixiJS tilemap** | Modern. | PixiJS-coupled. |
| **Tiled map editor** | The standard editor. | Just an editor; we import. |

## How this fits the NekoStack

- **`canvas`** is the renderer.
- **`assets`** provides tile sprites.
- **`pathfinding`** navigates the tile graph.
- **`graph`** for tile-adjacency.
- **`procgen`** generates the maps.

## Design philosophy

- **Engine-agnostic.** Works with plain canvas, PixiJS, or custom.
- **Chunked for scale.** Huge worlds loaded in chunks; only nearby chunks active.
- **Tiled-format compatible.** Tiled is the standard editor; we import its output.

## Architecture sketch

```
packages/tilemap/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ grid/
â”‚   â”‚   â”œâ”€â”€ storage.ts
â”‚   â”‚   â””â”€â”€ chunk.ts
â”‚   â”œâ”€â”€ layer/
â”‚   â”‚   â””â”€â”€ compose.ts
â”‚   â”œâ”€â”€ import/
â”‚   â”‚   â””â”€â”€ tmx.ts
â”‚   â”œâ”€â”€ render/
â”‚   â”‚   â”œâ”€â”€ visible.ts
â”‚   â”‚   â””â”€â”€ draw.ts
â”‚   â”œâ”€â”€ collision/
â”‚   â”‚   â””â”€â”€ query.ts
â”‚   â”œâ”€â”€ chunked/
â”‚   â”‚   â”œâ”€â”€ load.ts
â”‚   â”‚   â””â”€â”€ unload.ts
â”‚   â”œâ”€â”€ auto-tile/
â”‚   â”‚   â””â”€â”€ variant.ts
â”‚   â””â”€â”€ cli.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Grid storage + layers
### v0.2 â€” Canvas rendering
### v0.3 â€” Tiled (.tmx) import
### v0.4 â€” Visible-region culling
### v0.5 â€” Collision queries
### v0.6 â€” Chunked loading
### v0.7 â€” Auto-tiling
### v1.0 â€” Stable API

## Product potential

**Internal:** Critical for Leytide.
**Open source release:** Plausible â€” engine-agnostic TS tilemap library is rare.
**Commercial:** Marginal.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Game systems.
- **Estimated learning return:** High. Tile rendering, chunked world loading, auto-tiling algorithms.
