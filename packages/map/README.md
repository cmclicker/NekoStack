# @nekostack/map

> Spatial UI / pan-zoom / map rendering. Real-world geographic maps and abstract zoomable canvases. Distinct from `tilemap` (game-tile grids).

## Quick reference

| | |
|---|---|
| **Build tier** | Frontend depth |
| **Depends on** | `schema`, `ui`, `theme`, `canvas`, `motion` (smooth zoom), `a11y` |
| **Used by** | Leytide (world maps for non-tile views), NekoSystems (process maps), business-ops (location maps), narrative tools (story maps), retail-ops (store layouts) |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 10â€“14 weeks focused |

## Why this exists

Two distinct "map" use cases:
- **Geographic maps** (world coordinates, tile servers, real-world).
- **Abstract maps** (story diagrams, business process maps, custom coordinate systems, custom imagery).

`map` covers both via a unified abstract-coordinate API with adapters for geographic + abstract.

## Scope

### In scope
- Pan / zoom interaction.
- Tile server integration (geographic).
- Custom tile / imagery sources (abstract).
- Markers / annotations / overlays.
- Marker clustering at zoom-out.
- Click / hover interaction.
- Coordinate transforms.
- Keyboard navigation.

### Out of scope
- Tile-based game world (`tilemap`).
- Pathfinding (`pathfinding`).
- Canvas 2D scene management (`canvas`).
- 3D / globe view.

## Boundary

### Owns
- Pan / zoom
- Tile + custom imagery
- Markers / overlays
- Clustering
- Interaction
- Coordinate transforms

### Does NOT own
| Capability | Lives in |
|---|---|
| Tile-based game world | `tilemap` |
| Pathfinding | `pathfinding` |
| Canvas primitives | `canvas` |
| Geographic data (countries / cities) | external |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **MapLibre GL** | OSS Mapbox-alternative. | Heavy; geographic-only. |
| **Leaflet** | Lightweight geographic. | Closer fit for geographic; we want abstract too. |
| **deck.gl** | Data viz on maps. | Specialized. |
| **react-zoom-pan-pinch** | Lightweight pan-zoom. | Just pan-zoom, no tiles. |

## How this fits the NekoStack

- **`canvas`** for custom tile rendering.
- **`motion`** for smooth zoom.

## Design philosophy

- **Geographic + abstract unified.** Same API; different tile sources.
- **Clustering at zoom-out.** Don't render 10,000 markers.
- **Keyboard navigable.** Pan / zoom via keys.

## Architecture sketch

```
packages/map/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ viewport/
â”‚   â”‚   â”œâ”€â”€ pan.ts
â”‚   â”‚   â””â”€â”€ zoom.ts
â”‚   â”œâ”€â”€ tiles/
â”‚   â”‚   â”œâ”€â”€ geographic.ts
â”‚   â”‚   â””â”€â”€ custom.ts
â”‚   â”œâ”€â”€ markers/
â”‚   â”‚   â”œâ”€â”€ marker.tsx
â”‚   â”‚   â””â”€â”€ cluster.ts
â”‚   â”œâ”€â”€ overlays/
â”‚   â”‚   â””â”€â”€ render.tsx
â”‚   â”œâ”€â”€ interaction/
â”‚   â”‚   â”œâ”€â”€ click.ts
â”‚   â”‚   â””â”€â”€ hover.ts
â”‚   â”œâ”€â”€ coordinates/
â”‚   â”‚   â””â”€â”€ transform.ts
â”‚   â””â”€â”€ a11y/
â”‚       â””â”€â”€ kbd-nav.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Pan / zoom + custom imagery
### v0.2 â€” Markers + overlays
### v0.3 â€” Interaction (click, hover)
### v0.4 â€” Clustering
### v0.5 â€” Geographic tile servers
### v0.6 â€” Accessibility
### v1.0 â€” Stable API

## Product potential

**Internal:** Leytide especially.
**Open source release:** Plausible â€” abstract-map niche less crowded.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Frontend depth.
- **Estimated learning return:** High. Viewport math, tile pyramid, marker clustering, abstract-vs-geographic coordinate systems.
