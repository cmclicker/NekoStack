# @nekostack/canvas

> Canvas 2D primitives + scene management. The substrate for share-card rendering, in-game HUDs, custom widgets that don't fit in DOM.

## Quick reference

| | |
|---|---|
| **Build tier** | Frontend depth |
| **Depends on** | `schema`, `theme`, `motion` (canvas-side animations), `assets` (sprites) |
| **Used by** | NekoVibe (share-card generation — already in production!), NekoBattler (combat HUD), `tilemap`, `map`, any custom-rendered surface |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 8–12 weeks focused |
| **Sellable?** | Modest — PixiJS / Konva dominate but lightweight niche exists |

## Why this exists

NekoVibe's share-card generator (we wrote it today!) is exactly the use case: canvas-based image generation with theming + sprite-based icons + text rendering. Lifting this pattern into a package makes every project's share cards / custom widgets shareable.

## Scope

### In scope
- Canvas 2D primitive helpers (rect / circle / path / text).
- Scene graph (transform hierarchy).
- Sprite rendering (via `assets`).
- Text rendering (font loading, measurement, wrapping).
- Image generation (canvas → PNG / WebP blob).
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
- Canvas → image export
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
- **Image-export first-class.** Canvas → PNG / WebP for share cards is core.
- **Theme-aware.** Colors come from `theme`.

## Architecture sketch

```
packages/canvas/
├── src/
│   ├── primitives/
│   │   ├── rect.ts
│   │   ├── circle.ts
│   │   ├── path.ts
│   │   └── text.ts
│   ├── scene/
│   │   ├── node.ts
│   │   └── traverse.ts
│   ├── sprite/
│   │   └── render.ts          # via assets
│   ├── text/
│   │   ├── font-loader.ts
│   │   ├── measure.ts
│   │   └── wrap.ts
│   ├── export/
│   │   ├── png.ts
│   │   └── webp.ts
│   ├── hit-test/
│   │   └── pick.ts
│   └── animate/
│       └── tick.ts            # via motion
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Primitives (rect / circle / path / text)
### v0.2 — Scene graph + transforms
### v0.3 — Image export (PNG / WebP)
### v0.4 — Sprite rendering
### v0.5 — Text wrapping + font loading
### v0.6 — Hit testing
### v0.7 — Animation integration
### v1.0 — Stable API

## Product potential

**Internal:** NekoVibe share cards, NekoBattler HUD, custom UI.
**Open source release:** Modest.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Frontend depth.
- **Estimated learning return:** High. Canvas 2D semantics, scene-graph design, font measurement, hit testing.
