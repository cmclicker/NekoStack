# @nekostack/map

> Spatial UI / pan-zoom / map rendering. Real-world geographic maps and abstract zoomable canvases. Distinct from `tilemap` (game-tile grids).

## Quick reference

| | |
|---|---|
| **Build tier** | Frontend depth |
| **Depends on** | `schema`, `ui`, `theme`, `canvas`, `motion` (smooth zoom), `a11y` |
| **Used by** | Leytide (world maps for non-tile views), NekoSystems (process maps), business-ops (location maps), narrative tools (story maps), retail-ops (store layouts) |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 10–14 weeks focused |
| **Sellable?** | Modest — MapLibre / Leaflet dominate geographic; abstract-map niche less crowded |

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
├── src/
│   ├── viewport/
│   │   ├── pan.ts
│   │   └── zoom.ts
│   ├── tiles/
│   │   ├── geographic.ts
│   │   └── custom.ts
│   ├── markers/
│   │   ├── marker.tsx
│   │   └── cluster.ts
│   ├── overlays/
│   │   └── render.tsx
│   ├── interaction/
│   │   ├── click.ts
│   │   └── hover.ts
│   ├── coordinates/
│   │   └── transform.ts
│   └── a11y/
│       └── kbd-nav.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Pan / zoom + custom imagery
### v0.2 — Markers + overlays
### v0.3 — Interaction (click, hover)
### v0.4 — Clustering
### v0.5 — Geographic tile servers
### v0.6 — Accessibility
### v1.0 — Stable API

## Product potential

**Internal:** Leytide especially.
**Open source release:** Plausible — abstract-map niche less crowded.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Frontend depth.
- **Estimated learning return:** High. Viewport math, tile pyramid, marker clustering, abstract-vs-geographic coordinate systems.
