# `@nekostack/ui` — Changelog

Per-milestone changes. Pairs with git tags (`ui-vX.Y.Z`) and [GitHub releases](https://github.com/cmclicker/NekoStack/releases). Format: newest first.

Published to npm as `@nekostack/ui` (Apache-2.0).

---

## ui-v1.0.1 — 2026-06-19

[Tag](https://github.com/cmclicker/NekoStack/releases/tag/ui-v1.0.1) · Patch fix for npm publish artifact hygiene.

### Fixed

- **Narrowed `files` glob** — the v1.0.0 publish used `"files": ["dist"]` which shipped stale build artifacts (`dist/src/Button.js`, `dist/tests/`, `dist/.tsbuildinfo`) to consumers. Changed to an explicit allow-list: `ui.css`, `ui.min.css`, `components.json`, `index.js`, `index.d.ts`. Tarball shrank from 29 files to 12.
- **Rebuilt `dist/`** before publish to remove the stale `Button.js` artifact that had been included in v1.0.0.

---

## ui-v1.0.0 — 2026-06-19

[Tag](https://github.com/cmclicker/NekoStack/releases/tag/ui-v1.0.0) · First public release.

### Shipped

- **92 component classes** across 13 CSS source files: base, layout, button, form, disclosure, card, feedback, nav, overlay, data, media, mockup, utilities.
- **Zero JS / zero React** — pure CSS. Import the stylesheet and use the class names.
- **Token purity** — every color reference uses `var(--neko-color-semantic-*)` or a CSS keyword. Zero hardcoded hex colors anywhere in the compiled output.
- **WCAG accessible interactive states** — every interactive component (button, form, nav) exposes `:hover`, `:focus-visible`, and `:disabled` states.
- **Cascade order enforced** — source files concatenate in a fixed order; no keyframe redefinition, no `!important` outside base.
- **Component catalog** (`./components`) — JSON array of all 92 class names for tooling.
- **Minified build** (`./css/min`) — 87 kB minified vs 118 kB unminified.

### Install

```bash
npm install @nekostack/ui
```

```css
/* in your stylesheet or root entrypoint */
@import "@nekostack/ui/css";
```

```html
<!-- usage -->
<button class="neko-btn">Click</button>
<div class="neko-card">...</div>
```

### Exports

```
@nekostack/ui           → typed JS catalog
@nekostack/ui/css       → dist/ui.css (full)
@nekostack/ui/css/min   → dist/ui.min.css (minified)
@nekostack/ui/components → dist/components.json (class name list)
```

### Test count

- 83 passing

### Still deferred

- JavaScript behavior primitives (headless)
- React / framework bindings
- Icon integration (`@nekostack/icons`)
- Animation integration (`@nekostack/motion`)
