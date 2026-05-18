# Runtime Validation

> The v0.6 runtime API for `@nekostack/schema`. Defines what `parse` / `safeParse` / `validate` do, how their output relates to a schema's input vs. output type, what the issue contract is, and where Zod fits inside the wrapper. For the v0.1 absence-semantics table this doc references, see [`ABSENCE_SEMANTICS.md`](./ABSENCE_SEMANTICS.md). For the locked phase plan, see [`PHASE_PLAN_v0.6.md`](./PHASE_PLAN_v0.6.md).

## Purpose

v0.6 makes runtime validation a NekoStack-owned workflow. A consumer never imports Zod for validation; they import `@nekostack/schema`, define a schema once via `s.*`, and use `parse` / `safeParse` / `validate` against it. Zod executes behind the wrapper, but the consumer's vocabulary is `Schema<I, O>`, `Result<T>`, `Issue[]`, `ParseError` — not `ZodSchema`, `ZodError`, or a Zod issue code.

This is the [thesis-fit](../../../PRODUCT_THESIS.md) lens applied to validation: the package absorbs the workflow, not just adapts an external tool.

## Public API

```ts
import { s, parse, safeParse, validate, ParseError } from "@nekostack/schema";
import type { Result, Issue } from "@nekostack/schema";

declare const User: ReturnType<typeof s.object>;

parse(User, input);      // s.output<typeof User>            (throws ParseError)
safeParse(User, input);  // Result<s.output<typeof User>>
validate(User, input);   // Result<s.input<typeof User>>
```

Three free functions, one error class. The schema-as-first-arg shape is deliberate — it keeps every entry point a plain function so it composes with any wiring layer (HTTP handlers, form validators, agent tool implementations) without becoming method-bound to a class.

## `parse`

```ts
function parse<S>(schema: S, input: unknown): s.output<S>
```

- Throws [`ParseError`](#parseerror) on failure. The thrown error carries the full normalized `Issue` list.
- Uses **output semantics**: the return type matches `s.output<S>`. Default values are filled before the value is returned.
- Use when the caller doesn't have a meaningful "what to do on failure" branch — `parse` is the friction-causing default; failure is loud.

```ts
const User = s.object({ name: s.string().default("anon") });
parse(User, {});            // → { name: "anon" }
parse(User, { name: 42 });  // throws ParseError([{ code: "invalid_type", path: ["name"], ... }])
```

## `safeParse`

```ts
function safeParse<S>(schema: S, input: unknown): Result<s.output<S>>
```

- Never throws. Returns `{ success: true, data }` or `{ success: false, issues }`.
- Same output semantics + default-fill behavior as `parse`. Differs only in the error mode.
- Use when the caller wants to inline-branch on success/failure.

```ts
const r = safeParse(User, {});
if (r.success) {
  r.data.name; // "anon"
} else {
  r.issues.forEach((i) => console.log(i.code, i.path));
}
```

## `validate`

```ts
function validate<S>(schema: S, input: unknown): Result<s.input<S>>
```

- Structural check. Returns `Result<s.input<S>>`.
- Uses **input semantics**: the return type is the *input* shape — default-bearing fields are object-optional in Input but object-required in Output (see [`ABSENCE_SEMANTICS.md`](./ABSENCE_SEMANTICS.md)).
- Does **not** apply defaults. Does **not** run transforms.
- **Still runs portable refinements** — `min` / `max` / `regex` / `email` / `int` / etc. are all enforced.
- Use when the caller wants to know whether the input would pass a `parse` *without* paying for transforms or accepting a default-filled object.

```ts
const User = s.object({ name: s.string().min(3).default("anon") });
validate(User, {});            // → { success: true, data: {} }            (no fill; absent is valid)
validate(User, { name: "rin" });// → { success: true, data: { name: "rin" }} (passes through)
validate(User, { name: "ab" }); // → { success: false, issues: [{ code: "too_small", ... }] } (refinement still runs)
```

The split between `parse` and `validate` is the v0.6-locked Decision #8 read of the v0.1 absence-semantics table — see [Validate-only IR variant](#validate-only-ir-variant) below for how it is realized internally.

## Default semantics

A field declared with `.default(v)` is **input-optional, output-required** (v0.1 Invariant 4):

| Entry point | Missing default-bearing field | Explicit value |
|---|---|---|
| `parse(schema, input)` | fills `v` in output | passed through |
| `safeParse(schema, input)` | fills `v` in `data` on success | passed through |
| `validate(schema, input)` | accepted; **not filled**; absent in returned data | passed through |

`null` is **not** equivalent to "missing." `default(v)` does not imply `nullable`; `null` on a non-nullable default-bearing field is rejected by all three entry points. To accept both null and missing, chain `.nullable().default(v)`.

## Unknown-key policies

Every object has an explicit policy. The compile path realizes the policy directly into the underlying Zod schema; behavior is identical across `parse` / `safeParse` / `validate`.

| Policy | `parse` / `safeParse` | `validate` |
|---|---|---|
| `strict` (default) | rejects with one `unknown_key` issue per offending key | rejects with `unknown_key` issues |
| `passthrough` | accepts; **preserves** unknown keys in returned data | accepts; preserves |
| `stripUnknown` | accepts; **drops** unknown keys from returned data | accepts; drops |

Zod batches all offending keys into a single `unrecognized_keys` issue; the issue-normalization layer splits them so one `unknown_key` lands per key. Per-emitted path is `[...originalPath, key]`.

Nested objects each carry their own policy. An outer-strict + inner-passthrough composition is legal; each level enforces its own rule independently.

## Issue normalization

The runtime never surfaces a `ZodError`. Every failure path produces a `readonly Issue[]` using NekoStack's stable [`IssueCode`](../src/errors/issue.ts) vocabulary, per Decision #12:

| Zod issue code | NekoStack `IssueCode` | Notes |
|---|---|---|
| `invalid_type` (received `undefined`, expected ≠ undefined) | `missing_required` | "field is absent" beats "field has wrong type" |
| `invalid_type` (other) | `invalid_type` | |
| `unrecognized_keys` | `unknown_key` | one issue per key (Zod batches, the normalizer splits) |
| `invalid_literal` | `invalid_literal` | `expected` / `received` preserved |
| `invalid_enum_value` | `invalid_enum` | `expected` carries the option list |
| `invalid_union` / `invalid_union_discriminator` | `invalid_union` | discriminator folded — no v0.6 public surface |
| `invalid_arguments` / `invalid_return_type` | `invalid_type` | + `metadata.source = "zod"`, `metadata.zodCode = <original>` |
| `too_small` | `too_small` | + constraint metadata (`minimum`, `inclusive`, `exact`, `type`) |
| `too_big` | `too_big` | + constraint metadata (`maximum`, `inclusive`, `exact`, `type`) |
| `invalid_string` | `invalid_format` | + `metadata.validation` (`"email"` / `"url"` / `"uuid"` / `"regex"` / …) |
| `invalid_date` | `invalid_type` | DateNode has no v0.6 builder |
| `custom` | `custom_refinement_failed` | |
| **anything else** | `custom_refinement_failed` | + `metadata.source = "zod"`, `metadata.zodCode = <original>` |

The last row is the **fallback contract** (Decision #12 round-2): adding a new Zod code in a future Zod release must not crash the normalizer. `metadata.source` is the discriminator consumers key off; `metadata.zodCode` is what they use for triage.

Every emitted `Issue` also carries:

- `path` — Zod path, copied (not referenced — defensive against Zod array mutation).
- `message` — Zod's human message, verbatim.
- `expected` / `received` — verbatim where Zod provides them.
- `schemaId` / `schemaVersion` — copied from `schema.metadata` when present; omitted when absent.
- `severity: "error"` — always, in v0.6. The `"warning"` channel is reserved for later.

## `ParseError`

```ts
class ParseError extends Error {
  readonly code: "parse_failed";
  readonly issues: readonly Issue[];
}
```

- Thrown only by `parse`. `safeParse` and `validate` return `Result` and never throw.
- The `issues` array is a defensive copy and frozen — mutating it post-construction has no effect.
- `name` is `"ParseError"` so `e.name === "ParseError"` works for non-`instanceof` discrimination.
- `code === "parse_failed"` is the stable literal for switching. **Don't** depend on `message` — it's human-readable but not part of the contract.

```ts
try {
  parse(User, input);
} catch (e) {
  if (e instanceof ParseError) {
    for (const i of e.issues) handle(i);
  } else {
    throw e;
  }
}
```

## Internal engine

Zod is the **internal execution engine** for v0.6. It is not part of the user-facing surface:

- A consumer of `@nekostack/schema` does **not** import Zod.
- The runtime API accepts NekoStack `Schema` builders, not `ZodSchema` instances.
- `parse` / `safeParse` / `validate` return NekoStack types (`Result`, `Issue`, `ParseError`) — never a `ZodError`.
- A future runtime that replaces Zod with a pure IR-walker engine **must** be a no-op for consumers.

This is the thesis-fit boundary applied to engines: the wrapper has absorbed the workflow. If a consumer needs to know which engine is underneath to use the package correctly, the wrapper is leaking — that's a regression, not a feature.

Under the hood, two consumers share one **semantic mapping** (Decision #6, [`ZOD_MODIFIER_ORDERING.md`](./ZOD_MODIFIER_ORDERING.md)):

```
src/generators/zod-mapping.ts        # shared semantic mapping
       │                               (IR traversal + v0.2 modifier
       │                                ordering; ZodEmitter<T> + emit<T>())
       │
       ├─→ src/generators/zod.ts            (ZodEmitter<string>)
       │                                    (deterministic TS source —
       │                                     used by the generator pipeline)
       │
       └─→ src/runtime/zod-compile.ts       (ZodEmitter<ZodTypeAny>)
                                            (live runtime value —
                                             used by the cache below)
```

No `eval` of generated source. No source-to-value parsing. No value-to-source serialization. Each consumer realizes the mapping independently in its own concrete output type.

## Compile cache

```
src/runtime/compile.ts:
  const cache = new WeakMap<SchemaNode, ZodTypeAny>();
```

- Cache key is **`SchemaNode` object identity**, not IR equality.
- First call per `SchemaNode`: build the live Zod schema via the value consumer, store in the cache.
- Subsequent calls with the same `SchemaNode`: return the cached `ZodTypeAny` reference.
- Two distinct `SchemaNode` instances with byte-identical IR do **not** share — explicit dedup via `irHash` (v0.2) is a v0.7 registry concern, not a runtime concern.
- Lazy: schemas defined but never validated never compile.
- The IR is deep-frozen by the builder, so storing the live Zod schema next to its key is safe — the IR cannot mutate out from under the cached value.
- `WeakMap` lets the entire `(node, compiled)` pair be garbage-collected when the consumer drops its reference to the schema.

**Concurrency.** Node is single-threaded; first-call wins by default and there's no race. A future worker-threads consumer that shares a `SchemaNode` across threads will get a per-thread cache. Documented here; no v0.6 mitigation.

## Validate-only IR variant

`validate` cannot simply reuse the parse-time compiled Zod, because the parse-time schema fills defaults and the validate contract says it must not. Decision #8 is the resolution:

- For every default-bearing field, drop `modifiers.default` and set `modifiers.optional = true`.
- Keep `nullable` / `nullish`, refinements, metadata, and the `unknownKeys` policy.
- Recurse through object fields and array elements.

The transform lives in `src/runtime/strip-defaults.ts`. The variant is **not** the same `SchemaNode` as the original — the compile cache keys on identity, so the variant lands in its own cache slot automatically.

To keep `validate` cache-friendly, `src/runtime/parse.ts` adds a second `WeakMap`:

```
src/runtime/parse.ts:
  const validateNodeCache = new WeakMap<SchemaNode, SchemaNode>();
```

- Cache key: the **original** `SchemaNode` (the one the consumer wrote).
- Cache value: the stripped variant tree.
- First `validate` call per schema: strip once, cache the variant. Repeated `validate(sameSchema, ...)` calls reuse the variant and therefore the same compiled Zod.

**Issue normalization for `validate` is passed the original `schema.node`**, never the variant — so `schemaId` / `schemaVersion` always come from the consumer-authored metadata regardless of which compile path produced the failure.

## Semantic parity

The runtime is cross-checked against three independent engines (Decision #19), live in [`tests/semantic-parity.test.ts`](../tests/semantic-parity.test.ts):

1. **NekoStack runtime** — `safeParse(schema, input).success`.
2. **Generated-Zod execution** — emit source via `generateZod(schema.node)`, load + execute the emitted const expression with a real Zod runtime, call its `.safeParse(input)`. Explicitly **not** `compileZodSchema(...)` — the point is to cross-check the v0.2 source generator and the v0.6 runtime compiler.
3. **Ajv 2020** — compile the output of `generateJsonSchema(schema.node)` and run the validator.
4. **Small IR-walker oracle** — a direct interpreter over `SchemaNode` for the v0.6 supported subset. Knows nothing about Zod or JSON Schema.

Compare-only contract: **accept/reject**. Issue shapes are intentionally not compared across engines.

Redocly's role is separate (Decision #19a): [`tests/runtime-openapi-spec-validity.test.ts`](../tests/runtime-openapi-spec-validity.test.ts) verifies that every runtime-supported schema still emits an OpenAPI 3.1 component that passes structural validation. Redocly is **not** a runtime input oracle; treating it as one was the round-2 audit correction.

## Unsupported behavior

The v0.6 runtime supports the same IR subset the v0.2 generators cover:

| Kind / feature | Status |
|---|---|
| `string` / `number` / `boolean` / `literal` / `enum` / `array` / `object` | supported |
| `optional` / `nullable` / `nullish` / `default` modifiers | supported |
| Portable refinements (`minLength`, `maxLength`, `length`, `regex`, `email`, `uuid`, `url`, `int`, `min`, `max`, `gt`, `lt`, `multipleOf`, `minItems`, `maxItems`) | supported |
| `date` IR | **throws `UnsupportedNodeKindError`** at compile time |
| `union` IR | **throws** at compile time |
| `recursiveRef` IR | **throws** at compile time |
| `transform` IR | **throws** at compile time |
| Runtime refinements (`{ kind: "runtime", ... }`) | **throws** at compile time (Invariant 7 — fail loudly, never silently drop) |
| Regex with non-empty flags in `generateJsonSchema` | throws (JSON Schema's `pattern` has no flag support); the runtime path itself supports flags |

The throws are intentional. Silently dropping a runtime refinement would compile a validator that accepts inputs the IR intends to reject — exactly the kind of subtle data-loss bug the package exists to prevent.

## Non-goals

- **`ValidateError` to mirror `ParseError`.** `validate` returns `Result` only in v0.6. A `validateOrThrow` companion may land later if a consumer asks; the absence is intentional, not an oversight.
- **Method-style API (`schema.parse(input)`).** v0.6 ships the free functions. A `Schema.prototype.parse` alias could be added in a v0.6.x without breaking anything; the locked surface is the free-function form.
- **Schema-version negotiation.** Cross-version compatibility checks are a v0.7 registry concern.
- **Error message localization.** v0.6 surfaces Zod's English messages verbatim; `@nekostack/locale` integration is deferred.
- **`schemaId` / `schemaVersion` auto-population on every issue.** v0.6 populates these from `schema.metadata` when present; consumers that want them everywhere set the metadata. A registry could auto-fill in v0.7.
- **Worker-thread shared cache.** Per-thread caches are the v0.6 behavior; sharing across threads is a future concern.

## See also

- [`ABSENCE_SEMANTICS.md`](./ABSENCE_SEMANTICS.md) — the v0.1 absence-semantics table that `default` / `optional` / `nullable` / `nullish` are realizations of.
- [`ZOD_MODIFIER_ORDERING.md`](./ZOD_MODIFIER_ORDERING.md) — the locked modifier-application order shared by the source generator and the runtime compiler.
- [`USAGE.md`](./USAGE.md) — v0.2 generator surface (TypeScript types, Zod source). The runtime API in this doc consumes the same schema definitions.
- [`PHASE_PLAN_v0.6.md`](./PHASE_PLAN_v0.6.md) — locked plan and the twenty-one decisions backing this contract.
- [`INVARIANTS.md`](./INVARIANTS.md) — cross-cutting invariants, including the engine-swap-safe and cache-invariance rules added in v0.6.
