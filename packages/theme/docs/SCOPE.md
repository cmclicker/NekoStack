# @nekostack/theme — Scope & Invariants

## What this package is

A W3C DTCG design token pipeline. Single input: `src/tokens.json` (1,738 lines). Outputs: `dist/neko.css` (CSS custom properties), `dist/index.js` (typed JS token object), `dist/tokens.json` (raw token data), `dist/tailwind.preset.cjs` (Tailwind configuration).

## Invariants

1. **Token purity** — every color value in `dist/neko.css` is a `--neko-color-*` custom property. No hardcoded hex.
2. **Complete coverage** — all 3 themes (neko, synthwave, cupcake) × 2 modes (dark, light) ship in a single CSS file.
3. **WCAG 2.1 AA** — all 9 semantic role pairs (base/content) and text roles (text-base, text-muted, text-subtle vs bg-base) verify ≥4.5:1 contrast across all 6 theme × mode combinations. Enforced by the test suite.
4. **Deterministic build** — same `tokens.json` in, same `dist/` out, byte-for-byte.
5. **Semantic over raw** — components consume `--neko-color-semantic-primary`, not `--purple-500`. Raw scale tokens are build intermediates only.

## What is in scope (v1.0)

- W3C DTCG token pipeline (JSON → CSS + JS + JSON)
- 3 themes × 2 modes shipped as a single CSS file
- WCAG AA contrast verification (test suite)
- Tailwind preset mapping token values to config
- Typed JS export (`tokens`, `defaultTheme`, `defaultMode`, `themeOptions`)

## What is NOT in scope (v1.0)

- UI components → `@nekostack/ui`
- Per-user theme storage (localStorage / db) → future release
- High-contrast accessibility variant → future release
- Animation / motion tokens → `@nekostack/motion`
- Free-form, untyped CSS variable injection
