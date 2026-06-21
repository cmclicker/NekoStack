# @nekostack/schema

> An IR-backed multi-output schema system. Define types once; emit Zod validators, JSON Schema, OpenAPI, and TypeScript from a canonical intermediate representation. The implementation risk is not the DSL — it's semantic consistency across outputs.

## Quick reference

| | |
|---|---|
| **Build tier** | Foundation primitive — build first |
| **Depends on** | (none — foundational). External: TypeScript (dev/build). Peer: Zod (for runtime validation; not required at IR level). |
| **Used by** | `@nekostack/cli` (published); `api`, `form`, `auth`, `config`, `events`, `telemetry`, and others (planned) |
| **Status** | **v1.0 — released.** Canonical IR + Zod / JSON Schema / OpenAPI / TypeScript generators + runtime validation. 1,294 tests; public surface frozen. |
| **Released** | [`schema-v1.0.0`](./CHANGELOG.md) — API frozen. Reserved-but-unbuilt IR capacity (unions, lazy/recursive refs, transforms, dates) lands in post-1.0 minors. |

## Why this exists

Every non-trivial app defines the same data shape in multiple places: TypeScript `interface`, Zod schema, JSON Schema, OpenAPI spec, Prisma model, form schema. They drift. Always. A field gets added in one place and forgotten in three others, and the bugs that result are silent until someone hits the unhappy path.

`@nekostack/schema` solves this the same way every serious schema-first stack does: **define the shape once in a single DSL, normalize to an internal representation, and generate every downstream form from that representation.** The unique value isn't the DSL — Zod, TypeBox, Effect-Schema, and io-ts all have nice DSLs. The unique value is the **canonical IR + semantic-loss discipline**: every generator consumes the IR (not builder internals), and where outputs cannot faithfully represent the IR (e.g., a custom refinement in JSON Schema), the system explicitly marks the gap rather than silently lying.

Building this rather than adopting Zod is justified because:

1. **Zod is one output target, not the source.** A Zod-as-source architecture forces every non-Zod consumer to glue through adapters that drift.
2. **Outputs target NekoStack's specific consumers** — the Zod output knows about NekoStack's normalized `Issue` shape; the OpenAPI output knows how NekoStack APIs version themselves.
3. **No vendor coupling.** Zod 4 introduces a breaking change? The generator emits Zod 3 syntax until you choose to migrate.

## Scope

### In scope

**Shipped (v1.0)**
- DSL: `s.string()`, `s.number()`, `s.boolean()`, `s.literal()`, `s.enum()`, `s.array()`, `s.object()` — modifiers: optional / nullable / nullish / default.
- Canonical IR: every builder produces a normalized `SchemaNode` tree; generators consume only IR.
- Generators: TypeScript types, Zod validators, JSON Schema (draft 2020-12), OpenAPI 3.1 component schemas.
- Composition: `extend`, `omit`, `pick`, `partial`, `required`, and conflict-safe `merge` (with explicit `override`).
- Schema identity: reverse-DNS IDs + versions for cross-package references.
- Portable constraints: min / max / regex / format / etc. (compile to all four output targets).
- Validation runtime: structured `Issue[]` with stable, normalized codes; `parse` / `safeParse` / `validate`.
- Strict-by-default object behavior; explicit `.stripUnknown()` / `.passthrough()` opt-ins.
- Generated artifact lifecycle: deterministic headers, source-hash tracking, freshness checks.
- CLI commands (via `@nekostack/cli`): `schema generate`, `schema check`, `schema diff`.

**Reserved IR capacity — not yet built (post-v1.0 minors)**

These IR node kinds are planned and have reserved slots in the node type, but their builders and generator paths are not implemented. Calling them throws `UnsupportedNodeKindError` at runtime.

- `s.lazy()` — recursive / self-referential schemas.
- `s.union()` / `s.discriminatedUnion()` — sum types.
- Date types: `s.isoDateTime()`, `s.isoDate()`, `s.epochMs()`, `s.dateObject()`.
- Transforms — value-transforming modifiers.
- Runtime-only refinements — custom predicate functions (`s.refine()`); portable constraints above are fully shipped.

### Out of scope
- Database schema generation (DDL) — `@nekostack/migrate` territory.
- GraphQL SDL output — could be a future generator; not in 1.0.
- Runtime validation *library implementation* — we generate Zod schemas; we don't reimplement Zod's runtime.
- Form rendering — `@nekostack/form`'s job; it consumes our schemas.
- Schema *registry as a service* (hosted history, team permissions, governance) — out of scope for this package; belongs in a future hosted layer.

## Boundary

> See BOUNDARIES.md §7 in the NekoStack repository for the full capability map.

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
| Global CLI runtime, plugin discovery, terminal UX, workspace command orchestration | `cli` |

### CLI ownership note

`@nekostack/schema` may expose schema-specific CLI command **handlers**, but it does not own the global CLI runtime. Global command routing, plugin discovery, terminal UX, and workspace command orchestration belong to `@nekostack/cli`.

Concretely: the `src/cli/` subdirectory in this package exports handler functions for `schema generate`, `schema check`, `schema diff`. These are registered with `@nekostack/cli` as plugin commands per its plugin contract. We do not own the `neko` binary, the argv parser, the interactive prompt UX, the help system, or any cross-package command orchestration — those are CLI-package concerns. This prevents future scope creep while keeping `schema generate / check / diff` available to users.

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

> **Not yet implemented — planned for v1.1.** The builders below (`s.isoDateTime()`, `s.isoDate()`, `s.epochMs()`, `s.dateObject()`) do not exist in v1.0.x. The `DateNode` IR type exists and generators reserve slots for it, but calling these builders throws `UnsupportedNodeKindError`. The contract below is the planned API.

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

**Portable constraints** map to known output features and are **fully shipped in v1.0**:

```ts
s.string().min(3)            // → JSON Schema minLength
s.string().max(50)           // → maxLength
s.string().regex(/^NEKO_/)   // → pattern (flags unsupported — see note below)
s.string().email()           // → format: email
s.number().int().min(0)      // → integer minimum
```

> **Regex flags caveat (v1.0):** `s.string().regex(/^NEKO_/i)` — a regex *with flags* — is rejected by the JSON Schema and OpenAPI generators (`UnsupportedNodeKindError: regexFlags`). TypeScript and Zod generators accept it. If your schema uses a flagged regex, it cannot be generated across all four outputs until v1.1 adds flag-aware JSON Schema emission (e.g., via `(?i)` inline flag syntax).

> **Not yet implemented — planned for v1.1.** The `.refine()` method does not exist on any builder in v1.0.x. The `RefinementNode` IR type exists but the DSL builder throws `UnsupportedNodeKindError`. The contract below is the planned API.

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

> **`s.lazy()` not yet implemented — planned for v1.1.** The example below shows the planned recursive-schema API. In v1.0.x `s.lazy()` does not exist; the `RecursiveRefNode` IR type exists but throws `UnsupportedNodeKindError` at the generator boundary. Schema `.id()` and `.version()` are fully shipped for non-recursive schemas.

Recursive and cross-package schemas require stable identifiers. NekoStack uses reverse-DNS-style IDs with versions:

```ts
const User = s.object({
  id: s.string().uuid(),
  manager: s.lazy(() => User).optional(),   // s.lazy — v1.1
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

### Transform semantics

> **Not yet implemented — planned for v1.1.** `.transform()` does not exist on any builder in v1.0.x. The `TransformNode` IR type exists and all four generators throw `UnsupportedNodeKindError` uniformly when they encounter one, but the DSL builder is not yet shipped. The contract below is the planned API.

Transforms create two distinct types — the *input* the validator accepts and the *output* it returns:

```ts
const ParsedAge = s.string().transform(v => Number(v));
//                ^^^^^^^^^^                  ^^^^^^
//                input: string               output: number
```

NekoStack exposes both explicitly:

```ts
s.input<typeof ParsedAge>    // string
s.output<typeof ParsedAge>   // number
s.infer<typeof ParsedAge>    // alias to output (Zod-compatible default)
```

`s.infer` aliasing to **output** matches Zod ergonomics and what most consumers want ("the validated/parsed type"). For form bindings and API request shapes, `s.input` is the right type. The IR's `TransformNode` carries both annotations so generators can emit either side correctly.

JSON Schema and OpenAPI outputs describe the **input** type (the wire format). The transformation only happens at runtime, so non-runtime outputs cannot represent it — semantic-loss metadata flags this.

### Union policy

> **Not yet implemented — planned for v1.1.** `s.union()` and `s.discriminatedUnion()` do not exist in v1.0.x. The `UnionNode` IR type exists and generators throw `UnsupportedNodeKindError` uniformly when they encounter one, but the DSL builders are not yet shipped. The contract below is the planned API.

Two union forms with different semantics:

```ts
s.union([A, B, C])                          // plain union
s.discriminatedUnion("kind", [A, B, C])     // discriminated by 'kind' field
```

Rules:

- Plain unions are allowed but **discouraged for object variants**. Validation tries each branch in order and aggregates errors.
- Object unions SHOULD use `discriminatedUnion`. Generated OpenAPI emits `oneOf` with `discriminator` metadata, producing cleaner client codegen and clearer error reporting.
- **Issue reporting for unions:** the runtime returns issues from the *best-matching* branch (the branch that progressed furthest before failing). For `discriminatedUnion`, the discriminator-matched branch's issues are returned exclusively — no ambiguity about which variant the user intended.

The IR's `UnionNode` tracks whether the union is discriminated and, if so, the discriminator field. Generators consume this to emit correct OpenAPI / JSON Schema.

### Validate vs parse

The runtime exposes two distinct operations:

```ts
validate(schema, input)   // read-only check; returns Result<input, Issue[]>; no mutation, no defaults, no transforms
parse(schema, input)      // validates + applies defaults + runs transforms; returns Result<output, Issue[]>
```

- **`validate`** answers "does this input conform?" It does not mutate, default, or coerce. Returns the input unchanged on success, typed at the **input** shape.
- **`parse`** answers "what is the normalized output?" It applies defaults, runs transforms, returns the **output** shape. Most consumers want `parse`.

Use the right one:
- **Config loading at boot** — `parse` (apply defaults so the config object is fully populated).
- **API request bodies** — `parse` (canonical shape for downstream code).
- **Form initialization** — `parse` (form starts pre-populated with defaults).
- **Observability/audit inspection** — `validate` (don't mutate the value being recorded).
- **Permission/entitlement decision input checks** — `validate` (input is data; don't transform it).

Generators emit code that supports both. Consumers pick.

### Coercion policy

**No implicit coercion.** By default:

```ts
const Age = s.number();
parse(Age, "42");  // ❌ Issue { code: "invalid_type", expected: "number", received: "string" }
```

Explicit coercion is opt-in via a separate constructor (not a chainable method on the base type):

> **Not yet implemented — planned for v1.1.** `.coerceFromString()` does not exist on any builder in v1.0.x. The contract below is the planned API.

```ts
s.number().coerceFromString();       // accepts "42" → 42
s.boolean().coerceFromString();      // accepts "true"/"false" → boolean (rejects "1"/"yes" — too forgiving)
s.isoDateTime().coerceFromString();  // accepts ISO 8601 strings → normalized
```

Why no `s.coerce.number()` like Zod:

- Silent coercion is a security smell. `"true"`, `"1"`, `"yes"` all becoming `true` without explicit opt-in causes real bugs.
- Coerced types must be representable in non-runtime outputs as the coerced shape (not the original). JSON Schema describes the wire format expected; if the wire format is "string coercible to number," that's a different schema and we surface it explicitly.
- Coercion never leaks into JSON Schema / OpenAPI as native behavior. It's runtime-only with semantic-loss metadata when the output schema differs from the runtime acceptance.

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

A [companion spec doc](./docs/ISSUE_CODES.md) catalogs the full set with descriptions, example messages, and Zod-to-NekoStack mappings. The runtime validator normalizes raw Zod issues into this shape; consumers (`form` error display, `api` error responses, `admin` diagnostics) all read the same structure.

### Generated artifact policy

Every generated file includes a deterministic header:

```ts
/**
 * @generated by @nekostack/schema
 * source: user.schema.ts
 * schemaId: com.nekostack.auth.User
 * schemaVersion: 1.0.0
 * sourceHash: sha256:7f3e2a9b...
 * irHash:     sha256:c4a2e810...
 * generator: zod@0.4.1
 * DO NOT EDIT MANUALLY.
 */
```

**Two hashes, distinguishing two different changes:**

- **`sourceHash`** changes when the source file changes — including whitespace, comments, reorderings, anything textual.
- **`irHash`** changes only when the normalized IR changes — i.e., the actual schema semantics.

This distinction matters for review hygiene. CI can categorize a PR:

- *Source changed, IR identical* — comment / whitespace / reorder only. Regeneration not required (header `sourceHash` is updated; output bytes don't change).
- *Source changed, IR changed* — real schema change. Regeneration required; reviewers must inspect generated diffs.
- *Generated output's `irHash` doesn't match current IR* — stale. CI fails.

Rules:

- **Committed to git.** Generated files are tracked, not gitignored. Makes review possible, prevents "works on my machine" drift.
- **Never manually edited.** CI verifies both `sourceHash` and `irHash` against current source. Manual edits would be silently overwritten by the next `neko schema generate`.
- **Deterministic.** Same IR + same generator version → byte-identical output.
- **Freshness check.** `neko schema check` rehashes sources, recomputes IR, verifies generated artifacts match on both `sourceHash` and `irHash`. CI fails on stale output.
- **Incremental.** Only schemas with changed `irHash` need regeneration (source-only changes update the header but produce identical bytes elsewhere — still rewritten so the header is fresh).
- **Outputs separated.** TypeScript `.d.ts`, Zod `.ts`, JSON Schema `.json`, OpenAPI `.openapi.json` are distinct files. Allows each output to be consumed in isolation.
- **Headers describe lineage.** Source path, schema ID, version, both hashes, generator version — all readable from the file itself.

A companion spec doc (deferred to v1.0) will detail header format, the exact hash algorithm (canonical JSON serialization → SHA-256), and the `neko schema check` exit-code contract.

### Dependency policy

The package is foundational within NekoStack — no NekoStack-package dependencies. External dependencies are classified:

- **Runtime (in the published package):** `zod` — required by the runtime validation layer (`validate()`, `parse()`, `safeParse()`). npm 7+ auto-installs it via `peerDependencies`; consumers who only use the IR + generators without runtime validation will still have it installed unless they use `--no-optional-peer-deps`. The IR, builders, and generators are pure TS; only the runtime validation path imports Zod.
- **Peer:** `zod ^3.22.0` — declared as peerDep so consumers control the Zod version. Auto-installed by npm 7+.
- **Dev-only:** `ajv` (JSON Schema conformance), `@redocly/openapi-core` (OpenAPI fixture validation).

The IR, builders, and generators have no hard Zod dependency. The runtime validation path (`dist/src/runtime/zod-compile.js`) does a top-level Zod import and will throw `ERR_MODULE_NOT_FOUND` if Zod is absent. In practice Zod is always present (auto-installed as a peer dep), but the "no runtime deps" statement in prior versions was imprecise.

---

## How this fits the NekoStack

**Depends on:** Nothing within NekoStack. This is foundational — every other package may depend on it.

**Published packages that consume schema:**
- `@nekostack/cli` — schema validation, codegen, and diff commands.

**Planned:** `@nekostack/api`, `@nekostack/form`, `@nekostack/auth`, `@nekostack/config`, `@nekostack/events`, `@nekostack/telemetry`, and others in the NekoStack ecosystem all plan to consume this package as their data-shape substrate.

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
  createdAt: s.string(),  // ISO 8601 string; use s.isoDateTime() when v1.1 ships
})
  .id("com.nekostack.auth.User")
  .version("1.0.0")
  .describe("Authenticated user");

export type User = s.infer<typeof User>;
```

`neko schema generate` produces `.gen/user.zod.ts`, `.gen/user.json`, `.gen/user.openapi.json`, `.gen/user.d.ts` — each with the deterministic header.

## Roadmap

v1.0 is the stable, API-frozen baseline. Post-v1.0 work:

- **Reserved IR capacity** — `s.union()`, `s.lazy()` (recursive), `s.transform()`, and full date typing are in the IR type system; generator support for the full surface lands in post-v1.0 minors.
- **Registry-lite** — local schema registry, schema diffing between versions, and breaking-change detection (`neko schema diff`).

**Breaking-change matrix** (registry-lite target):

| Change | Compatibility |
|---|---|
| Add optional field | non-breaking |
| Add required field | **breaking** (clients sending old shape now fail) |
| Remove field | **breaking** for consumers that read it |
| Make required → optional | non-breaking for producers; breaking for consumers expecting field |
| Add nullable (widen) | usually non-breaking for consumers |
| Remove nullable (narrow) | **breaking** for producers that emitted null |
| Widen enum (add value) | **breaking** for clients (must handle new value) |
| Narrow enum (remove value) | **breaking** for producers |
| Change scalar type (string → number) | **breaking** |
| Add runtime-only refinement | **breaking** for runtime consumers; invisible to JSON Schema/OpenAPI outputs |
| Rename field | **breaking** in all directions unless explicitly aliased |
| Add discriminated-union branch | non-breaking for consumers using fallback; breaking otherwise |

- **Schema migrations** — forward migration registry, version graph, migration provenance + audit.
- **Generator plugin contract** — stable contract for third-party generators (Prisma DDL, GraphQL SDL, etc.).
- **Performance benchmarks** — vs Zod and TypeBox.

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

## Locked Design Decisions (v1.0 Freeze)

These are stable API contracts guaranteed not to change in v1.x.

- **No Async Refinements.** `refineAsync` is explicitly rejected. Validation must remain a pure, synchronous, CPU-bound operation. If a check requires I/O (e.g., querying a database to see if a username is taken), it is **Business Logic**, not **Shape Validation**, and belongs in a Controller or Service.
- **Recursive Schema Cycles (`A → B → A`).** `s.lazy()` MUST take a string ID representing the target schema (e.g., `s.lazy("com.nekostack.User")`). The compiler does not attempt to resolve this during definition. It is resolved safely at runtime by querying the `schemaRegistry`. If the ID doesn't exist, it throws `recursive_reference_unresolved`.
- **Cross-package schema-id collision policy.** If `@nekostack/auth` and a consuming project both define `com.nekostack.auth.User@1.0.0` with different IR hashes, the registry `buildRegistry()` function returns a `Result.failure` with code `duplicate_schema_id` (it does not throw). There is no silent overriding or "prefer local." The registry is the single source of truth.

## Still-open implementation decisions

The Implementation contracts section pins the load-bearing decisions. The list below names what is **not yet** decided — labeled honestly rather than pretending everything is closed. Each item is a real choice that will need to land before or during the relevant phase.

- **Discriminator value types.** Discriminated-union discriminators are presumed to be string literals (`s.literal("kind")`). Should we allow number literals too? Implications for OpenAPI emission TBD.
- **Workspace vs package vs hosted registry resolution.** Registry-lite (v0.7) is local-only. The path to a future hosted registry needs a lookup-precedence rule. Deferred.
- **Per-tenant schema overlays.** Some SaaS consumers may want tenant-specific schema extensions (extra fields per tenant). Out of scope for v1; possibly Phase-9 / `@nekostack/entitlements`-adjacent.
- **Generator plugin contract.** Third-party generators (e.g., a future Prisma generator, GraphQL SDL emitter) need a stable contract. Deferred until v1.0 / post-v1.
- **Performance budgets.** No explicit perf targets yet. Will be set against Zod / TypeBox baselines.

Items here should graduate into the Implementation contracts section once decided. The list itself is the artifact: hiding open questions is worse than naming them.

## Status

v1.0 — public API frozen. 1,294 tests passing. See the [CHANGELOG](./CHANGELOG.md) for release history.
