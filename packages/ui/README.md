# @nekostack/ui

> The Schema-Driven Component Library. Headless where possible, themed via `@nekostack/theme`, accessible by default.
> **The v1.0 Invariant:** Every component prop is strictly bound to the Theme Schema Registry. End-to-end type safety from the data layer to the render layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Force multiplier — build after `theme`, `icons`, `a11y`, `motion` |
| **Depends on** | `schema` (Prop-Registry), `theme` (tokens), `icons` (iconography), `motion` (animations), `a11y` |
| **Used by** | NekoVibe, NekoBattler, Leytide, NekoSystems, future products |
| **Status** | Empty placeholder — Formalizing |
| **Est. to v1.0** | 12–24 weeks focused |

## The "Prop-Registry" Invariant (v1.0 Architecture)

Getting `ui` to v1.0 represents a massive logical shift: moving from data integrity to **computational aesthetics and state**.

To maintain NekoStack's purity, UI components cannot be wildcards. The defining rule of `@nekostack/ui` is the **Prop-Registry Invariant**:
- A component's stylistic props (variants, sizes, colors, spacing) are **not** hardcoded enums in a `.tsx` file.
- They are dynamically restricted by the Intermediate Representation (IR) defined in `@nekostack/theme`.
- If a component accepts data, that data's shape is verified by `@nekostack/schema`.

**The "S-Tier" Flex:** You generate your UI component props from the same IR that defines your database. A change to the design system schema instantly updates the TypeScript compiler for every React component across the monorepo, guaranteeing that a UI component never receives an invalid state.

## Why this exists

Every frontend reaches for the same components. Without a shared library governed by a strict schema, projects reinvent them with subtly different behaviors, drifting design tokens, and zero cross-project muscle memory.

`@nekostack/ui` provides headless primitives (behavior and a11y) layered with styled defaults that are mathematically tied to `@nekostack/theme`. It optimizes for the solo developer who needs to trust that the components they wrote six months ago will perfectly accept the data models they are generating today.

## Scope

### In scope
- Headless component primitives: behavior, state, accessibility.
- Styled default implementations strictly bound to `@nekostack/theme` tokens.
- Composable building blocks: Slot, Portal, FocusTrap, VisuallyHidden.
- Common components: Button, Input, Dialog, Popover, Toast, Avatar, Card, etc.
- Layout primitives: Stack, Grid, Container.
- Form primitives that natively consume `@nekostack/form` schemas.
- Strict A11y discipline.

### Out of scope
- Domain widgets (e.g., CombatLog). Those live in consuming projects.
- Untyped "style" prop injection. Inline overrides must still conform to the theme schema.

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

## Roadmap

### v0.1 — Primitives & The "Prop-Registry" Binding
- Establish the connection between `@nekostack/schema`, `@nekostack/theme`, and React Component props.
- Slot, Portal, FocusTrap.
- Button with schema-validated variants.
### v0.2 — Form controls (Input, Select, Switch)
### v0.3 — Layout (Stack, Grid, Container)
### v0.4 — Overlays (Dialog, Popover)
### v1.0 — Stable API
