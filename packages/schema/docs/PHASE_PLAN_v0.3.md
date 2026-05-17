# Phase Plan: `@nekostack/schema` v0.3 — JSON Schema generation

> **PLAN only — no code in the PR that lands this doc.** Same discipline as v0.2 ([`PHASE_PLAN_v0.2.md`](./PHASE_PLAN_v0.2.md)).
>
> Reviewed against [`checklists/package/implementation-acceptance.md`](../../../checklists/package/implementation-acceptance.md). Once this plan is approved, the implementation candidate opens on `feat/schema-v0.3-candidate`.

## Phase scope

v0.3 adds one new generator + the IR pieces JSON Schema needs:

1. **`generateJsonSchema(node, options?) → string`** — emits a JSON Schema **draft 2020-12** document for the given `SchemaNode`. Returns canonical JSON (sorted keys, no trailing newline drift).
2. **Identity / `$id` / `$defs` / `$ref` strategy** — schemas with `metadata.id` get a deterministic `$id`; nested named schemas extract to `$defs`; references resolve through the local registry conceptually (the real registry ships v0.7).
3. **Semantic-loss metadata** — when a portable feature has no direct JSON Schema representation (e.g., a runtime refinement), the output emits `x-nekostack-*` extension keys flagging the gap rather than silently dropping it.
4. **JSON Schema test-suite conformance** — the generator's output is validated against the official [JSON Schema Test Suite](https://github.com/json-schema-org/JSON-Schema-Test-Suite) for draft 2020-12 (or a curated subset relevant to our IR surface).

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
    ├── json-schema-conformance.test.ts     # validates output via Ajv (or similar)
    ├── json-schema-execution.test.ts       # validates fixtures via the generated schema
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

- **devDependency** added: `ajv ^8.12.0` (or comparable). Used by `json-schema-conformance.test.ts` to validate that the generator output is itself valid draft-2020-12 JSON Schema, and to run schema-against-fixture execution tests.
- No new runtime dependency. JSON Schema output is a JSON string — no validator runs in `generateJsonSchema` itself.
- No new `@nekostack/*` deps. Boundary stays clean.

## Decisions to lock before coding

Twelve open decisions. The plan PR exists to resolve them — please weigh in inline. Several are non-obvious because JSON Schema's "absence semantics" (required arrays, nullable encoding, default as annotation-only) don't map 1:1 with our IR.

### Format + identity

1. **Draft target.** JSON Schema **draft 2020-12** only in v0.3. (Draft 2019-09 and earlier are out; they're widely supported but the 2020-12 changes around `$defs` / `unevaluatedProperties` are worth getting right from the start.)
2. **`$id` strategy for schemas with `metadata.id`.**
   - **Option A (preferred):** `$id: "https://schemas.nekostack.dev/<reverse-dns-id>/<version>"` — embeds version, URL-shaped, future-CDN-friendly.
   - **Option B:** `$id: "urn:nekostack:<reverse-dns-id>:<version>"` — URN, doesn't imply a hostname.
   - **Option C:** `$id` = the literal `metadata.id` plus a query-string version — ugly.
   - Recommendation: **A**, with `https://schemas.nekostack.dev` as the canonical URL prefix (configurable via `JsonSchemaGeneratorOptions.idBase`).
3. **`$id` for anonymous schemas (no `metadata.id`).** Don't emit `$id`. Inline. Don't auto-synthesize an id.
4. **`$defs` extraction.** Currently the IR has no notion of "nested named schemas" because there are no recursive references in v0.1/v0.2. For v0.3, every named subschema referenced from the root via `RecursiveRefNode` would extract to `$defs/<localName>`. **Since v0.1/v0.2 don't ship `RecursiveRefNode` builders, v0.3 effectively never emits `$defs` either.** Plan: declare the strategy, defer the implementation to whenever recursive-ref builders ship. Output a `$defs: {}` block only if non-empty.
5. **Cross-package `$ref` (`metadata.id` from another package).** Out of scope for v0.3 — registry-lite is v0.7. v0.3 inlines everything reachable from the root node.

### Absence semantics translation

JSON Schema doesn't have a TS-style `?:`. Absence is encoded via an object's `required: [...]` array plus type/`null` unions and `default` annotations. This is where most of the contract-survival work happens.

6. **`optional()` mapping.** Field is **omitted from** the parent object's `required` array. No `null` in the field's `type`. Behaviorally matches "missing OK, null rejected, value-type OK."
7. **`nullable()` mapping.** Field **stays in** the parent's `required` array. The field's `type` becomes `["<base>", "null"]` (draft 2020-12 supports the type-array form). Behaviorally matches "missing rejected, null OK, value-type OK."
8. **`nullish()` mapping.** Field is **omitted from** `required` AND its `type` includes `"null"`. Behaviorally matches "missing OK, null OK, value-type OK."
9. **`default()` mapping.** Field is **omitted from** `required` (so input-optional is honored), `default: <value>` is emitted as **JSON Schema annotation** (not behavior — JSON Schema validators don't apply defaults). Add `x-nekostack-default-applied-by: "runtime"` so consumers know the default isn't applied by JSON Schema-level validation. **This is the asymmetry that doesn't survive cleanly to JSON Schema.** The output type *as JSON Schema sees it* matches `s.input<T>` (default-bearing field is optional, value type is the base). To match `s.output<T>` you'd need a separate `mode: "input" | "output"` like the TS generator has. **Recommendation: ship `mode: "input"` only in v0.3** (matches `s.input<T>`, matches how API request schemas typically work, matches the JSON Schema convention that `default` is metadata). Add `mode: "output"` later if a real consumer needs it.

### Refinements

10. **Portable refinements → JSON Schema keywords.** Direct mapping table:

    | IR portable refinement | JSON Schema |
    |---|---|
    | `minLength` | `minLength` |
    | `maxLength` | `maxLength` |
    | `length` | `minLength` + `maxLength` (both set to value) |
    | `regex` (source + flags) | `pattern` (source only — JSON Schema patterns are ECMAScript-syntax without flags; if the IR carries flags we emit a `x-nekostack-regex-flags` extension and write the pattern unflagged) |
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

### Object policy + miscellaneous

12. **Unknown-key policy → `additionalProperties`.**

    | IR `unknownKeys` | JSON Schema |
    |---|---|
    | `"strict"` | `additionalProperties: false` |
    | `"stripUnknown"` | `additionalProperties: false` *plus* `x-nekostack-strip: true` (JSON Schema can't *strip* — only reject; the extension flags that the runtime is expected to strip) |
    | `"passthrough"` | `additionalProperties: true` |

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
- **Self-conformance tests** (Ajv) — every generated JSON Schema is itself loaded by Ajv and validated as a valid draft-2020-12 document. Catches "my output looks right but isn't actually valid JSON Schema."
- **Execution tests** — for each fixture, compile the generated schema with Ajv and run it against expected-pass and expected-fail inputs from the v0.2 absence-semantics matrix. Proves the generated JSON Schema accepts/rejects per the IR's intent (within JSON-Schema's expressive limits).
- **Unsupported-kind throw tests** — assert on `code` / `kind` / `generator` fields per the v0.2 contract.
- **Example regenerate test** — three new committed JSON Schema artifacts (`tenant.json.schema.json`, `audit-event.json.schema.json`, `entitlement.json.schema.json`) added to the existing `tests/examples/regenerate.test.ts`.

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

1. Error class extension: `UnsupportedNodeKindError`'s `generator` field accepts `"jsonSchema"`.
2. Generator skeleton: handles primitives (string / number / boolean / literal / enum) without refinements or absence modifiers — pure type mapping.
3. Generator + portable refinements (the mapping table from Decision #10).
4. Generator + absence modifiers (Decisions #6–#9, `mode: "input"` only) + object policy (Decision #12).
5. Generator + identity (`$id` per Decision #2) + `$defs` skeleton (Decision #4 — empty in v0.3 absent recursive-ref builders).
6. Generator + semantic-loss metadata for runtime refinements (Decision #11 throws) and any other gaps.
7. Snapshot tests.
8. Ajv self-conformance test harness + tests.
9. Ajv execution tests against the absence-semantics matrix.
10. `docs/JSON_SCHEMA_MAPPING.md` (new contract doc).
11. Example regenerate test extended with three new JSON Schema artifacts.
12. `docs/USAGE.md` + `docs/EXAMPLES.md` extended.
13. `docs/ROADMAP.md` v0.3 → candidate.
14. `docs/INVARIANTS.md` extended with the v0.3 corollary.
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
- `mode: "output"` for JSON Schema — defer until a real consumer needs it.

## Action requested from reviewer

- Approve / push back on the 12 decisions above. Highest-stakes ones: #2 (`$id` URI shape), #9 (default + the asymmetry that JSON Schema can't represent), #11 (runtime refinements throw vs. emit-with-warning), #12 (`stripUnknown` representation).
- Flag any v0.3 scope item that should be removed or any v0.4+ item that should pull forward.
- Confirm `ajv` is the right dev-dep choice for self-conformance + execution tests (alternatives: `@cfworker/json-schema`, `hyperjump-jsv`, hand-rolled checks — but Ajv is the de-facto standard).

Once approved, implementation opens on `feat/schema-v0.3-candidate`.
