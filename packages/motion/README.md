# @nekostack/motion

> Animation + transition primitives. Spring physics, choreography, gesture-driven motion. Reduced-motion respect baked in.

## Quick reference

| | |
|---|---|
| **Build tier** | Frontend depth |
| **Depends on** | `schema`, `theme` (reduced-motion variant), `a11y` |
| **Used by** | `ui`, `editor`, `chart`, every UI surface with motion |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 6–10 weeks focused |
| **Sellable?** | Low — Framer Motion dominates |

## Why this exists

UI motion done right takes a real library. Framer Motion is excellent but heavyweight. `motion` is the NekoStack-conventional motion layer — lighter, integrates with theme, respects reduced-motion by default.

## Scope

### In scope
- Spring physics.
- Tween animations.
- Choreography (sequenced + parallel animations).
- Gesture-driven motion (drag, scroll-linked).
- Reduced-motion respect (animations skip or simplify).
- Layout animations (FLIP technique).
- Enter / exit transitions.

### Out of scope
- Charts / data viz (`chart`).
- Canvas / game animations (`canvas` / game engines).
- 3D / WebGL animations.

## Boundary

### Owns
- Spring physics
- Tween
- Choreography
- Gesture-driven motion
- Reduced-motion respect
- Layout animations
- Enter / exit transitions

### Does NOT own
| Capability | Lives in |
|---|---|
| Chart animations | `chart` |
| Canvas animations | `canvas` |
| Theme tokens | `theme` |
| Accessibility primitives | `a11y` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **Framer Motion** | Industry standard React motion. | Heavy bundle. |
| **react-spring** | Spring-based. | Smaller ecosystem. |
| **GSAP** | Mature. | Commercial license at scale; non-React. |
| **CSS transitions / animations** | Built-in. | No spring, no choreography. |

## How this fits the NekoStack

- **`theme`** provides reduced-motion variant.
- **`a11y`** integrates with prefers-reduced-motion media query.

## Design philosophy

- **Spring by default.** Springs feel right; tweens feel mechanical.
- **Reduced-motion baked in.** Skip animations when user prefers.
- **Choreography first-class.** Sequenced + parallel without callback hell.

## Architecture sketch

```
packages/motion/
├── src/
│   ├── spring/
│   │   └── physics.ts
│   ├── tween/
│   │   └── ease.ts
│   ├── choreography/
│   │   ├── sequence.ts
│   │   └── parallel.ts
│   ├── gesture/
│   │   ├── drag.ts
│   │   └── scroll.ts
│   ├── reduced-motion/
│   │   └── respect.ts
│   ├── layout/
│   │   └── flip.ts
│   └── transition/
│       ├── enter.ts
│       └── exit.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Spring + tween
### v0.2 — Choreography
### v0.3 — Gesture
### v0.4 — Reduced-motion
### v0.5 — Layout animations
### v1.0 — Stable API

## Product potential

**Internal:** Used everywhere.
**Open source release:** Marginal.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Frontend depth.
- **Estimated learning return:** High. Spring physics, choreography, FLIP layout animations, gesture handling.
