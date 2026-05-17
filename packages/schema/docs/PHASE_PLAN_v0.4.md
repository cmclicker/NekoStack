# Phase Plan: `@nekostack/schema` v0.4 — OpenAPI 3.1 component generation

> **PLAN only — no code in the PR that lands this doc.** Same discipline as v0.2 / v0.3.
>
> Reviewed against [`checklists/package/implementation-acceptance.md`](../../../checklists/package/implementation-acceptance.md). Once approved, implementation opens on `feat/schema-v0.4-candidate`.

## Why this phase is small

OpenAPI 3.1 explicitly aligns its Schema Object with **JSON Schema draft 2020-12** — the same draft v0.3 already targets. That means most of `generateJsonSchema`'s output is already a valid OpenAPI 3.1 component schema. The work in v0.4 is mostly about:

- Picking the right output unit (component schema fragment vs. full OpenAPI document).
- Honoring the OpenAPI-specific extension keys (`discriminator`, `xml`, `example`, `externalDocs`) — none of which v0.1's IR uses yet, so v0.4 is mostly *not* using them.
- Validation harness: `@redocly/openapi-core` (or comparable) for round-tripping.

The plan deliberately keeps v0.4 narrow so it can ship in days, not weeks.

## Phase scope

1. **`generateOpenApiComponent(node, options?) → string`** — emits a single **OpenAPI 3.1 component schema** as canonical JSON. The output is the value that would live under `components.schemas.<Name>` in a full OpenAPI document — not the document itself. Consumers compose it into their own document.
2. **Round-trip validation via `@redocly/openapi-core`** — every emitted schema is loaded into a synthetic OpenAPI 3.1 document, run through Redocly's validator, and asserted clean.
3. **OpenAPI-aware provenance** — same `x-nekostack` extension block as v0.3, with `generator: "openApi"`. OpenAPI Specification Extensions permit any `x-*` keys, so this is portable across all OpenAPI 3.1 tooling.
4. **Format mapping alignment** — JSON Schema's `format: "uri"` vs OpenAPI's preference, etc. Codify the small differences in a new contract doc.
5. **Three new committed example artifacts** — `tenant.openapi.json`, `audit-event.openapi.json`, `entitlement.openapi.json` under `examples/generated/`, validated by the existing regenerate test.

## Explicit non-scope

- Full OpenAPI documents (paths, operations, parameters, responses, security schemes, servers, callbacks, etc.) — `@nekostack/api`'s eventual concern. v0.4 ships **component schemas only**.
- Cross-schema `$ref` (`#/components/schemas/<Other>`) — requires registry-lite (v0.7). v0.4 inlines everything, same as v0.3.
- `discriminator` keyword — needs union builders in the IR (none in v0.1/v0.2/v0.3). When unions ship, the JSON Schema generator and OpenAPI generator both gain discriminator support together.
- `xml` / `externalDocs` keywords — no IR construct uses them.
- `example` / `examples` keywords — IR doesn't carry example data. Could be added if a real consumer needs it.
- OpenAPI 3.0 target — 3.0 has its own subset (`nullable: true` instead of `type: ["x", "null"]`). Out of scope; a future generator option could add it if needed.
- Composition operators — v0.5.
- Runtime parse/validate — v0.6.
- CLI handlers — v0.7.

## Public API delta

To be added to `src/index.ts`:

```ts
export { generateOpenApiComponent } from "./generators/openapi.js";
export type { OpenApiGeneratorOptions } from "./generators/types.js";
```

Two new exports — one value, one type. The existing `UnsupportedNodeKindError`'s `generator` union extends to `"typescript" | "zod" | "jsonSchema" | "openApi"`.

## Internal file delta

```
packages/schema/src/
└── generators/
    ├── openapi.ts             # the generator
    ├── openapi-meta.ts        # OpenAPI-specific extension constants (if any beyond x-nekostack)
    └── errors.ts              # extended: generator includes "openApi"
```

Tests:

```
packages/schema/tests/
└── generators/
    ├── openapi.test.ts                # snapshot tests + throw cases
    ├── openapi-redocly.test.ts        # round-trip via @redocly/openapi-core
    └── __snapshots__/openapi/         # external .snap files
```

Example artifacts:

```
packages/schema/examples/generated/
├── tenant.openapi.json
├── audit-event.openapi.json
└── entitlement.openapi.json
```

Plus the regenerate test extension at [`tests/examples/regenerate.test.ts`](../tests/examples/regenerate.test.ts).

## Dependency delta

- **devDependency** added: `@redocly/openapi-core ^1.34.0` (or comparable). Used by the round-trip test only. Not a runtime dep.
- No new runtime dep. No new `@nekostack/*` deps.

## Decisions to lock before coding

Twelve decisions. Several inherit from v0.3 cleanly; OpenAPI-specific ones are flagged.

### Output shape

1. **Output unit: component-schema fragment, not full document.** `generateOpenApiComponent(node)` returns the value that would slot under `components.schemas.<Name>`. Consumers compose. Rationale: full-document generation (paths, operations) belongs to `@nekostack/api`. v0.4 stays a schema generator.

2. **Function name.** `generateOpenApiComponent` (verbose but accurate) over `generateOpenApi` (implies full document). Naming follows the v0.3 precedent of being specific about what comes out.

3. **Reuse vs parallel implementation.** OpenAPI 3.1 schemas are JSON Schema draft 2020-12 with a few extra optional keywords. Two options:
   - **Option A (preferred):** parallel implementation that shares no code with `json-schema.ts`. Each generator is straightforward; sharing creates coupling and conditional branching that becomes a tax.
   - **Option B:** factor `json-schema.ts` into a shared core + thin OpenAPI wrapper.
   - Recommendation: **A** for v0.4. Revisit only if `openapi.ts` ends up >70% identical to `json-schema.ts`.

### Format + identity (mostly inherited from v0.3)

4. **OpenAPI 3.1 only.** No 3.0 target in v0.4.
5. **`$id` strategy.** OpenAPI component schemas typically do NOT carry `$id` because their identity is the position in the document (`#/components/schemas/<Name>`). Default: **omit `$id`** in the component fragment. The provenance object still carries `schemaId` + `schemaVersion`.
6. **Anonymous schemas.** Same as v0.3 — emit without identity metadata. The provenance block records `schemaId: null`.
7. **Inline schemas only.** No `$ref` extraction in v0.4 (same as v0.3). When cross-schema references ship in v0.7's registry, the OpenAPI generator gains `#/components/schemas/...` ref emission alongside JSON Schema's `$defs`.

### Absence semantics — same as v0.3

8. **`optional()` / `nullable()` / `nullish()` / `default()`** map exactly as in v0.3 (`required` array + `type: ["base", "null"]` form + `default` annotation + `x-nekostack-default-applied-by: "runtime"`). OpenAPI 3.1's Schema Object inherits these from JSON Schema 2020-12.

### Object policy — same as v0.3

9. **Unknown-key policy** maps exactly as in v0.3:
   - `strict` → `additionalProperties: false`
   - `passthrough` → `additionalProperties: true`
   - `stripUnknown` → `additionalProperties: true` + `x-nekostack-strip: true`

### Refinement mapping

10. **Portable refinements** map the same as v0.3 (full table in [`JSON_SCHEMA_MAPPING.md`](./JSON_SCHEMA_MAPPING.md)). Two OpenAPI-specific clarifications:
    - **`format` values:** v0.3 emits `format: "uri"` (JSON Schema). OpenAPI tooling commonly uses both `"uri"` and `"url"`; the spec prefers `"uri"`. v0.4 keeps `"uri"`. Other formats (`email`, `uuid`, `date-time`) align cleanly.
    - **`pattern` semantics:** OpenAPI 3.1 explicitly says `pattern` is ECMAScript flavor without flags — identical to JSON Schema 2020-12. The regex-with-flags throw (Decision #11a in v0.3) applies here too.

11. **Runtime refinements throw**, same as v0.3. `UnsupportedNodeKindError({ kind: "runtimeRefinement", generator: "openApi" })`.

11a. **Regex with non-empty flags throws** with `kind: "regexFlags"`, same reasoning as v0.3.

### Validation harness

12. **`@redocly/openapi-core` for round-trip validation.** Each test:
    1. Compose a synthetic OpenAPI 3.1 document with the emitted component schema at `components.schemas.Subject`.
    2. Run Redocly's validator on the document.
    3. Assert zero validation errors.

    Alternative considered: `swagger-parser` (older, less actively maintained); the spec authors' own `openapi-types` (types only, no validator). Redocly is the closest to an authoritative validator that's actively maintained and tree-shakeable. **Recommendation: `@redocly/openapi-core`.**

## Invariants — phase-specific risk

All 8 invariants still apply. New v0.4 corollary to add to `INVARIANTS.md`:

> **v0.4 (OpenAPI 3.1):** Generated component schemas pass `@redocly/openapi-core` validation when composed into a synthetic OpenAPI 3.1 document. Drift from the spec means the round-trip test fails.

## Test strategy

- **Snapshot tests** per fixture (vitest `toMatchFileSnapshot`, external `.snap`).
- **Redocly round-trip tests** — every generated component schema is composed into a synthetic OpenAPI 3.1 doc and validated. Catches spec violations the snapshot can't (a schema can be JSON-valid but spec-invalid).
- **Throw tests** — same shape as v0.3 (assert on `code` / `kind` / `generator`), including the `regexFlags` case.
- **Example regenerate tests** — three new committed OpenAPI artifacts added to the existing `tests/examples/regenerate.test.ts`.

## Checklist pre-mapping

| Section | v0.4 strategy |
|---|---|
| **Scope** | Implementation PR titled `feat(schema): v0.4 candidate — OpenAPI 3.1 component generation`. Links this plan + ROADMAP v0.4 heading. |
| **Public API** | Two new exports (`generateOpenApiComponent`, `OpenApiGeneratorOptions`). Each justified in implementation PR body. |
| **Boundary** | No `@nekostack/*` imports. New devDep on `@redocly/openapi-core` declared. |
| **Contracts** | New contract doc `docs/OPENAPI_MAPPING.md` ships with the implementation PR. `INVARIANTS.md` extended with the Redocly-pass corollary. |
| **Immutability + determinism** | Generator is a pure function of IR. Canonical JSON. Determinism test. |
| **Tests** | Snapshots + Redocly round-trips + throw tests + example regenerate. |
| **Validation commands** | Same five (`test`, `typecheck`, `build`, `pack --dry-run`, `ls`). |
| **Local artifacts** | `docs/OPENAPI_MAPPING.md` (new contract doc). `docs/USAGE.md` extended with a `generateOpenApiComponent` section. `docs/EXAMPLES.md` extended with OpenAPI links. `docs/ROADMAP.md` v0.4 → candidate. |
| **Process** | Draft PR on `feat/schema-v0.4-candidate`. Ready-for-review only after self-audit walks the checklist clean. |
| **Milestone process (post-merge)** | Tag, release, CHANGELOG entry per `packages/schema/CHANGELOG.md`'s rule. `GENERATOR_VERSION` bumped to `@nekostack/schema@0.4.0`; snapshots regenerated. |

## Sequencing

Implementation lands on `feat/schema-v0.4-candidate` as reviewable commits:

1. Error class extension: `UnsupportedNodeKindError`'s `generator` field accepts `"openApi"`.
2. `openapi.ts` generator — primitives, refinements, absence modifiers, object policy. Cleanly mirrors `json-schema.ts` (Decision #3 Option A: parallel implementation, no shared core).
3. `openapi-meta.ts` if any OpenAPI-specific extension keys are needed beyond `x-nekostack`. (Likely empty in v0.4; create the file only if used.)
4. Throw paths (runtime refinements, regex flags, unsupported IR kinds).
5. Snapshot tests.
6. Redocly round-trip test harness + tests.
7. `docs/OPENAPI_MAPPING.md` (new contract doc).
8. Example regenerate test extended with three new OpenAPI artifacts.
9. `docs/USAGE.md` + `docs/EXAMPLES.md` extended.
10. `docs/ROADMAP.md` v0.4 → candidate.
11. `docs/INVARIANTS.md` extended with the Redocly-pass corollary.
12. `GENERATOR_VERSION` bump to `@nekostack/schema@0.4.0`; regenerate every snapshot.
13. `src/index.ts` update.

## Estimate

**2–4 focused days.** Smaller than v0.3 because:
- OpenAPI 3.1 component schemas are draft 2020-12 — most of the v0.3 generator's output is already valid.
- No new absence-semantics work; inherits directly from v0.3.
- No new contract surface (the throw / metadata / object-policy rules all carry over).

Risk areas:
- Redocly's validator may flag schema-level constructs that JSON Schema accepts but OpenAPI rejects (e.g., schema `$id` in component position). Catch these early via the round-trip tests.
- `format` values may need OpenAPI-specific tuning if Redocly is strict about names not in the OpenAPI registered-format list.

## What this plan does NOT decide

Deferred to later phases or future plan PRs:

- Full OpenAPI document generation (paths, operations) — `@nekostack/api`'s concern, when that package exists.
- OpenAPI 3.0 target — future generator option.
- `discriminator` keyword — requires union builders.
- `example` / `externalDocs` / `xml` keywords — no IR construct uses them yet.
- Cross-schema `$ref` extraction — v0.7 registry-lite.
- Plugin contract for third-party OpenAPI extensions — post-v1.0.

## Action requested from reviewer

- Approve / push back on the 12 decisions. Highest-stakes: **#1** (component fragment vs full doc), **#3** (parallel implementation vs shared core), **#5** (omit `$id` in component position), **#12** (Redocly choice).
- Flag any in-scope item that should be removed or any deferred item that should pull forward.
- Confirm `@redocly/openapi-core` is the right validator choice.

Once approved, implementation opens on `feat/schema-v0.4-candidate`.
