# @nekostack/chart

> Charting + data visualization primitives. SVG-based, theme-aware, accessibility-aware. The "make this dashboard not ugly" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Frontend depth |
| **Depends on** | `schema`, `ui`, `theme`, `motion`, `a11y` |
| **Used by** | `admin` (dashboards), `metrics` UI surfaces, `path` (cross-project status), Business-OS reporting, NekoVibe stats |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 10â€“16 weeks focused |

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
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ types/
â”‚   â”‚   â”œâ”€â”€ line.tsx
â”‚   â”‚   â”œâ”€â”€ bar.tsx
â”‚   â”‚   â”œâ”€â”€ area.tsx
â”‚   â”‚   â”œâ”€â”€ pie.tsx
â”‚   â”‚   â”œâ”€â”€ scatter.tsx
â”‚   â”‚   â””â”€â”€ sparkline.tsx
â”‚   â”œâ”€â”€ axes/
â”‚   â”‚   â”œâ”€â”€ scale.ts
â”‚   â”‚   â””â”€â”€ grid.tsx
â”‚   â”œâ”€â”€ tooltip/
â”‚   â”‚   â””â”€â”€ render.tsx
â”‚   â”œâ”€â”€ legend/
â”‚   â”‚   â””â”€â”€ render.tsx
â”‚   â”œâ”€â”€ interactive/
â”‚   â”‚   â”œâ”€â”€ hover.ts
â”‚   â”‚   â”œâ”€â”€ click.ts
â”‚   â”‚   â””â”€â”€ zoom.ts
â”‚   â”œâ”€â”€ theme/
â”‚   â”‚   â””â”€â”€ consume.ts
â”‚   â”œâ”€â”€ a11y/
â”‚   â”‚   â”œâ”€â”€ kbd-nav.ts
â”‚   â”‚   â””â”€â”€ summary.ts
â”‚   â””â”€â”€ responsive/
â”‚       â””â”€â”€ resize.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Line + bar
### v0.2 â€” Axes / scales / grids
### v0.3 â€” Tooltips + legends
### v0.4 â€” Area / pie / scatter / sparkline
### v0.5 â€” Interactivity
### v0.6 â€” Accessibility
### v0.7 â€” Animation integration
### v1.0 â€” Stable API

## Product potential

**Internal:** Used by all dashboards.
**Open source release:** Modest.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Frontend depth.
- **Estimated learning return:** High. SVG rendering, scales (D3-style), accessibility for visualizations.
