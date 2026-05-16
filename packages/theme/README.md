# @nekostack/theme

> Design tokens, dark mode, accessibility variants (high-contrast, reduced-motion), per-user theme storage. CSS variables as the substrate, typed at the TS layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Frontend depth — UI substrate |
| **Depends on** | `schema` (theme shape) |
| **Used by** | `ui`, `motion`, `editor`, `chart`, `table`, `map`, `icons`, every UI consumer |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 4–8 weeks focused |
| **Sellable?** | Modest — Tailwind / Radix Colors dominate; integration angle |

## Why this exists

Design tokens are the substrate of every consistent UI. NekoVibe already has `design-tokens.css` (committed today!) — lifting this into a shared package means every project gets the same token discipline.

## Scope

### In scope
- Color tokens (semantic + raw scales).
- Spacing / typography / radius / shadow tokens.
- Dark mode + theme switching.
- Per-user theme storage (localStorage / db).
- Accessibility variants (high-contrast, reduced-motion respect).
- CSS variable generation.
- Typed TS access to tokens.
- Theme override / extension API.

### Out of scope
- Component library (`ui`).
- Animation timing (`motion`).
- Theme-aware components (consumers).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §36 for the full capability map.

### Owns
- Design token catalog
- Dark mode + theme switching
- Per-user theme storage
- Accessibility variants
- CSS variable generation
- Typed TS access

### Does NOT own
| Capability | Lives in |
|---|---|
| UI components | `ui` |
| Animation timing | `motion` |
| Accessibility primitives | `a11y` |
| Icons | `icons` |
| Theme editor UI | `admin` (if built) |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **Tailwind CSS** | Class-based design tokens. | Class-style; we want CSS variables for theming flexibility. |
| **Radix Colors** | Excellent semantic color scales. | Substrate; we can use as a base. |
| **Stitches** | Stale. | Stale. |
| **Panda CSS** | Modern. | Closer in spirit. |
| **CSS variables direct** | Universal. | What we wrap with TS types. |

## How this fits the NekoStack

- **`ui`** consumes tokens.
- **`motion`** respects reduced-motion.
- **`a11y`** drives accessibility variants.
- **`admin`** could expose theme-editor surface.

## Design philosophy

- **CSS variables as source of truth.** TS layer is typed access.
- **Semantic > raw.** Components use `--color-surface-primary`, not `--purple-500`.
- **Accessibility variants first-class.** High-contrast and reduced-motion are themes, not afterthoughts.
- **Per-user storage.** NekoVibe already does per-user themes; we make it default.

## Architecture sketch

```
packages/theme/
├── src/
│   ├── tokens/
│   │   ├── color.ts
│   │   ├── spacing.ts
│   │   ├── typography.ts
│   │   ├── radius.ts
│   │   └── shadow.ts
│   ├── modes/
│   │   ├── dark.ts
│   │   └── light.ts
│   ├── variants/
│   │   ├── high-contrast.ts
│   │   └── reduced-motion.ts
│   ├── storage/
│   │   ├── local.ts
│   │   └── db.ts
│   ├── css-vars/
│   │   └── generate.ts
│   ├── ts-access/
│   │   └── typed.ts
│   └── override/
│       └── extend.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Color + spacing + typography tokens
### v0.2 — Dark mode switching
### v0.3 — CSS variable generation
### v0.4 — Typed TS access
### v0.5 — Accessibility variants
### v0.6 — Per-user storage
### v1.0 — Stable API

## Product potential

**Internal:** Used by every UI consumer.
**Open source release:** Modest.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Frontend depth — UI substrate.
- **Estimated learning return:** Moderate. Design token systems, CSS variable architecture, accessibility theme variants.
