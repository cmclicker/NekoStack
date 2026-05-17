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

## v0.2 — TypeScript + Zod generation ← *candidate*

Status: **candidate** ([#5](https://github.com/cmclicker/NekoStack/pull/5)). Implementation follows the merged plan in [`PHASE_PLAN_v0.2.md`](./PHASE_PLAN_v0.2.md).

- `generateTypeScript(node, options?)` — type-alias generator supporting `mode: "input" | "output" | "both"` (default `"output"`).
- `generateZod(node, options?)` — Zod 3.x generator with fixed modifier ordering per [`ZOD_MODIFIER_ORDERING.md`](./ZOD_MODIFIER_ORDERING.md).
- `irHash(node)` — sha256 of canonical IR serialization, hex-encoded. **Used by generated-file headers in v0.2** and **consumed by the v0.7 freshness check** (it is introduced here, not in v0.7).
- Deterministic generated-file headers per [`HEADER_FORMAT.md`](./HEADER_FORMAT.md) (`sourceHash` deferred to v0.7 — needs CLI).
- `UnsupportedNodeKindError` with stable `code` / `kind` / `generator` fields for any IR kind without a v0.2 generator (date, union, recursiveRef, transform).
- Snapshot tests for generator output (vitest `toMatchFileSnapshot`).
- Zod-execution tests (generated validator runs in a real Zod runtime and matches absence-semantics fixtures).
- Zod-modifier-composition tests (the eight-row matrix from Decision #8).

## v0.3 — JSON Schema generation

- JSON Schema draft 2020-12 output
- `$id` / `$defs` / `$ref` per identity rules
- Portable constraint mapping (min/max/regex/format/etc.)
- Semantic-loss metadata for runtime-only refinements
- JSON Schema test-suite conformance

## v0.4 — OpenAPI 3.1 generation

- OpenAPI 3.1 component schemas
- Integration fixtures for `@nekostack/api`
- Nullable / required mapping per the absence-semantics table
- Round-trip tests with `@redocly/openapi-core`

## v0.5 — Composition

- `extend`, `pick`, `omit`, `partial`, `required`
- Conflict-safe `merge` with explicit `override`

## v0.6 — Runtime validation

- `validate(schema, input)` and `parse(schema, input)`
- Unknown-key enforcement (the IR policy gets teeth here)
- Zod-backed execution; issue normalization
- **Semantic-parity tests** — same fixture validated four ways, expected failures match

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
