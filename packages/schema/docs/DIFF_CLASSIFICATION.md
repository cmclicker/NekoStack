# Diff Classification Contract

> The locked breaking / additive / cosmetic table that `diffNodes` and `diffHandler` implement, plus the lens, aggregation, and unsupported-kind rules. This file is the contract; the implementations live in [`../src/registry/diff.ts`](../src/registry/diff.ts) and [`../src/registry/handlers/diff.ts`](../src/registry/handlers/diff.ts). Every row in the table below has a fixture pair in [`../tests/registry/diff-classifier.test.ts`](../tests/registry/diff-classifier.test.ts), and the aggregation rule is gated by [`../tests/registry/handlers/diff-handler.test.ts`](../tests/registry/handlers/diff-handler.test.ts).

## Severity lens

**Input-acceptance compatibility** is the primary lens.

> *Would data that the **old** schema accepted still be accepted by the **new** schema?*

- **No** → `breaking`.
- **Yes**, and the new schema *also* accepts inputs the old one rejected → `additive`.
- **Same accepted set** (no validation effect) → `cosmetic`.

Output-shape compatibility is **a separate concern**. It is reflected in the change's `kind` field — `default_removed`, `default_value_changed`, etc. — but does *not* split the severity. Consumers needing an output-side reading apply their own lens over `change.kind`.

This lens is deliberate. The Master plan locked the single-severity rule (Decision #11) so the CLI's exit-code mapping (Decision #13) stays mechanical: any `breaking` row anywhere in a diff means a non-zero exit. A multi-lens classifier would either re-introduce judgment or require a flag-per-lens that v0.7 has not budgeted.

## Severity values

| Severity | Meaning | CLI exit (Step 28+) |
|---|---|---|
| `breaking` | At least one input the old schema accepted is rejected by the new schema. | non-zero |
| `additive` | The new schema's accepted set is a strict superset of the old one's. | zero (with notice) |
| `cosmetic` | The accepted sets are identical; only metadata or ordering changed. | zero |

The values are declared in [`../src/registry/types.ts`](../src/registry/types.ts) and the type is re-exported from the integration subpath [`@nekostack/schema/cli`](../src/cli-integration.ts).

## `worstSeverity` aggregation

`diffHandler` collapses the change list into one severity for CLI consumption:

```text
worstSeverity = max(severity over changes), where breaking > additive > cosmetic
worstSeverity = null  ⇔  changes.length === 0
```

Precedence is locked: `breaking > additive > cosmetic`. The implementation lives in `computeWorstSeverity` ([`../src/registry/handlers/diff.ts`](../src/registry/handlers/diff.ts)). `null` is the sentinel for "no changes detected" — distinct from `cosmetic`, which means "changes exist but none affect validation."

This is also the realization rule for Master plan Decision #13: a `schemaVersion` bump paired with structural changes inherits the worst structural severity, because every change keeps its own row in the list and the `schemaVersion` row's `cosmetic` severity loses the `max` against any `breaking`/`additive` structural row.

## Classification table (locked — Master plan Decision #12)

Every row is gated by a fixture pair in `diff-classifier.test.ts`. Adding, removing, or reclassifying a row is a contract change and requires a Master plan amendment.

| Change | Severity | `DiffChange.kind` | Notes |
|---|---|---|---|
| Top-level `kind` mismatch (e.g. `string` → `number`) | breaking | `type_changed` | Walker stops descending; no per-field diff is emitted past this point. |
| Add **required** field | breaking | `field_added` | Old data lacking the field now fails. |
| Add **nullable-only** field (required key, value may be `null`) | breaking | `field_added` | `nullable` does not imply `optional`; old data lacking the field still fails. |
| Add **optional** field | additive | `field_added` | Absence permitted; old data still validates. |
| Add **nullish** field (`optional + nullable`) | additive | `field_added` | Absence permitted. |
| Add **default-bearing** field | additive | `field_added` | Input-optional; old data validates and gains the default at output. |
| Remove field (any modifier) | breaking | `field_removed` | Consumers reading the field break; old data with the field newly becomes an unknown key. |
| Tighten refinement (`min` ↑, `max` ↓, new `regex`, `length` change, `multipleOf` change) | breaking | `refinement_changed` | Inputs that passed may now fail. |
| Loosen refinement (`min` ↓, `max` ↑, removed `regex`) | additive | `refinement_changed` | Strictly more accepting. |
| Tighten unknown-keys (`passthrough` → `strict`, `stripUnknown` → `strict`) | breaking | `unknown_keys_changed` | Inputs with unknowns now rejected. |
| Loosen unknown-keys (`strict` → `passthrough`, `strict` → `stripUnknown`) | additive | `unknown_keys_changed` | More accepting. |
| `passthrough` ↔ `stripUnknown` | cosmetic | `unknown_keys_changed` | Same accepted input set; output-side preserve-vs-drop differs but is *not* the lens. |
| Add enum value | additive | `enum_value_added` | Strictly more accepting. |
| Remove enum value | breaking | `enum_value_removed` | Inputs with that value now fail. |
| Change literal value | breaking | `literal_changed` | The only accepted value changed. |
| Add `default` to existing required field | additive | `default_added` | Input becomes input-optional; output unaffected for existing inputs. Tracked as one row (the implicit `optional` flip from `.default()` is masked — see [`./ABSENCE_SEMANTICS.md`](./ABSENCE_SEMANTICS.md)). |
| Remove `default` from a default-bearing field | breaking | `default_removed` | Field flips to input-required and output loses the fill. |
| Change default value | breaking | `default_value_changed` | Downstream observers see a different filled value at output. |
| `optional` → `nullable` | breaking | `absence_modifier_changed` | Drops absence-permission; old data lacking the key fails. |
| `nullable` → `optional` | breaking | `absence_modifier_changed` | Drops `null`-permission; old data with `null` fails. |
| `optional` → `nullish` | additive | `absence_modifier_changed` | Adds `null`-permission on top of absence. |
| `nullable` → `nullish` | additive | `absence_modifier_changed` | Adds absence-permission on top of `null`. |
| `nullish` → `optional` or `nullish` → `nullable` | breaking | `absence_modifier_changed` | Drops half of the previously-accepted absence/`null` permission. |
| Description / metadata-only edit | cosmetic | `metadata_changed` | No validation effect. Also covers `deprecated` flips and `schemaId` edits. |
| Refinement reorder (same set, different order) | cosmetic | `refinements_reordered` | Semantic equivalence — see [`./ZOD_MODIFIER_ORDERING.md`](./ZOD_MODIFIER_ORDERING.md) for the normalization contract. |
| `schemaVersion`-only change | cosmetic | `schema_version_changed` | Tracked separately. See the aggregation rule below. |

### Absence-state superset rule

The `absence_modifier_changed` severity is computed mechanically from the input-acceptance superset table in `absenceSeverity` ([`../src/registry/diff.ts`](../src/registry/diff.ts)):

```text
required  ⊂  optional
required  ⊂  nullable
required  ⊂  optional ⊂ nullish
required  ⊂  nullable ⊂ nullish
```

A transition is `additive` if the new state's accepted set is a superset of the old's; otherwise `breaking`. The masked-`optional` rule (a node carrying `.default()` is not separately reported as having become "optional") prevents the same change from being counted twice.

### Refinement-direction rule

Refinement param changes route through `refinementParamSeverity`. Numeric lower-bounds (`minLength`, `min`, `minItems`, `gt`) are `additive` when decreased and `breaking` when increased; numeric upper-bounds (`maxLength`, `max`, `maxItems`, `lt`) are the mirror. Equality-style refinements (`length`, `multipleOf`, `regex`) are conservatively `breaking` on any value change — the accepted set transformation is not monotone in the parameter.

## `schemaVersion` aggregation rule (Master plan Decision #13)

- A change to `metadata.version` alone, with no other changes, produces a single `schema_version_changed` row at `cosmetic` severity and `worstSeverity: "cosmetic"`.
- A `metadata.version` change *paired* with structural changes still produces the `schema_version_changed` row, but `worstSeverity` is the worst severity across the full change list — never silently demoted to `cosmetic` by the presence of the version bump.

The CLI surfaces `worstSeverity` directly; this rule keeps a version bump from masking a breaking change.

## Unsupported IR kinds

Per Master plan Decision #14, `diffNodes` **throws** `UnsupportedNodeKindError({ generator: "diff", kind })` for any IR kind not in the v0.7 supported set:

```text
supported:   string, number, boolean, literal, enum, array, object
unsupported: date, union, recursiveRef, transform
```

`diffHandler` does **not** catch — the throw propagates to the CLI dispatcher (Step 28+), which maps it to a non-zero exit code at the CLI boundary. This matches the v0.3 / v0.6 generator discipline (see [`./IR_CONTRACT.md`](./IR_CONTRACT.md)). Wrapping into an `integrity_error` `Issue` would be semantically wrong: the IR is well-formed; v0.7 simply does not know how to diff it.

## Output-side reading (not the lens)

Some rows have a divergent output-side reading. They are *not* classified differently — single-lens is the locked contract — but consumers wanting to reason about output shape can branch on the change's `kind`:

| `kind` | Input-lens severity | Output-shape implication |
|---|---|---|
| `default_added` | additive | New inputs that omit the field now produce a filled value at output; existing inputs unchanged. |
| `default_removed` | breaking | Output loses the fill; consumers expecting the field to always be present break. |
| `default_value_changed` | breaking | Output value differs for the same input; downstream observers see new values. |
| `unknown_keys_changed` (`passthrough` ↔ `stripUnknown`) | cosmetic | Output differs: `passthrough` preserves unknown keys, `stripUnknown` drops them. |

The intent is that any consumer with an output-side concern reads `change.kind` and applies its own lens. The classifier itself stays single-severity.

## Migrations are deferred

v0.7 classifies diffs; it does **not** propose, generate, or apply migrations. Migration emission is out of scope and is a v0.8+ concern. Consumers who want a migration today read the `DiffChange[]` payload and synthesize one externally.

## Implementation reference

| Surface | File |
|---|---|
| `diffNodes(before, after): readonly DiffChange[]` | [`../src/registry/diff.ts`](../src/registry/diff.ts) |
| `diffHandler({ before, after }): DiffResult` | [`../src/registry/handlers/diff.ts`](../src/registry/handlers/diff.ts) |
| Types (`DiffSeverity`, `DiffKind`, `DiffChange`, `DiffOpts`, `DiffResult`) | [`../src/registry/types.ts`](../src/registry/types.ts) |
| `UnsupportedNodeKindError` | [`../src/generators/errors.ts`](../src/generators/errors.ts) |
| Row-by-row classification fixtures | [`../tests/registry/diff-classifier.test.ts`](../tests/registry/diff-classifier.test.ts) |
| `worstSeverity` aggregation gate | [`../tests/registry/handlers/diff-handler.test.ts`](../tests/registry/handlers/diff-handler.test.ts) |
| Master plan source of truth | [`./PHASE_PLAN_v0.7.md`](./PHASE_PLAN_v0.7.md) (Decisions #11 / #12 / #13 / #14) |
