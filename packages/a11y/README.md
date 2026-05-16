# @nekostack/a11y

> Accessibility utilities: focus management, keyboard navigation, ARIA helpers, contrast checking, reduced-motion respect, screen-reader patterns. The "make this actually usable for everyone" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Frontend depth — cross-cutting |
| **Depends on** | `schema`, `theme` (high-contrast variant) |
| **Used by** | `ui`, `form`, `table`, `chart`, `editor`, `motion`, `input`, every UI surface |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 6–10 weeks focused |
| **Sellable?** | Modest — React Aria dominates but utility-shaped niche exists |

## Why this exists

Accessibility is non-negotiable but consistently shortchanged. Every UI surface needs: focus management (modals trap focus; popovers return focus), keyboard navigation (arrows in menus, tab order), ARIA roles/labels/live regions, contrast checking, reduced-motion respect, screen-reader announcement helpers.

`a11y` is the cross-cutting utility layer that consuming UI packages call into.

## Scope

### In scope
- Focus management (trap, restore, autofocus).
- Keyboard navigation patterns (arrow nav, tab order, escape handling).
- ARIA helpers (typed roles, label associations, live regions).
- Contrast checking (programmatic + dev-time warnings).
- Reduced-motion respect.
- Screen-reader announcement helpers (live regions).
- Skip-link generation.
- Accessibility test helpers (axe integration).
- ID generation (deterministic, accessible-label-friendly).

### Out of scope
- UI components themselves (`ui`).
- Theme tokens (`theme`).
- Form state (`form`).

## Boundary

### Owns
- Focus management
- Keyboard navigation primitives
- ARIA helpers
- Contrast checking
- Reduced-motion respect
- Screen-reader announcement
- Skip links
- A11y test helpers
- Accessible ID generation

### Does NOT own
| Capability | Lives in |
|---|---|
| Components | `ui` |
| Themes / high-contrast variants | `theme` |
| Form state | `form` |
| Translations | `locale` |
| Audio accessibility (dialogue boost) | `audio` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **React Aria** | Adobe's a11y primitives. | Heavyweight; verbose. We can use as substrate. |
| **Reach UI** | A11y-focused components. | Stale. |
| **axe-core** | Testing library. | Substrate; we wrap. |
| **focus-trap** | Just focus traps. | Substrate. |

## How this fits the NekoStack

- **`ui`** consumes for focus / ARIA.
- **`theme`** provides high-contrast variant.
- **`motion`** respects reduced-motion via us.
- **`input`** integrates for keyboard navigation.
- **`test`** has axe-integration helpers.

## Design philosophy

- **Cross-cutting utility, not components.** We provide hooks/helpers; components compose them.
- **Standards-aligned.** WCAG 2.1 AA is the floor; AAA where feasible.
- **Dev-time warnings.** Bad contrast / missing labels logged in dev.
- **Test integration.** axe assertions for any component.

## Architecture sketch

```
packages/a11y/
├── src/
│   ├── focus/
│   │   ├── trap.ts
│   │   ├── restore.ts
│   │   └── autofocus.ts
│   ├── keyboard/
│   │   ├── arrow-nav.ts
│   │   ├── tab-order.ts
│   │   └── escape.ts
│   ├── aria/
│   │   ├── roles.ts
│   │   ├── labels.ts
│   │   └── live-region.ts
│   ├── contrast/
│   │   ├── check.ts
│   │   └── warn.ts
│   ├── reduced-motion/
│   │   └── respect.ts
│   ├── screen-reader/
│   │   └── announce.ts
│   ├── skip-link/
│   │   └── generate.ts
│   ├── test/
│   │   └── axe.ts
│   └── id/
│       └── generate.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Focus management
### v0.2 — Keyboard navigation primitives
### v0.3 — ARIA helpers
### v0.4 — Reduced-motion
### v0.5 — Screen-reader announce
### v0.6 — Contrast checking
### v0.7 — Test helpers
### v1.0 — Stable API

## Product potential

**Internal:** Universal.
**Open source release:** Plausible — utility-shaped niche exists.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Frontend depth — cross-cutting.
- **Estimated learning return:** Very high. Focus management is subtle, ARIA semantics are deep, contrast math is real CS. Production-grade a11y is rare and valuable.
