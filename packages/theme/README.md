# @nekostack/theme

> Design tokens, dark mode, accessibility variants (high-contrast, reduced-motion), and per-user theme storage. 
> **The v1.0 Invariant:** Theme tokens are an explicit `@nekostack/schema`. The theme is a data contract, not just a CSS file.

## Quick reference

| | |
|---|---|
| **Build tier** | Frontend depth — UI substrate |
| **Depends on** | `schema` (theme shape) |
| **Used by** | `ui`, `motion`, `editor`, `chart`, `table`, `map`, `icons`, every UI consumer |
| **Status** | **v1.0 — released.** W3C DTCG pipeline; 3 themes × 2 modes; WCAG AA. 78 tests. |

## The "Prop-Registry" Invariant (v1.0 Architecture)

In NekoStack, a theme isn't just a collection of CSS variables; it is a **computational state** governed by the same data-integrity rules as our database.

1. **Token Schema:** The theme's allowed design tokens (e.g., `colors.primary`, `spacing.md`) are strictly defined by a `@nekostack/schema`.
2. **UI Consumption:** The `@nekostack/ui` package is only allowed to accept style/variant props that exist within this schema registry. 
3. **End-to-End Type Safety:** By generating the CSS variables and the TypeScript prop definitions from the exact same IR, we eliminate the "Silent Lie" of frontend development where a developer passes `variant="blue-500"` but the CSS only defines `--blue-400`.

## Scope

### In scope
- Schema-driven Token Catalog (semantic + raw scales).
- Dark mode + theme switching logic.
- Per-user theme storage (localStorage / db) validated by the schema.
- Accessibility variants (high-contrast, reduced-motion respect) as first-class theme states.
- Automated CSS variable generation from the Schema IR.
- Typed TS access generated from the Schema IR.

### Out of scope
- Component library (`ui`).
- Animation timing (`motion`).
- Free-form, untyped CSS variable injection.

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §36 for the full capability map.

### Owns
- Design token schema definitions
- Dark mode + theme switching state machine
- Per-user theme storage logic
- CSS variable generation pipeline
- Typed TS access

### Does NOT own
| Capability | Lives in |
|---|---|
| UI components | `ui` |
| Animation timing | `motion` |
| Accessibility primitives | `a11y` |

## Design philosophy

- **Schema as Source of Truth.** CSS variables and TS types are both generated outputs of the Theme IR.
- **Semantic > raw.** Components use `surface.primary`, not `purple.500`.
- **Accessibility variants first-class.** High-contrast and reduced-motion are themes, not afterthoughts.

## What ships in v1.0

- W3C DTCG token pipeline (`src/tokens.json` → `dist/neko.css`, typed JS, Tailwind preset)
- 3 themes (Neko, Synthwave, Cupcake) × 2 modes (dark, light) in a single CSS file
- WCAG 2.1 AA contrast verified across all 6 theme × mode combinations (78 tests)
- `prefers-reduced-motion` respected at the CSS layer

## Deferred to future releases

- Per-user theme storage (localStorage / db)
- High-contrast accessibility variant
- Animation / motion tokens (`@nekostack/motion`)
