---
layout: home
---

# NekoStack

A hand-crafted, opinionated full-stack utility suite. We replace "Silent Lies" and API drift with mathematical data contracts.

## Capability Matrix

| Package | Status | Invariant | Speed |
|---|---|---|---|
| **`@nekostack/schema`** | **v1.0 (published)** | Canonical IR. Compiles to TS, Zod, OpenAPI. Fuzz-tested. 1,294 tests. | ~6% overhead vs raw Zod |
| **`@nekostack/migrate-runner`** | v0.1.0 (pre-release) | Pure state machine. Validates `input → transform → output`. 405 tests. | Streaming input/audit (O(1)); buffered output |
| **`@nekostack/theme`** | v0.1 (unreleased) | Multi-theme design tokens (DTCG) → CSS variables + Tailwind preset. | Build-time |
| **`@nekostack/ui`** | v0.1 (unreleased) | Vanilla-CSS component library (92 components) consuming theme tokens. No JS/React deps. | Static CSS |

> Only `@nekostack/schema` is published to npm today (`v1.0.0`). The others live in the monorepo and publish as they reach their own 1.0.

## The "Silent Lie" vs The "Single Source of Truth"

**The Status Quo (Drift-Prone):**
You update your Prisma schema, but forget to update the Zod route validator and the OpenAPI spec. Your systems lie to each other.

**NekoStack (Zero-Drift):**
Define the shape once. Generate the artifacts instantly. If the generated files are stale, CI fails.

```typescript
import { s } from "@nekostack/schema";

export const User = s.object({
  id: s.string().uuid(),
  email: s.string().email(),
  role: s.enum(["admin", "member"]).default("member")
})
  .id("com.nekostack.auth.User")
  .version("1.0.0");
```

[Read the Migration Guide](/schema/migration-guide) | [Read the Product Thesis](/thesis)

## Sponsorship

Infrastructure maintenance costs money. We do not use emotional pitches or lifestyle branding. 

If NekoStack solves API drift and saves your engineering team time, sponsor the primitive.

[Sponsor on GitHub](https://github.com/sponsors/cmclicker)
