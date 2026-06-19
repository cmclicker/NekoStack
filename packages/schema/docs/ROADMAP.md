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

## v0.6 — Runtime validation

Status: **shipped** ([#22](https://github.com/cmclicker/NekoStack/pull/22), merged 2026-05-18). Plan: [`PHASE_PLAN_v0.6.md`](./PHASE_PLAN_v0.6.md). Contract: [`RUNTIME.md`](./RUNTIME.md). Tagged as [`schema-v0.6.0`](https://github.com/cmclicker/NekoStack/releases/tag/schema-v0.6.0).

Ships:
- `parse(schema, input): s.output<S>` — throws `ParseError`
- `safeParse(schema, input): Result<s.output<S>>` — non-throwing Result variant
- `validate(schema, input): Result<s.input<S>>` — structural check; no default fill, no transforms; portable refinements still run
- `ParseError extends Error` with `code = "parse_failed"` and a frozen defensive `issues` copy
- Issue normalization layer translating Zod issue codes into the v0.1 `IssueCode` vocabulary per the Decision #12 table; unmapped codes fall back to `custom_refinement_failed` with `metadata.source = "zod"` and `metadata.zodCode = <original>`
- Decision #6 shared semantic mapping — the v0.2 source generator and the v0.6 runtime compiler share one `ZodEmitter<T>` / `emit<T>()` interface (no `eval`, no source-to-value parsing, no value-to-source serialization)
- Decision #7 compile cache — `WeakMap<SchemaNode, ZodTypeAny>` keyed by node identity; lazy first-call build; byte-identical different nodes do not share
- Decision #8 validate-only IR variant — `stripDefaultsForValidate` produces a new tree with `modifiers.default` dropped and `modifiers.optional = true` set at the same level; cached per original-node identity in a second `WeakMap` so repeated `validate()` calls reuse the variant
- Decision #19 four-oracle parity matrix — NekoStack runtime / generated-Zod execution / Ajv 2020 over generated JSON Schema / small IR-walker (compare accept/reject only)
- Decision #19a Redocly carry-forward — OpenAPI spec-validity only, separate from runtime parity
- Promotion of Zod from `peerDependenciesMeta.optional: true` to a regular `dependency` (Step 11 of the locked plan)
- `GENERATOR_VERSION` bump to `@nekostack/schema@0.6.0` and v0.2 header snapshot regeneration (Step 12)
- Public re-exports of `parse` / `safeParse` / `validate` / `ParseError` from `src/index.ts` (Step 13)

Explicitly deferred:
- Date / union / recursiveRef / transform IR runtime support (still throws `UnsupportedNodeKindError`)
- Runtime refinement execution (IR shape declared; runtime fails loudly when one appears)
- Method-style API (`schema.parse(input)`); v0.6 ships the free functions only
- `ValidateError` companion to `ParseError`; `validate` returns `Result` only
- Locale / i18n of error messages

Per the [`PRODUCT_THESIS`](../../../PRODUCT_THESIS.md), v0.6 is the phase where NekoStack starts taking runtime-validator workflow space — users no longer have to install or import Zod directly for runtime validation. Zod stays as the internal execution engine; the user-facing surface is `parse` / `safeParse` / `validate` / `ParseError` from `@nekostack/schema`.

## v0.7 — Registry-lite + CLI

Status: **shipped** ([#25](https://github.com/cmclicker/NekoStack/pull/25), merged 2026-05-19). Plan: [`PHASE_PLAN_v0.7.md`](./PHASE_PLAN_v0.7.md). Contracts: [`REGISTRY.md`](./REGISTRY.md), [`DIFF_CLASSIFICATION.md`](./DIFF_CLASSIFICATION.md). Tagged as [`schema-v0.7.0`](https://github.com/cmclicker/NekoStack/releases/tag/schema-v0.7.0). Joint schema + CLI phase — first real implementation of [`@nekostack/cli`](../../cli) ships alongside the schema-side registry primitives.

Ships (schema-side):

- **`sourceHash` provenance slice** — `sourceHashFromText(text)` and the `ProvenanceOptions.sourceHash` field on every generator. The slice is **optional** — generators omit the `sourceHash` line/extension when not provided, so v0.6-and-earlier callers produce byte-identical output. Backward compatibility gated by the v0.2/v0.3/v0.4/v0.5/v0.6 snapshot tests.
- **`parseProvenanceFromText(text)`** — auto-detects JSDoc-header and `x-nekostack` provenance carriers, tolerates v0.6-era artifacts missing `sourceHash`, returns `Result<ParsedProvenance>` with `integrity_error` + `metadata.reason` on failure (no throws).
- **Registry primitives** — `buildRegistry(entries): Result<Registry>` and `findSchema(registry, schemaId, version?)`. Duplicate `(schemaId, schemaVersion)` pairs collected into `duplicate_schema_id` Issues; anonymous schemas silently skipped; unversioned schemas indexed under the empty-string inner key. Full contract in [`REGISTRY.md`](./REGISTRY.md).
- **Diff classifier** — `diffNodes(before, after)` walks two `SchemaNode` trees and returns `readonly DiffChange[]` per the locked Decision #12 table. Severity uses the input-acceptance lens. Unsupported IR kinds throw `UnsupportedNodeKindError({ generator: "diff", kind })`. Full contract in [`DIFF_CLASSIFICATION.md`](./DIFF_CLASSIFICATION.md).
- **Four pure handlers** — `listHandler`, `diffHandler` (adds `worstSeverity` aggregation, precedence `breaking > additive > cosmetic`, `null` for empty), `checkHandler` (two-hash freshness matrix + v0.6 missing-`sourceHash` fallback), `generateHandler` (emits all four artifact kinds per named schema; partial generation is not supported in v0.7 per Decision #6). Data-in / data-out; the schema package never touches the filesystem. Purity gated by [`../tests/registry/handler-purity.test.ts`](../tests/registry/handler-purity.test.ts).
- **Generated-artifact path convention** — `<schema-dir>/generated/<basename>[.<discriminator>].<artifact-kind>`. Multi-schema source files get a slugged discriminator per named schema; same-id-multiple-versions automatically embeds a version slug.
- **Integration subpath** — `@nekostack/schema/cli` exports the v0.7 surface for `@nekostack/cli` to consume. Root `@nekostack/schema` continues to expose only the v0.6 contract; the negative-leakage gate in [`../tests/public-surface.test.ts`](../tests/public-surface.test.ts) enforces this. Subpath wiring lives in the `package.json` `exports` map.

Ships (CLI-side — companion plan in [`../../cli/docs/PHASE_PLAN_v0.7.md`](../../cli/docs/PHASE_PLAN_v0.7.md), first real implementation of [`@nekostack/cli`](../../cli)):

- `neko schema list / diff / check / generate` — four locked verbs.
- `tsx` loader (register-once strategy), workspace walker, committed-artifact reader, JSON + pretty formatters.
- Locked exit-code mapping: `0 SUCCESS` / `1 LOGICAL_FAILURE` / `2 USAGE_ERROR` / `3 IO_ERROR` / `4 INTEGRITY_ERROR`.
- `@nekostack/cli` owns filesystem discovery, dynamic schema loading, stdout/stderr formatting, and exit codes — Master plan Decision #1 keeps `@nekostack/schema` pure.

Explicitly deferred:

- Migration proposal / generation / application — v0.8+.
- Partial generation (subset of artifact kinds) — locked by Decision #6.
- Date / union / recursiveRef / transform IR — still throws `UnsupportedNodeKindError` from generators and from `diffNodes`.

## v0.8 — Schema-data migrations: planning + verification + stub generation

Status: **shipped** ([#28](https://github.com/cmclicker/NekoStack/pull/28), merged 2026-05-20). Plan: [`PHASE_PLAN_v0.8.md`](./PHASE_PLAN_v0.8.md). Contract: [`MIGRATIONS.md`](./MIGRATIONS.md). Tagged as [`schema-v0.8.0`](https://github.com/cmclicker/NekoStack/releases/tag/schema-v0.8.0). Joint schema + CLI phase — the schema-side migration primitives ship under this tag and the four `neko schema migrate *` verbs ship alongside in [`@nekostack/cli`](../../cli).

The v0.8 boundary is **hard-locked**: the schema package owns *planning*, *verification*, and *stub generation* of authored schema-data migrations. It never executes a migration's `transform(input)` function and never ships an "apply" verb. The full non-goals table is in [`MIGRATIONS.md`](./MIGRATIONS.md).

Ships (schema-side) — *additive* over v0.7, no public-surface breakage at root `@nekostack/schema`:

- **`Migration<SchemaId, FromVersion, ToVersion, Input, Output>`** — the authored module shape: a 9-field JSDoc provenance header + a pure `transform(input)` function + a default export. Identity is the triple `(schemaId, fromVersion, toVersion)`; one `schemaId` per migration (Decision #4); forward-only (Decision #2).
- **`parseMigrationProvenanceFromText(text)`** — read the 9-field provenance carrier off a committed migration file. Fail-loud `integrity_error` + stable `metadata.reason` on malformed input; never silently skips (round-2 audit correction). The same JSDoc-only carrier discipline as v0.7 generators.
- **`buildMigrationRegistry(entries)`** — pure constructor with first-seen-wins duplicate handling; three-level shape supporting exact-triple lookup AND `(schemaId, fromVersion) → outgoing-edges` enumeration for chain construction. Returns `Result<MigrationRegistry>` and collects multiple failures without short-circuiting.
- **`planMigration({ schemaRegistry, migrationRegistry, schemaId, fromVersion, toVersion })`** — diff-aware planner. Consumes **both** registries so it can honor Decision #10's severity → migration-requirement dispatch. Locked rules: `null` / `cosmetic` → empty chain; `null` / `cosmetic` *with* an exact migration also authored → empty chain + `over_specified` `PlanNote` (migration not included in chain); `additive` *with* an exact migration → chain containing that migration; `additive` *without* a migration → empty chain + `additive_no_migration` `PlanNote`; `breaking` → DFS chain enumeration over the `(schemaId, fromVersion)` adjacency, required to reach `toVersion`. Never calls `transform`.
- **`verifyMigrationProvenance({ schemaRegistry, migrationRegistry })`** — four-way verdict matrix mirroring v0.7 freshness: `bound` / `cosmetic_drift` / `drift` / `missing_endpoint`. Requires **both** registries because verdicts come from comparing each migration's provenance hashes against the current endpoint-schema hashes. `bound` and `cosmetic_drift` are success-compatible (`cosmetic_drift` is warning-class on the success branch); `drift` and `missing_endpoint` are failure-class with stable metadata reasons. Iteration sorted by `(schemaId, fromVersion, toVersion)` for determinism.
- **`stubMigration(opts)` + `suggestedMigrationPathFor(opts)`** — pure file-content generator emitting the JSDoc header + `import type { Migration } from "@nekostack/schema/cli"` + typed declaration + `transform(input) { throw "Not yet implemented"; }` body + default export. Slug rule byte-compatible with v0.7's `suggestedPathFor`.
- **Four pure migration handlers** — `listMigrationsHandler`, `planMigrationHandler`, `verifyMigrationsHandler`, `stubMigrationHandler`. Data-in / data-out; never touch the filesystem, never call `.transform(`. Cross-handler purity gated by [`../tests/migrations/handler-purity.test.ts`](../tests/migrations/handler-purity.test.ts) (static-import scan over 9 modules × 12 forbidden patterns + 15 sentinel rows).
- **Integration subpath extension** — `@nekostack/schema/cli` exports the v0.8 surface alongside the v0.7 surface (10 runtime + 18 type names). Root `@nekostack/schema` retains the v0.6 contract unchanged; the negative-leakage gate in [`../tests/public-surface.test.ts`](../tests/public-surface.test.ts) extends to every v0.8 name.
- **`GENERATOR_VERSION` bump** to `@nekostack/schema@0.8.0` (Step 17 of the v0.8 plan).

Ships (CLI-side — companion implementation in [PR #28](https://github.com/cmclicker/NekoStack/pull/28)):

- `neko schema migrate list / plan / verify / stub` — four locked verbs mirroring the v0.7 `neko schema *` verb shape.
- `tsx`-based migration-file loader, workspace walker for migration directories, stdout/stderr formatters, exit-code mapping consistent with v0.7 (`0 SUCCESS` / `1 LOGICAL_FAILURE` / `2 USAGE_ERROR` / `3 IO_ERROR` / `4 INTEGRITY_ERROR`).
- `@nekostack/cli` owns filesystem discovery, dynamic migration-module loading, stdout/stderr formatting, exit codes, and **any side-effecting top-level evaluation of authored migration modules**. Master plan Decision #1 (schema is pure) stays in force for v0.8.

Explicitly **not** shipped — these are hard-locked non-goals, not deferred items:

- **No apply / runner / executor verb** — the schema package never calls a migration's `transform(input)` against real data. If a future package wants to provide one, it lives outside `@nekostack/schema`. [`MIGRATIONS.md`](./MIGRATIONS.md) is the contract.
- **No rollback** (Decision #2 — forward-only).
- **No cross-schema migrations** (Decision #4 — exactly one `schemaId` per migration).
- **No multi-hop skip** — chain enumeration is required; the planner never silently bypasses intermediate versions.
- **No database DDL migrations** (`@nekostack/migrate`'s concern).
- **No transform-correctness proof** — the package never executes `transform`, so it has no opinion on whether the transform is correct. Verification covers provenance integrity only.
- **No filesystem I/O, dynamic `import()`, stdout/stderr, exit codes** — owned by `@nekostack/cli`.

## v0.9 — Migration runner

Status: **shipped** ([#31](../../../pull/31), merged 2026-05-21). Shipped as a standalone downstream package [`@nekostack/migrate-runner`](../../migrate-runner).

- **Implementation boundary:** the schema package remains pure (planning + verification only). Execution logic (calling `transform`) lives exclusively in the runner package.
- **Safety pass:** ironclad "Validation Sandwich" (pre-validate → transform → post-validate).
- **Features:** dry-run, validate-only, resumability (audit cursor), forensic snapshots.

The v0.8 hard-locks remain in force: `@nekostack/schema` never mutates data.

## v1.0 — Stable API ← *active target*

Status: **in progress.** Final hardening phase.

- Full docs, [migration guide from Zod-as-source](./MIGRATION_GUIDE.md), [perf benchmarks](./BENCHMARKS.md), frozen public surface.
- Resolve remaining "Still-open" decisions in package README.
- **Completed:** Property-based / fuzz tests via `@nekostack/fuzz` (proves IR invariants and generator safety across 1000s of permutations).

---

Future phases must respect the invariants in [`IR_CONTRACT.md`](./IR_CONTRACT.md). If a phase needs to violate one, raise it explicitly; do not work around it silently.
