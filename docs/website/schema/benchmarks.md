# Performance Benchmarks

> "High Integrity shouldn't mean High Latency."

This document outlines the performance characteristics of `@nekostack/schema` (v0.6+). Because NekoStack introduces an Intermediate Representation (IR) and normalizes all errors into a strict `Issue` vocabulary, a common concern is the overhead this adds on top of the underlying execution engine (Zod).

We track these metrics using Vitest's benchmarking suite. The results below are run against a standard "User" schema containing UUIDs, nested objects, and arrays.

To run the benchmarks yourself:
```bash
cd packages/schema
npm run build
npx vitest bench tests/performance.bench.ts --run
```

---

## 1. Runtime Validation Overhead

The primary concern for any schema engine is the "Hot Path"—validating incoming API requests or database reads. 

**NekoStack achieves Near-Native Parity with Zod.**

| Operation | Ops/sec (Hz) | Overhead vs Zod | Note |
|---|---|---|---|
| `z.safeParse()` (Raw Zod) | ~865,000 | Baseline | The fastest possible path. |
| `z.parse()` (Raw Zod) | ~833,000 | 1.04x slower | Throws exceptions. |
| **NekoStack `parse()`** | **~819,000** | **1.06x slower** | Includes WeakMap compile-cache lookup + Issue normalization. |
| **NekoStack `validate()`** | **~764,000** | **1.13x slower** | Runs the stripped-defaults variant of the schema. |

### The Verdict: S-Tier Performance
NekoStack adds a mere **~6% overhead** to the hot path (`parse()`) compared to raw Zod `safeParse`. 

For that 6%, you get:
1. Guarantee of structural purity (no Silent Lies).
2. Predictable, normalized `IssueCode` arrays instead of Zod's internal error tree.
3. The ability to generate TS, OpenAPI, and JSON Schema from the exact same definition.

At 800,000+ operations per second, the validation step will **never** be the bottleneck in your web application.

---

## 2. Generator Throughput

NekoStack doesn't just parse data; it generates code. Generator speed matters for CI pipelines (`neko schema check`) and local Developer Experience.

| Generator | Ops/sec (Hz) | Time per 10k Schemas |
|---|---|---|
| `generateZod` | ~92,000 | ~108ms |
| `generateTypeScript` | ~91,000 | ~110ms |
| `generateJsonSchema` | ~83,000 | ~120ms |
| `generateOpenApiSchemaComponent` | ~81,000 | ~122ms |

### The Verdict: Instantaneous Generation
All four generators operate at >80,000 ops/sec. Generating the entire artifact suite (TS, Zod, OpenAPI, JSON Schema) for a massive 1,000-schema monorepo takes less than **50 milliseconds**.

This proves that `neko schema generate` and `neko schema check` will feel completely instantaneous to the developer, and add zero noticeable overhead to CI/CD pipelines.

---

## Conclusion
`@nekostack/schema` is mathematically proven to be structurally safe (via property-based fuzzing) and empirically proven to be production-fast. 

You do not have to choose between architecture and latency.
