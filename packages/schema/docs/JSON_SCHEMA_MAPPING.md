# JSON Schema Mapping Contract

> How `generateJsonSchema` translates a `SchemaNode` into JSON Schema **draft 2020-12**. This file is the contract; the implementation lives in [`../src/generators/json-schema.ts`](../src/generators/json-schema.ts).

## Why a contract doc

JSON Schema does not represent NekoStack's absence semantics 1:1 with TypeScript or Zod. A separate contract is needed because:

- Object-field optionality is encoded in the parent's `required` array, not at the field type.
- `null` is a value in JSON Schema's type system; nullability extends `type` into an array (`["string", "null"]`).
- `default` is **annotation only** — JSON Schema validators do not apply defaults during validation.
- Mutation (the kind of thing `stripUnknown` does at runtime) can't be expressed at all.
- `pattern` doesn't take flags.

Drift between IR semantics and JSON Schema output would silently produce schemas that accept or reject the wrong inputs. This doc pins the rules so the future implementer (and anyone reviewing generator changes) can check against it.

## Output model

`generateJsonSchema(node, options?)` returns a **complete JSON document** — `$schema` + (`$id` if named) + the body + provenance. Canonical: every object's keys are sorted at every level; 2-space indent; single trailing newline. Same IR + same generator version → byte-identical output.

The output models **accepted input**. The output-shape variant (default-applied, all fields required) is not representable as a single JSON Schema; it is deferred to a later phase if a concrete consumer needs it.

## Root structure

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:nekostack:schema:<id>:<version>",
  "type": "...",
  "properties": { ... },
  "x-nekostack": {
    "generator": "jsonSchema",
    "generatorVersion": "@nekostack/schema@<version>",
    "irHash": "sha256:<64-hex>",
    "schemaId": "<id or null>",
    "schemaVersion": "<version or null>"
  }
}
```

## Identity (`$id`)

Default: **URN**.

```
urn:nekostack:schema:<metadata.id>:<metadata.version>
```

URL form is opt-in via `options.idBase`:

```ts
generateJsonSchema(node, { idBase: "https://schemas.example.com" });
// → $id: "https://schemas.example.com/<metadata.id>/<metadata.version>"
```

Edge cases:
- **Anonymous schema** (no `metadata.id`) → no `$id` emitted.
- **No version** → emit URN/URL without the trailing version segment.
- **Never emits `$defs`** in v0.3 — inline schemas only. Extraction strategy documented for a future phase (when recursive refs or registry-backed refs ship).

## Absence semantics

For an object field with the given IR modifiers:

| IR modifier | In `required`? | Field `type` | `default` annotation? |
|---|---|---|---|
| (none) | yes | base | — |
| `optional()` | **no** | base | — |
| `nullable()` | yes | `["base", "null"]` | — |
| `nullish()` | **no** | `["base", "null"]` | — |
| `default(v)` | **no** | base | `default: v` + `x-nekostack-default-applied-by: "runtime"` |

`default` is JSON Schema annotation only — validators do not apply it. The `x-nekostack-default-applied-by: "runtime"` extension tells NekoStack-aware consumers that the runtime (or the generated Zod) is responsible for filling in the default.

The output models input. The asymmetry from v0.1 (default → input-optional, output-required) does not survive cleanly to JSON Schema; the input side is what's represented.

## Object unknown-key policy

| IR `unknownKeys` | JSON Schema |
|---|---|
| `"strict"` | `additionalProperties: false` |
| `"passthrough"` | `additionalProperties: true` |
| `"stripUnknown"` | `additionalProperties: true` + `x-nekostack-strip: true` |

**Why `true` (not `false`) for `stripUnknown`:** `stripUnknown` means *input may carry unknown keys; the runtime strips them; the result is clean*. JSON Schema models accepted input. Emitting `additionalProperties: false` would make validators **reject** inputs that `stripUnknown` is supposed to **accept** — that's `strict` semantics in disguise.

JSON Schema cannot express mutation, so the strip step lives in the runtime; the `x-nekostack-strip: true` extension tells NekoStack-aware consumers to perform it.

## Portable refinements

| IR refinement | JSON Schema |
|---|---|
| `minLength` | `minLength` |
| `maxLength` | `maxLength` |
| `length` | `minLength` + `maxLength` (both set to value) |
| `regex` (no flags) | `pattern` |
| `regex` (non-empty flags) | **throws** — see "Throw contract" |
| `email` | `format: "email"` |
| `uuid` | `format: "uuid"` |
| `url` | `format: "uri"` |
| `int` | `type: "integer"` (replaces `type: "number"`) |
| `min` (number) | `minimum` |
| `max` (number) | `maximum` |
| `gt` (number) | `exclusiveMinimum` |
| `lt` (number) | `exclusiveMaximum` |
| `multipleOf` | `multipleOf` |
| `minItems` (array) | `minItems` |
| `maxItems` (array) | `maxItems` |

## Throw contract

The generator throws `UnsupportedNodeKindError` rather than silently producing a schema that changes validation semantics:

| Case | `kind` | Rationale |
|---|---|---|
| IR kind `date` / `union` / `recursiveRef` / `transform` | the kind name | No mapping in v0.3 |
| Runtime refinement (`refinements[i].kind === "runtime"`) | `"runtimeRefinement"` | Emitting JSON Schema without it would silently accept inputs the IR rejects |
| `regex` with non-empty flags | `"regexFlags"` | JSON Schema `pattern` has no flag support; emitting source-only would drop case-insensitivity / unicode / etc. — that's a behavior change, not metadata loss |

Error shape (same as v0.2):

```ts
{
  code: "UNSUPPORTED_NODE_KIND",
  kind: "date" | "union" | "recursiveRef" | "transform" | "runtimeRefinement" | "regexFlags",
  generator: "jsonSchema",
}
```

Tests assert on `code` / `kind` / `generator` — never on message text.

## Semantic-loss extensions (`x-nekostack-*`)

When JSON Schema can accept the same input but cannot express a NekoStack runtime action or annotation directly, the generator emits an `x-nekostack-*` extension key:

| Extension | Where | Meaning |
|---|---|---|
| `x-nekostack-default-applied-by: "runtime"` | on a node with `default()` | JSON Schema does not apply defaults at validation; the runtime must |
| `x-nekostack-strip: true` | on an object with `stripUnknown` | The schema accepts unknown keys; the runtime must strip them |

When emitting would *change validation behavior* (runtime refinements, regex flags), the generator throws instead. The rule of thumb: metadata = "JSON Schema validates the same thing, downstream needs to know more"; throw = "emitting would change what the schema validates."

## Test coverage

- [`../tests/generators/json-schema.test.ts`](../tests/generators/json-schema.test.ts) — snapshot + identity + absence-semantics + object policy + throw cases.
- [`../tests/generators/json-schema-ajv2020-self.test.ts`](../tests/generators/json-schema-ajv2020-self.test.ts) — Ajv2020 `addSchema()` against each generated schema, confirming it is itself a valid draft-2020-12 document.
- [`../tests/generators/json-schema-ajv2020-exec.test.ts`](../tests/generators/json-schema-ajv2020-exec.test.ts) — Ajv2020 `compile()` then run against expected-pass / expected-fail inputs from the v0.1/v0.2 absence-semantics matrix.

If a future change to the generator would break this contract, the relevant test fails. That's the gate.
