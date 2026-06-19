# @nekostack/economy

> In-game economy modeling: currencies, sink/source analysis, drift detection, Monte Carlo balance simulation. The "is this economy healthy?" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Game systems |
| **Depends on** | `schema` (currency / sink / source definitions), `sim` (Monte Carlo runs), `random`, `math` (probability), `telemetry` (real-economy metrics) |
| **Used by** | NekoBattler (whisker economy), NekoGacha (pull economics), Leytide (gold + crafting), any game with virtual currency |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 8â€“12 weeks focused |

## Why this exists

Game economies fail silently. Players accumulate too much currency â†’ inflation â†’ rewards feel meaningless. Players accumulate too little â†’ grind-wall â†’ players quit. Without a model, you discover this from reviews.

`economy` is the toolkit:
- Define currencies + sinks (what removes them) + sources (what produces them).
- Simulate via `sim` (10K simulated players over 90 days; check drift).
- Detect drift (real-economy `telemetry` vs predicted).
- Tune via parameter sweeps.

## Scope

### In scope
- Currency definitions (whiskers, gold, gems, etc.).
- Sink / source registry per currency.
- Predicted economy curves (expected balance over time).
- Monte Carlo balance simulation.
- Real-economy metrics (drift from predicted).
- Drift detection + alerting.
- Sensitivity analysis (param X up 10% â†’ balance impact?).
- Player-segment analysis (whales / dolphins / minnows).

### Out of scope
- Real-money billing (`billing`).
- Plan-based gating (`entitlements`).
- Gacha pull-rate mechanics specifically (consuming game).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§61 (in BOUNDARIES.md).

### Owns
- Currency definitions
- Sink / source registry
- Predicted economy curves
- Monte Carlo balance simulation
- Drift detection
- Sensitivity analysis
- Player-segment analysis

### Does NOT own
| Capability | Lives in |
|---|---|
| Real-money billing | `billing` |
| Plan-based gating | `entitlements` |
| Specific game's currency rules | consuming game |
| Telemetry event ingestion | `telemetry` |

## How this fits the NekoStack

- **`sim`** runs Monte Carlo.
- **`random`** for pull / drop randomness.
- **`math`** for distributions.
- **`telemetry`** provides real-economy data.

## Design philosophy

- **Predicted vs actual.** Always compare model to reality.
- **Drift alerts.** When actual deviates from predicted beyond threshold.
- **Param sensitivity.** Know which knobs matter.
- **Segment-aware.** Average balance lies; segment distributions matter.

## Architecture sketch

```
packages/economy/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ currency/
â”‚   â”‚   â””â”€â”€ define.ts
â”‚   â”œâ”€â”€ sink-source/
â”‚   â”‚   â”œâ”€â”€ register.ts
â”‚   â”‚   â””â”€â”€ analyze.ts
â”‚   â”œâ”€â”€ predict/
â”‚   â”‚   â””â”€â”€ curve.ts
â”‚   â”œâ”€â”€ simulate/
â”‚   â”‚   â””â”€â”€ monte-carlo.ts
â”‚   â”œâ”€â”€ drift/
â”‚   â”‚   â””â”€â”€ detect.ts
â”‚   â”œâ”€â”€ sensitivity/
â”‚   â”‚   â””â”€â”€ analyze.ts
â”‚   â”œâ”€â”€ segment/
â”‚   â”‚   â””â”€â”€ distribute.ts
â”‚   â””â”€â”€ cli.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Currency + sink/source registry
### v0.2 â€” Predicted curves
### v0.3 â€” Monte Carlo simulation
### v0.4 â€” Drift detection
### v0.5 â€” Sensitivity analysis
### v0.6 â€” Player segments
### v1.0 â€” Stable API

## Product potential

**Internal:** NekoBattler whiskers, NekoGacha pulls, Leytide gold.
**Open source release:** Plausible â€” TS economy modeling is undersupplied.
**Commercial:** Marginal.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Game systems.
- **Estimated learning return:** Very high. Economy design, Monte Carlo, drift detection, sensitivity analysis â€” rare and important game-design skills.
