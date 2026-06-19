# @nekostack/table

> Data grids: sort / filter / virtualize / select / edit / bulk-action. The "show a lot of rows fast" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Frontend depth |
| **Depends on** | `schema` (column schemas), `ui`, `theme`, `a11y`, `actions` (bulk actions) |
| **Used by** | `admin` (user / audit / flag tables), Business-OS surfaces, NekoBattler wiki, leaderboards |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 10â€“14 weeks focused |

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
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ core/
â”‚   â”‚   â””â”€â”€ table.tsx           # TanStack Table wrapper
â”‚   â”œâ”€â”€ sort/
â”‚   â”‚   â””â”€â”€ multi-column.ts
â”‚   â”œâ”€â”€ filter/
â”‚   â”‚   â”œâ”€â”€ per-column.ts
â”‚   â”‚   â””â”€â”€ global.ts
â”‚   â”œâ”€â”€ virtualize/
â”‚   â”‚   â””â”€â”€ rows.ts
â”‚   â”œâ”€â”€ select/
â”‚   â”‚   â”œâ”€â”€ single.ts
â”‚   â”‚   â””â”€â”€ multi.ts
â”‚   â”œâ”€â”€ bulk/
â”‚   â”‚   â””â”€â”€ action.ts          # via actions package
â”‚   â”œâ”€â”€ edit/
â”‚   â”‚   â””â”€â”€ inline.tsx
â”‚   â”œâ”€â”€ columns/
â”‚   â”‚   â”œâ”€â”€ resize.ts
â”‚   â”‚   â”œâ”€â”€ reorder.ts
â”‚   â”‚   â””â”€â”€ pin.ts
â”‚   â”œâ”€â”€ export/
â”‚   â”‚   â”œâ”€â”€ csv.ts
â”‚   â”‚   â””â”€â”€ json.ts
â”‚   â””â”€â”€ a11y/
â”‚       â””â”€â”€ kbd-nav.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” TanStack Table wrapper + styled defaults
### v0.2 â€” Sort + filter
### v0.3 â€” Virtualization
### v0.4 â€” Selection + bulk actions
### v0.5 â€” Inline editing
### v0.6 â€” Column management
### v0.7 â€” Export
### v0.8 â€” Accessibility
### v1.0 â€” Stable API

## Product potential

**Internal:** Used by all admin surfaces.
**Open source release:** Modest.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Frontend depth.
- **Estimated learning return:** High. Virtualized rendering, headless table architecture, bulk-action UX.
