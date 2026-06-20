# @nekostack/ui — Roadmap

Authoritative source for "what ships when." Full design rationale lives in the package [`README.md`](../README.md).

## v1.0 — Stable component library

Status: **shipped**. Apache-2.0. Published to npm.

Includes:
- 92-component vanilla-CSS library — zero JS/React runtime dependencies
- Consumes `@nekostack/theme` CSS custom properties directly
- Full component catalog: buttons, badges, forms, inputs, selects, checkboxes, radios,
  modals, drawers, toasts, tooltips, cards, tables, avatars, progress, spinners, and more
- Dark and light theme support via `data-theme` / `data-mode` attributes
- `ui.css` / `ui.min.css` distributable
- `components.json` machine-readable component registry (consumed by `@nekostack/schema`)
- `preview.html` — self-contained visual reference

## Future

Component additions and bug fixes ship as patch releases. New component families (charts,
rich text, date pickers) tracked as minor releases when the scope is defined.
