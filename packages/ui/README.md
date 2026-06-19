# @nekostack/ui

> The Schema-Driven Component Library. Headless where possible, themed via `@nekostack/theme`, accessible by default.
> **The v1.0 Invariant:** Every component prop is strictly bound to the Theme Schema Registry. End-to-end type safety from the data layer to the render layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Force multiplier — build after `theme`, `icons`, `a11y`, `motion` |
| **Depends on** | `schema` (Prop-Registry), `theme` (tokens), `icons` (iconography), `motion` (animations), `a11y` |
| **Used by** | NekoVibe, NekoBattler, Leytide, NekoSystems, future products |
| **Status** | **v1.0 — released.** Vanilla CSS; 92 components; zero JS/React; token-pure. 83 tests. |

## What this is

A vanilla CSS component library. 92 component classes. No JavaScript. No React. No build step required in your project — just import the stylesheet.

All color references consume `@nekostack/theme` CSS custom properties exclusively (`var(--neko-color-semantic-*)`). Zero hardcoded hex values in the compiled output. Every interactive component has `:hover`, `:focus-visible`, and `:disabled` states.

## Install

```bash
npm install @nekostack/ui @nekostack/theme
```

```css
@import "@nekostack/theme/css";  /* design tokens */
@import "@nekostack/ui/css";     /* component classes */
```

```html
<button class="neko-btn">Click</button>
<div class="neko-card">...</div>
<input class="neko-input" type="text" />
```

## Components (v1.0, 92 classes)

| Category | Classes |
|---|---|
| Layout | `neko-container`, `neko-stack`, `neko-cluster`, `neko-grid`, `neko-center` |
| Button | `neko-btn`, `neko-btn-group` |
| Form | `neko-input`, `neko-select`, `neko-textarea`, `neko-checkbox`, `neko-radio`, `neko-switch`, `neko-range`, `neko-file`, `neko-label`, `neko-field`, `neko-fieldset`, `neko-legend`, `neko-input-group` |
| Card / Surface | `neko-card`, `neko-surface`, `neko-elevated`, `neko-muted-surface`, `neko-panel` |
| Feedback | `neko-alert`, `neko-badge`, `neko-tag`, `neko-toast`, `neko-spinner`, `neko-progress`, `neko-skeleton`, `neko-status`, `neko-loading-dots` |
| Navigation | `neko-tabs`, `neko-link`, `neko-breadcrumb`, `neko-menu`, `neko-pagination`, `neko-navbar`, `neko-bottom-nav`, `neko-footer` |
| Overlay | `neko-modal`, `neko-dialog`, `neko-drawer`, `neko-tooltip`, `neko-popover`, `neko-backdrop`, `neko-dropdown` |
| Data | `neko-table`, `neko-list`, `neko-avatar`, `neko-stat`, `neko-empty` |
| Disclosure | `neko-accordion`, `neko-collapse`, `neko-swap` |
| Media | `neko-carousel`, `neko-diff`, `neko-hero`, `neko-banner`, `neko-indicator`, `neko-mask` |
| Mockup | `neko-mockup-browser`, `neko-mockup-window`, `neko-mockup-phone`, `neko-mockup-code` |
| Typography | `neko-prose`, `neko-code`, `neko-kbd`, `neko-kbd-combo`, `neko-divider` |
| Utilities | `neko-visually-hidden`, `neko-truncate`, `neko-rounded`, `neko-text-center`, `neko-text-left`, `neko-text-right`, `neko-text-muted`, `neko-text-subtle` |
| Complex | `neko-chat`, `neko-tree`, `neko-timeline`, `neko-steps`, `neko-stepper`, `neko-rating`, `neko-radial-progress`, `neko-countdown`, `neko-calendar`, `neko-theme-controller` |

## Scope

### In scope (v1.0)
- CSS-only component classes (zero JS)
- Token-pure color references
- WCAG accessible interactive states

### Out of scope (v1.0)
- JavaScript behavior primitives
- React / framework bindings
- Icon integration (`@nekostack/icons`)
- Animation primitives (`@nekostack/motion`)

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §36 for the full capability map.

### Owns
- Headless component primitives
- Styled defaults consuming `theme` tokens
- Common overlay, feedback, navigation, and layout components
- Form bindings consuming `form` state

### Does NOT own
| Capability | Lives in |
|---|---|
| Theme tokens + dark mode + a11y variants | `theme` |
| Animation + transition primitives | `motion` |
| Accessibility utilities | `a11y` |
| Form state management + validation | `form` |

## Design philosophy

- **Prop-Registry Validation.** If it's a stylistic choice, it lives in the theme schema. If it's a data shape, it lives in the data schema.
- **Composition over configuration.** Small components that compose, not one Button with 30 props.
- **Headless underneath, styled by default.** Drop down to the headless layer if needed.
- **Accessibility is non-negotiable.** Keyboard nav, ARIA, focus, contrast — all default.

## Design philosophy

- **CSS is the product.** Import one stylesheet, use class names. No framework required.
- **Semantic tokens only.** Components never use raw color values — always `--neko-color-semantic-*`.
- **Accessibility is structural.** `:hover`, `:focus-visible`, `:disabled` are part of every interactive component, not optional.
- **Token purity is machine-enforced.** The test suite fails the build on any hardcoded hex color.
