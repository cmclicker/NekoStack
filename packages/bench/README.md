# @nekostack/bench

> Performance benchmarking + regression detection. Microbenchmarks with statistical significance, CI-integrated perf gates. The "did this PR make things slower?" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Observability â€” testing-adjacent |
| **Depends on** | `schema` (benchmark definitions), `metrics` (results stored as metrics over time), `audit` (regression detections); external: tinybench or comparable |
| **Used by** | CI pipelines, performance-critical packages (`rules`, `sim`, `search`, `cache`), `path` (perf milestones), `governance` (perf-regression gates) |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 4â€“8 weeks focused |

## Why this exists

Most projects test functional correctness; few test performance. The result: silent perf regressions ship. A 100ms slowdown in a hot path goes unnoticed for months.

`bench` is the package for: define microbenchmarks, run them in CI, store results, alert on regressions.

## Scope

### In scope
- Microbenchmark definition (run-fn + warmup + iterations).
- Statistical significance (multiple runs, variance computation).
- Result storage (over time, via `metrics`).
- Regression detection (compare PR to main baseline).
- CI integration (`neko bench check --against main`).
- Per-benchmark threshold configuration.

### Out of scope
- Load testing (different shape â€” k6, Artillery).
- Production performance monitoring (`metrics` + `trace`).
- Visual / UI performance (browser-specific tools).
- Profiling (we measure; profiling is a separate concern).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§17 for the full capability map.

### Owns
- Microbenchmark DSL
- Warmup + iteration management
- Statistical significance
- Regression detection (CI)
- Per-benchmark thresholds
- Result history (via `metrics`)

### Does NOT own
| Capability | Lives in |
|---|---|
| Load testing | external (k6, Artillery) |
| Profiling | external |
| Production monitoring | `metrics` + `trace` |
| Tests of correctness | `test` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **tinybench** | Modern microbench. | Substrate. |
| **benchmark.js** | Mature microbench. | Substrate. |
| **mitata** | Modern, statistical. | Substrate. |
| **CodSpeed / Codecov** | Hosted perf-CI. | Vendor. |

## How this fits the NekoStack

- **`metrics`** stores results over time.
- **`audit`** records regressions.
- **`governance`** can declare "no PR may regress benchmark X by more than Y%."

## Design philosophy

- **Statistical, not single-run.** Multiple runs, variance computation, significance testing.
- **Regression detection is mechanical.** PR runs benchmarks, compares to main, fails if regression beyond threshold.
- **Stored over time.** Trends matter as much as point-in-time.

## Architecture sketch

```
packages/bench/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ define/
â”‚   â”‚   â””â”€â”€ bench.ts
â”‚   â”œâ”€â”€ run/
â”‚   â”‚   â”œâ”€â”€ warmup.ts
â”‚   â”‚   â”œâ”€â”€ iterate.ts
â”‚   â”‚   â””â”€â”€ stats.ts
â”‚   â”œâ”€â”€ regression/
â”‚   â”‚   â”œâ”€â”€ compare.ts
â”‚   â”‚   â””â”€â”€ threshold.ts
â”‚   â”œâ”€â”€ store/
â”‚   â”‚   â””â”€â”€ via-metrics.ts
â”‚   â””â”€â”€ ci.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Microbench DSL
### v0.2 â€” Warmup + statistical runs
### v0.3 â€” CI comparison
### v0.4 â€” Threshold configuration
### v0.5 â€” Metric storage
### v1.0 â€” Stable API

## Product potential

**Internal:** Useful for perf-critical packages.
**Open source release:** Marginal.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Observability â€” testing-adjacent.
- **Estimated learning return:** Moderate. Microbench statistics, regression detection, CI-perf-gate patterns.
