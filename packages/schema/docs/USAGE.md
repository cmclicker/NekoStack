# Usage — `@nekostack/schema` v0.6

> What v0.6 lets you do as an author, end-to-end. For the runtime contract, see [`RUNTIME.md`](./RUNTIME.md). For the why and the scope boundaries, see [`SCOPE.md`](./SCOPE.md). For the full surface, see [`../README.md`](../README.md).

## What v0.6 is good for

v0.6 is the phase where `@nekostack/schema` becomes the **runtime-validation workflow**, not just a code generator. From a single schema definition:

1. **Validate input directly** via `parse` / `safeParse` / `validate` — no Zod import in your code.
2. A **TypeScript type alias** matching the schema's runtime shape (with the v0.1 input/output split honored).
3. A **Zod 3.x validator** as a portable artifact for interoperability (microservices that don't import `@nekostack/schema`, third-party tools, etc.).
4. A **JSON Schema draft 2020-12** + **OpenAPI 3.1 component** for cross-language contracts and API documentation.
5. A **deterministic header** on every generated file recording schema id, version, IR hash, and generator version.

Zod is the internal execution engine for runtime validation. A consumer of `@nekostack/schema` does **not** import Zod for runtime validation; the surface is `parse` / `safeParse` / `validate` from `@nekostack/schema`. See [`RUNTIME.md`](./RUNTIME.md) for the full contract — including default semantics, unknown-key policies, issue normalization, and what the validate-only IR variant does. You **cannot** yet use this package for a CLI workflow (v0.7).

## Defining a schema

```ts
import { s } from "@nekostack/schema";

export const Tenant = s
  .object({
    id: s.string().uuid(),
    slug: s.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
    name: s.string().min(1).max(120),
    plan: s.enum(["free", "pro", "enterprise"] as const).default("free"),
    billingEmail: s.string().email().nullable(),
  })
  .id("com.nekostack.tenant.Tenant")
  .version("1.0.0")
  .describe("A NekoStack workspace tenant.");
```

Three things every "real" schema should do, derived from v0.1:

- Give it an `.id("com.org.area.Name")` — generators put it in the header; v0.7 will look it up here.
- Give it a `.version("x.y.z")` — generators emit it; future breaking-change detection (v0.7) keys off it.
- Give it a `.describe("...")` — generators emit it as JSDoc / Zod `.describe()`.

Anonymous schemas (no `.id()`) work — generators emit `schemaId: null` with a visible `// anonymous schema` comment — but they're not registry-addressable.

## Validating input at runtime

```ts
import { s, parse, safeParse, validate, ParseError } from "@nekostack/schema";
import { Tenant } from "./tenant.schema.js";

// Throw on failure — the friction-causing default.
const tenant = parse(Tenant, input);
//    ^ s.output<typeof Tenant> (defaults filled)

// Return a Result instead of throwing.
const r = safeParse(Tenant, input);
if (r.success) {
  r.data;          // s.output<typeof Tenant>
} else {
  r.issues;        // readonly Issue[]
}

// Structural check only — does NOT fill defaults, does NOT run transforms.
const v = validate(Tenant, input);
if (v.success) {
  v.data;          // s.input<typeof Tenant> (default-bearing fields stay absent)
}

// ParseError carries the full normalized issue list.
try {
  parse(Tenant, input);
} catch (e) {
  if (e instanceof ParseError) {
    for (const i of e.issues) {
      // i.code         — stable NekoStack IssueCode
      // i.path         — Zod path, copied
      // i.expected/received — verbatim from Zod when available
      // i.schemaId / i.schemaVersion — from schema.metadata when present
      // i.severity     — always "error" in v0.6
    }
  } else {
    throw e;
  }
}
```

Three things to know:

- **`parse` / `safeParse` fill defaults.** `validate` accepts a missing default-bearing field but does **not** fill it. See [`RUNTIME.md` → Default semantics](./RUNTIME.md#default-semantics).
- **Unknown keys are rejected by default.** The object policy is `strict`. Use `.passthrough()` to preserve them in the output, `.stripUnknown()` to drop them. Same behavior across `parse`, `safeParse`, and `validate`.
- **Issues use a stable NekoStack vocabulary.** Consumers see `Issue` / `IssueCode` from `@nekostack/schema`, never a `ZodError`. The Zod engine is internal and may be replaced in a future phase without changing the consumer-facing contract. The full mapping table is in [`RUNTIME.md` → Issue normalization](./RUNTIME.md#issue-normalization).

## Generating a TypeScript type

```ts
import { generateTypeScript } from "@nekostack/schema";
import { Tenant } from "./tenant.schema.js";

const ts = generateTypeScript(Tenant.node);
// Returns a complete .ts module as a string: header + `export type Tenant = { ... };`
```

Output mode controls the input/output split:

| `options.mode` | Emits | Use when |
|---|---|---|
| *(omitted)* / `"output"` | `export type <Name> = ...` | You want the post-default, post-transform type (matches `s.infer<T>` / `s.output<T>`). |
| `"input"` | `export type <Name>Input = ...` | You're typing API request bodies / form values before defaults apply. |
| `"both"` | `export type <Name>Input` + `export type <Name>Output` | You want both sides explicit. |

The two sides genuinely differ for any schema with a `.default(v)` field — default-bearing fields are object-optional in Input, object-required in Output. See [`ABSENCE_SEMANTICS.md`](./ABSENCE_SEMANTICS.md) for the full table.

`mode: "both"` is the safest default for shared API contracts.

## Generating a Zod validator (as an artifact)

> Since v0.6, generated Zod is an **interoperability artifact**, not your runtime path. Use `parse` / `safeParse` / `validate` for in-process validation; emit Zod source for downstream services or third-party tools that want to consume a portable Zod schema without importing `@nekostack/schema`.

```ts
import { generateZod } from "@nekostack/schema";
import { Tenant } from "./tenant.schema.js";

const zod = generateZod(Tenant.node);
// Returns: header + `import { z } from "zod"` + `export const schema = z.object({...}).strict()...`
```

The emitted source and the runtime compiler share a single semantic mapping (Decision #6 of the v0.6 plan), so the generated Zod file and `parse(Tenant, input)` agree on accept/reject for every input. The four-oracle parity matrix in [`tests/semantic-parity.test.ts`](../tests/semantic-parity.test.ts) is what asserts that.

Modifier ordering is fixed; see [`ZOD_MODIFIER_ORDERING.md`](./ZOD_MODIFIER_ORDERING.md). The headline rule: **default is always last**, so the v0.1 absence-semantics contract survives translation.

Consumer of the generated file needs Zod installed; `@nekostack/schema` already depends on Zod for its own runtime, so no extra setup is needed for in-process validation.

## Generating a JSON Schema

```ts
import { generateJsonSchema } from "@nekostack/schema";
import { Tenant } from "./tenant.schema.js";

const json = generateJsonSchema(Tenant.node);
// Returns: a complete draft-2020-12 JSON document as a string.
```

Default `$id` is URN-shaped (`urn:nekostack:schema:<id>:<version>`). For URL-shaped IDs (when you actually host schemas at a real URL), pass `idBase`:

```ts
generateJsonSchema(Tenant.node, { idBase: "https://schemas.example.com" });
// $id: "https://schemas.example.com/com.nekostack.tenant.Tenant/1.0.0"
```

Important properties:

- **Models accepted input.** JSON Schema treats `default` as annotation, not behavior — validators don't fill defaults. The output represents what the wire input is allowed to look like; the runtime (or generated Zod) is responsible for applying defaults.
- **`stripUnknown` is encoded as `additionalProperties: true` + `x-nekostack-strip: true`.** JSON Schema can't express mutation; the runtime strips. The extension key tells NekoStack-aware consumers to do that.
- **Throws on semantic-loss cases.** Runtime refinements (custom predicates) and regex with non-empty flags throw `UnsupportedNodeKindError` rather than emit JSON Schema that changes validation behavior. See [`JSON_SCHEMA_MAPPING.md`](./JSON_SCHEMA_MAPPING.md) for the full contract.
- **Provenance under `x-nekostack`.** JSON has no comment syntax, so the v0.2-style header is moved into a single `x-nekostack: { generator, generatorVersion, irHash, schemaId, schemaVersion }` object.

Optional consumer dep: `ajv` (any version that supports draft 2020-12 — import via `ajv/dist/2020.js`). Not required to *generate*, only to *validate*.

## Generating an OpenAPI 3.1 component schema

```ts
import { generateOpenApiSchemaComponent } from "@nekostack/schema";
import { Tenant } from "./tenant.schema.js";

const component = generateOpenApiSchemaComponent(Tenant.node);
// Returns: canonical JSON for the value at `components.schemas.Tenant` in
// an OpenAPI 3.1 document. Compose into your own document.
```

The output is a **component schema fragment**, not a full OpenAPI document. Paths / operations / responses / security schemes / etc. are not in scope for `@nekostack/schema` — they belong to a future `@nekostack/api` package.

Differences from `generateJsonSchema`:
- **No `$schema`** — OpenAPI 3.1 documents declare the schema dialect at the document root via `jsonSchemaDialect`; components inherit it.
- **No `$id`** — component identity is the position in the document (`#/components/schemas/<Name>`).
- **`x-nekostack.generator: "openApi"`** — distinguishes the artifact from JSON Schema output.

Everything else (absence semantics, object policy, refinement mapping, throw behavior on runtime refinements + regex with flags, `x-nekostack-strip` / `x-nekostack-default-applied-by`) is **identical to JSON Schema** because both generators share the same internal fragment emitter. See [`OPENAPI_MAPPING.md`](./OPENAPI_MAPPING.md) for the delta table and [`JSON_SCHEMA_MAPPING.md`](./JSON_SCHEMA_MAPPING.md) for the full mapping.

Optional consumer dep: `@redocly/openapi-core` (or any OpenAPI 3.1 validator) if you want to validate the composed document.

## Composing existing object schemas

```ts
import { s } from "@nekostack/schema";

const User = s.object({
  id: s.string().uuid(),
  email: s.string().email(),
  role: s.string().default("member"),
});

// Common patterns:
const UserInputForCreate = User.omit({ id: true });           // server fills id
const UserPatch = User.partial();                              // PATCH/update shape
const UserPublic = User.pick({ id: true, email: true });       // safe-to-expose subset
const UserAdmin = User.extend({ permissions: s.array(s.string()) });
const UserWithNumericId = User.override({ id: s.number() });
```

Seven operators are available on every `ObjectSchema`: `extend`, `pick`, `omit`, `partial`, `required`, `merge`, `override`. All return a new `ObjectSchema` (no mutation), fail loudly on conflicts / unknown keys / missing keys, drop top-level metadata (re-tag with `.id().version().describe()` if needed), and preserve field-level metadata. See [`COMPOSITION.md`](./COMPOSITION.md) for the full contract — especially:

- **`partial()` and `required()` both strip `default`.** A partial schema should not silently inject defaults into a PATCH payload; a required + default-bearing field is semantically contradictory.
- **`merge` throws on field conflict AND on `unknownKeys` mismatch by default.** Resolve explicitly via `{ conflict: "left" | "right" }` and `{ unknownKeys: "left" | "right" }`.
- **`extend` and `override` are asymmetric on purpose** — `extend` rejects existing keys; `override` rejects missing keys. The pair covers add and replace without overlap.

Composition produces a plain `ObjectNode` — no generator changes; the TS / Zod / JSON Schema / OpenAPI generators handle composed schemas identically to hand-written equivalents (asserted by parity tests).

## Generated-file headers

Every output file starts with a deterministic JSDoc block — full spec in [`HEADER_FORMAT.md`](./HEADER_FORMAT.md):

```ts
/**
 * @generated by @nekostack/schema
 * schemaId:         com.nekostack.tenant.Tenant
 * schemaVersion:    1.0.0
 * irHash:           sha256:7f3e2a9b...
 * generator:        typescript
 * generatorVersion: @nekostack/schema@0.7.0
 *
 * DO NOT EDIT MANUALLY.
 */
```

Consumers may:
- Read `irHash` to detect stale generated artifacts.
- Read `schemaId` / `schemaVersion` to identify which schema this file represents.
- Refuse to load files with an older `generatorVersion`.

Consumers must NOT:
- Edit a generated file by hand (CI may enforce later).
- Parse data out of free-form comments — use the typed fields.

## Computing `irHash` directly

```ts
import { irHash } from "@nekostack/schema";
irHash(Tenant.node); // → "7f3e2a9b..." (64-char hex, sha256 of canonical IR serialization)
```

Same IR → same hash, every time. Semantic change → different hash. This is the foundation v0.7's CI freshness check uses; you can use it now to gate your own deploys ("if `irHash(latest) !== headerOf(committedFile).irHash`, regenerate").

## Workflow today (no CLI yet)

There is no `neko schema generate` command in v0.6, and the v0.7 CLI is in progress but not yet shipped — see [`ROADMAP.md`](./ROADMAP.md). The intended workflow until v0.7 lands:

1. Author the schema in `your-package/schemas/foo.schema.ts`.
2. **For runtime validation:** import `parse` / `safeParse` / `validate` from `@nekostack/schema` and call them directly. No generated artifact required.
3. **For artifact generation** (cross-language contracts, microservice interop, documentation): write a script (or a vitest snapshot test — see this package's [`tests/examples/regenerate.test.ts`](../tests/examples/regenerate.test.ts) for a worked example) that calls `generateTypeScript` / `generateZod` / `generateJsonSchema` / `generateOpenApiSchemaComponent` and writes the result to disk.
4. Commit both the source schema and any generated files.
5. Review diffs as ordinary code review.

Once v0.7's CLI ships, `neko schema generate` / `check` / `diff` / `list` replace the hand-written generation script and add freshness CI.

## `@nekostack/schema/cli` — internal integration only (v0.7)

> Not a public consumer API. This is the subpath `@nekostack/cli` imports from to build the v0.7 `neko schema *` commands.

The v0.7 registry / freshness / generation primitives are reachable through a separate subpath:

```text
@nekostack/schema           public v0.6 consumer surface (parse, safeParse, validate, s, generators, …)
@nekostack/schema/cli       package-internal CLI integration surface (buildRegistry, diffNodes, four handlers, …)
```

If you are writing application code or a library that uses `@nekostack/schema` directly, **do not** import from `@nekostack/schema/cli`. The names exposed there are subject to internal change between minor versions; engine-swap-safety lives at the root, not at this subpath. The negative gate in [`../tests/public-surface.test.ts`](../tests/public-surface.test.ts) enforces that root `@nekostack/schema` does not leak any v0.7 registry name.

The subpath exists so the eventual `neko schema *` CLI (companion plan in [`../../cli/docs/PHASE_PLAN_v0.7.md`](../../cli/docs/PHASE_PLAN_v0.7.md)) has a stable, package-internal seam to import from. Full surface and contract in [`REGISTRY.md`](./REGISTRY.md); diff classification in [`DIFF_CLASSIFICATION.md`](./DIFF_CLASSIFICATION.md).

## Schema-data migrations (v0.8 — in progress, preview only)

> v0.8 is **in progress** on [`feat/schema-v0.8-candidate`](https://github.com/cmclicker/NekoStack/tree/feat/schema-v0.8-candidate) ([PR #28](https://github.com/cmclicker/NekoStack/pull/28)), not yet shipped. The schema-side primitives below already exist on the branch; the CLI-side `neko schema migrate *` verbs are still being wired up. This section is a preview of the v0.8 workflow once it lands — the contract is locked in [`MIGRATIONS.md`](./MIGRATIONS.md).

v0.8 lets you describe how to migrate **data** from one version of a schema to a newer version of the same schema. It ships planning, verification, and stub generation — it does **not** ship an apply verb, and the package never executes a migration's `transform(input)`. If you need to run a migration against real data, that lives in your own code or a downstream package.

A migration is a TypeScript module under your package's migration directory:

```ts
/**
 * @migration
 * schemaId:                com.nekostack.tenant.Tenant
 * fromVersion:             1.0.0
 * toVersion:               2.0.0
 * fromIrHash:              sha256:<hex of the v1 IR>
 * toIrHash:                sha256:<hex of the v2 IR>
 * sourceHash:              sha256:<hex of this file's UTF-8 bytes>
 * generator:               migration
 * generatorVersion:        @nekostack/schema@0.8.0
 * authoredAt:              2026-05-19T00:00:00Z
 */
import type { Migration } from "@nekostack/schema/cli";
import type { TenantV1 } from "../generated/tenant-1.0.0.types.js";
import type { TenantV2 } from "../generated/tenant-2.0.0.types.js";

const migration: Migration<
  "com.nekostack.tenant.Tenant",
  "1.0.0",
  "2.0.0",
  TenantV1,
  TenantV2
> = {
  schemaId: "com.nekostack.tenant.Tenant",
  fromVersion: "1.0.0",
  toVersion: "2.0.0",
  transform(input) {
    return { ...input, /* v2 shape */ };
  },
};

export default migration;
```

Three rules:

- **One `schemaId` per migration** (Decision #4). A single migration may never straddle two schemas; split it.
- **Forward-only** (Decision #2). `fromVersion` is always older than `toVersion`; no reverse module shape, no rollback.
- **Fail-loud provenance.** All nine header fields are required. Missing or malformed headers fail with `code: "integrity_error"` and a stable `metadata.reason` — they are never silently skipped.

Once v0.8's CLI ships, four verbs will mirror the v0.7 `neko schema *` shape:

| Verb | What it does | Pure surface it consumes |
|---|---|---|
| `neko schema migrate list` | Enumerate authored migrations grouped by `(schemaId, fromVersion)` | `listMigrationsHandler` |
| `neko schema migrate plan` | Compute the migration chain (or "none needed", or "over-specified") for a `(schemaId, fromVersion, toVersion)` path | `planMigrationHandler` (consumes BOTH schema and migration registries) |
| `neko schema migrate verify` | Classify every authored migration as `bound` / `cosmetic_drift` / `drift` / `missing_endpoint` against the current schema registry | `verifyMigrationsHandler` |
| `neko schema migrate stub` | Generate a skeleton migration file (header + typed declaration + `transform(input) { throw "Not yet implemented"; }`) | `stubMigrationHandler` + `suggestedMigrationPathFor` |

The schema package never walks the migration directory, never imports your authored migration modules, and never calls `.transform(...)` — those responsibilities all sit in `@nekostack/cli`. Master plan Decision #1 (schema is pure) stays in force; the migration handlers' purity is gated by [`../tests/migrations/handler-purity.test.ts`](../tests/migrations/handler-purity.test.ts).

The contract details — provenance header field-by-field, planner severity dispatch table, verifier verdict matrix, schema/CLI ownership, non-goals — live in [`MIGRATIONS.md`](./MIGRATIONS.md).

## Handling unsupported IR

A `SchemaNode` whose kind isn't generator-ready throws `UnsupportedNodeKindError` with a stable shape. v0.3 extends the set with two new `kind` values: `"runtimeRefinement"` (from any generator) and `"regexFlags"` (JSON Schema only — regex with non-empty flags).

```ts
import { UnsupportedNodeKindError } from "@nekostack/schema";

try {
  generateZod(someExoticNode);
} catch (e) {
  if (e instanceof UnsupportedNodeKindError) {
    // e.code      === "UNSUPPORTED_NODE_KIND"
    // e.kind      === "date" | "union" | "recursiveRef" | "transform" | "runtimeRefinement" | "regexFlags"
    // e.generator === "typescript" | "zod" | "jsonSchema" | "openApi"
  }
}
```

Runtime-only refinements (custom predicates added via a future `.refine(fn)` builder) also throw, intentionally. Generators that can't honor the validation must not silently emit code that omits it.

For the JSON Schema generator specifically, regex with non-empty flags also throws (`kind: "regexFlags"`) — JSON Schema `pattern` has no flag support, and emitting source-only would silently drop case-insensitivity / unicode / etc.

## What's still deferred (cross-reference to scope)

| Want | Wait for | Why |
|---|---|---|
| Full OpenAPI document (paths/operations/responses/security/etc.) | `@nekostack/api` package | Schema package generates component schemas only |
| OpenAPI 3.0 target (`nullable: true` form) | future generator option | v0.4 ships 3.1 only |
| Deep / recursive composition (nested-field merge) | future | v0.5 ships shallow operators only |
| Composition history (`metadata.derivedFrom`) | future | Could aid v0.7 diffing; not needed for v0.5 |
| `neko schema generate / check / diff` CLI | v0.7 | Registry-lite phase |
| Automatic CLI-populated `sourceHash` in committed artifacts | v0.7 CLI | Direct generator calls can already pass `sourceHash` via `ProvenanceOptions.sourceHash` — see the "Optional `sourceHash` provenance (v0.7+)" section in [`EXAMPLES.md`](./EXAMPLES.md). The CLI will compute it from source files automatically. |
| `$defs` extraction / cross-package `$ref` | v0.7 (registry-lite) | No IR construct in v0.3 needs it |
| Output-shape JSON Schema (default-applied, all fields required) | deferred | JSON Schema can't represent the input/output split as a single document |
| Schema-data migrations: planning + verification + stub generation | v0.8 ([PR #28](https://github.com/cmclicker/NekoStack/pull/28), in progress) | See the v0.8 preview section above and [`MIGRATIONS.md`](./MIGRATIONS.md). |
| **Executing** a schema-data migration's `transform(input)` | never in `@nekostack/schema` | Hard-locked non-goal of the v0.8 contract; the package owns planning + verification + stub generation only. If you need a runner, it lives in your own code or a downstream package. |
| Database / DDL migrations | `@nekostack/migrate` | Always — `@nekostack/schema` migrations are schema-data only. |
| Reverse / rollback migrations | not supported | v0.8 is forward-only (Decision #2). |
| Date types (`isoDateTime` etc.) | future | IR exists; builders deferred |

## Worked examples

[`EXAMPLES.md`](./EXAMPLES.md) walks through the three example schemas in [`../examples/`](../examples/) and links each generated artifact. Read that next.
