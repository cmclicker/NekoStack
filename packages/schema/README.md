# @nekostack/schema

> An IR-backed multi-output schema system. Define types once; emit Zod validators, JSON Schema, OpenAPI, and TypeScript from a canonical intermediate representation. The implementation risk is not the DSL — it's semantic consistency across outputs.

## Quick reference

| | |
|---|---|
| **Build tier** | Foundation primitive — build first |
| **Depends on** | (none — foundational). External: TypeScript (dev/build). Peer: Zod (for runtime validation; not required at IR level). |
| **Used by** | `api`, `cli`, `codex`, `auth`, `form`, `config`, `events`, `telemetry`, `validator`, `id`, `entitlements`, `lint` (rule authoring), and effectively everything else |
| **Status** | Empty placeholder — not started. Design pass complete (see [`references/schema/design-audit-2026-05.md`](../../references/schema/design-audit-2026-05.md)). |
| **Est. to v1.0** | 6–12 weeks focused / 4–8 months at solo-dev cadence (revised up from the original brief after the IR + semantic-loss design pass) |
| **Sellable?** | Not as the package itself. It's the **technical substrate** for a future registry/governance product. Schema-as-a-service requires registry + diffing + history + governance + CI integration on top — see [Product potential](#product-potential). |

## Why this exists

Every non-trivial app defines the same data shape in multiple places: TypeScript `interface`, Zod schema, JSON Schema, OpenAPI spec, Prisma model, form schema. They drift. Always. A field gets added in one place and forgotten in three others, and the bugs that result are silent until someone hits the unhappy path.

`@nekostack/schema` solves this the same way every serious schema-first stack does: **define the shape once in a single DSL, normalize to an internal representation, and generate every downstream form from that representation.** The unique value isn't the DSL — Zod, TypeBox, Effect-Schema, and io-ts all have nice DSLs. The unique value is the **canonical IR + semantic-loss discipline**: every generator consumes the IR (not builder internals), and where outputs cannot faithfully represent the IR (e.g., a custom refinement in JSON Schema), the system explicitly marks the gap rather than silently lying.

Building this rather than adopting Zod is justified because:

1. **Zod is one output target, not the source.** A Zod-as-source architecture forces every non-Zod consumer to glue through adapters that drift.
2. **You learn schema-system internals end-to-end** — IR design, generator architecture, type-level TypeScript, JSON Schema semantics, OpenAPI 3.1 nuances, semantic-loss management.
3. **Outputs target NekoStack's specific consumers** — the Zod output knows about NekoStack's normalized `Issue` shape; the OpenAPI output knows how NekoStack APIs version themselves.
4. **No vendor coupling.** Zod 4 introduces a breaking change? The generator emits Zod 3 syntax until you choose to migrate.

## Scope

### In scope
- DSL: object, array, primitives, union, enum, literal, recursive (via `s.lazy()`), optional/nullable/nullish/default, transform.
- **Date typing** — explicit per use case: `s.isoDateTime()`, `s.isoDate()`, `s.epochMs()`, `s.dateObject()` (runtime-only).
- **Two refinement classes** — *portable constraints* (min/max/regex/format/etc.) and *runtime-only* refinements (custom predicates).
- Canonical IR: every builder produces a normalized `SchemaNode` tree; generators consume only IR.
- Generators: TypeScript types, Zod validators, JSON Schema (draft 2020-12), OpenAPI 3.1 component schemas.
- Composition: `extend`, `omit`, `pick`, `partial`, `required`, and conflict-safe `merge` (with explicit `override`).
- Schema identity: reverse-DNS IDs + versions for cross-package + recursive references.
- Validation runtime: structured `Issue[]` with stable, normalized codes.
- Strict-by-default object behavior; explicit `.stripUnknown()` / `.passthrough()` opt-ins.
- Generated artifact lifecycle: deterministic headers, source-hash tracking, freshness checks.
- CLI commands (via `@nekostack/cli`): `schema generate`, `schema check`, `schema diff`.

### Out of scope
- Database schema generation (DDL) — `@nekostack/migrate` territory.
- GraphQL SDL output — could be a future generator; not in 1.0.
- Runtime validation *library implementation* — we generate Zod schemas; we don't reimplement Zod's runtime.
- Form rendering — `@nekostack/form`'s job; it consumes our schemas.
- Schema *registry as a service* (hosted history, team permissions, governance) — future commercial layer above this package.

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §7 for the full capability map.

### Owns
- Canonical IR (`SchemaNode` AST)
- DSL builders that produce IR
- TS, Zod, JSON Schema, OpenAPI generators
- Composition operators with explicit conflict rules
- Schema identity + versioning metadata
- Runtime validation (executes IR-backed generated validators)
- Normalized `Issue` shape + stable codes
- Generated artifact policy (headers, hashes, freshness)

### Does NOT own
| Capability | Lives in |
|---|---|
| Form input validation UI + state | `form` (consumes our schemas) |
| API request/response boundary validation | `api` (consumes our schemas) |
| Cross-reference / continuity validation | `validator` |
| Database schema definition + DDL | `migrate` (works with us for versioning) |
| Branded ID types (UUID/ULID/branded primitives) | `id` (uses us as substrate) |
| ESLint rule authoring | `lint` |
| GraphQL SDL output | external (not in v1; could be future generator) |
| Runtime validation library *implementation* | external (Zod — we generate, we don't reimplement) |
| Schema **migration execution** at scale | future package or v0.8+ here, gated on production need |

---

## Implementation contracts

This section pins the load-bearing decisions that every implementer (including future-you) must respect. The DSL is the easy part; these are where schema systems usually rot.

### Canonical Intermediate Representation (IR)

Every schema builder produces a serializable, normalized `SchemaNode` AST. **Generators consume only the IR — never private builder internals.**

```ts
type SchemaNode =
  | StringNode
  | NumberNode
  | BooleanNode
  | DateNode            // narrowed; see "Date types" below
  | LiteralNode
  | EnumNode
  | ArrayNode
  | ObjectNode
  | UnionNode
  | RefinementNode      // marks portable vs runtime-only — explicit
  | RecursiveRefNode    // requires a stable schema id (see "Identity")
  | TransformNode;      // runtime-only; serialized as opaque metadata
```

The hard rule, repeated for emphasis:

> **Builders create IR. Generators consume IR. Runtime validators execute the generated validator backed by IR.**

Without this, the DSL is the source of truth in name only — every generator starts interpreting builder objects differently, and the four outputs drift. The IR is the single contract that prevents drift.

### Date types

`s.date()` is rejected as ambiguous. Date handling is explicit per use case:

| DSL | Runtime input | Serialized form | JSON Schema | When to use |
|---|---|---|---|---|
| `s.isoDateTime()` | ISO 8601 string | string | `format: date-time` | **default for APIs / config / cross-system** |
| `s.isoDate()` | YYYY-MM-DD string | string | `format: date` | date-only fields |
| `s.epochMs()` | number | number | `integer, format: int64` | high-throughput logs, telemetry |
| `s.dateObject()` | `Date` object | `Date` object | runtime-only metadata | in-process only — never serialized |

`dateObject()` is the only one not portable to non-TS consumers; the IR marks it as runtime-only.

### Absence semantics

The most under-specified part of any schema system. NekoStack pins these explicitly:

| DSL call | TypeScript | Runtime accepts | JSON Schema `required`? | OpenAPI `nullable`? |
|---|---|---|---|---|
| `s.string()` | `field: string` | string only | yes | no |
| `s.string().optional()` | `field?: string` | missing or undefined | no | no |
| `s.string().nullable()` | `field: string \| null` | string or null; missing rejected | yes | yes |
| `s.string().nullish()` | `field?: string \| null` | missing, undefined, or null | no | yes |
| `s.string().default("x")` | input `field?: string`; output `field: string` | missing accepted; replaced | no (default emitted) | no |

`optional()` and `nullable()` are different. `null` is a value; missing is the absence of a value. Conflating them is the most common source of API drift.

### Refinement portability

A refinement is either **portable** (representable in every output format) or **runtime-only** (only representable in Zod / runtime validators). The DSL forces the distinction at definition time.

**Portable constraints** map to known output features:

```ts
s.string().min(3)            // → JSON Schema minLength
s.string().max(50)           // → maxLength
s.string().regex(/^NEKO_/)   // → pattern
s.string().email()           // → format: email
s.number().int().min(0)      // → integer minimum
```

**Runtime-only refinements** are custom predicates only Zod / our runtime can execute:

```ts
s.string().refine(value => isValidTenantSlug(value), {
  code: "invalid_tenant_slug",
  description: "Must match tenant slug rules",
});
```

These cannot be faithfully represented in JSON Schema or OpenAPI. Generators emit metadata when semantic loss occurs:

```json
{
  "type": "string",
  "x-nekostack-runtime-refinement": true,
  "x-nekostack-refinement-code": "invalid_tenant_slug"
}
```

**Key property:** the JSON Schema / OpenAPI outputs are always **correct supersets** of the true validation rules. They accept everything the strict runtime would accept (and possibly more, because the runtime-only refinement is invisible to them). They never silently misrepresent stricter behavior.

### Unknown-key policy

By default, every object schema is **strict**: unknown keys cause validation to fail.

```ts
s.object({ email: s.string() })
// Input: { email: "x@example.com", admin: true }
// Result: ❌ Issue { code: "unknown_key", path: ["admin"] }
```

Permissive behavior is opt-in:

```ts
s.object({ email: s.string() }).strict()         // explicit reject (default)
s.object({ email: s.string() }).stripUnknown()   // silently strip extras
s.object({ email: s.string() }).passthrough()    // keep extras unchecked
```

Strict-by-default is non-negotiable for auth, API, and config schemas. Permissive behavior must be a deliberate choice, not an accidental default.

### Schema identity ($id / $ref strategy)

Recursive and cross-package schemas require stable identifiers. NekoStack uses reverse-DNS-style IDs with versions:

```ts
const User = s.object({
  id: s.string().uuid(),
  manager: s.lazy(() => User).optional(),
})
  .id("com.nekostack.auth.User")
  .version("1.0.0")
  .describe("Authenticated user");
```

Rules:

- Every schema referenced by `s.lazy()` (i.e., recursive) **MUST** have an `.id()`. Unnamed recursive schemas are rejected at definition time.
- IDs are globally unique within a NekoStack workspace. Two packages cannot both define `com.nekostack.auth.User` at the same version.
- Generated JSON Schema uses `$id` + `$defs` based on the schema ID.
- Cross-package references compose: `@nekostack/auth` schemas can reference `com.nekostack.tenant.Tenant` without import gymnastics — the JSON Schema output emits a `$ref` URL the consumer resolves through the local registry.
- Schema versions participate in identity. `com.nekostack.auth.User@1.0.0` and `...@2.0.0` are distinct schemas; migrations bridge them (v0.8+).

### Composition conflict rules

`merge()` is the only composition operator that can produce conflicts. Default behavior is **fail loudly**:

```ts
const A = s.object({ id: s.string() });
const B = s.object({ id: s.number() });

A.merge(B);                         // ❌ throws: field 'id' conflict
A.merge(B, { conflict: "right" });  // explicit: right side wins
A.merge(B, { conflict: "left" });   // explicit: left side wins
A.override({ id: s.number() });     // explicit named override
```

Silent merge replacement is forbidden. Auth schemas, in particular, must not be partially clobbered by composition.

Other composition operators (`extend`, `pick`, `omit`, `partial`, `required`) cannot produce field-type conflicts and need no conflict policy.

### Error model

Validation errors are structured `Issue` records — never raw strings, never raw Zod errors:

```ts
type Issue = {
  code: IssueCode;
  path: Array<string | number>;
  message: string;
  expected?: unknown;
  received?: unknown;
  schemaId?: string;
  schemaVersion?: string;
  severity: "error" | "warning";
  metadata?: Record<string, unknown>;
};
```

Codes are stable, machine-readable, and NekoStack-normalized:

```
invalid_type
missing_required
unknown_key
too_small
too_big
invalid_enum
invalid_literal
invalid_union
custom_refinement_failed
schema_version_unsupported
recursive_reference_unresolved
```

A companion spec doc (to be written when implementation starts) will catalog the full set with descriptions, example messages, and Zod-to-NekoStack mappings. The runtime validator normalizes raw Zod issues into this shape; consumers (`form` error display, `api` error responses, `admin` diagnostics) all read the same structure.

### Generated artifact policy

Every generated file includes a deterministic header:

```ts
/**
 * @generated by @nekostack/schema
 * source: user.schema.ts
 * schemaId: com.nekostack.auth.User
 * schemaVersion: 1.0.0
 * sourceHash: sha256:7f3e2a9b...
 * generator: zod@0.4.1
 * DO NOT EDIT MANUALLY.
 */
```

Rules:

- **Committed to git.** Generated files are tracked, not gitignored. Makes review possible, prevents "works on my machine" drift.
- **Deterministic.** Same schema source + same generator version → byte-identical output.
- **Freshness check.** `neko schema check` rehashes sources, verifies generated artifacts match. CI fails on stale output.
- **Incremental.** Only schemas with changed sources are regenerated.
- **Outputs separated.** TypeScript `.d.ts`, Zod `.ts`, JSON Schema `.json`, OpenAPI `.openapi.json` are distinct files. Allows each output to be consumed in isolation.
- **Headers describe lineage.** Source path, schema ID, version, source hash, generator version — all readable from the file itself.

A companion spec doc (deferred) will detail header format, the exact hash algorithm, and the `neko schema check` exit-code contract.

### Dependency policy

The package is foundational within NekoStack — no NekoStack-package dependencies. External dependencies are classified:

- **Runtime (in the published package):** none in the core; the IR + builders + generators are pure TS. Specific generators may pull tiny utility libs (e.g., a JSON Schema validator dependency for self-conformance tests stays dev-only).
- **Peer:** Zod, when the consumer uses the generated Zod validator at runtime. Declared as peerDep so consumers control the Zod version.
- **Dev-only:** Zod (for self-tests), `ajv` (JSON Schema conformance), `@redocly/openapi-core` (OpenAPI fixture validation).

The package can *generate* Zod without *requiring* Zod at runtime; consumers wanting runtime validation install Zod themselves.

---

## Competitors and adjacent tools

| Tool | What they do well | Where they fall short for us |
|---|---|---|
| **Zod** | Excellent runtime validator, great TS inference, large ecosystem; ~all NekoStack consumers will run *generated* Zod at runtime. | Zod-as-source forces every non-Zod consumer through adapters that drift. We emit Zod as one output target; we don't make Zod the source format. |
| **TypeBox** | JSON-Schema-first, fast, multi-target. | DSL is verbose and less TS-native; closer in spirit to our approach but with different priorities. |
| **Effect-Schema** | Extremely powerful, principled, multi-output. | Steep learning curve, deep Effect ecosystem coupling, overkill for solo dev. |
| **io-ts** | Mature, principled. | Verbose, weaker TS inference than Zod, declining ecosystem. |
| **Valibot** | Tree-shakeable Zod alternative. | Same single-output limitation as Zod. |
| **JSON Schema (raw)** | Universal interchange format. | Hand-written JSON is hostile to author and review. |
| **TypeBox + zod-from-json-schema** | Multi-tool stack. | Toolchain becomes the spec — fragile, hard to evolve consistently. |

The right framing — corrected from the original audit critique:

> NekoStack is not "better Zod." It is a **schema IR + generator system** that emits Zod as one target alongside JSON Schema, OpenAPI, and TypeScript. The unique value is multi-output semantic consistency, not DSL ergonomics.

## How this fits the NekoStack

**Depends on:** Nothing within NekoStack. This is foundational — every other package may depend on it.

**Used by:**
- `@nekostack/api` — generates OpenAPI components.
- `@nekostack/form` — drives form rendering + validation.
- `@nekostack/cli` — validates command-line inputs.
- `@nekostack/codex` — validates entity shape definitions.
- `@nekostack/auth` — typifies token claims + `AccessDecision` shapes.
- `@nekostack/config` — boot-time env + runtime config validation.
- `@nekostack/events` — event payload shapes.
- `@nekostack/telemetry` — typed event catalog shapes.
- Effectively everything that crosses a system boundary.

## Design philosophy

- **IR is the contract.** DSL produces IR; generators consume IR; runtime executes IR-backed validators. The DSL is replaceable; the IR is not.
- **One source, many outputs — with honest semantic-loss tracking.** Outputs are derived. Where a derivation cannot be faithful, the system marks the gap explicitly.
- **TS-native DSL.** Schemas are TypeScript code, not a separate IDL file. Inference works for free.
- **Strict by default everywhere.** Unknown keys reject. Composition conflicts reject. Recursive schemas without IDs reject. Permissive behaviors are deliberate opt-ins.
- **Structured errors, normalized codes.** No raw strings, no Zod-leaked codes. The `Issue` shape is the contract.
- **Deterministic generated output.** Same source + same generator version → byte-identical output. Reviewable, diffable, CI-checkable.
- **Versioned schemas.** Every schema can carry an ID + version. Migrations (v0.8+) bridge versions; pre-migration, version is metadata that surfaces in errors + outputs.

## Architecture sketch

```
packages/schema/
├── src/
│   ├── ir/                      # SchemaNode AST + normalization
│   │   ├── nodes.ts             # node type definitions
│   │   ├── normalize.ts         # builder → IR
│   │   └── serialize.ts         # IR ↔ JSON (for registry / hashing)
│   ├── builders/                # public DSL: s.object(), s.string(), etc.
│   ├── generators/              # IR → outputs
│   │   ├── ts.ts                # → TypeScript .d.ts
│   │   ├── zod.ts               # → Zod validator code
│   │   ├── json-schema.ts       # → JSON Schema draft 2020-12
│   │   ├── openapi.ts           # → OpenAPI 3.1 component
│   │   └── header.ts            # deterministic generated-file header
│   ├── runtime/                 # validate() — IR-backed runtime
│   ├── composition/             # extend/pick/omit/partial/required/merge/override
│   ├── identity/                # $id, version, registry lookup
│   ├── errors/                  # Issue, IssueCode, normalizers
│   └── cli/                     # `neko schema generate / check / diff`
├── docs/                        # deeper spec docs (deferred — see Roadmap)
├── tests/
│   ├── ir/                      # IR normalization tests
│   ├── generators/              # snapshot + execution tests
│   ├── parity/                  # semantic-parity (Neko ↔ Zod ↔ JSON Schema ↔ OpenAPI)
│   └── conformance/             # JSON Schema test suite, OpenAPI fixtures
└── README.md
```

Authoring a schema:

```ts
import { s } from '@nekostack/schema';

export const User = s.object({
  id: s.string().uuid(),
  email: s.string().email(),
  displayName: s.string().min(1).max(50),
  createdAt: s.isoDateTime(),
})
  .id("com.nekostack.auth.User")
  .version("1.0.0")
  .describe("Authenticated user");

export type User = s.infer<typeof User>;
```

`neko schema generate` produces `.gen/user.zod.ts`, `.gen/user.json`, `.gen/user.openapi.json`, `.gen/user.d.ts` — each with the deterministic header.

## Roadmap

Revised after the design-audit pass. Migrations pushed from v0.5 to v0.8+ because the migration problem is much bigger than the original scope acknowledged.

### v0.1 — Core IR + builders
- `SchemaNode` IR + serialization.
- Primitive builders (string / number / boolean / literal / enum).
- Object builder (strict default), array builder, named schemas with `.id()` / `.version()` / `.describe()`.
- Metadata: id, version, description, deprecated flag.
- Basic `Issue` shape, normalized codes.
- TypeScript type inference (`s.infer<T>`).
- Builder unit tests + type inference tests.

### v0.2 — TypeScript + Zod generation
- TS generator (`.d.ts` output).
- Zod generator (Zod 3.x target initially).
- Deterministic header.
- Snapshot tests for generator output.
- Zod-execution tests (generated validator runs and matches fixtures).

### v0.3 — JSON Schema generation
- JSON Schema draft 2020-12 output.
- `$id` / `$defs` / `$ref` per identity rules.
- Portable constraint mapping (min/max/regex/format/etc.).
- Semantic-loss metadata for runtime-only refinements (`x-nekostack-runtime-refinement`).
- JSON Schema test-suite conformance.

### v0.4 — OpenAPI 3.1 generation
- OpenAPI 3.1 component schemas.
- Integration fixtures for `@nekostack/api`.
- Nullable / required mapping per the Absence Semantics table.
- Round-trip tests with `@redocly/openapi-core`.

### v0.5 — Composition
- `extend`, `pick`, `omit`, `partial`, `required`.
- Conflict-safe `merge` with explicit `override`.
- Composition tests covering conflict cases.

### v0.6 — Runtime validation
- `validate(schema, input)` returning `Result<T, Issue[]>`.
- Unknown-key handling (strict / stripUnknown / passthrough).
- Zod-backed execution (runtime delegates to generated Zod).
- Issue normalization (raw Zod issues → NekoStack `Issue` codes).
- Semantic-parity tests: same fixture validated against Neko runtime, generated Zod, JSON Schema validator, OpenAPI-compatible schema — expected failures match.

### v0.7 — Registry-lite
- Local schema registry (lookup by id + version).
- Schema diffing between two versions.
- Breaking-change detection.
- `neko schema check` (freshness) and `neko schema diff` (changes).

### v0.8+ — Migrations
- Migration registry with version graph.
- Forward migrations between versioned schemas.
- Pre/post migration validation.
- Migration provenance and audit.
- Failure behavior + downgrade policy.
- Fixture tests per version pair.

### v1.0 — Stable API
- Full documentation site.
- Migration guide from Zod-as-source.
- Performance benchmarks vs Zod and TypeBox.
- Companion spec docs (deferred from v0.x): full Issue code catalog, generated-artifact policy details, testing strategy.

## Testing strategy

| Test category | When | Notes |
|---|---|---|
| Builder unit tests | v0.1 | shape construction, basic validation |
| Type inference tests | v0.1 | `expectTypeOf` / tsd-style assertions |
| IR normalization tests | v0.1 | builder → expected IR |
| Generator snapshot tests | v0.2+ | byte-identical output across runs |
| Zod execution tests | v0.2 | generated Zod actually validates correctly |
| JSON Schema conformance | v0.3 | passes JSON Schema test suite |
| OpenAPI fixture tests | v0.4 | round-trip with `@redocly/openapi-core` |
| **Semantic parity tests** | v0.6 | **most important** — same fixture validated four ways, failures match |
| Error normalization tests | v0.6 | Zod errors → NekoStack Issue codes |
| Recursive schema tests | v0.6 | `s.lazy()` references resolve through generators |
| Composition tests | v0.5 | merge conflicts, override semantics |
| Versioning + migration tests | v0.8+ | per-version fixtures, forward migration correctness |
| Property-based / fuzz tests | v1.0 | via `@nekostack/fuzz`: invariants like "any IR roundtrips to itself" |

Semantic parity is the load-bearing test category. Where the four outputs cannot match (runtime-only refinements being the prime case), the test asserts the *expected gap*, not equality.

## Product potential

**Internal use:** Mandatory. The whole stack rests on this.

**Open-source release:** Strong candidate. The multi-output semantic-consistency angle is genuinely undersupplied. MIT-licensed release with good docs could attract real users — particularly TS teams running multi-language stacks (TS frontend + Python backend, or generating SDKs for non-TS consumers).

**Commercial product (corrected from the original brief):** `@nekostack/schema` is **not the commercial product by itself**. It is the technical substrate for a future registry/governance product. A schema package becomes commercially interesting only when paired with:

- Hosted schema registry with version history
- Cross-version diffing + breaking-change detection
- SDK / codegen integration (à la Speakeasy / Stainless, but one layer earlier)
- Schema governance + team permissions
- CI integration (PR-level schema-change review)
- Changelog generation
- Compliance export
- Migration tracking

That commercial product would be a separate offering (e.g., `@nekostack/schema-cloud` or NekoSystems' enterprise tier consuming this) — built on top of this primitive. Not a near-term focus, but the path is real.

**Estimated effort to v1.0:** 6–12 weeks of focused work; more realistically 4–8 months at solo-dev cadence. Revised up from the original 4–8 / 3–6 because the IR + semantic-loss + identity + parity-test work added scope.

## Status

- **Current:** Empty placeholder. Design pass complete; implementation not started.
- **Owner:** Cody (solo dev project).
- **Priority tier:** Foundation primitive. **Among the first three packages to actually implement** because every other serious NekoStack module inherits its contracts.
- **Estimated learning return:** Very high. Schema-system design, type-level TypeScript, code-gen architecture, JSON Schema semantics, OpenAPI 3.1 internals, semantic-loss management, deterministic output discipline — all in one project.
- **Source thinking:** See [`references/schema/design-audit-2026-05.md`](../../references/schema/design-audit-2026-05.md) for the engineering audit that drove this README's current shape. Future significant design changes should generate a similar audit document and link from here.
