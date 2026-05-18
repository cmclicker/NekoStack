# `@nekostack/schema` — Changelog

Per-milestone changes. Pairs with the git tags (`schema-vX.Y.Z`) and the [GitHub releases](https://github.com/cmclicker/NekoStack/releases). Format: newest first.

This package is workspace-internal (`private: true`, version `0.0.0`). The milestone identifiers are git/release markers, not npm publications.

---

## schema-v0.6.0 — 2026-05-18

[Tag](https://github.com/cmclicker/NekoStack/releases/tag/schema-v0.6.0) · merge commit [`c55ce95`](https://github.com/cmclicker/NekoStack/commit/c55ce952bc027b98cc1f4d270db4ec5b9e2b758d). Runtime validation as a NekoStack-owned workflow on the v0.2 source-generator + v0.5 composition foundation.

### Shipped

- **Runtime API on the package surface** — `parse(schema, input): s.output<S>` (throws `ParseError`), `safeParse(schema, input): Result<s.output<S>>`, `validate(schema, input): Result<s.input<S>>` (structural check; does NOT fill defaults; portable refinements still run). `ParseError extends Error` with `code: "parse_failed"` and a frozen `readonly issues: Issue[]`.
- **Engine-swap-safe boundary** — Zod is the internal execution engine. Consumers never import Zod for runtime validation. The public surface carries NekoStack types only (`Result`, `Issue`, `ParseError`), never a `ZodSchema` or `ZodError`. This is the [`PRODUCT_THESIS`](../../PRODUCT_THESIS.md) lens applied to validation.
- **Decision #6 shared semantic mapping** — `ZodEmitter<T>` / `emit<T>()` is the contract; the v0.2 string generator and the v0.6 value compiler are independent consumers. No `eval`, no source-to-value, no value-to-source. All v0.2 Zod source snapshots remain byte-identical post-extraction.
- **Decision #7 compile cache** — `WeakMap<SchemaNode, ZodTypeAny>` keyed on node identity; lazy first-call build; byte-identical IR with distinct node identity does NOT share (explicit dedup via `irHash` remains a v0.7 registry concern).
- **Decision #8 validate-only IR variant** — `stripDefaultsForValidate` drops `modifiers.default` and sets `modifiers.optional = true` at the same level; preserves `nullable` / refinements / metadata / `unknownKeys`. Cached per original-node identity in a separate `WeakMap` so repeated `validate(sameSchema, ...)` calls reuse both the variant and its compiled Zod.
- **Decision #12 issue normalization** — `ZodError → readonly Issue[]` per a locked mapping table; `unrecognized_keys` splits into one `unknown_key` issue per key. Round-2 fallback: unmapped Zod codes surface as `custom_refinement_failed` with `metadata.source = "zod"` and `metadata.zodCode = <original>` so triage never loses traceability.
- **Decision #19 four-oracle parity matrix** — NekoStack runtime / generated-Zod execution / Ajv 2020 over generated JSON Schema / small IR-walker. Compare-only contract: accept/reject. All four oracles agree on every fixture (primitives, literal/enum, arrays, object policies, absence semantics, full portable-refinement set).
- **Decision #19a OpenAPI spec-validity carry-forward** — Redocly validates that every runtime-supported schema still emits a clean OpenAPI 3.1 component. **Not** a runtime data oracle; the round-2 audit correction is permanent.
- **New contract doc** — [`docs/RUNTIME.md`](docs/RUNTIME.md) covering public API, default semantics, unknown-key policies, the issue normalization table, the engine boundary, the compile + validate-variant caches, semantic parity, unsupported behavior, and non-goals.
- **Six new INVARIANTS corollaries** — engine-swap-safe public surface, default-semantics split, `Issue[]` as the only public error vocabulary, cache invariance (`SchemaNode` identity), Redocly spec-validity-only role, fail-loud throws for unsupported runtime IR.
- **Docs sweep** — [`USAGE.md`](docs/USAGE.md), [`EXAMPLES.md`](docs/EXAMPLES.md), [`SCOPE.md`](docs/SCOPE.md), [`INVARIANTS.md`](docs/INVARIANTS.md), [`ROADMAP.md`](docs/ROADMAP.md), and [`BOUNDARIES.md`](../../BOUNDARIES.md) all reframed: runtime validation is the primary workflow, generators are the artifact / interoperability path.
- **`GENERATOR_VERSION` bumped to `@nekostack/schema@0.6.0`** — 59 snapshots regenerated; only the version field changed, `irHash` values unchanged.
- **Tooling alignment** — `scripts/generate-status.mjs` `parseActiveTarget` recognizes both `← *active target*` and `← *candidate implementation in progress*` so the status layer tracks candidate state without flagging false drift.

### Dependency changes

- **`zod` promoted from `peerDependenciesMeta.optional: true` to a regular `dependency`.** Range `^3.22.0` unchanged. Consumers no longer install or import Zod manually.
- `@redocly/openapi-core`, `ajv`, `ajv-formats` remain devDeps (used by the spec-validity and parity tests only).
- No other dep changes.

### Test count

- 342 → 587 (+245 net).

### Still deferred

- `neko schema generate / check / diff` CLI — v0.7
- `sourceHash` in headers — v0.7
- Local schema registry / freshness check — v0.7 (consumes the v0.2 `irHash`)
- Date / union / recursiveRef / transform IR runtime support
- Runtime refinement execution (IR shape declared; runtime currently throws `UnsupportedNodeKindError`)
- Method-style API (`schema.parse(input)`); v0.6 ships free functions only
- `ValidateError` companion to `ParseError`; `validate` returns `Result` only
- Locale / i18n of error messages
- Migrations between schema versions — v0.8+

---

## schema-v0.5.0 — 2026-05-17

[Tag](https://github.com/cmclicker/NekoStack/releases/tag/schema-v0.5.0) · merge commit [`70f19e9`](https://github.com/cmclicker/NekoStack/commit/70f19e9). Composition layer on the v0.1 IR foundation.

### Shipped

- **Seven new methods on `ObjectSchema`** — `extend`, `pick`, `omit`, `partial`, `required`, `merge`, `override`. All return a new `ObjectSchema` (no mutation), drop top-level metadata, preserve field-level metadata, and fail loudly on collisions / unknown keys / missing keys / merge conflicts / `unknownKeys` mismatches.
- **`extend(E)`** throws on key collision. To replace deliberately, use `override`. To combine with explicit resolution, use `merge`.
- **`override(O)`** throws on key not in base. Accepts any schema type for the replacement — that's the whole point.
- **`partial(mask?)` and `required(mask?)`** are symmetric on `default` — both strip it. Rationale: in v0.1, `default(v)` means input-optional + output-required, so preserving `default` through `partial` would leave output required while claiming optional. Symmetric strip is the only self-consistent rule.
- **`merge(other, options?)`** has three overloads encoding the conflict policy at the type level (`MergeThrowShape` / `MergeLeftShape` / `MergeRightShape`). Throws by default on field conflict AND on `unknownKeys` mismatch. Two independent knobs: `conflict` and `unknownKeys`. `unknownKeys` mismatch is fail-loud because strict-vs-passthrough is a real validation-semantics policy, not cosmetic.
- **Three new public types**: `Mask<S>`, `OverrideMask<S>`, `MergeOptions`. Internal `*Shape` helpers stay package-internal.
- **New contract doc** — [`docs/COMPOSITION.md`](docs/COMPOSITION.md).
- **Two new INVARIANTS corollaries** — composition fail-loudly; composition strips top-level metadata.
- **`Schema.clone()` JSDoc** now documents the v0.5 subclass invariant: `clone(node)` must be a pure IR-replacement operation. Future Schema subclasses that violate this silently break `partial`/`required`'s field-modifier swapping.
- **`MergeThrowShape` is `Identity<S & Other>`** — preserves disjoint merges and lets TypeScript surface some conflicts through normal intersection behavior, but **runtime conflict detection is the load-bearing guarantee**.
- **Generator parity** — composition produces a plain `ObjectNode`; all four generators (TS / Zod / JSON Schema / OpenAPI) handle composed schemas byte-identically to hand-written equivalents (proven by a 7-operator × 4-generator parity matrix).
- **`GENERATOR_VERSION` bumped to `@nekostack/schema@0.5.0`** — 59 snapshots regenerated.

### Dependency changes

None. Pure-TS work on top of v0.1–v0.4.

### Test count

- 248 → 342 (+94 net).

### Still deferred

- Runtime `parse` / `validate` from this package — v0.6
- `neko schema generate / check / diff` CLI — v0.7
- `sourceHash` in headers — v0.7
- `$defs` extraction + cross-package `$ref` — v0.7 (registry-lite)
- Deep / recursive composition — future
- `merge` with `"merge"` mode (recursive type-union) — future
- Static `s.merge(A, B)` top-level form — future
- Migrations — v0.8+
- Zod 4 target — future generator option

---

## schema-v0.4.0 — 2026-05-17

[Tag](https://github.com/cmclicker/NekoStack/releases/tag/schema-v0.4.0) · merge commit [`c9d15d0`](https://github.com/cmclicker/NekoStack/commit/c9d15d0). Fourth generator on the v0.1 IR foundation.

### Shipped

- **`generateOpenApiSchemaComponent(node, options?)`** — emits a single OpenAPI 3.1 Schema Component (the value at `components.schemas.<Name>`). Canonical JSON. Not a full OpenAPI document — that belongs to a future `@nekostack/api`.
- **Shared `emitSchemaFragment`** — new [`src/generators/schema-fragment.ts`](src/generators/schema-fragment.ts) owns the IR-to-fragment translation. `json-schema.ts` and `openapi.ts` are now thin wrappers differing only on root structure, `$schema` / `$id`, and provenance `generator` value. Eliminates the JSON-Schema-vs-OpenAPI drift vector. Hard gate verified: v0.3 JSON Schema snapshots remained byte-identical through the extraction.
- **No `$schema`, no `$id`** in component-position output (Decision #5 — component identity is the position in the document).
- **`x-nekostack` provenance with `generator: "openApi"`** — `irHash` identical to the JSON Schema generator's for the same node (proven by test).
- **Throw contract** identical to v0.3: runtime refinements + regex-with-non-empty-flags throw `UnsupportedNodeKindError` with `generator: "openApi"`. Same stable `code` / `kind` / `generator` shape from v0.2.
- **`OpenApiGeneratorOptions = Record<string, never>`** — explicit no-options contract enforced at compile time. `@ts-expect-error`-backed test guards against regression. Widens to a richer interface when the first real option lands (likely `discriminator` with union builders).
- **`@redocly/openapi-core` round-trip tests** — every emitted component composed into a synthetic OpenAPI 3.1 document (with explicit `jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema"`) and validated clean. Per the v0.4 plan fallback, can switch to spawning the Redocly CLI if the programmatic API ever proves impractical.
- **Three new committed example artifacts** under [`examples/generated/`](examples/generated/): `tenant.openapi.json`, `audit-event.openapi.json`, `entitlement.openapi.json`.
- **New contract doc** — [`docs/OPENAPI_MAPPING.md`](docs/OPENAPI_MAPPING.md). Deliberately delta-only; everything else defers to `JSON_SCHEMA_MAPPING.md`.
- **Two new INVARIANTS corollaries** — "Redocly round-trip must pass" and "IR-to-fragment translation lives once in `schema-fragment.ts`; parallel implementations are explicitly rejected."
- **Stale-doc cleanups** — `src/index.ts` generator section phase-neutralized, `UnsupportedNodeKindError` JSDoc generator-neutralized.
- **`GENERATOR_VERSION` bumped to `@nekostack/schema@0.4.0`** — 56 snapshots regenerated; new artifact provenance lines match this milestone.

### Dependency changes

- New devDep: `@redocly/openapi-core ^1.34.0`. No new runtime dep.

### Test count

- 219 → 248 (+29 net).

### Still deferred

- Composition operators — v0.5
- Runtime `parse` / `validate` from this package — v0.6
- `neko schema generate / check / diff` CLI — v0.7
- `sourceHash` in headers — v0.7
- `$defs` extraction + cross-package `$ref` — v0.7 (registry-lite)
- Full OpenAPI documents (paths/operations/etc.) — `@nekostack/api`'s concern
- OpenAPI 3.0 target — future generator option
- `discriminator` keyword — needs union builders
- `example` / `xml` / `externalDocs` — no IR construct uses them
- Migrations — v0.8+
- Zod 4 target — future generator option

---

## schema-v0.3.0 — 2026-05-17

[Tag](https://github.com/cmclicker/NekoStack/releases/tag/schema-v0.3.0) · merge commit [`9c50364`](https://github.com/cmclicker/NekoStack/commit/9c50364). Third generator on the v0.1 IR foundation.

### Shipped

- **`generateJsonSchema(node, options?)`** — canonical draft 2020-12 output. Sorted keys, 2-space indent, single trailing newline. Same IR + same generator version → byte-identical output. Models accepted input only — no `mode` option in v0.3.
- **Identity** — URN `$id` by default (`urn:nekostack:schema:<id>:<version>`); URL form via `options.idBase`; anonymous schemas omit `$id`; never emits `$defs` in v0.3 (inline only — strategy documented for future).
- **Absence semantics** — `optional` / `nullish` / `default` omitted from `required`; `nullable` / `nullish` encode `null` in the type array; `default` emits annotation + `x-nekostack-default-applied-by: "runtime"`.
- **Object policy** — `strict` → `additionalProperties: false`; `passthrough` → `true`; `stripUnknown` → `true` + `x-nekostack-strip: true` (JSON Schema cannot strip; runtime does).
- **Refinement mapping** — full table in [`docs/JSON_SCHEMA_MAPPING.md`](docs/JSON_SCHEMA_MAPPING.md).
- **Throw contract** (Invariant 7) — runtime refinements (`kind: "runtimeRefinement"`) and regex-with-non-empty-flags (`kind: "regexFlags"`) throw `UnsupportedNodeKindError` rather than silently emit a schema that changes validation behavior. Stable `code` / `kind` / `generator` shape unchanged from v0.2; `generator` field union extended to include `"jsonSchema"`.
- **Provenance via `x-nekostack` extension object** — JSON has no comment syntax, so v0.2's JSDoc header concept moves into a single extension object at the root.
- **Codified extension keys** — `src/generators/json-schema-meta.ts` exports `JSON_SCHEMA_EXTENSIONS` constants. Any new `x-nekostack-*` key has to land in this file first.
- **New contract doc** — [`docs/JSON_SCHEMA_MAPPING.md`](docs/JSON_SCHEMA_MAPPING.md).
- **Three new committed example artifacts** under [`examples/generated/`](examples/generated/): `tenant.json.schema.json`, `audit-event.json.schema.json`, `entitlement.json.schema.json`. Validated by the regenerate test alongside the v0.2 TS/Zod outputs.
- **`GENERATOR_VERSION` bumped to `@nekostack/schema@0.3.0`** — provenance on every generated artifact (v0.2 and v0.3 outputs alike) now matches this milestone. 50 snapshots regenerated.
- **`UnsupportedNodeKindError` message** is now phase-neutral (previously pointed at `PHASE_PLAN_v0.2.md`).
- **`INVARIANTS.md`** extended with the v0.3 corollary on `x-nekostack-*` extensions vs. throw.

### Dependency changes

- New devDeps: `ajv ^8.12.0` (imported only via `ajv/dist/2020.js`, the draft-2020-12 class) and `ajv-formats ^3.0.1` (for `format: "email" / "uri"` execution tests). No new runtime dep.

### Test count

- 163 → 219 (+56 net).

### Still deferred

- OpenAPI 3.1 — v0.4
- Composition operators — v0.5
- Runtime `parse` / `validate` from this package — v0.6
- `neko schema generate / check / diff` CLI — v0.7
- `sourceHash` in headers — v0.7
- `$defs` extraction + cross-package `$ref` — v0.7 (registry-lite)
- Output-shape JSON Schema (default-applied, all-required) — deferred indefinitely (no concrete consumer needs it)
- Opt-in lossy regex-with-flags mode — deferred (current behavior is throw)
- Migrations between schema versions — v0.8+
- Zod 4 target — future generator option

---

## schema-v0.2.1 — 2026-05-16

[Tag](https://github.com/cmclicker/NekoStack/releases/tag/schema-v0.2.1) · merge commit [`17cd182`](https://github.com/cmclicker/NekoStack/commit/17cd182). Patch release on the v0.2 line — proof artifacts + generator output polish from the dogfood pass.

### Shipped

- **v0.2 dogfood examples** — three realistic schemas (`Tenant`, `AuditEvent`, `Entitlement`) under [`examples/`](examples/) with committed generated artifacts under [`examples/generated/`](examples/generated/). The committed files double as snapshots for [`tests/examples/regenerate.test.ts`](tests/examples/regenerate.test.ts), so example drift fails CI.
- **Author-facing docs** — [`docs/USAGE.md`](docs/USAGE.md) and [`docs/EXAMPLES.md`](docs/EXAMPLES.md).
- **TS generator: nested object indentation** — nested object types now indent per depth (was: collapsed to outer-field column).
- **TS generator: array-of-object element parens** — replaced unsafe `startsWith("{")` heuristic with a structural top-level-union scanner. Closes the semantic hole where `s.array(s.object({...}).optional())` could emit `{...} | undefined[]` (parsed as "object OR array of undefined") instead of the correct `({...} | undefined)[]`.

### Test count

- 144 → 163 (+19 since v0.2.0): 9 regenerate-test cases, 4 nested-indent assertions, 6 array-paren assertions.

### Why this was its own release

The dogfood polish changed generator behavior (real bug fix in the array-paren case, presentational change in the nested-indent case). Folding it under `schema-v0.2.0` would have understated the change and made the tagged release diverge from main. A patch tag preserves honesty without bumping the minor version.

### No public API change

- No new exports.
- No new dependency.
- `src/index.ts` unchanged from v0.2.0.

### Still deferred

Same as v0.2.0 (see below).

---

## schema-v0.2.0 — 2026-05-16

[Tag](https://github.com/cmclicker/NekoStack/releases/tag/schema-v0.2.0) · merge commit [`eee079c`](https://github.com/cmclicker/NekoStack/commit/eee079c).

### Shipped

- **`generateTypeScript(node, options?)`** — TS type-alias generator with `mode: "input" | "output" | "both"` (default `"output"`). Absence-semantics input/output split preserved end-to-end.
- **`generateZod(node, options?)`** — Zod 3.x generator with fixed modifier ordering. See [`docs/ZOD_MODIFIER_ORDERING.md`](docs/ZOD_MODIFIER_ORDERING.md).
- **`irHash(node)`** — sha256 of canonical IR serialization, hex-encoded. Used by generated-file headers in v0.2; consumed (not introduced) by the v0.7 freshness check.
- **Deterministic generated-file headers** — schemaId, schemaVersion, irHash, generator, generatorVersion. See [`docs/HEADER_FORMAT.md`](docs/HEADER_FORMAT.md). `sourceHash` deferred to v0.7.
- **`UnsupportedNodeKindError`** — stable `code` / `kind` / `generator` fields. Tests assert on fields, not message text.
- **Runtime refinements throw, not skip** — both generators throw `UnsupportedNodeKindError({ kind: "runtimeRefinement" })` rather than silently dropping unsupported refinement kinds.
- **Snapshot tests** for generator output (`vitest` `toMatchFileSnapshot`, external `.snap` files).
- **Zod-execution tests** — load generated code into a real Zod runtime, validate fixtures.
- **Zod-modifier-composition tests** — the eight-row matrix from Decision #8 (optional / nullable / nullish / default and combinations).

### Dependency changes

- Added `zod ^3.22.0` as **optional `peerDependency`** (consumers using the generated Zod runtime install it themselves) and `devDependency` (for the execution test harness). Generators ship as pure TS; no runtime import of Zod from the package itself.

### Test count

- 44 → 144 (+100 net at the tag commit; v0.2.1 took it to 163).

### Still deferred

- JSON Schema — v0.3
- OpenAPI 3.1 — v0.4
- Composition operators (`extend` / `pick` / `omit` / `partial` / `merge`) — v0.5
- Runtime `parse` / `validate` from this package directly — v0.6
- `neko schema generate / check / diff` CLI — v0.7
- `sourceHash` in generated headers — v0.7
- Migrations between schema versions — v0.8+
- Zod 4 target — future generator option (Zod 4 is stable; intentionally deferred for scope)

---

## schema-v0.1.0 — 2026-05-16

[Tag](https://github.com/cmclicker/NekoStack/releases/tag/schema-v0.1.0) · merge commit [`8a94853`](https://github.com/cmclicker/NekoStack/commit/8a94853). First package phase accepted under [`standards/package-development.md`](../../standards/package-development.md).

### Shipped

- **Canonical `SchemaNode` IR** — all 12 node kinds typed; 7 with v0.1 builders (string / number / boolean / literal / enum / array / object). Future kinds (date / union / recursiveRef / transform) declared internally but not surfaced.
- **DSL builders** — `s.string` / `s.number` / `s.boolean` / `s.literal` / `s.enum` / `s.array` / `s.object`.
- **Modifiers** — `optional` / `nullable` / `nullish` / `default`. `Schema` base tracks `TInputKey` and `TOutputKey` separately so default-bearing fields are correctly input-optional + output-required.
- **Metadata** — `id` / `version` / `describe` / `deprecated`.
- **Strict-by-default object policy** — `strict` (default) / `stripUnknown` / `passthrough`. Stored in IR; runtime enforcement deferred to v0.6.
- **Type inference** — `s.infer` / `s.input` / `s.output`.
- **`Issue` / `IssueCode` / `Result`** — vocabulary pinned; the parser that produces them ships in v0.6.
- **Canonical IR serialization** — `serializeIR(node)` sorts keys recursively, strips undefined. Foundation for v0.2's `irHash` and v0.7's freshness check.
- **Tight public API** — `src/index.ts` re-exports only v0.1-buildable node kinds. Implementation classes exported as type-only.
- **Package-local docs** — `README.md`, [`docs/SCOPE.md`](docs/SCOPE.md), [`docs/INVARIANTS.md`](docs/INVARIANTS.md), [`docs/ROADMAP.md`](docs/ROADMAP.md), [`docs/IR_CONTRACT.md`](docs/IR_CONTRACT.md), [`docs/ABSENCE_SEMANTICS.md`](docs/ABSENCE_SEMANTICS.md).
- **Package tooling** — first concrete package in the monorepo to wire `tsconfig.json` + `vitest.config.ts` + per-package scripts.

### Test count

- 0 → 44 (29 runtime + 15 type-level via `expectTypeOf`).

### Still deferred

- TypeScript generation — v0.2
- Zod generation — v0.2
- JSON Schema — v0.3
- OpenAPI — v0.4
- Composition operators — v0.5
- Runtime `parse` / `validate` — v0.6
- Schema registry + CLI + diff — v0.7
- Migrations — v0.8+

---

## Milestone process

For every shipped schema milestone:

1. Merge the implementation PR.
2. Merge the dogfood / proof PR if one exists (examples, generator polish surfaced during dogfooding, regenerate snapshots).
3. Merge the ROADMAP status PR (`candidate` → `shipped`; advance the next phase to `active target`).
4. Tag the **final** commit on the milestone — i.e. the dogfood merge if there is one, otherwise the implementation merge. Use `git tag -a schema-vX.Y.Z <sha> -m "..."` + `git push origin schema-vX.Y.Z`.
5. Create a GitHub release pointing at the tag.
6. Add a new section at the top of this file.
7. Keep `docs/` and `README.md` current — never duplicate them under `docs/v0.x/`.

Behavior-changing dogfood polish that lands AFTER the implementation has already been tagged gets its own patch milestone (`schema-v0.2.1`-style) — see the v0.2 line in this changelog for the working precedent. Folding it back into the implementation tag would make the tagged release diverge from main and understate the change.

The git history is the implementation truth; tags + releases + this changelog are the milestone-visible truth.
