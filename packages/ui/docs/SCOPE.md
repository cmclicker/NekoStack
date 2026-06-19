# @nekostack/ui — Scope & Invariants

## What this package is

A vanilla CSS component library. 92 component classes across 13 CSS source files. Zero JavaScript. Zero React. Consumes `@nekostack/theme` CSS custom properties exclusively.

## Invariants

1. **Token purity** — zero hardcoded hex colors in the compiled output. Every color reference uses `var(--neko-color-semantic-*)` or a CSS keyword (transparent, currentColor, inherit, initial, none).
2. **Accessible interactive states** — every interactive component exposes `:hover`, `:focus-visible`, and `:disabled` states.
3. **No `!important` outside base.css** — enforced by the test suite.
4. **No keyframe redefinition** — `@keyframes neko-*` are defined once in `base.css` only. Other files must not redefine them.
5. **Cascade order** — the 13 source files concatenate in a fixed declared order. The test suite verifies position.
6. **Block comment header** — every source file begins with a `/* ... */` block comment listing its classes.
7. **Component catalog ≥ 90** — `dist/components.json` must contain at least 90 class names (currently: 92).

## What is in scope (v1.0)

- CSS-only component classes (no JS behavior)
- 13 component categories: base, layout, button, form, disclosure, card, feedback, nav, overlay, data, media, mockup, utilities
- Full build: `dist/ui.css` (full) + `dist/ui.min.css` (minified) + `dist/components.json` (catalog)
- Token purity enforcement

## What is NOT in scope (v1.0)

- JavaScript behavior → future release
- React / Vue / Svelte bindings → future release
- Headless primitives (FocusTrap, Portal, Slot) → future release
- Icon integration → `@nekostack/icons`
- Animation primitives → `@nekostack/motion`
- Form state management → `@nekostack/form`
