# @nekostack/schema

> Define a type once. Generate Zod validators, JSON Schema, OpenAPI, and TypeScript types from it. Stop the cross-layer drift.

## Why this exists

Every non-trivial app ends up defining the same data shape in multiple places:

- A TypeScript `interface` for the type system.
- A Zod schema for runtime validation at API boundaries.
- A JSON Schema for storing config files or generating documentation.
- An OpenAPI spec for API contracts.
- A Prisma model for the database.
- A form schema for the UI.

These drift. Always. A field gets added in one place and forgotten in three others, and the bugs that result are silent until someone hits the unhappy path in production.

`@nekostack/schema` solves this the same way every serious schema-first stack does: **define the shape once in a single DSL, and generate every downstream representation from it.** The unique angle is that NekoStack consumes its own output across every other package — `@nekostack/api` generates OpenAPI from these schemas, `@nekostack/form` drives form UIs from them, `@nekostack/codex` validates entities against them, `@nekostack/cli` validates command inputs against them. The schema layer is the spine.

Building this yourself rather than adopting Zod or TypeBox is justified because:
1. **You learn schema-first design end-to-end** — generator architecture, type-level TypeScript, JSON Schema semantics, OpenAPI 3.x.
2. **The generators target *your* specific downstream consumers**, not the general case. The Zod output knows about NekoStack's error conventions. The OpenAPI output knows how NekoStack APIs version themselves.
3. **Single source of truth without vendor coupling.** If Zod 4 introduces breaking changes, your generator emits Zod 3 syntax until you migrate on your timeline.

## Scope

### In scope
- Schema DSL: object, array, primitive, union, enum, literal, recursive, optional, nullable, default, refinement.
- Generators: TypeScript types, Zod schemas, JSON Schema (draft 2020-12), OpenAPI 3.1 component schemas.
- Schema composition: extend, omit, pick, partial, merge.
- Schema versioning: declare schema version, register migration functions between versions.
- Validation runtime: structured error format consumable by NekoStack/form and NekoStack/api.
- CLI command (via `@nekostack/cli`) to regenerate outputs from `*.schema.ts` files on demand.

### Out of scope
- Database schema generation (DDL). That's a different downstream consumer and may become its own package or live in `@nekostack/migrate`.
- GraphQL SDL output. Could be added as a generator later, not in v1.
- Runtime *validation library implementation* — we generate Zod schemas, we don't reimplement Zod's runtime.
- Form rendering. That's `@nekostack/form`'s job; it consumes our schemas.

## Competitors and adjacent tools

| Tool | What they do well | Where they fall short for us |
|---|---|---|
| **Zod** | Excellent runtime validator, great TS inference, large ecosystem. | Single output target (Zod itself). No first-class JSON Schema or OpenAPI generation. Hard to compose across non-TS consumers. |
| **TypeBox** | JSON-Schema-first, good multi-target story, fast. | The DSL is verbose and less TS-native. Bundle size concerns. |
| **Effect-Schema** | Extremely powerful, principled, multi-output. | Steep learning curve, deep Effect ecosystem coupling, overkill for our needs. |
| **io-ts** | Mature, principled. | Verbose, weaker TS inference than Zod, declining ecosystem. |
| **Valibot** | Tree-shakeable Zod alternative. | Same single-output problem as Zod. |
| **TypeBox + zod-from-json-schema** | Could combine multiple tools. | Toolchain becomes the spec — fragile and hard to evolve consistently. |

The right framing: we are not competing with Zod. We are *generating* Zod (and JSON Schema, and OpenAPI). Zod is downstream.

## How this fits the NekoStack

**Depends on:** Nothing. This is foundational — every other package may depend on it.

**Used by:**
- `@nekostack/api` — generates OpenAPI components from these schemas.
- `@nekostack/form` — drives form rendering and validation.
- `@nekostack/cli` — validates command-line inputs.
- `@nekostack/codex` — validates entity shape definitions.
- `@nekostack/auth` — validates token claims and AccessDecision shapes.
- `@nekostack/config` — validates env and runtime config.
- `@nekostack/events` — defines event payload shapes.
- `@nekostack/telemetry` — defines telemetry event schemas.
- Effectively everything.

## Design philosophy

- **One source, many outputs.** A schema is written once. Outputs are derived, never authored.
- **TS-native DSL.** Schemas are TypeScript code, not a separate IDL file. Inference works for free.
- **Structured errors.** Validation errors are typed objects with `code`, `path`, `expected`, `received`, `message`. Never raw strings.
- **Composition over configuration.** Small composable schema combinators. `extend`, `omit`, `pick`, `partial`, `merge` — like Zod, but normalized across all outputs.
- **Versioned schemas.** Every schema can be tagged with a version. Migrations between versions are first-class. This is what makes long-running products survive schema evolution.

## Architecture sketch

```
packages/schema/
├── src/
│   ├── core/                 # base types: Schema<T>, Issue, Result
│   ├── builders/             # object(), array(), union(), etc.
│   ├── generators/
│   │   ├── ts.ts             # → TypeScript .d.ts
│   │   ├── zod.ts            # → Zod validator code
│   │   ├── json-schema.ts    # → JSON Schema draft 2020-12
│   │   └── openapi.ts        # → OpenAPI 3.1 component
│   ├── runtime/              # validate() — used by consumers
│   ├── versioning/           # version() + migrate()
│   └── errors/               # Issue, IssueCode, formatIssue
├── tests/
└── README.md
```

Authoring a schema looks like:

```ts
import { s } from '@nekostack/schema';

export const User = s.object({
  id: s.string().uuid(),
  email: s.string().email(),
  displayName: s.string().min(1).max(50),
  createdAt: s.date(),
});

export type User = s.infer<typeof User>;
```

Then `neko schema generate` produces a `.gen/` directory next to the schema file with `user.zod.ts`, `user.json`, `user.openapi.json`, etc.

## Roadmap

### v0.1 — Foundation
- Core `Schema<T>` interface and primitive/object/array builders.
- TypeScript type inference (`s.infer<T>`).
- TS code generator (`.d.ts` output).
- Vitest test harness.

### v0.2 — Zod output
- Generator producing valid Zod 3.x schemas from `Schema<T>`.
- Round-trip test: any `Schema<T>` produces a Zod schema whose inferred type matches.

### v0.3 — JSON Schema output
- Generator producing JSON Schema draft 2020-12.
- Conformance against the JSON Schema test suite.

### v0.4 — OpenAPI output
- Generator emitting OpenAPI 3.1 component schemas.
- Integration test against `@nekostack/api`.

### v0.5 — Composition + versioning
- `extend`, `omit`, `pick`, `partial`, `merge` operators.
- `version()` tagging and `migrate()` between versions.

### v0.6 — Runtime validator
- `validate(schema, input)` returning `Result<T, Issue[]>`.
- Structured error format consumable across the stack.

### v1.0 — Stable API
- Full documentation site.
- Migration guide from Zod.
- Performance benchmarks vs Zod and TypeBox.

## Product potential

**Internal use:** Mandatory. The whole stack rests on this.

**Open source release:** Strong candidate. The space is crowded but the multi-output angle is genuinely undersupplied. MIT-licensed release with good docs could attract real users.

**Commercial product:** Plausible at the "managed schema registry + code-gen service" tier — analogous to Speakeasy or Stainless for API SDK generation, but operating one layer earlier (the schema layer that feeds API SDK generators). Not a near-term focus, but the path is real.

**Estimated effort to v1.0:** 4-8 weeks of focused work, more realistically 3-6 months at solo-dev cadence. The DSL is the small part; the generators and the test coverage are the time sink.

## Status

- **Current:** Empty placeholder. Not started.
- **Owner:** Cody (solo dev project).
- **Priority tier:** Foundation primitive. Should be among the first three packages implemented because so much else depends on it.
- **Estimated learning return:** Very high. Schema design, TS type-level programming, code-gen architecture, JSON Schema semantics, OpenAPI internals — all in one project.
