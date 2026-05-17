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
- `validate(schema, input): Result<TInput>` — pure structural check; does **not** apply defaults, does **not** run transforms (Invariant corollary v0.6). Returns the issues that would block a `parse`.

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
- **v0.6 semantic-parity tests** — same fixture validated four ways (NekoStack runtime, Ajv against the generated JSON Schema, Redocly against the generated OpenAPI component, hand-walked through the IR for a sanity bound). All four must agree on accept/reject for every fixture. This is the test that proves "the IR is the contract" beyond generator-output equivalence.

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
└── semantic-parity.test.ts        # the four-way parity matrix (NekoStack / Ajv / Redocly / IR walk)
```

## Dependency delta

- **`zod`** promoted from `peerDependencies` (optional) to `dependencies`. Version range stays `^3.22.0`; the v0.2 generator and the v0.6 runtime both target Zod 3.x.
- `peerDependencies` entry removed; `peerDependenciesMeta.zod` removed.
- No new dev dependencies.
- Ajv and `@redocly/openapi-core` stay as devDeps — they're test-side validators for the semantic-parity matrix, not user-visible.
- No `@nekostack/*` imports (Invariant 8).

## Decisions to lock before coding

Twenty decisions. The plan PR exists to resolve them. Highest-stakes flagged.

### API shape (highest stakes)

1. **`parse(schema, input)` throws `ParseError` with `issues: readonly Issue[]`.** Throwing is the friction-causing default; `safeParse` exists for callers that want Result. The throw shape carries the full issue list so handlers can `catch (e) { if (e instanceof ParseError) ... }` without re-running.

2. **`safeParse(schema, input)` returns `Result<s.output<S>>`** — same pipeline as `parse`, including default application and transform execution. Differs from `parse` only in surface (Result vs throw).

3. **`validate(schema, input)` returns `Result<s.input<S>>`** — `s.input<S>`, not `s.output<S>`, because validate does **not** apply defaults. A default-bearing field returned by `validate` reflects what was in the input (possibly absent); `parse` is the call that fills the default.

4. **`validate` does not run runtime refinements that have side-effects.** Portable refinements (min / max / regex / format) run because they're structural. Runtime-only refinements (the ones the v0.3 generator throws on) do NOT run in `validate` — they only run in `parse` / `safeParse`. Documented loss; matches the Invariant v0.6 corollary.

5. **All three functions are sync.** Async refinements / transforms land later.

### Engine + caching

6. **Internal engine is Zod 3.x.** Compiled via the v0.2 `generateZod` *as IR-walker logic*, not as string generation — the runtime engine reuses the per-node case logic that produces Zod calls, then executes the resulting Zod schema. (No `eval` of the v0.2 string output; that would be a security and source-map nightmare. The v0.2 generator can be refactored to emit Zod values directly, and the string-generator becomes a thin wrapper that converts the value to source.)

7. **Compiled Zod schemas are cached on a `WeakMap<SchemaNode, ZodSchema>`.** Same `SchemaNode` instance → same compiled Zod. Different instances with byte-identical IR do not share — explicit dedup via `irHash` (v0.2) is a v0.7 registry concern, not a runtime one.

8. **`validate` uses a defaults-stripped variant of the IR.** A `stripDefaultsForValidate(node)` helper walks the IR, drops `modifiers.default`, leaves everything else (`optional` / `nullable` / `nullish`) intact. The stripped IR is compiled to a separate cached Zod schema. **Important:** this is narrower than v0.5's `partial()`-strip, which also flips `optional`. The validate-time strip does NOT flip anything — a `default("x")` field becomes a plain required field for the purpose of structural validation. Required fields that are still absent → `missing_required`. (Decision #15 in v0.5 already established `default` ⇒ input-optional / output-required; stripping `default` alone for the validate path leaves a plain required input.)

   *Open question:* should the strip also flip a stripped-default field to `optional`? That would match v0.1's "input-optional" semantics — a default-bearing field accepts absence. Defaulting to **yes, flip to optional** in v0.6 keeps `validate(User, {})` from rejecting on a missing `name` whose default `User` would have filled. The strip therefore drops `default` AND sets `optional` on that field — but ONLY when there was a default to drop, and ONLY for the validate path. This is the more useful behavior for "is the input structurally acceptable?" Document this as Decision #8a; revisit if a real consumer reports the opposite preference.

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
| anything not listed above | `custom_refinement_failed` | last-resort; logged in test as "unmapped Zod code" |

13. **`Issue.expected` / `Issue.received` are populated when Zod provides them.** Verbatim from Zod, no re-serialization. `Issue.schemaId` / `Issue.schemaVersion` come from `schema.node.metadata` if present, regardless of which generator/runtime produced them.

14. **`Issue.severity` is always `"error"` in v0.6.** Warnings are a registry/diff concept (v0.7) — runtime validation either accepts or doesn't.

### Defaults + immutability

15. **`parse` applies defaults via Zod's `.default()` chain.** No double-application: the v0.2 generator already emits `.default(v)` at the end of the modifier chain, so the compiled Zod schema applies the default during parse exactly once. Zod's documented behavior here is the load-bearing guarantee.

16. **`parse` does not mutate its input.** The output is a new object even when no defaults applied. Zod's parse already satisfies this; documented so future engine swaps preserve the contract.

### Errors + observability

17. **`ParseError` carries `code: "parse_failed"` and `issues: readonly Issue[]`.** Parallel to `UnsupportedNodeKindError`'s stable `code` field. Tests assert on `.code` and `.issues[]`, not on `message` text.

18. **No internal logging or telemetry.** `@nekostack/log` and `@nekostack/telemetry` are consumers of issues, not producers of them. v0.6 is silent at the wire.

### Semantic parity

19. **Semantic-parity matrix covers every fixture used elsewhere in the test suite.** For each composed / hand-written schema in `tests/fixtures/`, the same input is validated four ways:
    - NekoStack runtime (`safeParse`)
    - Ajv 2020 against `generateJsonSchema(node)`
    - Redocly against `generateOpenApiSchemaComponent(node)` composed into a synthetic document
    - A trivial IR-walker test harness (`tests/helpers/ir-walk-validator.ts`) that handles only string / number / boolean / literal / enum / required-object — a "lowest common denominator" oracle that proves the IR has unambiguous semantics for the simple cases

    All four must agree on accept/reject for every fixture. Disagreement = bug, and the resolution rule is: **the IR is canonical**; the diverging engine is wrong. If Zod and Ajv disagree, the v0.2 / v0.3 generator that mis-translated is at fault.

20. **Semantic-parity tests are required for merge.** This is the load-bearing v0.6 test category — it's the proof that runtime validation actually completes the v0.1 promise.

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
- **`runtime-issue-normalize.test.ts`** — every row of the Decision #12 table proven by a fixture; an "unmapped Zod code" guard asserts the fallback works without crashing.
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
| **Boundary** | No `@nekostack/*` imports. Zod promoted to regular dep — this is the v0.6 engine ownership. Ajv / Redocly stay devDep (test-side validators). |
| **Contracts** | New contract doc `docs/RUNTIME.md` codifies the parse vs validate semantics, the issue-normalization table (Decision #12), and the cache invariance rule. `INVARIANTS.md` extended with three new v0.6 corollaries (issue normalization is the contract; cache invariance; engine swap-safe). `SCOPE.md` updated — "Runtime validation library implementation" row moves from "external (Zod — we will *generate*, not reimplement)" to "external Zod is the v0.6 internal engine; user-facing surface is `parse` / `safeParse` / `validate` from this package." `BOUNDARIES.md` updated per the Thesis-fit "BOUNDARIES rows touched" section. |
| **Immutability + determinism** | `parse` does not mutate input. Cache is keyed on `SchemaNode` identity. Compiled Zod is constructed from a deep-frozen IR (Invariant 6). |
| **Tests** | Seven new test files; ~90–110 new tests; four-way semantic-parity matrix is the load-bearing one. |
| **Validation commands** | Same five (`test`, `typecheck`, `build`, `pack --dry-run`, `ls`). |
| **Local artifacts** | New `docs/RUNTIME.md`. `docs/USAGE.md` extended with the three new functions and a "runtime validation: `@nekostack/schema` first, generated `_validator.ts` files as an opt-in" framing per the thesis. `docs/EXAMPLES.md` extended with at least one parse/validate example end-to-end. `docs/ROADMAP.md` v0.6 → candidate. `docs/SCOPE.md` row updated. `docs/INVARIANTS.md` extended with three corollaries. |
| **Process** | Draft PR on `feat/schema-v0.6-candidate`. Ready-for-review only after self-audit walks the four-audit checklist clean. |
| **Milestone process (post-merge)** | Tag + release + CHANGELOG entry per `packages/schema/CHANGELOG.md` rule. `GENERATOR_VERSION` bumped to `@nekostack/schema@0.6.0`; v0.2-style header snapshots regenerated for the runtime version line. `npm run status:generate` refreshed; status:check verified clean. |

## Sequencing

Implementation lands on `feat/schema-v0.6-candidate` as reviewable commits:

1. Refactor the v0.2 Zod generator to expose an internal `irToZodSchema(node): ZodSchema` value-producing function; the string generator becomes a thin wrapper. Tests for the existing string output stay byte-identical.
2. `src/runtime/compile.ts` — `WeakMap<SchemaNode, ZodSchema>` cache + `compile(node)` API.
3. `src/runtime/strip-defaults.ts` — IR transform for `validate`.
4. `src/runtime/normalize-issues.ts` — `ZodError → readonly Issue[]` per Decision #12 table.
5. `src/runtime/errors.ts` — `ParseError`.
6. `src/runtime/parse.ts` — `parse` / `safeParse` / `validate` entry points.
7. Tests in order: `runtime-issue-normalize` → `runtime-parse` → `runtime-validate` → `runtime-unknown-keys` → `runtime-default-semantics` → `runtime-compile-cache`.
8. `semantic-parity.test.ts` — the four-way matrix; runs Ajv and Redocly already configured from v0.3 / v0.4.
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

## Action requested from reviewer

- **Thesis-fit audit (new):** does the `## Thesis-fit` section answer the four questions clearly? In particular, is the "Zod-backed for v0.6, swap-safe for later" framing the right level of commitment, or should the doctrine bind harder ("pure IR-walker by v1.0")?
- **Decision #6** (refactor v0.2 generator to expose `irToZodSchema` value-producer) is the highest-risk implementation item — flag if the boundary should land differently (e.g., a separate `compileForRuntime(node)` function that doesn't refactor the existing generator at all).
- **Decision #8a** — the validate-time strip flips a stripped-default field to `optional`. Flag if the opposite ("validate keeps the field required even after stripping its default") is the more defensible reading of the v0.6 invariant corollary.
- **Decision #12** — the Zod → IssueCode mapping table. This is the one consumer-facing contract that's hardest to change later; review for fidelity to the v0.1 vocabulary intent.
- **Decision #19** — the four-way semantic-parity matrix as the load-bearing v0.6 test category. Flag if the fourth oracle (a trivial IR-walker) is overkill or under-spec.
- Confirm the **Zod runtime-dep promotion** (peer-optional → regular) is the right call. The alternative is to keep it as a hard peer (non-optional) and continue requiring the consumer to install it — that breaks the thesis but reduces NekoStack's transitive footprint.

Once approved, implementation opens on `feat/schema-v0.6-candidate`.
