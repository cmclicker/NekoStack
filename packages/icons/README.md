# @nekostack/icons

> SVG sprite system + typed icon names + theming. The "import an icon, get a typed component" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Frontend depth |
| **Depends on** | `schema`, `theme` (color theming), `ui` |
| **Used by** | every UI consumer; `ui` components ship with icons |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 3–5 weeks focused |
| **Sellable?** | Low — Lucide / Heroicons dominate |

## Why this exists

Icons are typically: import each SVG individually (bundle bloat), or use a giant component library (more bundle bloat). `icons` is the SVG sprite system — one HTTP request for the sprite, typed component references.

## Scope

### In scope
- SVG sprite generation (build-time).
- Typed icon names (`<Icon name="check" />` — TS error if name doesn't exist).
- Per-icon size + color via `theme`.
- Icon set adapters (Lucide, Heroicons, custom).
- Tree-shakable (only ship icons you use).

### Out of scope
- Icon design (we consume icon sets).
- Animated icons (use `motion` separately).

## Boundary

### Owns
- SVG sprite generation
- Typed icon component
- Per-icon size + color
- Icon set adapters
- Tree-shaking

### Does NOT own
| Capability | Lives in |
|---|---|
| Icon design | external (Lucide / Heroicons / Figma) |
| Animations | `motion` |
| Theme tokens | `theme` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **lucide-react** | Mature icon set as React components. | Bundle bloat; each icon is a component. |
| **react-icons** | Many sets unified. | Heavy. |
| **SVG sprites direct** | Universal. | Manual setup. |
| **iconify** | Many sets. | Closer fit but framework-light. |

## How this fits the NekoStack

- **`theme`** drives color.
- **`ui`** components use icons.

## Design philosophy

- **Sprite, not components.** One HTTP request; type-safe references.
- **Theme-aware.** Icon colors from theme tokens.
- **Tree-shakable.** Bundle only what you use.

## Architecture sketch

```
packages/icons/
├── src/
│   ├── sprite/
│   │   └── generate.ts         # build-time
│   ├── component/
│   │   └── Icon.tsx
│   ├── adapters/
│   │   ├── lucide.ts
│   │   └── heroicons.ts
│   ├── tree-shake/
│   │   └── used.ts
│   └── cli.ts                  # `neko icons build`
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Sprite generation
### v0.2 — Typed Icon component
### v0.3 — Theme integration
### v0.4 — Lucide adapter
### v0.5 — Tree-shaking
### v1.0 — Stable API

## Product potential

**Internal:** Used everywhere.
**Open source release:** Marginal.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Frontend depth.
- **Estimated learning return:** Moderate. SVG sprite pipelines, build-time type generation, tree-shaking.
