# Phase Plan: `@nekostack/schema` v0.6 — Runtime validation

> **PLAN only — no code in the PR that lands this doc.** Same discipline as v0.2 / v0.3 / v0.4 / v0.5.
>
> First phase planned under the four-audit gate in [`standards/package-development.md`](../../../standards/package-development.md). The `## Thesis-fit` section below is the new first gate; everything else mirrors v0.5's shape.
>
> Reviewed against [`checklists/package/implementation-acceptance.md`](../../../checklists/package/implementation-acceptance.md). Once approved, implementation opens on `feat/schema-v0.6-candidate`.

## Thesis-fit

> v0.6 makes runtime validation a NekoStack workflow. Zod may execute behind the curtain, but the user-facing contract is `@nekostack/schema`.

### Workflow absorbed

v0.6 absorbs the manual runtime-validation workflow where a user defines a schema, generates or writes a validator separately, imports Zod directly, calls `.parse()` / `.safeParse()`, translates Zod errors into project-specific issue objects, and manually keeps that behavior aligned with the schema IR. After v0.6, runtime validation is performed through `@nekostack/schema` directly — generated `_validator.ts` files become optional artifacts for users who want them, not the path of least resistance.

### User-facing verb / API

The user-facing surface is NekoStack-native:

- `parse(schema, input): TOutput` — full pipeline; applies defaults, runs portable refinements, enforces unknown-key policy; throws on failure.
- `safeParse(schema, input): Result<TOutput>` — same pipeline as `parse`; returns the v0.1 `Result<T>` instead of throwing.
- `validate(schema, input): Result<TInput>` — pure structural check; does **not** apply defaults, does **not** run transforms, does **not** execute runtime-only refinements (Invariant corollary v0.6). Returns the structural issues that would block parsing **before** normalization and default application — not necessarily every issue a full `parse` would surface.

Users do not need to import Zod, Ajv, or any generated validator file to perform runtime validation. The peer-dep optionality of Zod (`peerDependenciesMeta.zod.optional: true`) is removed: Zod becomes a regular runtime dependency of `@nekostack/schema` because it is the v0.6 internal engine, not a user-supplied substrate.

### Internal engine

v0.6 uses Zod as the runtime execution backend, reusing the v0.2 Zod generator to compile the IR into a Zod schema, then executing the Zod schema and normalizing its errors into the v0.1 `Issue` / `IssueCode` vocabulary. The Zod schema is built once per IR instance and cached on a `WeakMap` keyed on the `SchemaNode` so repeated calls do not recompile.

Zod is an implementation engine, not the product surface. The public contract is the NekoStack issue/result vocabulary, default-application behavior, unknown-key enforcement, and parse/validate semantics. If a future phase replaces the Zod-backed executor with a pure IR-walker runtime, the public API must not need to change.

### BOUNDARIES rows touched

In [`BOUNDARIES.md`](../../../BOUNDARIES.md) §7 ("Schema / types"), v0.6 implements:

- **Runtime validation execution** (currently rowed as "via generated Zod") — the row's parenthetical changes from "via generated Zod" to "via @nekostack/schema runtime; Zod is the internal engine."
- **Issue model + normalized `IssueCode` vocabulary** — declared in v0.1, finally consumed.
- **Result type for future parse/validate** — same.

v0.6 does **not** move:

- API request-body validation (still `@nekostack/api`, which consumes this).
- Form input validation (still `@nekostack/form`, which consumes this).
- Cross-record / continuity validation (still `@nekostack/validator`).
- CLI runtime (still `@nekostack/cli`, which orchestrates `neko schema *`).
- Schema registry / diff / freshness (still v0.7 — `neko schema check` consumes the v0.2 `irHash`).
- Schema migrations (still v0.8+).

## Why this phase exists

Every consumer of `@nekostack/schema` that does anything at runtime currently has to:

1. Call `generateZod(node)` (or generate it ahead of time as part of a build step).
2. Save the generated TypeScript and import it back.
3. Or import Zod directly and either eval the generated string or hand-translate the schema.
4. Run Zod against the input.
5. Translate `ZodError.issues[]` into whatever issue shape the application uses — every consumer reinventing the translation.
6. Decide independently when to apply defaults, how to strip vs. reject unknown keys, etc.

Steps 2–6 are exactly the "stitching" the [`PRODUCT_THESIS`](../../../PRODUCT_THESIS.md) says NekoStack absorbs. v0.6 collapses them into `parse` / `safeParse` / `validate`.

The downstream phases also need v0.6 directly:

- **`@nekostack/api`** v0.x — request-body validation is `safeParse(RequestSchema, req.body)`; the issue vocabulary maps cleanly to API error responses.
- **`@nekostack/form`** v0.x — form-field validation uses the same Issue vocabulary so server-side and client-side errors render through the same path.
- **`@nekostack/validator`** v0.x — content-shape validation calls `validate` repeatedly across record sets; the no-defaults / no-transforms semantics matters because validator is checking what's there, not normalizing it.
- **v0.6 semantic-parity tests** — same fixture validated four runtime ways: NekoStack runtime, generated-Zod execution, Ajv against generated JSON Schema, and a small IR-walker oracle. All four must agree on accept/reject for every fixture. This is the test that proves "the IR is the contract" beyond generator-output equivalence. Redocly remains a separate OpenAPI spec-validity check (Decision #19a), not a runtime input oracle.

## Phase scope

Three new public functions, the v0.1 `Result<T>` finally has a producer, and the unknown-key policy in the IR finally has teeth at runtime.

```ts
import { s, parse, safeParse, validate } from "@nekostack/schema";

const User = s.object({
  id: s.string(),
  name: s.string().default("anon"),
  age: s.number().optional(),
});

// parse: full pipeline; throws on failure.
const u = parse(User, { id: "u_1" });
// → { id: "u_1", name: "anon" }  // default applied

// safeParse: full pipeline; returns Result.
const r = safeParse(User, { id: 42 });
// → { success: false, issues: [{ code: "invalid_type", path: ["id"], ... }] }

// validate: structural check; NO defaults, NO transforms.
const v = validate(User, { id: "u_1" });
// → { success: true, data: { id: "u_1" } }   // NOTE: no `name: "anon"` filled
```

Unknown-key policy enforcement (all three modes get teeth):

```ts
const Strict = s.object({ id: s.string() });                          // default
const Open   = s.object({ id: s.string() }).passthrough();
const Clean  = s.object({ id: s.string() }).stripUnknown();

parse(Strict, { id: "x", extra: 1 });   // throws: issues[0].code === "unknown_key"
parse(Open,   { id: "x", extra: 1 });   // → { id: "x", extra: 1 }
parse(Clean,  { id: "x", extra: 1 });   // → { id: "x" }                (extra dropped)
```

## Explicit non-scope

- **Async refinements / async transforms.** v0.6 is sync only. Adding `parseAsync` / `validateAsync` is a future opt-in.
- **Transforms (data-shape mutation beyond default application).** The IR has `TransformNode` declared but no builder; runtime support waits for the builder.
- **Cross-package `$ref` resolution at parse time.** Single inline schema only. Cross-schema references arrive with registry-lite (v0.7).
- **Schema-version negotiation at runtime.** `parse` does not check `schema.metadata.version` against an "expected version" parameter. That's a registry concern (v0.7).
- **Custom error formatters.** v0.6 returns `Issue[]` as-is; a `formatIssues(issues, opts?)` UX helper can land later (v0.6.1 or v0.7) once real consumers report what shapes they actually want.
- **Partial / streaming validation** (validate-as-you-go for large inputs). Defer.
- **Localization of `Issue.message`.** v0.6 emits English messages; per-locale formatting goes through `@nekostack/locale` when that's wired up.
- **A `neko schema validate <file>` CLI.** CLI surfaces wait for `@nekostack/cli` integration in v0.7+.
- **Removing the v0.2 `generateZod` generator.** It stays — users who want to ship generated `_validator.ts` files for build-time pre-compilation still can. v0.6 changes the **default path of least resistance**, not the available toolset.
- **Performance benchmarks.** Documented as out-of-scope for v0.6; first benchmarks land at v1.0.
- **Removing the `peerDependency` declaration of Zod.** Zod moves from optional peer to regular runtime dependency. The peer entry is removed only because keeping it would imply consumer choice over a version range — which contradicts the engine ownership.

## Public API delta

```ts
// Three new functions exported from src/index.ts.
//
// All three accept any `AnySchema` (the v0.1 base-class union). The return
// type uses the v0.1 inference helpers — `s.input<S>` for validate (no
// defaults applied yet; matches the input keys) and `s.output<S>` for
// parse / safeParse (defaults applied; matches the output keys).

export function parse<S extends AnySchema>(
  schema: S,
  input: unknown,
): s.output<S>;

export function safeParse<S extends AnySchema>(
  schema: S,
  input: unknown,
): Result<s.output<S>>;

export function validate<S extends AnySchema>(
  schema: S,
  input: unknown,
): Result<s.input<S>>;

// One new error class, parallel to UnsupportedNodeKindError (v0.2). Thrown
// only by `parse` on validation failure. Carries the full issue list so
// callers that catch can still inspect.
export class ParseError extends Error {
  readonly code: "parse_failed";
  readonly issues: readonly Issue[];
  constructor(issues: readonly Issue[]);
}
```

That's it for public exports — three functions and one error class. No new types, no changes to the v0.1 `Issue` / `IssueCode` / `Result` exports.

## Internal file delta

```
packages/schema/src/
├── runtime/                       # NEW DIRECTORY — the runtime engine
│   ├── parse.ts                   # parse / safeParse / validate entry points
│   ├── compile.ts                 # IR → Zod schema cache (WeakMap on SchemaNode)
│   ├── strip-defaults.ts          # IR transform: drop `default` modifiers; used by `validate`
│   ├── normalize-issues.ts        # ZodError → readonly Issue[]
│   └── errors.ts                  # ParseError
├── builders/
│   └── ...                        # unchanged
└── errors/
    └── issue.ts                   # unchanged (already declared in v0.1)
```

Tests:

```
packages/schema/tests/
├── runtime-parse.test.ts          # parse / safeParse positive + negative paths
├── runtime-validate.test.ts       # validate: no defaults, no transforms
├── runtime-unknown-keys.test.ts   # strict / passthrough / stripUnknown all three
├── runtime-issue-normalize.test.ts # ZodError → Issue mapping table
├── runtime-default-semantics.test.ts # parse fills defaults; validate does not
├── runtime-compile-cache.test.ts  # same SchemaNode → same compiled Zod (WeakMap)
├── semantic-parity.test.ts        # the four-way parity matrix (Decision #19): NekoStack / generated-Zod / Ajv / IR-walker oracle
└── openapi-spec-validity.test.ts  # Decision #19a: emitted OpenAPI components stay spec-valid under Redocly
```

## Dependency delta

- **`zod`** promoted from `peerDependencies` (optional) to `dependencies`. Version range stays `^3.22.0`; the v0.2 generator and the v0.6 runtime both target Zod 3.x.
- `peerDependencies` entry removed; `peerDependenciesMeta.zod` removed.
- No new dev dependencies.
- **Ajv** stays as a devDep — runtime semantic-parity validator (Decision #19, oracle #3 against generated JSON Schema). Not user-visible.
- **`@redocly/openapi-core`** stays as a devDep — OpenAPI spec-validity validator only (Decision #19a). Used to compose emitted components into a synthetic OpenAPI 3.1 document and assert structural validity; **not** a runtime input oracle. Not user-visible.
- No `@nekostack/*` imports (Invariant 8).

## Decisions to lock before coding

Twenty-one decisions (numbered #1–#20 plus the inserted #8a and #19a from the round-2 amendment). The plan PR exists to resolve them. Highest-stakes flagged.

### API shape (highest stakes)

1. **`parse(schema, input)` throws `ParseError` with `issues: readonly Issue[]`.** Throwing is the friction-causing default; `safeParse` exists for callers that want Result. The throw shape carries the full issue list so handlers can `catch (e) { if (e instanceof ParseError) ... }` without re-running.

2. **`safeParse(schema, input)` returns `Result<s.output<S>>`** — same pipeline as `parse`, including default application and transform execution. Differs from `parse` only in surface (Result vs throw).

3. **`validate(schema, input)` returns `Result<s.input<S>>`** — `s.input<S>`, not `s.output<S>`, because validate does **not** apply defaults. A default-bearing field returned by `validate` reflects what was in the input (possibly absent); `parse` is the call that fills the default.

4. **`validate` does not run runtime refinements that have side-effects.** Portable refinements (min / max / regex / format) run because they're structural. Runtime-only refinements (the ones the v0.3 generator throws on) do NOT run in `validate` — they only run in `parse` / `safeParse`. Documented loss; matches the Invariant v0.6 corollary.

5. **All three functions are sync.** Async refinements / transforms land later.

### Engine + caching

6. **Internal engine is Zod 3.x. Shared semantic mapping, two consumers, no value-to-source conversion.**

   v0.6 extracts the shared IR traversal and modifier-ordering logic out of the v0.2 Zod generator into an internal Zod compilation module. The module has **two consumers** that share the semantic mapping but produce different artifact types:

   - **`generateZod(node): string`** — emits deterministic TypeScript source text (the v0.2 generator's existing job). All v0.2 snapshots remain byte-identical.
   - **`compileZodSchema(node): ZodSchema`** (alias `irToZodSchema`) — returns a live `ZodSchema` value for runtime `parse` / `safeParse` / `validate`.

   **Source generation and runtime compilation share the per-node semantic mapping — they do NOT share output objects.** The source generator must not stringify a live `ZodSchema` value, and the runtime compiler must not parse generated source. A live Zod object is not a reliable source-code AST; reverse-engineering one back into text would require chasing private fields and would break the moment Zod's internals shift. Two independent consumers of one shared mapping is the correct factoring; matches the v0.4 `emitSchemaFragment` extraction pattern in spirit.

   No `eval` of generated source anywhere. Security, source maps, and bundler behavior all stay clean.

7. **Compiled Zod schemas are cached on a `WeakMap<SchemaNode, ZodSchema>`.** Same `SchemaNode` instance → same compiled Zod. Different instances with byte-identical IR do not share — explicit dedup via `irHash` (v0.2) is a v0.7 registry concern, not a runtime one.

8. **`validate` compiles against a validate-specific IR variant.** A `stripDefaultsForValidate(node)` helper walks the IR and, for each default-bearing field:
   - drops `modifiers.default`
   - sets `modifiers.optional = true` for the validate-only IR variant
   - leaves `nullable` / `nullish` and every other field untouched

   The variant IR is compiled to a separate Zod schema and cached on its own `WeakMap` slot. `validate` does not fill the default value in the returned `data`; `parse` / `safeParse` do.

   **Rationale.** `validate` returns `Result<s.input<S>>`, not `s.output<S>`. Per v0.1 (Invariant 4 + the absence-semantics table), `default(v)` means **input-optional + output-required** — a missing default-bearing field is a valid input. So `validate` must accept the absence, and it must NOT silently fill the default (that's parse's job). The combined "strip default + flip to optional" is the only rule consistent with both halves of the absence-semantics contract for the validate path.

   **Locked example:**

   ```ts
   const User = s.object({ name: s.string().default("anon") });

   validate(User, {}).success === true;     // valid: name is input-optional
   validate(User, {}).data    === {};       // no fill; validate returns the input
   parse(User, {})            === { name: "anon" };  // fill applies
   safeParse(User, {})        === { success: true, data: { name: "anon" } };
   ```

   **Why this is narrower than v0.5's `partial()`-strip.** `partial()` strips defaults AND flips fields to optional permanently, in both the IR and the type. The v0.6 validate-time variant flips to optional **only inside the validate-compile cache** — the original `SchemaNode` is unchanged, `parse` still sees a default-bearing field, and the type-level shape that callers see (`s.input<S>`) is unaffected because input keys are already optional for default-bearing fields per v0.1.

9. **Compile happens lazily on first call per `SchemaNode`.** No precompilation at schema construction (which would change the v0.1 builder semantics).

### Unknown-key enforcement

10. **All three IR policies enforced at runtime.**
    - `strict` (default) → unknown keys produce `{ code: "unknown_key", path: [<keyName>] }`. `parse` throws via `ParseError`; `safeParse` / `validate` return the issue in the Result.
    - `passthrough` → unknown keys are preserved verbatim in the output. Their schema is `unknown` from TypeScript's perspective.
    - `stripUnknown` → unknown keys are dropped from the output. **In `validate`, stripUnknown still strips** — because `validate` returns `s.input<S>` which is the structural intent; the v0.3 JSON-Schema mapping documented "runtime does it" for strip, and v0.6 is the runtime.

11. **Issue path for unknown-key matches the offender's key, not the object's path.** I.e., on `s.object({ a: s.string() }, /* strict */)` validating `{ a: "ok", b: 1 }`, the issue path is `["b"]`, not `[]`. Same convention as Zod's `ZodIssue.path`.

### Issue normalization

12. **Map Zod issue codes to `IssueCode` per this table** (v0.6 implementation locks this; v1.0 freezes for downstream consumers):

| Zod issue code | NekoStack `IssueCode` | Notes |
|---|---|---|
| `invalid_type` (received: undefined, expected ≠ undefined) | `missing_required` | "field is absent" beats "field has wrong type" |
| `invalid_type` (other) | `invalid_type` | |
| `unrecognized_keys` | `unknown_key` | one issue per offending key (Zod batches; we split) |
| `invalid_literal` | `invalid_literal` | |
| `invalid_enum_value` | `invalid_enum` | |
| `invalid_union` | `invalid_union` | |
| `invalid_union_discriminator` | `invalid_union` | folded — v0.6 has no public discriminated-union surface |
| `invalid_arguments` / `invalid_return_type` | n/a | function schemas not in v0.6 scope; if Zod emits, surface as `invalid_type` with metadata |
| `too_small` (string min, array minLength) | `too_small` | |
| `too_big` | `too_big` | |
| `invalid_string` (format: email/url/uuid/regex) | `invalid_format` | |
| `invalid_date` | `invalid_type` | DateNode has no v0.6 builder; falls through |
| `custom` | `custom_refinement_failed` | |
| anything not listed above | `custom_refinement_failed` | last-resort; **must** populate `metadata.source = "zod"` and `metadata.zodCode = <original code>` so traceability is preserved. Tests assert the metadata is present for the fallback path. |

13. **`Issue.expected` / `Issue.received` are populated when Zod provides them.** Verbatim from Zod, no re-serialization. `Issue.schemaId` / `Issue.schemaVersion` come from `schema.node.metadata` if present, regardless of which generator/runtime produced them.

14. **`Issue.severity` is always `"error"` in v0.6.** Warnings are a registry/diff concept (v0.7) — runtime validation either accepts or doesn't.

### Defaults + immutability

15. **`parse` applies defaults via Zod's `.default()` chain.** No double-application: the v0.2 generator already emits `.default(v)` at the end of the modifier chain, so the compiled Zod schema applies the default during parse exactly once. Zod's documented behavior here is the load-bearing guarantee.

16. **`parse` does not mutate its input.** The output is a new object even when no defaults applied. Zod's parse already satisfies this; documented so future engine swaps preserve the contract.

### Errors + observability

17. **`ParseError` carries `code: "parse_failed"` and `issues: readonly Issue[]`.** Parallel to `UnsupportedNodeKindError`'s stable `code` field. Tests assert on `.code` and `.issues[]`, not on `message` text.

18. **No internal logging or telemetry.** `@nekostack/log` and `@nekostack/telemetry` are consumers of issues, not producers of them. v0.6 is silent at the wire.

### Semantic parity

19. **Semantic-parity matrix — four runtime input oracles.** For each composed / hand-written schema in `tests/fixtures/`, the same input is validated four ways and all four must agree on accept/reject:

    1. **NekoStack runtime** — `safeParse(schema, input)`.
    2. **Generated-Zod execution** — `generateZod(node)` emitted to source, the source compiled, the resulting Zod schema executed against the same input. This is the cross-check that proves the runtime compiler (Decision #6) and the source generator produce semantically equivalent validators.
    3. **Ajv 2020** — against `generateJsonSchema(node)`. The cross-format check; Ajv is the actively-maintained JSON Schema 2020-12 validator.
    4. **IR-walker oracle** — a deliberately small `tests/helpers/ir-walk-validator.ts` that handles only the subset of node kinds covered by v0.6 (string / number / boolean / literal / enum / object with required + optional + default + the three unknown-key policies). Lowest-common-denominator validator that proves the IR has unambiguous semantics for the simple cases independently of any external library.

    Disagreement = bug, and the resolution rule is: **the IR is canonical**; the diverging engine is wrong. If Zod and Ajv disagree, the v0.2 / v0.3 generator that mis-translated is at fault.

    **Redocly is NOT in this matrix.** Redocly validates the structural validity of OpenAPI documents and components — it is not a runtime input validator and cannot rule on whether `{...}` matches a component schema. It stays as a separate test category (see Decision #19a).

19a. **OpenAPI spec-validity check (separate from #19).** For each fixture, the OpenAPI component emitted by `generateOpenApiSchemaComponent(node)` must compose into a valid OpenAPI 3.1 document under `@redocly/openapi-core` (already configured in v0.4). This is the v0.4 round-trip check carried forward — it proves the OpenAPI generator's output stays spec-valid as the runtime work changes adjacent files. It does **not** participate in accept/reject parity for inputs.

20. **Semantic-parity tests (Decision #19) are required for merge.** This is the load-bearing v0.6 test category — it's the proof that runtime validation actually completes the v0.1 promise across NekoStack runtime + the generators' compiled equivalents.

## Invariants — phase-specific risk

All 8 invariants still apply. v0.6 invariant corollaries (some pre-existing in [`INVARIANTS.md`](./INVARIANTS.md), some new):

- **(pre-existing) v0.6 (runtime):** `validate(schema, input)` may not apply defaults or run transforms. `parse(schema, input)` does both. Anything else violates Invariant 3.
- **(new) v0.6 (issue normalization is the contract):** Downstream consumers depend on the `IssueCode` mapping in Decision #12. Changing a mapping in a later phase is a breaking change. Adding a new code requires going through the `ISSUE_CODES` change-control rule already documented in [`src/errors/issue.ts`](../src/errors/issue.ts).
- **(new) v0.6 (cache invariance):** A `SchemaNode` produces the same compiled Zod schema for the lifetime of the process. If a builder method ever mutated the underlying IR (which it cannot, per Invariant 6), the cache would silently serve stale validators — the cache invariance is downstream of immutability, and tests assert it.
- **(new) v0.6 (engine swap-safe):** No public API surfaces Zod types. Callers receive `Result<...>` / `s.output<S>` / `Issue[]` — never a `ZodSchema` or a `ZodError`. Future replacement of the engine must be a no-op for consumers.

## Test strategy

- **`runtime-parse.test.ts`** — positive paths (each builder kind), throw-on-failure for `parse`, Result-on-failure for `safeParse`, no-mutation of input.
- **`runtime-validate.test.ts`** — `validate` over the same fixtures as parse; asserts (a) no defaults applied, (b) optional / nullable / nullish flags respected per v0.1 absence semantics, (c) `Result.data` matches `s.input<S>` shape.
- **`runtime-unknown-keys.test.ts`** — strict throws / Result-issues with `code: "unknown_key"`; passthrough preserves the unknown key in the output; stripUnknown drops it. Each tested across all three entry points (`parse`, `safeParse`, `validate`).
- **`runtime-issue-normalize.test.ts`** — every row of the Decision #12 table proven by a fixture; the "unmapped Zod code" guard asserts (a) the fallback path does not crash, AND (b) the emitted `Issue.metadata` carries `source: "zod"` + `zodCode: <original>` so the original code is recoverable downstream.
- **`runtime-default-semantics.test.ts`** — the load-bearing test for `validate` vs `parse`: same default-bearing schema, same empty input, `parse` returns the default-filled output, `validate` returns the input shape unchanged.
- **`runtime-compile-cache.test.ts`** — repeated `parse(sameSchema, ...)` shares the compiled Zod (proven via a private hook exposing the cache, or via test-side instrumentation).
- **`semantic-parity.test.ts`** — the four-way matrix from Decision #19. Failure surfaces "which engines disagree" so the diagnosis is immediate.
- **No snapshot churn for v0.1–v0.5.** v0.6 is additive; existing tests must remain byte-identical.

Estimated test count delta: **+90–110 tests** (342 → ~430–450).

## Checklist pre-mapping

| Section | v0.6 strategy |
|---|---|
| **Thesis-fit** | The `## Thesis-fit` section above is the answer. The four questions are answered explicitly; the workflow absorbed, user-facing verb, internal engine, and BOUNDARIES rows touched are each named. |
| **Scope** | Implementation PR titled `feat(schema): v0.6 candidate — runtime validation`. Links this plan + ROADMAP v0.6 heading. |
| **Public API** | Three new functions (`parse`, `safeParse`, `validate`) + one error class (`ParseError`). No new types beyond what's already exported (`Issue` / `IssueCode` / `Result` are v0.1). |
| **Boundary** | No `@nekostack/*` imports. Zod promoted to regular dep — this is the v0.6 engine ownership. Ajv stays devDep (runtime semantic-parity validator per Decision #19); `@redocly/openapi-core` stays devDep (OpenAPI spec-validity only, Decision #19a — not a runtime input oracle). |
| **Contracts** | New contract doc `docs/RUNTIME.md` codifies the parse vs validate semantics, the issue-normalization table (Decision #12), and the cache invariance rule. `INVARIANTS.md` extended with three new v0.6 corollaries (issue normalization is the contract; cache invariance; engine swap-safe). `SCOPE.md` updated — "Runtime validation library implementation" row moves from "external (Zod — we will *generate*, not reimplement)" to "external Zod is the v0.6 internal engine; user-facing surface is `parse` / `safeParse` / `validate` from this package." `BOUNDARIES.md` updated per the Thesis-fit "BOUNDARIES rows touched" section. |
| **Immutability + determinism** | `parse` does not mutate input. Cache is keyed on `SchemaNode` identity. Compiled Zod is constructed from a deep-frozen IR (Invariant 6). |
| **Tests** | Eight new test files, including the runtime semantic-parity matrix (Decision #19) and the separate OpenAPI spec-validity carry-forward (Decision #19a); ~90–110 new tests; the four-way runtime parity matrix is the load-bearing one. |
| **Validation commands** | Same five (`test`, `typecheck`, `build`, `pack --dry-run`, `ls`). |
| **Local artifacts** | New `docs/RUNTIME.md`. `docs/USAGE.md` extended with the three new functions and a "runtime validation: `@nekostack/schema` first, generated `_validator.ts` files as an opt-in" framing per the thesis. `docs/EXAMPLES.md` extended with at least one parse/validate example end-to-end. `docs/ROADMAP.md` v0.6 → candidate. `docs/SCOPE.md` row updated. `docs/INVARIANTS.md` extended with three corollaries. |
| **Process** | Draft PR on `feat/schema-v0.6-candidate`. Ready-for-review only after self-audit walks the four-audit checklist clean. |
| **Milestone process (post-merge)** | Tag + release + CHANGELOG entry per `packages/schema/CHANGELOG.md` rule. `GENERATOR_VERSION` bumped to `@nekostack/schema@0.6.0`; v0.2-style header snapshots regenerated for the runtime version line. `npm run status:generate` refreshed; status:check verified clean. |

## Sequencing

Implementation lands on `feat/schema-v0.6-candidate` as reviewable commits:

1. Extract the v0.2 Zod generator's shared IR traversal / modifier-ordering logic into an internal Zod semantic-mapping module. Keep two consumers:
   - `generateZod(node): string` for deterministic TypeScript source output.
   - `compileZodSchema(node): ZodSchema` (alias `irToZodSchema(node)`) for live runtime execution.

   Existing v0.2 source snapshots must remain byte-identical. No value-to-source or source-to-value conversion in either direction. Per Decision #6.
2. `src/runtime/compile.ts` — `WeakMap<SchemaNode, ZodSchema>` cache + `compile(node)` API.
3. `src/runtime/strip-defaults.ts` — IR transform for `validate`.
4. `src/runtime/normalize-issues.ts` — `ZodError → readonly Issue[]` per Decision #12 table.
5. `src/runtime/errors.ts` — `ParseError`.
6. `src/runtime/parse.ts` — `parse` / `safeParse` / `validate` entry points.
7. Tests in order: `runtime-issue-normalize` → `runtime-parse` → `runtime-validate` → `runtime-unknown-keys` → `runtime-default-semantics` → `runtime-compile-cache`.
8. `semantic-parity.test.ts` — Decision #19's four-way runtime matrix: NekoStack runtime / generated-Zod execution / Ajv 2020 against generated JSON Schema / IR-walker oracle. Ajv is configured from v0.3.
8a. `openapi-spec-validity.test.ts` — Decision #19a: emitted OpenAPI components compose into a synthetic OpenAPI 3.1 document and pass `@redocly/openapi-core` structural validation. Carried forward from v0.4; runs Redocly only here.
9. `docs/RUNTIME.md` — contract doc.
10. `docs/USAGE.md` + `docs/EXAMPLES.md` extended.
11. `docs/SCOPE.md` row updated; `docs/INVARIANTS.md` corollaries added; `docs/ROADMAP.md` v0.6 → candidate.
12. `BOUNDARIES.md` row parenthetical updated per Thesis-fit.
13. `package.json` — Zod from peer-optional → regular dep; remove `peerDependenciesMeta.zod`.
14. `GENERATOR_VERSION` bump to `@nekostack/schema@0.6.0`; regenerate v0.2 header snapshots; verify `npm run status:check` stays clean (status:generate after merge as part of the release-follow-up PR, per the established pattern).
15. `src/index.ts` update — `parse`, `safeParse`, `validate`, `ParseError`.

## Estimate

**5–7 focused days.** Larger than v0.5 because:

- The Zod generator refactor (Sequencing #1) is a real refactor with byte-identical output requirement — small risk surface but it gates everything after.
- The four-way semantic-parity matrix is non-trivial test infrastructure (~30–40 tests, plus a small IR-walker oracle).
- The Decision #12 issue-normalization table needs a fixture per row.
- The validate-vs-parse split is a load-bearing semantic distinction that will likely surface 1–2 design clarifications during implementation.

Risk areas:

- **Decision #6 (refactor the v0.2 generator)** is the riskiest single item. Mitigation: keep the existing string generator behavior byte-identical, prove via the existing snapshot suite *before* writing any runtime code on top.
- **Decision #8a (strip-defaults + flip-to-optional for validate)** may need to be revisited once the first downstream consumer (likely `@nekostack/api`) lands. The chosen default favors "structural acceptance"; the opposite ("default-bearing fields are still required when defaults are off") is a coherent alternative.
- **Cache invariance and concurrent calls.** Node is single-threaded so the WeakMap is safe, but if a future worker-threads consumer shares a schema across threads, the cache becomes per-thread. Document this in `docs/RUNTIME.md`; no v0.6 mitigation needed.

## What this plan does NOT decide

- **Whether `validate` should also throw a sibling `ValidateError`.** Currently `validate` returns Result only (no throw counterpart). A `validateOrThrow` could land later if a consumer asks. Default: no — validate is the "no-throw structural check" intent.
- **Function-call ergonomics.** `parse(User, input)` is the current shape. A method-style `User.parse(input)` is more familiar to Zod-shaped users; this could be added as a thin alias later (`Schema.prototype.parse` / `.safeParse` / `.validate`). v0.6 ships the free functions only; the method aliases can land in v0.6.1 without breaking anything.
- **Schema-version negotiation.** v0.7 registry concern.
- **`schemaId` / `schemaVersion` auto-population on every issue.** v0.6 populates these from `schema.metadata` when present; consumers that want them everywhere should set metadata explicitly. A registry could auto-fill in v0.7.
- **Error message localization.** v0.6 English only; `@nekostack/locale` integration deferred.

## Decision history

- **v0.6-plan, initial draft** — 20 decisions, plan-only PR. First phase planned under the four-audit gate in `standards/package-development.md` (thesis-fit is the new first gate). Thesis-fit section authored using the reviewer-supplied framing: "v0.6 makes runtime validation a NekoStack workflow. Zod may execute behind the curtain, but the user-facing contract is `@nekostack/schema`."

- **v0.6-plan, round-2 amendment** — four corrections after the first audit pass. Decision count grows to 21 (the new #19a).
  - **Decision #6 rewritten.** The original phrasing implied the v0.2 string generator could become a wrapper that stringifies a live `ZodSchema` value — wrong abstraction; a live Zod object is not a reliable source-code AST. New phrasing: shared internal Zod-compilation module with **two consumers** (`generateZod(node): string` and `compileZodSchema(node): ZodSchema`), shared semantic mapping, no value-to-source conversion in either direction. Matches the v0.4 `emitSchemaFragment` extraction pattern.
  - **Decision #8a made definitive.** The "open question" framing is removed. The validate-time IR variant **strips `default` AND sets `optional = true`** for the affected fields, ONLY inside the validate-compile cache (the original `SchemaNode` is unchanged). Rationale locked: `validate` returns `Result<s.input<S>>`; v0.1's `default(v)` is input-optional + output-required; the combined strip is the only rule that respects both halves. Worked example added showing `validate(User, {}) → { success: true, data: {} }` vs `parse(User, {}) → { name: "anon" }`.
  - **Decision #19 corrected.** Redocly is not a runtime input oracle — it validates OpenAPI document/component structure, not arbitrary inputs against the component schema. The four-way matrix is now: NekoStack runtime / generated-Zod execution (proves the runtime compiler matches the source generator) / Ajv 2020 against generated JSON Schema / IR-walker oracle. The OpenAPI spec-validity check (the carried-forward v0.4 Redocly round-trip) becomes the separate **Decision #19a** with its own test file (`openapi-spec-validity.test.ts`).
  - **Wording cleanup on `validate`.** Removed the overclaim that `validate` returns "the issues that would block a `parse`" — `validate` skips runtime-only refinements (per the v0.6 invariant corollary), so it cannot universally return every `parse`-blocking issue. New phrasing: "structural issues that would block parsing before normalization and default application — not necessarily every issue a full `parse` would surface."
  - **Decision #12 fallback row tightened.** Unmapped Zod codes still map to `custom_refinement_failed`, but **must** populate `metadata.source = "zod"` and `metadata.zodCode = <original>` so the original code is recoverable downstream. The `runtime-issue-normalize.test.ts` description updated to assert this.

  Knock-on changes:
  - Internal file delta now includes the shared Zod-compilation module (the existing `src/generators/zod.ts` refactor is implicit in Sequencing #1).
  - `tests/` listing now includes both `semantic-parity.test.ts` AND `openapi-spec-validity.test.ts`.
  - Decision count grows from 20 to 21 (the new #19a sits between #19 and #20).

## Action requested from reviewer

Post-round-2 amendment, the remaining open items are narrower:

- **Thesis-fit audit (new gate):** confirm the `## Thesis-fit` section reads cleanly under the four-question rubric, especially the "Zod-backed for v0.6, swap-safe for later" commitment level.
- **Decision #6 (round-2):** the two-consumer shared-mapping framing replaces the prior "value → source" implication. Confirm the shape — `generateZod(node): string` + `compileZodSchema(node): ZodSchema`, sharing the per-node semantic mapping, with no cross-conversion — is the right factoring.
- **Decision #8a (now definitive):** the validate-time variant strips `default` AND sets `optional = true`, only inside the validate-compile cache, with the locked example. Confirm this matches the v0.1 absence-semantics reading and is not a quiet behavior change for any consumer the audit anticipates.
- **Decision #12 (round-2):** the unmapped-Zod-code fallback now requires `metadata.source = "zod"` and `metadata.zodCode = <original>`. Confirm the metadata key names are the ones we want consumers to depend on long-term.
- **Decision #19 + #19a (round-2):** the four-way runtime matrix excludes Redocly (correct — Redocly is not a runtime input oracle) and replaces it with generated-Zod execution as the cross-check between the runtime compiler and the source generator. Redocly stays as the v0.4 spec-validity carry-forward in its own test file. Confirm the four-oracle composition + the separate spec-validity check are the right shape.
- **Zod runtime-dep promotion** (peer-optional → regular): unchanged from round-1. Confirm, or flag if you'd prefer a hard non-optional peer instead (trades thesis-fit for a smaller transitive footprint).

Once approved, implementation opens on `feat/schema-v0.6-candidate`.
