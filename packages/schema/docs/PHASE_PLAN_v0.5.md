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

To be added on `ObjectSchema` (no new top-level exports):

```ts
class ObjectSchema<S extends RawShape> {
  // ... existing ...
  extend<E extends RawShape>(extension: E): ObjectSchema<Extend<S, E>>;
  pick<K extends Mask<S>>(keys: K): ObjectSchema<Pick<S, K>>;
  omit<K extends Mask<S>>(keys: K): ObjectSchema<Omit<S, K>>;
  partial(): ObjectSchema<Partial<S>>;
  partial<K extends Mask<S>>(keys: K): ObjectSchema<PartialBy<S, K>>;
  required(): ObjectSchema<Required<S>>;
  required<K extends Mask<S>>(keys: K): ObjectSchema<RequiredBy<S, K>>;
  merge<Other extends RawShape>(
    other: ObjectSchema<Other>,
    options?: MergeOptions,
  ): ObjectSchema<Merge<S, Other>>;
  override<O extends Partial<S>>(overrides: O): ObjectSchema<Override<S, O>>;
}

export type Mask<S extends RawShape> = { [K in keyof S]?: true };
export type MergeOptions = { conflict?: "throw" | "left" | "right" };
```

(`Extend`, `Pick`, `Omit`, etc. are TS-level helpers in `src/types.ts` — they shadow the global TS utility types within this package's type module, but are not re-exported with those names from `src/index.ts` to avoid confusion. They're spelled internally as `ExtendShape`, `PickShape`, etc.)

Two new public type exports:
- `Mask<S>` — the `{ key: true }` mask shape used by `pick`/`omit`/`partial`/`required`.
- `MergeOptions` — the `conflict` policy.

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

6. **`partial()` strips `optional` flags that exist + sets `optional` on all fields.** Idempotent — calling twice has no effect. Pure mapped-over-fields.

7. **`partial({ key: true })` (granular form) only touches the named keys; others unchanged.** Same for `required({ key: true })`.

8. **`required()` strips BOTH `optional` AND `default` from every field.** Rationale: "required" means input must include the field; a default-bearing field accepts missing input, so defaults conflict with required semantics. Documented loss: if you need to preserve defaults across composition, don't use `required` — re-author with the default-bearing field explicit. **This is the most debatable decision; please weigh in.**

9. **`partial()` does NOT touch `default`.** A field with `{ optional: true, default: "x" }` stays the same after `partial()` (already optional). A field with `{ default: "x" }` and no explicit `optional` also stays the same (`.default()` already sets `optional: true`).

10. **`nullable` / `nullish` are NOT touched by `partial` or `required`.** These are about value type (can be null?), not field presence. Composition operators only move the absence flag.

### Metadata + identity

11. **Composed schemas drop all metadata (`id`, `version`, `description`, `deprecated`).** Forces explicit `.id().version().describe()` on the result. Prevents implicit identity preservation that could cause registry collisions in v0.7 ("two different `com.x.User` schemas, one is the original and one is the `pick`-narrowed version").

12. **Field-level metadata IS preserved.** When `pick` keeps a field, that field's description survives. Same for `extend` / `merge` — incoming fields carry their own metadata.

### Object policy + refinements

13. **Object `unknownKeys` policy:**
    - Single-object operators (`pick` / `omit` / `partial` / `required`): preserve the base's policy.
    - `extend`: preserve the base's policy.
    - `merge`: take the **left** operand's policy. The right operand's policy is dropped silently (the alternative is throw-on-mismatch, which feels too strict; the left-wins choice mirrors how most ORM-style composes resolve this).
    - `override`: preserve the base's policy.

14. **Object-level refinements:** v0.1 doesn't support object-level refinements (only field-level). The Schema base class has `refinements`, but ObjectSchema in practice doesn't accumulate them. If a future feature adds object-level refinements (e.g., cross-field validators), composition needs to revisit them. v0.5 documents "object-level refinements are passed through from the base for pick/omit/partial/required/extend; dropped from the right operand of merge."

### Type inference

15. **All seven operators preserve the v0.1 absence-semantics contract.** Specifically:
    - `extend(E)`: each E field's `TInputKey` / `TOutputKey` carries through.
    - `pick` / `omit`: each surviving field's flags carry through.
    - `partial()`: each field's `TInputKey` and `TOutputKey` become `"optional"`.
    - `required()`: each field's `TInputKey` and `TOutputKey` become `"required"` (since default is stripped, this is consistent).
    - `merge` with `"left"`: left wins, including key flags.
    - `merge` with `"right"`: right wins, including key flags.
    - `override`: replacement field's flags fully replace the base field's.

    The shared `Identity` prettify helper still applies; `s.input<typeof Composed>` and `s.output<typeof Composed>` must produce the right shapes per the v0.1 contract. Type-level tests are mandatory.

### Generator parity

16. **No generator changes required.** Composition produces a plain `ObjectNode`; the TS, Zod, JSON Schema, and OpenAPI generators handle it via the shared `emitSchemaFragment`. A regression test will emit a composed schema with each generator and assert clean output to prove this in practice.

## Invariants — phase-specific risk

All 8 invariants still apply. New v0.5 corollaries to add to `INVARIANTS.md`:

- **Composition operators throw on conflict / unknown / missing keys.** Silent merge replacement, silent extension of conflicting keys, and silent pick/omit of nonexistent keys are forbidden (Invariant 7 — fail loudly).
- **Composed schemas drop top-level metadata.** Identity must be re-asserted on the composed result to avoid implicit ID propagation through derived schemas.

## Test strategy

- **Runtime behavior tests** (`composition.test.ts`) — each operator produces the expected IR shape; idempotence where claimed; immutability of inputs.
- **Type-level inference tests** (`composition.test-d.ts`) — `expectTypeOf` assertions for each operator against the v0.1 absence-semantics matrix; verifies input/output split survives composition.
- **Conflict matrix tests** (`composition-conflict.test.ts`) — every throw case asserted (extend collision, override missing key, merge conflict default, pick unknown key, omit unknown key); positive cases for the explicit `"left"` / `"right"` resolution.
- **Generator parity tests** — for at least one composed schema (e.g., `User.extend({ tag: s.string() })`), emit via all four generators and assert the output is structurally what an equivalent hand-written `s.object({...})` would produce.
- **No snapshot churn for v0.1–v0.4.** Composition is additive; existing tests must remain byte-identical.

## Checklist pre-mapping

| Section | v0.5 strategy |
|---|---|
| **Scope** | Implementation PR titled `feat(schema): v0.5 candidate — composition operators`. Links this plan + ROADMAP v0.5 heading. |
| **Public API** | Two new public types (`Mask`, `MergeOptions`); seven new methods on `ObjectSchema`. No top-level exports beyond the two types. |
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

1. Type helpers in `src/types.ts` (`Mask`, `MergeOptions`, `ExtendShape`, `PickShape`, `OmitShape`, `PartialShape`, `RequiredShape`, `MergeShape`, `OverrideShape`).
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
14. `src/index.ts` update (only the two new public types).

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

## Action requested from reviewer

- Approve / push back on the 16 decisions, especially **#1** (extend throws on conflict), **#3** (merge default = throw), **#8** (required strips default), **#11** (composed schemas drop metadata).
- Flag any in-scope item that should be removed or any non-scope item that should pull forward.
- Confirm the "ObjectSchema methods only, no top-level functions" surface is right.

Once approved, implementation opens on `feat/schema-v0.5-candidate`.
