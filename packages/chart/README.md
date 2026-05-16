# @nekostack/chart

> Charting + data visualization primitives. SVG-based, theme-aware, accessibility-aware. The "make this dashboard not ugly" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Frontend depth |
| **Depends on** | `schema`, `ui`, `theme`, `motion`, `a11y` |
| **Used by** | `admin` (dashboards), `metrics` UI surfaces, `path` (cross-project status), Business-OS reporting, NekoVibe stats |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 10–16 weeks focused |
| **Sellable?** | Modest — Recharts / Visx / Tremor dominate |

## Why this exists

Every dashboard needs charts. Most chart libraries are either powerful-but-heavyweight (Highcharts, ECharts) or light-but-limited (Recharts). `chart` is opinionated, theme-aware, accessibility-aware.

## Scope

### In scope
- Common chart types (line, bar, area, pie, donut, scatter, sparkline).
- Axes / scales / grids.
- Tooltips + legends.
- Interactive (hover, click, zoom).
- Theme-token integration.
- Accessibility (keyboard navigation, screen-reader summaries).
- Responsive (resize-aware).
- Animation via `motion`.

### Out of scope
- Maps (`map`).
- Tables (`table`).
- Canvas-based games (`canvas`).
- 3D visualization.

## Boundary

### Owns
- Common chart types
- Axes / scales / grids
- Tooltips + legends
- Interactivity
- Theme integration
- Accessibility for charts
- Responsive layout
- Animation integration

### Does NOT own
| Capability | Lives in |
|---|---|
| Map visualization | `map` |
| Data tables | `table` |
| Canvas / 2D | `canvas` |
| Theme tokens | `theme` |
| Animation primitives | `motion` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **Recharts** | Easy React charts. | Limited customization, declining momentum. |
| **Visx** | Composable D3-based. | Closer fit; substrate-shaped. |
| **Tremor** | Dashboard-focused. | Tailwind-coupled. |
| **Nivo** | Pretty. | Heavyweight. |
| **D3** | Universal. | Substrate; we wrap. |

## How this fits the NekoStack

- **`theme`** drives colors.
- **`motion`** for animations.
- **`a11y`** for chart accessibility.

## Design philosophy

- **Theme-aware.** Charts adopt the design system; no per-chart colors.
- **Accessibility-first.** Keyboard nav, screen-reader summaries, color-blind-safe palettes.
- **Composable.** Build complex charts from primitives.

## Architecture sketch

```
packages/chart/
├── src/
│   ├── types/
│   │   ├── line.tsx
│   │   ├── bar.tsx
│   │   ├── area.tsx
│   │   ├── pie.tsx
│   │   ├── scatter.tsx
│   │   └── sparkline.tsx
│   ├── axes/
│   │   ├── scale.ts
│   │   └── grid.tsx
│   ├── tooltip/
│   │   └── render.tsx
│   ├── legend/
│   │   └── render.tsx
│   ├── interactive/
│   │   ├── hover.ts
│   │   ├── click.ts
│   │   └── zoom.ts
│   ├── theme/
│   │   └── consume.ts
│   ├── a11y/
│   │   ├── kbd-nav.ts
│   │   └── summary.ts
│   └── responsive/
│       └── resize.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Line + bar
### v0.2 — Axes / scales / grids
### v0.3 — Tooltips + legends
### v0.4 — Area / pie / scatter / sparkline
### v0.5 — Interactivity
### v0.6 — Accessibility
### v0.7 — Animation integration
### v1.0 — Stable API

## Product potential

**Internal:** Used by all dashboards.
**Open source release:** Modest.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Frontend depth.
- **Estimated learning return:** High. SVG rendering, scales (D3-style), accessibility for visualizations.
