# @nekostack/random

> Deterministic seeded PRNG. Weighted random, shuffle bags, distribution sampling. The "same seed produces same output" foundation for sims, procgen, gacha, tests.

## Quick reference

| | |
|---|---|
| **Build tier** | Utility primitives |
| **Depends on** | (none — foundational); external: seedable PRNG library |
| **Used by** | `sim` (deterministic sims), `procgen` (reproducible generation), `replay` (deterministic re-execution), `rules` (where stochastic), `test` (seeded factories), `economy` (Monte Carlo), `id` (non-crypto random); not crypto — that's `crypto` |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 3–5 weeks focused |
| **Sellable?** | Low — substrate |

## Why this exists

`Math.random()` is fine for trivia; bad for anything reproducible. Sims, procgen, replays — all need deterministic randomness. `random` provides seedable PRNGs with NekoStack-conventional helpers.

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

- **Determinism is non-negotiable.** Same seed → same output.
- **Streams are independent.** Multiple consumers don't interfere.
- **Pity systems are real.** Gacha needs guaranteed-drops; we provide.
- **NOT for crypto.** `crypto` exists for that.

## Architecture sketch

```
packages/random/
├── src/
│   ├── prng/
│   │   ├── mulberry32.ts
│   │   └── xorshift.ts
│   ├── streams/
│   │   └── independent.ts
│   ├── weighted/
│   │   └── table.ts
│   ├── shuffle-bag/
│   │   └── bag.ts
│   ├── distribution/
│   │   ├── normal.ts
│   │   ├── poisson.ts
│   │   └── exponential.ts
│   ├── pity/
│   │   └── counter.ts
│   └── snapshot/
│       └── state.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Seeded PRNG
### v0.2 — Independent streams
### v0.3 — Weighted random
### v0.4 — Shuffle bags
### v0.5 — Distributions
### v0.6 — Pity systems
### v0.7 — State snapshots
### v1.0 — Stable API

## Product potential

**Internal:** Used by sims, games, procgen, tests.
**Open source release:** Marginal.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Utility primitives.
- **Estimated learning return:** High. PRNG algorithms, deterministic streams, distribution sampling, gacha mechanics.
