# @nekostack/random

> Deterministic seeded PRNG. Weighted random, shuffle bags, distribution sampling. The "same seed produces same output" foundation for sims, procgen, gacha, tests.

## Quick reference

| | |
|---|---|
| **Build tier** | Utility primitives |
| **Depends on** | (none â€” foundational); external: seedable PRNG library |
| **Used by** | `sim` (deterministic sims), `procgen` (reproducible generation), `replay` (deterministic re-execution), `rules` (where stochastic), `test` (seeded factories), `economy` (Monte Carlo), `id` (non-crypto random); not crypto â€” that's `crypto` |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 3â€“5 weeks focused |

## Why this exists

`Math.random()` is fine for trivia; bad for anything reproducible. Sims, procgen, replays â€” all need deterministic randomness. `random` provides seedable PRNGs with NekoStack-conventional helpers.

## Scope

### In scope
- Seeded PRNG (mulberry32 / xorshift / etc.).
- RNG streams (independent streams from one seed).
- Weighted random (probability tables).
- Shuffle bags (no repeats until full cycle).
- Distribution sampling (normal / poisson / exponential / etc.).
- Pity systems (guaranteed-drop counters for gacha).
- Replay-friendly state snapshots.

### Out of scope
- Cryptographic random (`crypto`).
- Math primitives (`math`).
- Procgen-specific generators (`procgen`).

## Boundary

### Owns
- Seeded PRNG
- RNG streams
- Weighted random
- Shuffle bags
- Distribution sampling
- Pity systems
- State snapshots

### Does NOT own
| Capability | Lives in |
|---|---|
| Cryptographic random | `crypto` |
| Math / curves | `math` |
| Procgen content generation | `procgen` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **seedrandom** | Mature. | Substrate. |
| **chance.js** | High-level. | Older. |
| **Math.random()** | Built-in. | Non-deterministic. |

## How this fits the NekoStack

- Every deterministic process uses us.
- **`crypto`** is the cryptographic counterpart.

## Design philosophy

- **Determinism is non-negotiable.** Same seed â†’ same output.
- **Streams are independent.** Multiple consumers don't interfere.
- **Pity systems are real.** Gacha needs guaranteed-drops; we provide.
- **NOT for crypto.** `crypto` exists for that.

## Architecture sketch

```
packages/random/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ prng/
â”‚   â”‚   â”œâ”€â”€ mulberry32.ts
â”‚   â”‚   â””â”€â”€ xorshift.ts
â”‚   â”œâ”€â”€ streams/
â”‚   â”‚   â””â”€â”€ independent.ts
â”‚   â”œâ”€â”€ weighted/
â”‚   â”‚   â””â”€â”€ table.ts
â”‚   â”œâ”€â”€ shuffle-bag/
â”‚   â”‚   â””â”€â”€ bag.ts
â”‚   â”œâ”€â”€ distribution/
â”‚   â”‚   â”œâ”€â”€ normal.ts
â”‚   â”‚   â”œâ”€â”€ poisson.ts
â”‚   â”‚   â””â”€â”€ exponential.ts
â”‚   â”œâ”€â”€ pity/
â”‚   â”‚   â””â”€â”€ counter.ts
â”‚   â””â”€â”€ snapshot/
â”‚       â””â”€â”€ state.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Seeded PRNG
### v0.2 â€” Independent streams
### v0.3 â€” Weighted random
### v0.4 â€” Shuffle bags
### v0.5 â€” Distributions
### v0.6 â€” Pity systems
### v0.7 â€” State snapshots
### v1.0 â€” Stable API

## Product potential

**Internal:** Used by sims, games, procgen, tests.
**Open source release:** Marginal.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Utility primitives.
- **Estimated learning return:** High. PRNG algorithms, deterministic streams, distribution sampling, gacha mechanics.
