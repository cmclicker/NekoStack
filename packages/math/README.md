# @nekostack/math

> Curve functions, probability tables, interpolation, statistics. The "shape this number" layer for game design, economy modeling, animation easing, balance.

## Quick reference

| | |
|---|---|
| **Build tier** | Utility primitives |
| **Depends on** | (none â€” foundational) |
| **Used by** | `economy` (curve modeling), `progression` (leveling curves), `motion` (easing), `procgen` (interpolation), `chart` (axis scales), `random` (some distributions), game balance code |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 3â€“5 weeks focused |

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
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ curves/
â”‚   â”‚   â”œâ”€â”€ linear.ts
â”‚   â”‚   â”œâ”€â”€ log.ts
â”‚   â”‚   â”œâ”€â”€ exp.ts
â”‚   â”‚   â”œâ”€â”€ sigmoid.ts
â”‚   â”‚   â””â”€â”€ piecewise.ts
â”‚   â”œâ”€â”€ probability/
â”‚   â”‚   â”œâ”€â”€ table.ts
â”‚   â”‚   â””â”€â”€ expected-value.ts
â”‚   â”œâ”€â”€ interpolate/
â”‚   â”‚   â”œâ”€â”€ lerp.ts
â”‚   â”‚   â”œâ”€â”€ cubic.ts
â”‚   â”‚   â””â”€â”€ bezier.ts
â”‚   â”œâ”€â”€ range/
â”‚   â”‚   â”œâ”€â”€ clamp.ts
â”‚   â”‚   â””â”€â”€ remap.ts
â”‚   â”œâ”€â”€ stats/
â”‚   â”‚   â”œâ”€â”€ mean.ts
â”‚   â”‚   â”œâ”€â”€ median.ts
â”‚   â”‚   â”œâ”€â”€ variance.ts
â”‚   â”‚   â””â”€â”€ percentile.ts
â”‚   â”œâ”€â”€ vector/
â”‚   â”‚   â”œâ”€â”€ vec2.ts
â”‚   â”‚   â””â”€â”€ vec3.ts
â”‚   â””â”€â”€ easing/
â”‚       â””â”€â”€ functions.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Curves + interpolation
### v0.2 â€” Probability tables
### v0.3 â€” Statistics
### v0.4 â€” Vector helpers
### v0.5 â€” Easing functions
### v1.0 â€” Stable API

## Product potential

**Internal:** Used by games + economy + UI motion.
**Open source release:** Marginal.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Utility primitives.
- **Estimated learning return:** High. Curve design, interpolation, statistics â€” game-design + production engineering.
