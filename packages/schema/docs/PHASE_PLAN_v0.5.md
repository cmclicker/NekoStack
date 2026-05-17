# Phase Plan: `@nekostack/schema` v0.5 — Composition operators

> **PLAN only — no code in the PR that lands this doc.** Same discipline as v0.2 / v0.3 / v0.4.
>
> Reviewed against [`checklists/package/implementation-acceptance.md`](../../../checklists/package/implementation-acceptance.md). Once approved, implementation opens on `feat/schema-v0.5-candidate`.

## Why this phase exists

Every non-trivial schema set needs `pick`/`omit`/`extend`/`partial`/`required`/`merge`. Without them, users hand-rewrite shapes — and hand-rewritten shapes drift from the originals exactly the way the IR was built to prevent. v0.5 is the first phase that lets a downstream consumer compose schemas without leaving the system.

Composition is also the load-bearing dependency for several later phases:
- `@nekostack/api`'s request/response shapes (input often = entity-minus-server-fields).
- v0.6's runtime parse/validate (semantic-parity tests need composed fixtures).
- v0.7's registry diffing (must understand that a v2 schema is `v1.extend(...)`).

The conflict-handling work is the design risk; the rest is mechanical.

## Phase scope

Seven new methods on `ObjectSchema`:

```ts
const A = s.object({ id: s.string(), name: s.string() });
const B = s.object({ id: s.number(), email: s.string() });

A.extend({ email: s.string() });     // add new fields; throws on key collision
A.pick({ id: true });                // keep only the named keys
A.omit({ id: true });                // remove the named keys
A.partial();                         // all fields optional
A.partial({ name: true });           // named fields optional
A.required();                        // all fields required
A.required({ name: true });          // named fields required
A.merge(B);                          // throws: 'id' conflict
A.merge(B, { conflict: "right" });   // right wins
A.merge(B, { conflict: "left" });    // left wins
A.override({ id: s.number() });      // replace; throws if key absent in base
```

Each returns a **new `ObjectSchema`** (no mutation of the receiver). The composed result is a plain `ObjectNode` in the IR — no new node kind needed; generators already handle it.

## Explicit non-scope

- Composition on non-object schemas — `s.array().extend()` etc. have no sensible meaning.
- Deep / recursive composition — `extend` / `merge` are shallow over fields. If a field is itself an object, replacing it replaces the whole field; there's no per-nested-field composition operator. (Could be added later if a real consumer needs it.)
- Cross-schema `$ref` — still v0.7 registry-lite. v0.5 composition produces a single inline ObjectNode.
- Composition history / provenance — the composed schema doesn't carry "I was made by `A.merge(B)`" metadata. (Could be added as `metadata.derivedFrom` later if useful.)
- `merge` with `conflict: "merge"` (recursive type-merge of overlapping fields) — too complex for v0.5; only `"left"` and `"right"` ship.
- A standalone top-level `s.merge(A, B)` function — composition is method-on-instance only in v0.5. A static form can land later if it improves ergonomics.

## Public API delta

To be added on `ObjectSchema` (no new top-level exports). All composed-shape names use the `Shape` suffix to avoid shadowing TypeScript's built-in `Pick` / `Omit` / `Partial` / `Required` utility types — that shadowing made earlier audit reads harder than they needed to be.

```ts
class ObjectSchema<S extends RawShape> {
  // ... existing ...

  extend<E extends RawShape>(extension: E): ObjectSchema<ExtendShape<S, E>>;

  pick<M extends Mask<S>>(keys: M): ObjectSchema<PickShape<S, M>>;
  omit<M extends Mask<S>>(keys: M): ObjectSchema<OmitShape<S, M>>;

  partial(): ObjectSchema<PartialShape<S>>;
  partial<M extends Mask<S>>(keys: M): ObjectSchema<PartialByShape<S, M>>;

  required(): ObjectSchema<RequiredShape<S>>;
  required<M extends Mask<S>>(keys: M): ObjectSchema<RequiredByShape<S, M>>;

  // `merge` overloads encode the conflict-resolution decision at the type
  // level — the resulting field types depend on which side wins. The
  // default (no options or `conflict: "throw"` / omitted) returns the
  // THROW-shape type, which surfaces the conflict at compile time when
  // statically detectable; at runtime, it still throws on actual conflicts.
  //
  // `unknownKeys` is independent of `conflict` and must be usable on its own,
  // e.g., `A.merge(B, { unknownKeys: "right" })` when only the object policy
  // differs. The first overload below (`conflict?: "throw"`) covers that case.
  merge<Other extends RawShape>(
    other: ObjectSchema<Other>,
    options?: MergeOptions & { conflict?: "throw" },
  ): ObjectSchema<MergeThrowShape<S, Other>>;
  merge<Other extends RawShape>(
    other: ObjectSchema<Other>,
    options: MergeOptions & { conflict: "left" },
  ): ObjectSchema<MergeLeftShape<S, Other>>;
  merge<Other extends RawShape>(
    other: ObjectSchema<Other>,
    options: MergeOptions & { conflict: "right" },
  ): ObjectSchema<MergeRightShape<S, Other>>;

  override<O extends OverrideMask<S>>(
    overrides: O,
  ): ObjectSchema<OverrideShape<S, O>>;
}

/** A `{ key: true }` subset mask over an existing shape. */
export type Mask<S extends RawShape> = { [K in keyof S]?: true };

/**
 * Constraint shape for `override`: keys must be a SUBSET of `keyof S`, but
 * VALUES may be any new `AnySchema` (override exists precisely to replace
 * a field's schema with a different one — e.g., `override({ id: s.number() })`
 * on a schema where `id` was originally `s.string()`). Distinct from a
 * `Partial<S>` constraint, which would force values to keep the old field
 * types and defeat the purpose.
 */
export type OverrideMask<S extends RawShape> = {
  [K in keyof S]?: AnySchema;
};

/** Options for `merge`. Both knobs default to `"throw"` (Decisions #3 + #13). */
export type MergeOptions = {
  /**
   * How to resolve field-level conflicts (same key, different schema).
   * Default: `"throw"`.
   */
  conflict?: "throw" | "left" | "right";

  /**
   * How to resolve object-level `unknownKeys` policy mismatches. JSON Schema /
   * OpenAPI consumers care about this — strict-vs-passthrough is a real
   * validation semantics change, not cosmetic. Default: `"throw"`.
   *
   * - If both objects use the same policy, no option needed — that policy is kept.
   * - If policies differ and this option is omitted (or `"throw"`), merge throws.
   * - `"left"` / `"right"` selects which operand's policy wins.
   */
  unknownKeys?: "throw" | "left" | "right";
};
```

All `*Shape` helpers live in `src/types.ts` (or a new `src/types/composition.ts` if the file grows). Their names deliberately do NOT collide with TypeScript's built-in `Pick` / `Omit` / `Partial` / `Required`. The package may re-export some of them publicly later (when downstream packages start writing generic helpers over composed shapes), but v0.5 keeps them internal to minimize the public surface.

Three new public type exports:
- `Mask<S>` — the `{ key: true }` subset shape used by `pick` / `omit` / `partial` / `required`.
- `OverrideMask<S>` — the constraint used by `override` (keys must be in `keyof S`; values may be any `AnySchema`, not the original field types).
- `MergeOptions` — the merge resolution knobs (`conflict` + `unknownKeys`).

## Internal file delta

```
packages/schema/src/
├── builders/
│   ├── object.ts          # NEW METHODS added; existing ObjectSchema preserved
│   └── ...
├── composition/           # NEW DIRECTORY
│   ├── extend.ts
│   ├── pick-omit.ts
│   ├── partial-required.ts
│   ├── merge.ts
│   └── override.ts
└── types.ts               # NEW TYPE HELPERS for the seven operators
```

Tests:

```
packages/schema/tests/
├── composition.test.ts        # runtime behavior of each operator
├── composition.test-d.ts      # type-level inference assertions (expectTypeOf)
└── composition-conflict.test.ts  # the conflict matrix for merge + extend + override
```

## Dependency delta

- No new runtime dep.
- No new devDep.
- No new `@nekostack/*` deps.
- v0.5 is pure-TS work on top of v0.1–v0.4.

## Decisions to lock before coding

Sixteen decisions. The plan PR exists to resolve them. Highest-stakes flagged.

### Conflict policy (highest stakes)

1. **`extend` on a key already in the base: throw.** The spec README is explicit: extend cannot produce conflicts because it forbids collisions. To intentionally replace a field, use `override`. To resolve conflicts deliberately, use `merge` with `conflict`.

2. **`override` on a key NOT in the base: throw.** Override is replacement, not addition. To add new fields, use `extend`. Asymmetric with extend on purpose — pairs cleanly.

3. **`merge` default: `conflict: "throw"`.** No silent replacement. The author of `A.merge(B)` must opt into resolution explicitly.

4. **`merge` resolution options: `"left" | "right"` only.** No `"merge"` (recursive type-union) in v0.5 — too complex, too many edge cases (what if left field is string + right is object?). If a real consumer needs it, ship later as an opt-in.

5. **`pick` / `omit` on a key NOT in the base: throw.** Same fail-loudly principle. Catches refactors where a key was renamed and a downstream `pick` references the old name.

### Modifier semantics

**Symmetric rule for presence-changing operators:** both `partial()` and `required()` strip `default` on the affected fields. The two operators are inverses; the rule has to be symmetric or the v0.1 absence-semantics contract breaks.

The reason: in v0.1, `default(v)` means **input-optional + output-required** (the runtime fills the missing value before downstream code sees the field). If `partial()` preserved `default`, the field's output key would stay `required` while we claim to be making it optional — a direct contradiction. A `partial`-form schema also should NOT silently inject default values into a PATCH/update payload, which is the most common reason to call `partial()` in the first place. Better to strip defaults and let the consumer re-add them explicitly when they actually want the fill-behavior back.

6. **`partial()` sets the affected fields to input-optional + output-optional**, AND strips `default`. Idempotent — calling twice has no effect.

7. **`partial({ key: true })` (granular form) only touches the named keys**; others unchanged. Same for `required({ key: true })`.

8. **`required()` sets the affected fields to input-required + output-required**, AND strips `default`. Symmetric to `partial`. Documented loss: defaults are removed; if you need to preserve them, don't use `required` / `partial` — re-author or compose with field-level edits.

9. **`partial()` and `required()` are symmetric on `default` — both strip it.** (Previous draft said `partial()` left `default` alone; that contradicted Decision #15. Corrected.) If a future variant needs to preserve defaults, ship it as an explicit opt-in (e.g., `partial({ preserveDefaults: true })`) rather than blurring the default behavior.

10. **`nullable` / `nullish` are NOT touched by `partial` or `required`.** These are about value type (can be null?), not field presence. Composition operators only move the absence flag.

### Metadata + identity

11. **Composed schemas drop all metadata (`id`, `version`, `description`, `deprecated`).** Forces explicit `.id().version().describe()` on the result. Prevents implicit identity preservation that could cause registry collisions in v0.7 ("two different `com.x.User` schemas, one is the original and one is the `pick`-narrowed version").

12. **Field-level metadata IS preserved.** When `pick` keeps a field, that field's description survives. Same for `extend` / `merge` — incoming fields carry their own metadata.

### Object policy + refinements

13. **Object `unknownKeys` policy:**
    - Single-object operators (`pick` / `omit` / `partial` / `required`): preserve the base's policy.
    - `extend`: preserve the base's policy.
    - `override`: preserve the base's policy.
    - `merge`: **same fail-loudly discipline as field conflicts** — silently dropping the right operand's policy was a real-validation-semantics drop (strict vs passthrough changes which inputs validate). The `unknownKeys` knob on `MergeOptions` covers it:
      - If both operands use the same policy → keep that policy. No option needed.
      - If policies differ and the option is omitted (or set to `"throw"`) → **throw**.
      - `"left"` → left policy wins; right policy is recorded as deliberately dropped.
      - `"right"` → right policy wins; left policy is recorded as deliberately dropped.

    **Why fail-loudly here.** The rest of v0.5 throws on field conflicts (Decision #3), unknown pick/omit keys (Decision #5), missing override keys (Decision #2), and key collisions in extend (Decision #1). Silent `unknownKeys` drift would be the one place composition silently changes validation semantics. That's exactly the failure mode v0.5 is designed to prevent.

14. **Object-level refinements:** v0.1 doesn't support object-level refinements (only field-level). The Schema base class has `refinements`, but ObjectSchema in practice doesn't accumulate them. If a future feature adds object-level refinements (e.g., cross-field validators), composition needs to revisit them. v0.5 documents "object-level refinements are passed through from the base for pick/omit/partial/required/extend; dropped from the right operand of merge."

### Type inference

15. **All seven operators preserve the v0.1 absence-semantics contract.** Specifically:
    - `extend(E)`: each E field's `TInputKey` / `TOutputKey` carries through.
    - `pick` / `omit`: each surviving field's flags carry through.
    - `partial()`: each affected field's `TInputKey` AND `TOutputKey` become `"optional"`. Default is stripped (Decision #6), so both keys move together — no input/output asymmetry remains.
    - `required()`: each affected field's `TInputKey` AND `TOutputKey` become `"required"`. Default is stripped (Decision #8), keeping the symmetry with `partial()`.
    - `merge` with default / `"throw"`: result type is `MergeThrowShape<S, Other>` — fields that are statically detectable as conflicting surface as `never` at the type level so consumers see the problem before the runtime throw.
    - `merge` with `"left"`: `MergeLeftShape<S, Other>` — left's field type wins for any overlap.
    - `merge` with `"right"`: `MergeRightShape<S, Other>` — right's field type wins for any overlap.
    - `override`: replacement field's flags fully replace the base field's; new field type may differ from old (e.g., `override({ id: s.number() })` on a previously-string `id`).

    The shared `Identity` prettify helper still applies; `s.input<typeof Composed>` and `s.output<typeof Composed>` must produce the right shapes per the v0.1 contract. **Type-level tests are mandatory** for at least:
    - default-bearing field through `partial()` → output now optional (default stripped)
    - default-bearing field through `required()` → output now required (default stripped)
    - `override` replacing a key with a different schema type
    - `override` on unknown key → TS error
    - `merge` with `"left"` / `"right"` producing the correct overlap field types
    - `merge` with `{ unknownKeys: "left" }` and no `conflict` → resolves to `MergeThrowShape` (since `conflict` defaults to `"throw"`); proves the overload accepts `unknownKeys` independently
    - `merge` with `{ unknownKeys: "right" }` and no `conflict` → same overload, same return type
    - `merge` with `{ conflict: "left", unknownKeys: "right" }` → `MergeLeftShape` (the conflict overload still applies even when both knobs are set)
    - `pick` / `omit` on unknown key → TS error

### Generator parity

16. **No generator changes required.** Composition produces a plain `ObjectNode`; the TS, Zod, JSON Schema, and OpenAPI generators handle it via the shared `emitSchemaFragment`. A regression test will emit a composed schema with each generator and assert clean output to prove this in practice.

## Invariants — phase-specific risk

All 8 invariants still apply. New v0.5 corollaries to add to `INVARIANTS.md`:

- **Composition operators throw on conflict / unknown / missing keys.** Silent merge replacement, silent extension of conflicting keys, and silent pick/omit of nonexistent keys are forbidden (Invariant 7 — fail loudly).
- **Composed schemas drop top-level metadata.** Identity must be re-asserted on the composed result to avoid implicit ID propagation through derived schemas.

## Test strategy

- **Runtime behavior tests** (`composition.test.ts`) — each operator produces the expected IR shape; idempotence where claimed; immutability of inputs.
- **Type-level inference tests** (`composition.test-d.ts`) — `expectTypeOf` assertions for each operator against the v0.1 absence-semantics matrix; verifies input/output split survives composition.
- **Conflict matrix tests** (`composition-conflict.test.ts`) — every throw case asserted:
  - `extend` collision → throw
  - `override` missing key → throw
  - `merge` field conflict with default options → throw
  - `merge` `unknownKeys` mismatch with default options → throw
  - `merge` `unknownKeys` mismatch with explicit `"left"` / `"right"` → no throw, expected policy wins
  - `pick` / `omit` on key not in base → throw
  Plus the positive resolutions: `merge` `conflict: "left"`/`"right"` produces the expected fields; `merge` `unknownKeys: "left"`/`"right"` produces the expected object policy.
- **Generator parity tests** — for at least one composed schema (e.g., `User.extend({ tag: s.string() })`), emit via all four generators and assert the output is structurally what an equivalent hand-written `s.object({...})` would produce.
- **No snapshot churn for v0.1–v0.4.** Composition is additive; existing tests must remain byte-identical.

## Checklist pre-mapping

| Section | v0.5 strategy |
|---|---|
| **Scope** | Implementation PR titled `feat(schema): v0.5 candidate — composition operators`. Links this plan + ROADMAP v0.5 heading. |
| **Public API** | Three new public types (`Mask`, `OverrideMask`, `MergeOptions`); seven new methods on `ObjectSchema` (with merge overloaded per `conflict` value). No top-level exports beyond the three types. |
| **Boundary** | No `@nekostack/*` imports. No new external deps. |
| **Contracts** | New contract doc `docs/COMPOSITION.md` codifies the conflict-handling, modifier semantics, metadata-drop rule, and inference contract. `INVARIANTS.md` extended with two v0.5 corollaries. |
| **Immutability + determinism** | All operators return new `ObjectSchema` instances; receiver and arguments are not mutated. Tested. |
| **Tests** | Runtime + type-level + conflict matrix + generator parity. |
| **Validation commands** | Same five (`test`, `typecheck`, `build`, `pack --dry-run`, `ls`). |
| **Local artifacts** | New `docs/COMPOSITION.md`. `docs/USAGE.md` extended with the seven operators. `docs/EXAMPLES.md` extended with at least one composed example (e.g., `TenantInput = Tenant.omit({ id: true, createdAt: true })`). `docs/ROADMAP.md` v0.5 → candidate. |
| **Process** | Draft PR on `feat/schema-v0.5-candidate`. Ready-for-review only after self-audit walks the checklist clean. |
| **Milestone process (post-merge)** | Tag + release + CHANGELOG entry per `packages/schema/CHANGELOG.md` rule. `GENERATOR_VERSION` bumped to `@nekostack/schema@0.5.0`; snapshots regenerated. |

## Sequencing

Implementation lands on `feat/schema-v0.5-candidate` as reviewable commits:

1. Type helpers in `src/types.ts` (or `src/types/composition.ts` if the file grows): `Mask`, `OverrideMask`, `MergeOptions`, `ExtendShape`, `PickShape`, `OmitShape`, `PartialShape`, `PartialByShape`, `RequiredShape`, `RequiredByShape`, `MergeThrowShape`, `MergeLeftShape`, `MergeRightShape`, `OverrideShape`.
2. `pick` / `omit` methods (simplest; pure shape narrowing) + tests.
3. `extend` method with throw-on-collision + tests.
4. `partial` / `required` methods (with granular `(mask?)` forms) + tests + the default-stripping decision documented.
5. `merge` method with conflict policy + tests.
6. `override` method with throw-on-missing-key + tests.
7. Conflict matrix tests covering every throw path.
8. Generator-parity tests across all four generators.
9. `docs/COMPOSITION.md` contract doc.
10. `docs/USAGE.md` + `docs/EXAMPLES.md` extended.
11. `docs/ROADMAP.md` v0.5 → candidate.
12. `docs/INVARIANTS.md` extended with the two v0.5 corollaries.
13. `GENERATOR_VERSION` bump to `@nekostack/schema@0.5.0`; regenerate snapshots.
14. `src/index.ts` update — the three new public types: `Mask`, `OverrideMask`, `MergeOptions`.

## Estimate

**4–6 focused days.** Larger than v0.4 (3–5 days actual) because:
- Seven operators × type-level + runtime correctness × conflict matrix = real surface area.
- Type-level work for the composed shape inference is non-trivial (mapped types, conditional types, the `Mask` constraint).
- Conflict matrix tests + generator parity tests add ~20–30 tests.

Risk areas:
- Type inference for `merge`-with-conflict-policy may not narrow cleanly; might need `as const` or careful generic constraints.
- The `required()` strips-default decision (Decision #8) is the most likely to come back during implementation — if the dogfood pass reveals it's annoying in practice, revisit.

## What this plan does NOT decide

- Cross-package composition (composing a schema from another `@nekostack/*` package's exports) — works in practice but registry-lite (v0.7) is what makes this safe at scale.
- `merge` with `conflict: "merge"` (recursive type-union) — deferred indefinitely; ship if a real consumer needs it.
- Static `s.merge(A, B)` / `s.extend(A, {...})` top-level forms — method-on-instance is sufficient for v0.5.
- A future `omitMatching` / `pickMatching` with predicate functions — not needed for v0.5's static-key surface.
- Object-level refinements + composition — deferred until object-level refinements exist.
- A "composition history" trace (e.g., `metadata.derivedFrom`) — could be useful for registry diffing in v0.7+; not needed for v0.5.

## Decision history

- **v0.5-plan, initial draft** — 16 decisions, plan-only PR. `OpenApiGeneratorOptions`-style empty-options sketch.
- **v0.5-plan, post-review amendment** — three corrections per the composition audit:
  - **#9 reversed** (`partial()` strips `default` symmetrically with `required()`). The previous wording said `partial()` left `default` untouched, which contradicted Decision #15 — a default-bearing field is input-optional / output-required, so a `partial()` schema that preserves it would still be output-required (not actually partial). Symmetric strip is the only self-consistent choice and avoids silently injecting defaults into PATCH/update payloads.
  - **Public API sketch rewritten** to:
    - Replace `override<O extends Partial<S>>` with `override<O extends OverrideMask<S>>`. `override` exists precisely to replace a field's schema with a different one (e.g., `override({ id: s.number() })` on a string `id`); `Partial<S>` would force values to keep the old field types.
    - Encode `merge`'s conflict-resolution at the type level via overloads — `MergeThrowShape` / `MergeLeftShape` / `MergeRightShape` resolve at compile time based on `options.conflict`.
    - Drop shadowing of TS built-in utility types throughout the sketch (`Pick`, `Omit`, `Partial`, `Required` → `PickShape`, `OmitShape`, `PartialShape`, `RequiredShape`). Internal helper-name visibility was misleading the audit reads.
  - **#13 changed** from silent-left-wins to fail-loudly with explicit `unknownKeys` resolution on `MergeOptions`. The original wording violated the rest of v0.5's discipline — `unknownKeys` is a real validation-semantics policy (strict vs passthrough changes what inputs validate), so silently dropping the right operand's policy was exactly the failure mode the rest of v0.5 is built to prevent.

Knock-on changes:
- Public-type count is now **three** (`Mask`, `OverrideMask`, `MergeOptions`), not two.
- Conflict-matrix tests expanded to cover `unknownKeys` mismatch (default-throws + explicit-left + explicit-right).
- Type-level test list expanded with `override` differing schema type, `override` unknown key, `merge` overlap field types per `conflict` value, and `pick`/`omit` unknown key at the TS level.

- **v0.5-plan, follow-up amendment** — three smaller corrections after the second audit pass:
  - **`merge` overload sketch rewritten** so `unknownKeys` works without `conflict`. The previous overloads required `conflict` in every options shape, which broke `A.merge(B, { unknownKeys: "right" })` — a valid use case the rest of the plan promises. New form uses `options?: MergeOptions & { conflict?: "throw" }` for the default overload and `MergeOptions & { conflict: "left" | "right" }` for the two explicit ones.
  - **Type-level test list expanded** with three new `merge`-options cases: `{ unknownKeys: "left" }` alone, `{ unknownKeys: "right" }` alone, and `{ conflict: "left", unknownKeys: "right" }` together.
  - **Sequencing step 1** updated to list every type helper the amended plan actually requires (`OverrideMask`, `PartialByShape`, `RequiredByShape`, `MergeThrowShape`/`MergeLeftShape`/`MergeRightShape` were missing from the original sequencing line).
  - **Sequencing step 14** updated from "only the two new public types" to "the three new public types: `Mask`, `OverrideMask`, `MergeOptions`."

## Action requested from reviewer

- Final ack on the amended decisions, especially the new fail-loudly `unknownKeys` policy (Decision #13) and the symmetric `partial`/`required` strip (Decisions #6 / #8 / #9).
- Confirm the rewritten API sketch (overrides, merge overloads, `OverrideMask`) reads cleanly.
- Flag any further in-scope item that should be removed or any non-scope item that should pull forward.

Once approved, implementation opens on `feat/schema-v0.5-candidate`.
