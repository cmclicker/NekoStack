# Absence Semantics

The single most under-specified part of any schema system. This package pins it.

`null` is a value. Missing is the absence of a value. They are different. Conflating them is the most common source of API drift.

## The table

| DSL | TypeScript (output) | Runtime accepts | JSON Schema `required`? | OpenAPI `nullable`? |
|---|---|---|---|---|
| `s.string()` | `field: string` | string only | yes | no |
| `s.string().optional()` | `field?: string` | missing or undefined | no | no |
| `s.string().nullable()` | `field: string \| null` | string or null; missing rejected | yes | yes |
| `s.string().nullish()` | `field?: string \| null` | missing, undefined, or null | no | yes |
| `s.string().default("x")` | input `field?: string`; output `field: string` | missing accepted; replaced | no (default emitted) | no |

## Input vs output

Critical distinction. The schema's *input* is what `parse`/`validate` accepts; the *output* is what `parse` returns (post-defaults, post-transforms).

- `optional()`: input is `T | undefined`, output is `T | undefined`. Object key is optional in *both*.
- `nullable()`: input is `T | null`, output is `T | null`. Object key is required in *both*.
- `nullish()`: input is `T | null | undefined`, output is `T | null | undefined`. Object key is optional in *both*.
- `default(v)`: input is `T | undefined` (object-optional), output is `T` (object-**required** — the default has been applied).

## Why default's asymmetry matters

A `default()`-bearing field accepts a missing input, but downstream code receives a fully-populated value. If the output type were also optional, every consumer of `parse(Schema, ...)` would have to defensively check for `undefined` despite the default making that impossible.

This is enforced by tracking `TInputKey` and `TOutputKey` as separate type parameters on `Schema` — see [`IR_CONTRACT.md`](./IR_CONTRACT.md).

## Tests that prove this

- [`tests/inference.test-d.ts`](../tests/inference.test-d.ts) — `describe("audit User example — proves the absence-semantics contract verbatim")` mirrors this table at the type level.
- [`tests/builders.test.ts`](../tests/builders.test.ts) — `describe("absence modifiers")` proves the IR modifiers (`optional`, `nullable`, `default`) are encoded correctly.

If you change `Schema`'s modifier methods, those tests are the gate. They are deliberately written against the spec table, not against implementation details.
