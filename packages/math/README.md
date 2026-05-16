# @nekostack/math

> Curve functions, probability tables, interpolation, statistics. The "shape this number" layer for game design, economy modeling, animation easing, balance.

## Quick reference

| | |
|---|---|
| **Build tier** | Utility primitives |
| **Depends on** | (none — foundational) |
| **Used by** | `economy` (curve modeling), `progression` (leveling curves), `motion` (easing), `procgen` (interpolation), `chart` (axis scales), `random` (some distributions), game balance code |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 3–5 weeks focused |
| **Sellable?** | Low — substrate |

## Why this exists

Game / economy / progression code is full of curve math: "how much XP for level N?", "what's the probability of X?", "ease this animation." Every project reinvents the same helpers. `math` collects them.

## Scope

### In scope
- Curve functions (linear / log / exp / sigmoid / piecewise).
- Probability tables.
- Interpolation (lerp / cubic / catmull-rom / bezier).
- Clamping / scaling / remapping ranges.
- Statistical helpers (mean / median / variance / percentile).
- Vector / matrix lite (2D / 3D vectors, basic ops).
- Easing functions for `motion`.

### Out of scope
- Random number generation (`random`).
- Linear algebra heavy lifting (gl-matrix etc.).
- Specific economic models (`economy`).

## Boundary

### Owns
- Curve functions
- Probability tables
- Interpolation
- Clamping / scaling / remap
- Statistics
- 2D / 3D vector lite
- Easing functions

### Does NOT own
| Capability | Lives in |
|---|---|
| Random number generation | `random` |
| Cryptographic math | `crypto` |
| Heavy linear algebra | external (gl-matrix) |
| Economy model | `economy` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **simple-statistics** | Mature stats. | Substrate. |
| **gl-matrix** | Heavy linear algebra. | More than we need. |
| **Custom helpers** | Common. | Reinvented per project. |

## How this fits the NekoStack

- **`economy`** for sink/source curves.
- **`progression`** for leveling curves.
- **`motion`** for easing.
- **`random`** for distribution math.
- **`chart`** for axis scales.

## Design philosophy

- **Composable functions.** Small helpers, combine freely.
- **Game-design friendly.** Easing curves and probability tables prioritized.
- **No heavyweight linear algebra.** Use gl-matrix if needed.

## Architecture sketch

```
packages/math/
├── src/
│   ├── curves/
│   │   ├── linear.ts
│   │   ├── log.ts
│   │   ├── exp.ts
│   │   ├── sigmoid.ts
│   │   └── piecewise.ts
│   ├── probability/
│   │   ├── table.ts
│   │   └── expected-value.ts
│   ├── interpolate/
│   │   ├── lerp.ts
│   │   ├── cubic.ts
│   │   └── bezier.ts
│   ├── range/
│   │   ├── clamp.ts
│   │   └── remap.ts
│   ├── stats/
│   │   ├── mean.ts
│   │   ├── median.ts
│   │   ├── variance.ts
│   │   └── percentile.ts
│   ├── vector/
│   │   ├── vec2.ts
│   │   └── vec3.ts
│   └── easing/
│       └── functions.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Curves + interpolation
### v0.2 — Probability tables
### v0.3 — Statistics
### v0.4 — Vector helpers
### v0.5 — Easing functions
### v1.0 — Stable API

## Product potential

**Internal:** Used by games + economy + UI motion.
**Open source release:** Marginal.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Utility primitives.
- **Estimated learning return:** High. Curve design, interpolation, statistics — game-design + production engineering.
