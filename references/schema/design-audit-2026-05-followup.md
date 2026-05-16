# `@nekostack/schema` — Design Audit Follow-up (2026-05)

> Source: external engineering audit follow-up (ChatGPT, 2026-05-16). Reviews the revision applied after [`design-audit-2026-05.md`](./design-audit-2026-05.md).
>
> **Status:** Incorporated into `packages/schema/README.md`.

## Verdict on the revision

This version is **substantially more trustworthy** than the first one. It now reads like an **implementation-grade design brief**, not just a positioning document. The major failure points from the prior audit are now explicitly addressed: canonical IR, semantic-loss handling, date typing, absence semantics, strict object behavior, schema identity, composition conflict rules, normalized errors, generated artifact policy, dependency policy, revised roadmap, and semantic-parity testing.

You can now trust this as a **package design contract draft**.

You still should **not** treat it as final implementation authority until it is decomposed into:
1. concrete file map,
2. exported public API,
3. internal type contracts,
4. generator behavior specs,
5. test matrix,
6. CLI command contracts,
7. failure-mode catalog.

But the scope is no longer fake-complete. It now names the hard parts instead of hiding them.

---

## What improved

### 1. It correctly reframes the package

The new opening is much stronger: *"An IR-backed multi-output schema system."* That is the correct identity.

The prior version made the package sound like "Zod, but ours." This version correctly positions it as: `DSL → canonical IR → generated outputs`. That is the right architectural spine.

### 2. It now owns semantic loss explicitly

This is the biggest trust improvement. The document distinguishes portable constraints, runtime-only refinements, and metadata emitted when an output cannot faithfully represent runtime behavior. JSON Schema/OpenAPI outputs are no longer pretending to be exact when they are not. The rule that non-runtime outputs become **correct supersets** is the right model.

### 3. It fixes the `date()` ambiguity

Rejecting vague `s.date()` is correct. The `isoDateTime()` / `isoDate()` / `epochMs()` / `dateObject()` split is exactly the sort of boring-but-critical distinction that prevents cross-layer corruption. `dateObject()` being runtime-only is also correct.

### 4. Absence semantics are pinned

The optional / nullable / nullish / default table is necessary and well-placed. One of the main places schema systems rot.

### 5. Strict-by-default is the right call

Correct for auth, API, config, entitlement, billing, and telemetry-adjacent schemas. Loose schemas should be explicit, not accidental.

### 6. The roadmap is much more honest

Pushing migrations to `v0.8+` is the correct move. Migrations are not a cute schema feature — they are data corruption territory. The revised roadmap builds toward them instead of pretending they are just another operator beside `pick()` and `omit()`.

---

## Remaining weaknesses

### 1. `TransformNode` is dangerous

The IR includes `TransformNode` described as runtime-only / opaque metadata. Acceptable, but needs stricter policy.

Transforms create two different types:

```ts
InputType → OutputType
```

For example: `s.string().transform(v => Number(v))` has input shape, output shape, runtime behavior, generated Zod behavior, JSON Schema input representation, TypeScript inferred input type, TypeScript inferred output type.

You need to decide whether `s.infer<typeof Schema>` means **input** or **output**.

Recommended:
```ts
s.input<typeof Schema>
s.output<typeof Schema>
s.infer<typeof Schema> // alias to output, if you want Zod-like behavior
```

Without this, transforms will poison type inference.

### 2. Union semantics need more detail

The document lists unions, but unions are not simple. Distinguish:

```ts
s.union([A, B])
s.discriminatedUnion("type", [A, B])
```

For production APIs, discriminated unions should be preferred because they generate cleaner OpenAPI, better errors, and better UI behavior.

Define whether union validation returns: first matching branch, all branch failures, best branch failure, or discriminator-specific failure. This matters for `Issue[]`.

### 3. Default behavior needs runtime timing

The absence table says default replaces missing values. Good. But **when**?

Options: during validation, parsing, generated Zod execution, form initialization, or config loading only.

Need a distinction between:
```ts
validate(schema, input)
parse(schema, input)
```

Recommended:
```ts
validate() // checks only, does not mutate/coerce
parse()    // validates and returns normalized/defaulted output
```

Or define `validate()` as parse-like. Pick one.

### 4. Coercion policy is missing

Are these allowed?
```ts
s.number().coerce()
s.boolean().coerce()
s.isoDateTime().coerce()
```

Given `{ "age": "42" }`, does it fail or become `42`?

Recommendation: **no coercion by default**. If supported, coercion must be explicit and runtime-only unless representable elsewhere:
```ts
s.number().coerceFromString()
```

Coercion should never silently leak into JSON Schema/OpenAPI as if it were native.

### 5. Registry-lite needs sharper boundaries

"Breaking-change detection" is a whole subsystem. At minimum, define categories:

| Change | Compatibility |
|---|---|
| Add optional field | non-breaking |
| Add required field | breaking |
| Remove field | breaking for consumers |
| Widen enum | maybe breaking for consumers |
| Narrow enum | breaking for producers |
| Make nullable | usually widening |
| Remove nullable | breaking |
| Change string to number | breaking |
| Add runtime-only refinement | breaking for runtime consumers, invisible to JSON Schema |

### 6. Generated artifact policy needs one more rule

Generated files committed — agreed. Add:

> Generated files must never be manually edited. CI must verify the source hash and generator hash, not just file presence.

Also consider requiring generated files to contain `schemaIrHash` not just `sourceHash`. Why: formatting/comment-only changes to the source file may not alter the IR. CI should be able to distinguish source-changed, IR-changed, and generated-output-changed.

---

## What I would add next

A new section titled `## Still-open implementation decisions`, including:

- Transform semantics: define input/output/infer behavior.
- Union semantics: plain union vs discriminated union, issue reporting strategy.
- Default timing: validate-only vs parse/default application.
- Coercion policy: rejected by default; explicit only if supported.
- Diff compatibility matrix: define breaking vs non-breaking schema changes.
- IR hash policy: source hash vs normalized IR hash.
- Registry lookup rules: local package registry vs workspace registry vs future hosted registry.

This makes the document even more trustworthy because it labels what is still undecided instead of pretending everything is closed.

---

## Trust answer

The first version was a *strategic brief*. This version is an *engineering design contract draft*. Major upgrade.

| Use case | Trust level |
| --- | ---: |
| Package purpose | High |
| Dependency direction | High |
| Core architecture | High |
| Scope boundaries | High |
| Roadmap sequencing | Medium-high |
| Implementation details | Medium |
| File-by-file build plan | Not yet |
| Public API finality | Not yet |
| Test completeness | Not yet |

The next step should be to turn this into a **file-by-file implementation contract**, starting with `packages/schema/src/ir/nodes.ts`.
