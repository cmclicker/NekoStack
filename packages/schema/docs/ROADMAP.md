# @nekostack/schema — Roadmap

Authoritative source for "what ships when." The full design rationale lives in the package [`README.md`](../README.md); this file is the operational checklist.

## v0.1 — Core IR + builders

Status: **shipped** ([#1](https://github.com/cmclicker/NekoStack/pull/1), merged 2026-05-16). First package accepted under [`standards/package-development.md`](../../../standards/package-development.md).

Includes:
- IR types for every `SchemaNode` kind (only seven have v0.1 builders)
- Canonical IR serialization (sorted keys, undefined-stripped)
- `Issue` + `IssueCode` vocabulary + `Result<T>` (declared; no parser uses them yet)
- `Schema` base class with `TInput`, `TOutput`, `TInputKey`, `TOutputKey`
- Builders: `s.string`, `s.number`, `s.boolean`, `s.literal`, `s.enum`, `s.array`, `s.object`
- Modifiers: `optional`, `nullable`, `nullish`, `default`
- Metadata: `id`, `version`, `describe`, `deprecated`
- Strict-by-default object policy stored *in IR*
- Type inference: `s.infer`, `s.input`, `s.output`
- Package-local TS + Vitest tooling
- 44 tests (29 runtime, 15 type-level)

Explicitly out of scope (see [`SCOPE.md`](./SCOPE.md)): generators, parse/validate engine, registry, diff, migrations, CLI.

## v0.2 — TypeScript + Zod generators

Status: **shipped** ([#5](https://github.com/cmclicker/NekoStack/pull/5), merged 2026-05-16). Plan: [`PHASE_PLAN_v0.2.md`](./PHASE_PLAN_v0.2.md). Second package phase accepted under [`standards/package-development.md`](../../../standards/package-development.md).

- `generateTypeScript(node, options?)` — type-alias generator supporting `mode: "input" | "output" | "both"` (default `"output"`).
- `generateZod(node, options?)` — Zod 3.x generator with fixed modifier ordering per [`ZOD_MODIFIER_ORDERING.md`](./ZOD_MODIFIER_ORDERING.md).
- `irHash(node)` — sha256 of canonical IR serialization, hex-encoded. **Used by generated-file headers in v0.2** and **consumed by the v0.7 freshness check** (it is introduced here, not in v0.7).
- Deterministic generated-file headers per [`HEADER_FORMAT.md`](./HEADER_FORMAT.md) (`sourceHash` deferred to v0.7 — needs CLI).
- `UnsupportedNodeKindError` with stable `code` / `kind` / `generator` fields for any IR kind without a v0.2 generator (date, union, recursiveRef, transform).
- Snapshot tests for generator output (vitest `toMatchFileSnapshot`).
- Zod-execution tests (generated validator runs in a real Zod runtime and matches absence-semantics fixtures).
- Zod-modifier-composition tests (the eight-row matrix from Decision #8).

## v0.3 — JSON Schema generation

Status: **shipped** ([#10](https://github.com/cmclicker/NekoStack/pull/10), merged 2026-05-17). Plan: [`PHASE_PLAN_v0.3.md`](./PHASE_PLAN_v0.3.md). Tagged as [`schema-v0.3.0`](https://github.com/cmclicker/NekoStack/releases/tag/schema-v0.3.0).

- `generateJsonSchema(node, options?)` — draft 2020-12 output. Canonical JSON (sorted keys, 2-space indent, single trailing newline). Models accepted input only — no `mode` option in v0.3.
- URN `$id` strategy by default (`urn:nekostack:schema:<id>:<version>`); URL-shaped IDs opt-in via `options.idBase`.
- Inline schemas only — `$defs` extraction documented as a future strategy but **not implemented** in v0.3 (no IR construct needs it).
- Absence-semantics translation per [`JSON_SCHEMA_MAPPING.md`](./JSON_SCHEMA_MAPPING.md): optional / nullish / default → omitted from `required`; nullable / nullish → `type: ["base", "null"]`; default emits annotation + `x-nekostack-default-applied-by: "runtime"`.
- Object policy: `strict` → `additionalProperties: false`; `passthrough` → `true`; `stripUnknown` → `true` + `x-nekostack-strip: true` (JSON Schema cannot strip; runtime does).
- Portable refinement mapping per [`JSON_SCHEMA_MAPPING.md`](./JSON_SCHEMA_MAPPING.md).
- Throws `UnsupportedNodeKindError` on unsupported IR kinds, runtime refinements (Decision #11), and regex with non-empty flags (Decision #11a — would silently drop case-insensitivity etc.).
- Ajv2020 self-conformance + execution test suite (uses `ajv/dist/2020.js`, the draft-2020-12 class — NOT the default draft-07 import).
- Three new example artifacts (`tenant.json.schema.json`, `audit-event.json.schema.json`, `entitlement.json.schema.json`) validated by the existing regenerate test.

## v0.4 — OpenAPI 3.1 component generation

Status: **shipped** ([#13](https://github.com/cmclicker/NekoStack/pull/13), merged 2026-05-17). Plan: [`PHASE_PLAN_v0.4.md`](./PHASE_PLAN_v0.4.md). Tagged as [`schema-v0.4.0`](https://github.com/cmclicker/NekoStack/releases/tag/schema-v0.4.0).

- `generateOpenApiSchemaComponent(node, options?)` — single OpenAPI 3.1 Schema Component (the value at `components.schemas.<Name>`). Not a full OpenAPI document — that belongs to a future `@nekostack/api` package.
- **Shared internal `emitSchemaFragment`** ([`schema-fragment.ts`](../src/generators/schema-fragment.ts)) extracted from the v0.3 JSON Schema generator. Both generators consume it; the wrappers only differ on root structure, `$schema` / `$id` decisions, and provenance `generator` name. Eliminates the JSON-Schema-vs-OpenAPI drift vector at the source.
- No `$schema` and no `$id` in component-position output (OpenAPI 3.1 documents declare the dialect at the document root via `jsonSchemaDialect`; component identity is the position in the document).
- Provenance via `x-nekostack` extension with `generator: "openApi"`; `irHash` is identical across both generators for the same node (proven by test).
- Absence semantics, object policy, refinement mapping, `stripUnknown` extension, runtime-refinement and regex-with-flags throws — all inherited unchanged from v0.3 via the shared fragment.
- Three new example artifacts (`tenant.openapi.json`, `audit-event.openapi.json`, `entitlement.openapi.json`) validated by the existing regenerate test.
- New contract doc [`OPENAPI_MAPPING.md`](./OPENAPI_MAPPING.md) — records only the deltas from `JSON_SCHEMA_MAPPING.md`, not a duplicate mapping table.
- Redocly round-trip tests via `@redocly/openapi-core` validate every emitted component composed into a synthetic OpenAPI 3.1 document. Fallback per the v0.4 plan: tests may spawn the Redocly CLI if the programmatic API proves impractical.

## v0.5 — Composition operators

Status: **shipped** ([#16](https://github.com/cmclicker/NekoStack/pull/16), merged 2026-05-17). Plan: [`PHASE_PLAN_v0.5.md`](./PHASE_PLAN_v0.5.md). Contract: [`COMPOSITION.md`](./COMPOSITION.md). Tagged as [`schema-v0.5.0`](https://github.com/cmclicker/NekoStack/releases/tag/schema-v0.5.0).

- Seven new methods on `ObjectSchema`: `extend`, `pick`, `omit`, `partial`, `required`, `merge`, `override`.
- Three new public types: `Mask<S>`, `OverrideMask<S>`, `MergeOptions`.
- **Fail-loudly discipline**: `extend` throws on key collision, `override` throws on missing key, `pick`/`omit` throw on unknown key, `merge` throws by default on field conflict AND `unknownKeys` mismatch.
- **`partial()` and `required()` are symmetric on `default` — both strip it.** Default-bearing fields are input-optional + output-required; preserving `default` through `partial` would leave output-required, contradicting the partial intent. Stripping keeps the v0.1 absence-semantics contract self-consistent across composition.
- Composition produces a plain `ObjectNode`; **generators handle composed schemas byte-identically to hand-written equivalents** (asserted by parity tests across all four generators).
- Composed schemas drop top-level metadata (`id` / `version` / `description` / `deprecated`); callers re-tag explicitly. Field-level metadata is preserved.

## v0.6 — Runtime validation ← *active target*

- `validate(schema, input)` and `parse(schema, input)`
- Unknown-key enforcement (the IR policy gets teeth here)
- Zod-backed execution; issue normalization
- **Semantic-parity tests** — same fixture validated four ways, expected failures match

Per the [`PRODUCT_THESIS`](#) (incoming), v0.6 is the phase where NekoStack starts taking runtime-validator workflow space — users no longer have to install or import Zod directly for runtime validation unless they choose to.

## v0.7 — Registry-lite

- Local schema registry (lookup by id + version)
- Schema diffing + breaking-change detection
- `neko schema check` (freshness) + `neko schema diff` — **consume** the existing `irHash` (shipped in v0.2) to detect stale generated artifacts; introduce the new `sourceHash` to detect source-file edits that left the IR unchanged.

## v0.8+ — Migrations

- Migration registry, forward migrations, pre/post validation, audit

## v1.0 — Stable API

- Full docs, migration guide from Zod-as-source, perf benchmarks, frozen public surface

---

Future phases must respect the invariants in [`IR_CONTRACT.md`](./IR_CONTRACT.md). If a phase needs to violate one, raise it explicitly; do not work around it silently.
