# Phase Plan: `@nekostack/schema` v0.3 — JSON Schema generation

> **PLAN only — no code in the PR that lands this doc.** Same discipline as v0.2 ([`PHASE_PLAN_v0.2.md`](./PHASE_PLAN_v0.2.md)).
>
> Reviewed against [`checklists/package/implementation-acceptance.md`](../../../checklists/package/implementation-acceptance.md). Once this plan is approved, the implementation candidate opens on `feat/schema-v0.3-candidate`.

## Phase scope

v0.3 adds one new generator + the IR pieces JSON Schema needs:

1. **`generateJsonSchema(node, options?) → string`** — emits a JSON Schema **draft 2020-12** document for the given `SchemaNode`. Returns canonical JSON (sorted keys, no trailing newline drift).
2. **Identity / `$id` strategy** — schemas with `metadata.id` get a deterministic `$id`. v0.3 emits **inline schemas only**; `$defs` extraction and `$ref` resolution are documented as a future strategy but **not implemented** in v0.3 (no IR construct needs them yet — recursive refs and cross-package refs both ship later).
3. **Semantic-loss metadata** — when a portable feature has no direct JSON Schema representation (e.g., a runtime refinement), the output emits `x-nekostack-*` extension keys flagging the gap rather than silently dropping it.
4. **Ajv-based self-conformance + execution tests** — generator output is compiled by Ajv's draft-2020-12 class (`ajv/dist/2020.js`) and run against NekoStack fixture matrices. We are not writing a validator; we are validating that our generator's output is itself a valid draft-2020-12 document and that it accepts/rejects fixtures per the IR's intent. (The official JSON Schema Test Suite is for validator conformance — Ajv is that validator, not us.)

## Explicit non-scope

- OpenAPI 3.1 generator — v0.4 (will reuse much of v0.3's mapping).
- Cross-package `$ref` resolution across a multi-package workspace — v0.7 (registry-lite).
- Schema migrations between versions — v0.8+.
- Runtime `parse` / `validate` — v0.6.
- CLI handlers — v0.7.
- Composition operators — v0.5.
- Generators for IR kinds without v0.1 builders (`DateNode`, `UnionNode`, `RecursiveRefNode`, `TransformNode`, runtime `Refinement`) — throw `UnsupportedNodeKindError({ kind, generator: "jsonSchema" })`. Same contract as v0.2.

## Public API delta

To be added to `src/index.ts`:

```ts
export { generateJsonSchema } from "./generators/json-schema.js";
export type { JsonSchemaGeneratorOptions } from "./generators/types.js";
```

That's it. Two new exports — one value, one type. The existing `UnsupportedNodeKindError` extends to accept `generator: "typescript" | "zod" | "jsonSchema"`.

## Internal file delta

```
packages/schema/src/
└── generators/
    ├── json-schema.ts        # the generator
    ├── json-schema-meta.ts   # x-nekostack-* extension key constants (codified contract)
    └── errors.ts             # extended: generator now includes "jsonSchema"
```

Tests:

```
packages/schema/tests/
└── generators/
    ├── json-schema.test.ts                 # snapshot tests per fixture
    ├── json-schema-ajv2020-self.test.ts    # ajv/dist/2020.js .addSchema() — output is valid draft 2020-12
    ├── json-schema-ajv2020-exec.test.ts    # ajv/dist/2020.js .compile() then run vs. fixtures
    └── __snapshots__/json-schema/          # external .snap files
```

Plus a new committed example:

```
packages/schema/examples/generated/
├── tenant.json.schema.json
├── audit-event.json.schema.json
└── entitlement.json.schema.json
```

These get added to [`tests/examples/regenerate.test.ts`](../tests/examples/regenerate.test.ts) so example drift fails CI, same as v0.2.

## Dependency delta

- **devDependency** added: `ajv ^8.12.0`. Tests import the draft-2020-12 class explicitly via `ajv/dist/2020.js` (not the default `ajv` entrypoint, which is draft-07 and is not backwards-compatible with 2020-12). Using the wrong entrypoint would silently configure Ajv for the wrong dialect — failing tests would then be telling us about Ajv's defaults, not our output.
- No new runtime dependency. JSON Schema output is a JSON string — no validator runs in `generateJsonSchema` itself.
- No new `@nekostack/*` deps. Boundary stays clean.

## Decisions to lock before coding

Twelve open decisions. The plan PR exists to resolve them — please weigh in inline. Several are non-obvious because JSON Schema's "absence semantics" (required arrays, nullable encoding, default as annotation-only) don't map 1:1 with our IR.

### Format + identity

1. **Draft target.** JSON Schema **draft 2020-12** only in v0.3. (Draft 2019-09 and earlier are out; they're widely supported but the 2020-12 changes around `$defs` / `unevaluatedProperties` are worth getting right from the start.)
2. **`$id` strategy for schemas with `metadata.id`.** Default is **URN-shaped**:

   ```
   urn:nekostack:schema:<metadata.id>:<metadata.version>
   ```

   URL-shaped IDs are opt-in via `JsonSchemaGeneratorOptions.idBase` — only when a consumer is intentionally hosting schemas at a real URL:

   ```ts
   generateJsonSchema(node, {
     idBase: "https://schemas.example.com",
   });
   // → $id: "https://schemas.example.com/<metadata.id>/<metadata.version>"
   ```

   Rationale: a URL-shaped `$id` implies a resolvable public namespace even if JSON Schema doesn't strictly require it to resolve. Until a NekoStack-owned schema host actually exists, defaulting to a `schemas.nekostack.dev` URL is presumptive. URN is a valid URI reference per RFC 8141 and a clean identifier choice for non-hosted schemas.
3. **`$id` for anonymous schemas (no `metadata.id`).** Don't emit `$id`. Inline. Don't auto-synthesize an id.
4. **`$defs` extraction — NOT implemented in v0.3.** The IR has no construct that needs extraction yet (no recursive refs, no cross-package refs). Implementing extraction logic + an empty `$defs: {}` block now would be unused scope. v0.3 emits **inline schemas only** and **never** emits a `$defs` key. When recursive-ref builders ship (or registry-backed `$ref` lands in v0.7), the strategy will be: every node referenced via `RecursiveRefNode` extracts to `$defs/<localName>` and gets a `$ref` at the use site. Documented here so the future implementer doesn't have to re-derive it; not built here.
5. **Cross-package `$ref` (`metadata.id` from another package).** Out of scope for v0.3 — registry-lite is v0.7. v0.3 inlines everything reachable from the root node.

### Absence semantics translation

JSON Schema doesn't have a TS-style `?:`. Absence is encoded via an object's `required: [...]` array plus type/`null` unions and `default` annotations. This is where most of the contract-survival work happens.

6. **`optional()` mapping.** Field is **omitted from** the parent object's `required` array. No `null` in the field's `type`. Behaviorally matches "missing OK, null rejected, value-type OK."
7. **`nullable()` mapping.** Field **stays in** the parent's `required` array. The field's `type` becomes `["<base>", "null"]` (draft 2020-12 supports the type-array form). Behaviorally matches "missing rejected, null OK, value-type OK."
8. **`nullish()` mapping.** Field is **omitted from** `required` AND its `type` includes `"null"`. Behaviorally matches "missing OK, null OK, value-type OK."
9. **`default()` mapping — input-validation only.** Field is **omitted from** `required` (so input-optional is honored). `default: <value>` is emitted as a JSON Schema **annotation** — JSON Schema validators do not apply defaults during validation, this is metadata only. The output also carries `x-nekostack-default-applied-by: "runtime"` so consumers know the default has to be applied by something else (the v0.6 runtime or the generated Zod).

   **v0.3 ships no `mode` option.** The JSON Schema models accepted input — the wire shape consumers send and validators check. The output-shape variant (default-applied, all fields required) is not representable as a single JSON Schema and is deferred until a concrete consumer needs it. If/when that lands, it'll be a separate option, not a forced split on every call.

   Worked example for a default-bearing field:

   ```json
   {
     "type": "string",
     "default": "member",
     "x-nekostack-default-applied-by": "runtime"
   }
   ```

   And the parent object's `required` array omits the field.

### Refinements

10. **Portable refinements → JSON Schema keywords.** Direct mapping table:

    | IR portable refinement | JSON Schema |
    |---|---|
    | `minLength` | `minLength` |
    | `maxLength` | `maxLength` |
    | `length` | `minLength` + `maxLength` (both set to value) |
    | `regex` (source, no flags) | `pattern` (direct mapping) |
    | `regex` (source + non-empty flags) | **throws** — see Decision #11a |
    | `email` | `format: "email"` |
    | `uuid` | `format: "uuid"` |
    | `url` | `format: "uri"` |
    | `int` | `type: "integer"` (note: changes the type itself, not a separate constraint) |
    | `min` (number) | `minimum` |
    | `max` (number) | `maximum` |
    | `gt` (number) | `exclusiveMinimum` |
    | `lt` (number) | `exclusiveMaximum` |
    | `multipleOf` | `multipleOf` |
    | `minItems` (array) | `minItems` |
    | `maxItems` (array) | `maxItems` |

11. **Runtime refinements.** Per Invariant 7 + v0.2 precedent, **throw `UnsupportedNodeKindError({ kind: "runtimeRefinement", generator: "jsonSchema" })`**. Same shape as v0.2. Do **not** silently emit a schema that omits the validation. Document in `docs/JSON_SCHEMA_MAPPING.md` (new — see "Local artifacts" below) that the v0.3 contract is "throw, not skip."

11a. **Regex with non-empty flags throws — for the same reason.** JSON Schema's `pattern` keyword is ECMAScript regex syntax *without flags*. Emitting `pattern: "abc"` for an IR refinement of `/abc/i` would change validation behavior (the IR accepts `"ABC"`; the emitted JSON Schema does not). That's semantic drift, not metadata loss, and Invariant 7 says fail loudly:

   ```ts
   throw new UnsupportedNodeKindError({
     kind: "regexFlags",
     generator: "jsonSchema",
   });
   ```

   Tests assert on `code` / `kind` / `generator` per the v0.2 contract. An opt-in lossy mode for regex flags can land later if a real consumer needs it.

### Object policy + miscellaneous

12. **Unknown-key policy → `additionalProperties`.**

    | IR `unknownKeys` | JSON Schema |
    |---|---|
    | `"strict"` | `additionalProperties: false` |
    | `"stripUnknown"` | `additionalProperties: true` *plus* `x-nekostack-strip: true` |
    | `"passthrough"` | `additionalProperties: true` |

    **Why `true`, not `false`, for `stripUnknown`:** the IR's `stripUnknown` policy means *input is allowed to carry unknown keys; the runtime strips them; the result is clean*. JSON Schema models accepted input. Emitting `additionalProperties: false` would make a JSON Schema validator **reject** inputs that `stripUnknown` is supposed to **accept** — that's `strict` behavior, not `strip`. The `x-nekostack-strip: true` extension tells NekoStack-aware consumers (runtime, CLI) that the unknown keys must be stripped before downstream code sees them. JSON Schema cannot express mutation, so the strip step lives in the runtime; the schema only describes what's accepted at the boundary.

## Invariants — phase-specific risk

All 8 invariants from [`docs/INVARIANTS.md`](./INVARIANTS.md) apply. Highest-risk for this phase:

| # | Invariant | Risk in v0.3 | Mitigation |
|---|---|---|---|
| 1 | IR is the only generator input | A generator that reaches into builder classes violates this | Function signature is `(node: SchemaNode, options?) => string`; no builder imports |
| 3 | Type inference follows the absence-semantics table | JSON Schema's `required` array vs. TS's `?:` makes drift easy | Decisions #6–#9 codified in `JSON_SCHEMA_MAPPING.md` + tested against the audit User example |
| 7 | Runtime-only semantics must be explicitly marked | A v0.3 generator that silently drops runtime refinements would lie to downstream consumers | Throw with stable shape; add `x-nekostack-*` annotations for any other semantic-loss case |

New v0.3 corollary to add to `INVARIANTS.md`: "Non-runtime generators must surface semantic loss via `x-nekostack-*` extension keys, never silently."

## Decisions deferred to v0.4+

These touch JSON Schema but only matter once OpenAPI lands:

- `nullable: true` vs. `type: ["x", "null"]` — OpenAPI 3.0 vs 3.1 disagree. v0.3 uses the 3.1 / draft-2020-12 form (`type` array). v0.4 will need to translate for OpenAPI 3.1 components specifically.
- `format` extensibility for custom keywords (e.g., `tenant-slug`) — Still-open decision from the original schema design audit. Defer.
- Discriminator metadata for discriminated unions — v0.4 / OpenAPI need it; v0.3 can wait since unions aren't buildable yet anyway.

## Test strategy

- **Snapshot tests** per IR fixture (vitest `toMatchFileSnapshot`, external `.snap`). Same pattern as v0.2.
- **Ajv2020 self-conformance tests** — every generated JSON Schema is loaded via Ajv's draft-2020-12 class (`import Ajv2020 from "ajv/dist/2020.js"`) and `addSchema()`-d. Catches "my output looks right but isn't actually valid draft-2020-12 JSON Schema." Using the default `import Ajv from "ajv"` (draft-07) would silently configure for the wrong dialect — don't.
- **Ajv2020 execution tests** — for each fixture, `compile()` the generated schema and run it against expected-pass and expected-fail inputs from the v0.2 absence-semantics matrix. Proves the generated JSON Schema accepts/rejects per the IR's intent (within JSON Schema's expressive limits).
- **Unsupported-kind throw tests** — assert on `code` / `kind` / `generator` fields per the v0.2 contract. Includes the new `kind: "regexFlags"` case from Decision #11a.
- **Example regenerate test** — three new committed JSON Schema artifacts (`tenant.json.schema.json`, `audit-event.json.schema.json`, `entitlement.json.schema.json`) added to the existing `tests/examples/regenerate.test.ts`.

The official [JSON Schema Test Suite](https://github.com/json-schema-org/JSON-Schema-Test-Suite) is **not** in scope. That suite is for validator conformance — Ajv is the validator we delegate to, not something we re-implement.

## Checklist pre-mapping

Walking [`checklists/package/implementation-acceptance.md`](../../../checklists/package/implementation-acceptance.md) in advance:

| Section | v0.3 strategy |
|---|---|
| **Scope** | Implementation PR titled `feat(schema): v0.3 candidate — JSON Schema generation`, links this plan + ROADMAP v0.3 heading. |
| **Public API** | Two new exports (`generateJsonSchema`, `JsonSchemaGeneratorOptions`). Each justified in implementation PR body. |
| **Boundary** | No `@nekostack/*` imports. New devDep on `ajv` (external) declared in `SCOPE.md`. |
| **Contracts** | New contract doc `docs/JSON_SCHEMA_MAPPING.md` ships with the implementation PR. `INVARIANTS.md` extended with one corollary: "Non-runtime generators must surface semantic loss via x-nekostack-* extension keys, never silently." |
| **Immutability + determinism** | Generator is a pure function of IR. Output is canonical JSON (sorted keys). Explicit determinism test. |
| **Tests** | Snapshots + Ajv self-conformance + Ajv execution + throw tests + example regenerate tests. |
| **Validation commands** | Same five (`test`, `typecheck`, `build`, `pack --dry-run`, `ls`). |
| **Local artifacts** | `docs/JSON_SCHEMA_MAPPING.md` (new contract doc). `docs/USAGE.md` extended with a `generateJsonSchema` section. `docs/EXAMPLES.md` extended with JSON Schema links. `docs/ROADMAP.md` v0.3 → candidate. |
| **Process** | Draft PR on `feat/schema-v0.3-candidate`. Ready-for-review only after self-audit walks the checklist clean. |
| **Milestone process (post-merge)** | Tag at the final commit of the milestone (implementation merge or dogfood merge if applicable). Release notes. CHANGELOG entry. Per [`packages/schema/CHANGELOG.md`](../CHANGELOG.md). |

## Sequencing

Implementation lands on `feat/schema-v0.3-candidate` as reviewable commits:

1. Error class extension: `UnsupportedNodeKindError`'s `generator` field accepts `"jsonSchema"`. `kind: "regexFlags"` becomes a valid value alongside `"runtimeRefinement"` and the existing IR kind names.
2. Generator skeleton: handles primitives (string / number / boolean / literal / enum) without refinements or absence modifiers — pure type mapping.
3. Generator + portable refinements (the mapping table from Decision #10). Includes the `regex`-with-flags throw (Decision #11a).
4. Generator + absence modifiers (Decisions #6–#9, **input-validation only — no `mode` option**) + object policy (Decision #12, including the corrected `stripUnknown` mapping).
5. Generator + identity (URN `$id` per Decision #2, with opt-in URL via `idBase`). No `$defs` work — inline schemas only per Decision #4.
6. Generator + runtime-refinement throw (Decision #11) and other semantic-loss `x-nekostack-*` extensions where needed.
7. Snapshot tests.
8. Ajv2020 self-conformance test harness + tests (`ajv/dist/2020.js`, not the default entrypoint).
9. Ajv2020 execution tests against the absence-semantics matrix.
10. `docs/JSON_SCHEMA_MAPPING.md` (new contract doc — encodes Decisions #6–#12 + the corrected `stripUnknown` rationale).
11. Example regenerate test extended with three new JSON Schema artifacts.
12. `docs/USAGE.md` + `docs/EXAMPLES.md` extended.
13. `docs/ROADMAP.md` v0.3 → candidate.
14. `docs/INVARIANTS.md` extended with the v0.3 corollary on semantic-loss extension keys.
15. `src/index.ts` update.

## Estimate

3–5 focused days. Lower than v0.2 because:
- Generator architecture is now familiar (third generator in this package).
- No runtime execution harness — Ajv handles that.
- Smaller decision matrix (no input/output mode in v0.3; only one mode).

Highest-risk step is probably #4 — the absence-semantics translation. The contract test against the audit User example is the gate.

## What this plan does NOT decide

Out-of-scope for this plan; deferred to later phases or future plan PRs:

- OpenAPI 3.1 generator shape (v0.4 plan).
- Cross-package `$ref` resolution and the registry that backs it (v0.7).
- The v0.7 CLI's `neko schema generate` behavior for JSON Schema output.
- Plugin contract for third-party generators (post-v1.0).
- An output-shape JSON Schema (default-applied, all fields required) — deferred indefinitely; no concrete consumer needs it yet.
- An opt-in lossy mode for regex with flags (`pattern` without flags + extension) — only added if a real consumer hits the wall.

## Decision history

- **v0.3-plan, initial draft** — 12 decisions, plan-only PR.
- **v0.3-plan, post-review amendment** — seven corrections per the JSON Schema audit:
  - **Ajv entrypoint** explicit — tests must use `ajv/dist/2020.js`, not the default draft-07 path.
  - **#2 ($id default)** changed from URL-shaped to URN-shaped; URL still available via `idBase` option. URL default presumed a NekoStack-owned schema host that doesn't exist.
  - **#4 ($defs)** removed from v0.3 implementation scope. No extraction, no empty `$defs: {}` block — inline schemas only. Strategy documented for the future implementer.
  - **#9 (default)** scope tightened: no `mode` option in v0.3. JSON Schema models accepted input; output-mode deferred until a concrete consumer exists.
  - **#11a (regex flags) added** — regex refinements with non-empty flags throw `UnsupportedNodeKindError({ kind: "regexFlags" })`. Emitting source-only `pattern` would change validation behavior, which is semantic drift, not metadata loss.
  - **#12 (stripUnknown)** mapping flipped: `additionalProperties: true` (not `false`) plus `x-nekostack-strip: true`. The `false` form was `strict` semantics in disguise — JSON Schema models accepted input, and `stripUnknown` is supposed to accept inputs with extras.
  - **Test strategy** dropped "official JSON Schema Test Suite" — that suite is for validator conformance; Ajv is the validator, not us. Replaced with explicit Ajv2020 self-conformance + execution test plan.

## Action requested from reviewer

- Final ack on the amended decisions.
- Flag any further in-scope item that should be removed or any v0.4+ item that should pull forward.

Once approved, implementation opens on `feat/schema-v0.3-candidate`.
