# `@nekostack/theme` — Changelog

Per-milestone changes. Pairs with git tags (`theme-vX.Y.Z`) and [GitHub releases](https://github.com/cmclicker/NekoStack/releases). Format: newest first.

Published to npm as `@nekostack/theme` (Apache-2.0).

---

## theme-v1.0.0 — 2026-06-19

[Tag](https://github.com/cmclicker/NekoStack/releases/tag/theme-v1.0.0) · First public release.

### Shipped

- **W3C DTCG token pipeline** — `src/tokens.json` (1,738 lines) → `dist/neko.css` via `scripts/build.mjs`. Deterministic build: same input, same output.
- **3 themes × 2 modes** — Neko (default), Synthwave, Cupcake; each in dark + light mode. All 6 combinations ship in a single CSS file as scoped `[data-theme][data-mode]` selectors.
- **`--neko-color-semantic-*` custom properties** — 9 semantic color roles (primary, secondary, accent-1, accent-2, accent-3, info, success, warning, danger) each with a `-content` pair, plus bg-base, text-base, text-muted, text-subtle, border-base.
- **WCAG 2.1 AA contrast** — all 9 semantic role pairs (base/content) and text roles verified ≥4.5:1 by the test suite across all 6 theme × mode combinations.
- **`prefers-reduced-motion`** — motion reduction is respected at the CSS layer.
- **Tailwind preset** (`./tailwind`) — maps token values to Tailwind config.
- **Typed JS export** (`dist/index.js`) — `tokens`, `defaultTheme`, `defaultMode`, `themeOptions`.

### Exports

```
@nekostack/theme          → typed JS (tokens object)
@nekostack/theme/css      → dist/neko.css
@nekostack/theme/tailwind → dist/tailwind.preset.cjs
@nekostack/theme/json     → dist/tokens.json
```

### Test count

- 78 passing

### Still deferred

- Per-user theme storage (localStorage / db)
- High-contrast accessibility variant
- Animation / motion tokens (`@nekostack/motion`)
