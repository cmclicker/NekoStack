# Composition Contract

> How the seven `ObjectSchema` composition operators behave. This file is the contract; the implementation lives in [`../src/builders/object.ts`](../src/builders/object.ts) and the type helpers in [`../src/types.ts`](../src/types.ts).

## Quick reference

```ts
const A = s.object({ id: s.string(), name: s.string() });
const B = s.object({ id: s.number(), email: s.string() });

A.extend({ email: s.string() });     // add new fields; throws on key collision
A.pick({ id: true });                // keep only named keys
A.omit({ id: true });                // remove named keys
A.partial();                         // all fields optional + default stripped
A.partial({ name: true });           // granular form: only the named keys
A.required();                        // all fields required + default stripped
A.required({ name: true });          // granular form
A.merge(B);                          // throws: 'id' conflict
A.merge(B, { conflict: "right" });   // right wins
A.merge(B, { unknownKeys: "left" }); // resolves an unknownKeys mismatch
A.override({ id: s.number() });      // replace; throws if key absent
```

## The three universal rules

Every composition operator follows these:

1. **Returns a new `ObjectSchema`.** No mutation of the receiver or arguments.
2. **Fails loudly.** Collisions, unknown keys, missing keys, and unknownKeys mismatches throw — never silently. Silent composition is the failure mode v0.5 exists to prevent.
3. **Drops top-level metadata.** Composed schemas lose `id` / `version` / `description` / `deprecated`. The author must re-tag the result explicitly. This prevents implicit identity preservation that would cause v0.7 registry collisions ("two different `com.x.User` schemas — one's the original, one's a `pick`-narrowed view").

Field-level metadata is preserved across all operators.

## The seven operators

### `extend(extension)` — add fields

```ts
const A = s.object({ id: s.string() });
A.extend({ name: s.string() });
// { id, name }

A.extend({ id: s.number() });
// throws: key 'id' already exists in base
```

Throws on any key in `extension` that already exists in the base. To deliberately replace a field, use `override`. To combine two schemas with explicit conflict policy, use `merge`.

### `pick(mask)` / `omit(mask)` — narrow

```ts
const Base = s.object({ id: s.string(), name: s.string(), age: s.number() });
Base.pick({ id: true, name: true });   // { id, name }
Base.omit({ age: true });              // { id, name }

Base.pick({ missing: true });
// throws: key 'missing' does not exist in base shape
```

Both throw on any key in the mask that's not in the base — catches refactor drift where a key was renamed and a downstream `pick` still references the old name.

### `partial(mask?)` — make optional, strip default

```ts
const A = s.object({ id: s.string(), role: s.string().default("member") });
const P = A.partial();
// Both fields become input-optional + output-optional.
// IMPORTANT: `role` loses its default. A partial schema should not silently
// inject defaults into a PATCH/update payload.

A.partial({ id: true });
// granular form: only `id` becomes optional; `role` unchanged
```

`partial` and `required` are **symmetric on `default`**: both strip it. Rationale: in the v0.1 absence-semantics contract, `default(v)` means input-optional + output-required (runtime fills the missing value). Preserving `default` through `partial()` would leave output-required while claiming to be optional — a direct contradiction. The symmetric strip is the only self-consistent rule.

If you need to preserve defaults across composition, don't use `partial` / `required` — re-author the field explicitly or compose at the IR level.

### `required(mask?)` — make required, strip default

```ts
const A = s.object({
  id: s.string().optional(),
  role: s.string().default("member"),
});
const R = A.required();
// Both fields become input-required + output-required.
// `role` loses its default — required + default-bearing was semantically
// contradictory anyway ("the field is required, but accepts missing input?").
```

### `merge(other, options?)` — combine

```ts
const A = s.object({ id: s.string(), shared: s.string() });
const B = s.object({ name: s.string(), shared: s.number() });

A.merge(B);
// throws: field 'shared' exists in both operands.
// Pass { conflict: "left" } or { conflict: "right" } to resolve.

A.merge(B, { conflict: "left" });   // shared is string (A's type)
A.merge(B, { conflict: "right" });  // shared is number (B's type)
```

`merge` has two independent knobs:

| Knob | Default | Meaning |
|---|---|---|
| `conflict` | `"throw"` | How field-level overlaps are resolved |
| `unknownKeys` | `"throw"` | How object-level `unknownKeys` policy mismatches are resolved |

Both default to `"throw"`. Same-policy merges (both operands `strict`, both `passthrough`, both `stripUnknown`) don't need the `unknownKeys` option. Mismatched merges must resolve explicitly:

```ts
const Strict = s.object({ id: s.string() });               // strict
const Loose = s.object({ name: s.string() }).passthrough(); // passthrough

Strict.merge(Loose);
// throws: unknownKeys policies differ.

Strict.merge(Loose, { unknownKeys: "right" });
// passthrough wins; merged object accepts unknown keys
```

The two knobs are independent: `A.merge(B, { unknownKeys: "right" })` works when fields don't conflict but policies do.

Why fail-loudly on `unknownKeys`: it's a real validation-semantics policy (strict vs passthrough changes which inputs validate), not cosmetic. Silently dropping the right operand's policy would be exactly the failure mode v0.5's other operators are built to prevent.

#### Type-level overload selection

`merge` has three overloads:

```ts
merge(other)                                          // → ObjectSchema<MergeThrowShape<S, Other>>
merge(other, { conflict?: "throw", unknownKeys?: ... }) // → ObjectSchema<MergeThrowShape<S, Other>>
merge(other, { conflict: "left",  unknownKeys?: ... }) // → ObjectSchema<MergeLeftShape<S, Other>>
merge(other, { conflict: "right", unknownKeys?: ... }) // → ObjectSchema<MergeRightShape<S, Other>>
```

`MergeThrowShape<S, Other>` is `Identity<S & Other>`. It preserves disjoint merges and lets TypeScript surface some conflicts through normal intersection behavior where possible, but **runtime conflict detection is the load-bearing guarantee**. Consumers must not rely on `MergeThrowShape` as the sole conflict detector — call `merge` with explicit `conflict: "left"` / `"right"` when you intend to resolve overlaps, and let the runtime throw catch the unintended ones.

`MergeLeftShape` / `MergeRightShape` resolve overlaps by picking the corresponding side's field type.

### `override(overrides)` — replace existing keys

```ts
const Base = s.object({ id: s.string(), name: s.string() });

Base.override({ id: s.number() });
// id is now a number; name unchanged

Base.override({ missing: s.string() });
// throws: key 'missing' does not exist in base
```

Throws on any key in `overrides` that's NOT in the base. To add new fields, use `extend`. To replace an existing field's schema with a different type (string → number, etc.), use `override`. The `OverrideMask<S>` constraint permits any `AnySchema` as a value — that's the whole point.

`extend` and `override` are deliberately asymmetric: `extend` rejects existing keys, `override` rejects missing keys. The pair covers add and replace without overlap.

## Object-level `unknownKeys` policy

Single-object operators (`pick` / `omit` / `partial` / `required` / `extend`) preserve the base's policy. Only `merge` can encounter a mismatch — handled by the `unknownKeys` knob on `MergeOptions` (see above).

## Object-level refinements

v0.1 doesn't yet support object-level refinements (only field-level). The `Schema` base class has a `refinements` array, but `ObjectSchema` in practice doesn't accumulate them. If a future feature adds object-level validators (e.g., cross-field constraints), composition needs to revisit them.

For now: single-object operators pass through any object-level refinements unchanged; `merge` drops the right operand's object-level refinements. Document re-asserts the policy when object-level refinements ship.

## Type inference contract

All operators preserve the v0.1 absence-semantics contract end-to-end. The per-operator type-level behavior:

| Operator | Effect on per-field `TInputKey` / `TOutputKey` |
|---|---|
| `extend(E)` | Each E field's keys carry through unchanged |
| `pick` / `omit` | Surviving fields' keys carry through unchanged |
| `partial()` | Affected fields' keys both become `"optional"`; TInput/TOutput widen with `\| undefined` |
| `required()` | Affected fields' keys both become `"required"`; TInput/TOutput narrow via `Exclude<…, undefined>` |
| `merge` (`"left"`) | Left's keys win for overlaps |
| `merge` (`"right"`) | Right's keys win for overlaps |
| `merge` (`"throw"`) | TS intersection (`S & Other`); overlap with incompatible types surfaces as `never` |
| `override` | Replacement field's keys fully replace the base field's |

`s.input<typeof Composed>` and `s.output<typeof Composed>` produce the right shapes per the v0.1 contract — type-level tests in [`../tests/composition.test-d.ts`](../tests/composition.test-d.ts) cover every operator.

## Generator parity

Composition produces a plain `ObjectNode` — no new IR kind, no generator changes. The four generators (TS, Zod, JSON Schema, OpenAPI) handle composed schemas via the shared `emitSchemaFragment`. This is asserted in [`../tests/composition-generator-parity.test.ts`](../tests/composition-generator-parity.test.ts): for each operator, the composed schema's generator output is byte-identical to an equivalent hand-written `s.object({...})`.

Notably, `partial`'s default-strip is observable end-to-end: the Zod chain has no `.default()` call; the JSON Schema output has no `default` key or `x-nekostack-default-applied-by` extension.

## What composition does NOT do

| Feature | Reason it's deferred |
|---|---|
| Composition on non-object schemas (`s.array().extend()`) | No sensible meaning |
| Deep / recursive composition (nested-field merge) | Adds complexity v0.5 doesn't need; shallow is sufficient |
| Cross-schema `$ref` | v0.7 registry-lite |
| Composition history metadata (`metadata.derivedFrom`) | Could help v0.7 diffing; not load-bearing for v0.5 |
| `merge` with `conflict: "merge"` (recursive type-union) | Too complex; only `"left"` / `"right"` ship in v0.5 |
| Static `s.merge(A, B)` top-level form | Method-on-instance is sufficient |
| `omitMatching` / `pickMatching` with predicates | Not needed for the static-key surface |

If a real consumer hits one of these, they ship in their own phase plan.
