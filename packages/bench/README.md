# @nekostack/bench

> Performance benchmarking + regression detection. Microbenchmarks with statistical significance, CI-integrated perf gates. The "did this PR make things slower?" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Observability — testing-adjacent |
| **Depends on** | `schema` (benchmark definitions), `metrics` (results stored as metrics over time), `audit` (regression detections); external: tinybench or comparable |
| **Used by** | CI pipelines, performance-critical packages (`rules`, `sim`, `search`, `cache`), `path` (perf milestones), `governance` (perf-regression gates) |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 4–8 weeks focused |
| **Sellable?** | Low — benchmark.js / tinybench dominate microbench; CI-perf-gate niche is real |

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
- Load testing (different shape — k6, Artillery).
- Production performance monitoring (`metrics` + `trace`).
- Visual / UI performance (browser-specific tools).
- Profiling (we measure; profiling is a separate concern).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §17 for the full capability map.

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
├── src/
│   ├── define/
│   │   └── bench.ts
│   ├── run/
│   │   ├── warmup.ts
│   │   ├── iterate.ts
│   │   └── stats.ts
│   ├── regression/
│   │   ├── compare.ts
│   │   └── threshold.ts
│   ├── store/
│   │   └── via-metrics.ts
│   └── ci.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Microbench DSL
### v0.2 — Warmup + statistical runs
### v0.3 — CI comparison
### v0.4 — Threshold configuration
### v0.5 — Metric storage
### v1.0 — Stable API

## Product potential

**Internal:** Useful for perf-critical packages.
**Open source release:** Marginal.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Observability — testing-adjacent.
- **Estimated learning return:** Moderate. Microbench statistics, regression detection, CI-perf-gate patterns.
