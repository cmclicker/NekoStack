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

## v0.2 — TypeScript + Zod generation ← *active target*

- TS generator (`.d.ts`)
- Zod generator (Zod 3.x target)
- Deterministic generated-file headers
- Snapshot tests for generator output
- Zod-execution tests (generated validator runs and matches fixtures)

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
- `neko schema check` (freshness) + `neko schema diff`

## v0.8+ — Migrations

- Migration registry, forward migrations, pre/post validation, audit

## v1.0 — Stable API

- Full docs, migration guide from Zod-as-source, perf benchmarks, frozen public surface

---

Future phases must respect the invariants in [`IR_CONTRACT.md`](./IR_CONTRACT.md). If a phase needs to violate one, raise it explicitly; do not work around it silently.
