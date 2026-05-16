# @nekostack/fuzz

> Property-based / fuzz testing. Generative input, invariant checking, shrinkage on failure. The "is this rule engine / sim / API actually correct under all inputs?" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Testing depth |
| **Depends on** | `schema` (input generators), `test` (test runner integration), `random` (PRNG), `audit`; external: `fast-check` or comparable |
| **Used by** | `rules` (rule engine invariants), `sim` (sim determinism), `api` (request validation), `schema` (round-trip generators), CI |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 4–8 weeks focused |
| **Sellable?** | Low — fast-check dominates |

## Why this exists

Property-based testing finds bugs unit tests miss: "for any valid input, the rule engine should not throw" or "any serialization round-trips to identical input." Hand-rolling generators per project is wasteful.

## Scope

### In scope
- Schema-driven generators (from `@nekostack/schema`).
- Invariant declarations.
- Shrinkage on failure.
- Fast-check integration.
- Deterministic seeding for reproducibility.
- CI integration.

### Out of scope
- Unit tests (`test`).
- Performance benchmarks (`bench`).
- Service mocks (`mock`).
- LLM evals (`eval`).

## Boundary

### Owns
- Schema-driven generators
- Invariant declarations
- Shrinkage
- Property-based test framework integration

### Does NOT own
| Capability | Lives in |
|---|---|
| Unit testing | `test` |
| Benchmarks | `bench` |
| Mocks | `mock` |
| LLM evals | `eval` |
| Random primitives | `random` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **fast-check** | Mature TS PBT. | Substrate; we wrap. |
| **jsverify** | Older. | Stale. |
| **Hypothesis** (Python) | Industry-leading. | Wrong language. |

## How this fits the NekoStack

- **`schema`** for generators.
- **`test`** for runner.
- **`random`** for PRNG.
- Critical for `rules` and `sim` correctness.

## Design philosophy

- **Schema-driven generators.** If you have a schema, you have a generator for free.
- **Shrinkage finds minimal counter-examples.**
- **Deterministic seeds.** Failures reproduce.

## Architecture sketch

```
packages/fuzz/
├── src/
│   ├── generators/
│   │   └── from-schema.ts
│   ├── invariants/
│   │   └── declare.ts
│   ├── shrink/
│   │   └── minimize.ts
│   ├── runner/
│   │   └── via-fast-check.ts
│   └── ci.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — fast-check wrapper
### v0.2 — Schema-driven generators
### v0.3 — Invariant DSL
### v0.4 — CI integration
### v1.0 — Stable API

## Product potential

**Internal:** Critical for `rules` / `sim` / `schema` correctness.
**Open source release:** Marginal.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Testing depth.
- **Estimated learning return:** Very high. Property-based testing methodology, shrinkage, invariant design.
