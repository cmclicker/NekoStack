# @nekostack/canvas

> Canvas 2D primitives + scene management. The substrate for share-card rendering, in-game HUDs, custom widgets that don't fit in DOM.

## Quick reference

| | |
|---|---|
| **Build tier** | Frontend depth |
| **Depends on** | `schema`, `theme`, `motion` (canvas-side animations), `assets` (sprites) |
| **Used by** | NekoVibe (share-card generation â€” already in production!), NekoBattler (combat HUD), `tilemap`, `map`, any custom-rendered surface |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 8â€“12 weeks focused |

## Why this exists

NekoVibe's share-card generator (we wrote it today!) is exactly the use case: canvas-based image generation with theming + sprite-based icons + text rendering. Lifting this pattern into a package makes every project's share cards / custom widgets shareable.

## Scope

### In scope
- Canvas 2D primitive helpers (rect / circle / path / text).
- Scene graph (transform hierarchy).
- Sprite rendering (via `assets`).
- Text rendering (font loading, measurement, wrapping).
- Image generation (canvas â†’ PNG / WebP blob).
- Hit testing.
- Animation integration via `motion`.

### Out of scope
- WebGL / 3D.
- Game-engine-level rendering (PixiJS).
- Charts (`chart`).
- Game tile worlds (`tilemap`).

## Boundary

### Owns
- Canvas 2D primitives
- Scene graph
- Sprite rendering integration
- Text rendering
- Canvas â†’ image export
- Hit testing
- Canvas-side animation

### Does NOT own
| Capability | Lives in |
|---|---|
| WebGL / 3D | external |
| Charts | `chart` |
| Tile-based worlds | `tilemap` |
| Asset pipeline | `assets` |
| Theme tokens | `theme` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **PixiJS** | Mature 2D rendering. | WebGL-first; heavier than needed for share cards. |
| **Konva** | Canvas-based 2D. | Closer fit. |
| **Fabric.js** | Older. | Stale. |
| **Canvas API direct** | Universal. | Verbose. |

## How this fits the NekoStack

- **`assets`** provides sprites.
- **`theme`** for colors.
- **`motion`** for animation timing.
- NekoVibe's share-card code is the template.

## Design philosophy

- **Lightweight.** No WebGL. Plain Canvas 2D.
- **Scene-graph-shaped.** Transform hierarchy; group / translate / rotate.
- **Image-export first-class.** Canvas â†’ PNG / WebP for share cards is core.
- **Theme-aware.** Colors come from `theme`.

## Architecture sketch

```
packages/canvas/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ primitives/
â”‚   â”‚   â”œâ”€â”€ rect.ts
â”‚   â”‚   â”œâ”€â”€ circle.ts
â”‚   â”‚   â”œâ”€â”€ path.ts
â”‚   â”‚   â””â”€â”€ text.ts
â”‚   â”œâ”€â”€ scene/
â”‚   â”‚   â”œâ”€â”€ node.ts
â”‚   â”‚   â””â”€â”€ traverse.ts
â”‚   â”œâ”€â”€ sprite/
â”‚   â”‚   â””â”€â”€ render.ts          # via assets
â”‚   â”œâ”€â”€ text/
â”‚   â”‚   â”œâ”€â”€ font-loader.ts
â”‚   â”‚   â”œâ”€â”€ measure.ts
â”‚   â”‚   â””â”€â”€ wrap.ts
â”‚   â”œâ”€â”€ export/
â”‚   â”‚   â”œâ”€â”€ png.ts
â”‚   â”‚   â””â”€â”€ webp.ts
â”‚   â”œâ”€â”€ hit-test/
â”‚   â”‚   â””â”€â”€ pick.ts
â”‚   â””â”€â”€ animate/
â”‚       â””â”€â”€ tick.ts            # via motion
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Primitives (rect / circle / path / text)
### v0.2 â€” Scene graph + transforms
### v0.3 â€” Image export (PNG / WebP)
### v0.4 â€” Sprite rendering
### v0.5 â€” Text wrapping + font loading
### v0.6 â€” Hit testing
### v0.7 â€” Animation integration
### v1.0 â€” Stable API

## Product potential

**Internal:** NekoVibe share cards, NekoBattler HUD, custom UI.
**Open source release:** Modest.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Frontend depth.
- **Estimated learning return:** High. Canvas 2D semantics, scene-graph design, font measurement, hit testing.
