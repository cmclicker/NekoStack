# @nekostack/table

> Data grids: sort / filter / virtualize / select / edit / bulk-action. The "show a lot of rows fast" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Frontend depth |
| **Depends on** | `schema` (column schemas), `ui`, `theme`, `a11y`, `actions` (bulk actions) |
| **Used by** | `admin` (user / audit / flag tables), Business-OS surfaces, NekoBattler wiki, leaderboards |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 10–14 weeks focused |
| **Sellable?** | Modest — TanStack Table / AG-Grid dominate |

## Why this exists

Data grids are the most-built UI component because they're the most-needed. NekoStack-conventional: headless under the hood (TanStack Table substrate), styled defaults, theme-aware, virtualized for performance, bulk-actions via `actions`.

## Scope

### In scope
- Headless table primitives (built on TanStack Table).
- Styled default rendering.
- Sorting / filtering / search.
- Virtualization (large datasets).
- Selection (single / multi).
- Bulk actions (via `actions`).
- Inline editing.
- Column resizing / reordering / pinning.
- Export to CSV / JSON.
- Accessibility (keyboard navigation, ARIA).

### Out of scope
- Charts (`chart`).
- Form inputs in cells (use `form` primitives).
- Spreadsheet-style formulas.

## Boundary

### Owns
- Table primitives
- Sort / filter / search
- Virtualization
- Selection + bulk actions
- Inline editing
- Column management
- Export (CSV/JSON)
- Table accessibility

### Does NOT own
| Capability | Lives in |
|---|---|
| Charts | `chart` |
| Form input components | `form` / `ui` |
| Theme tokens | `theme` |
| Bulk-action registry | `actions` |
| Data export to archives | `export` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **TanStack Table** | Headless, modern. | Substrate; we wrap. |
| **AG-Grid** | Enterprise. | Heavyweight, paid features. |
| **MUI DataGrid** | Mature. | MUI-coupled. |
| **react-data-grid** | Older. | Less momentum. |

## How this fits the NekoStack

- **`ui`** for components.
- **`actions`** for bulk-action registry.
- **`export`** for export-to-archive.
- **`a11y`** for keyboard / ARIA.

## Design philosophy

- **TanStack Table substrate.** Don't reinvent; wrap.
- **Virtualized by default.** Handle thousands of rows without lag.
- **Bulk actions first-class.** Real admin work is "select N, do X."
- **Keyboard navigable.** Cell-level nav, not just row.

## Architecture sketch

```
packages/table/
├── src/
│   ├── core/
│   │   └── table.tsx           # TanStack Table wrapper
│   ├── sort/
│   │   └── multi-column.ts
│   ├── filter/
│   │   ├── per-column.ts
│   │   └── global.ts
│   ├── virtualize/
│   │   └── rows.ts
│   ├── select/
│   │   ├── single.ts
│   │   └── multi.ts
│   ├── bulk/
│   │   └── action.ts          # via actions package
│   ├── edit/
│   │   └── inline.tsx
│   ├── columns/
│   │   ├── resize.ts
│   │   ├── reorder.ts
│   │   └── pin.ts
│   ├── export/
│   │   ├── csv.ts
│   │   └── json.ts
│   └── a11y/
│       └── kbd-nav.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — TanStack Table wrapper + styled defaults
### v0.2 — Sort + filter
### v0.3 — Virtualization
### v0.4 — Selection + bulk actions
### v0.5 — Inline editing
### v0.6 — Column management
### v0.7 — Export
### v0.8 — Accessibility
### v1.0 — Stable API

## Product potential

**Internal:** Used by all admin surfaces.
**Open source release:** Modest.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Frontend depth.
- **Estimated learning return:** High. Virtualized rendering, headless table architecture, bulk-action UX.
