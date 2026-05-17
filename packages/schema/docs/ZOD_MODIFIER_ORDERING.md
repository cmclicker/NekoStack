# Zod Modifier Ordering Contract

> The fixed order in which `generateZod` applies modifiers to a Zod chain. This file is the contract; the implementation lives in [`../src/generators/zod.ts`](../src/generators/zod.ts).

## Why ordering matters

Zod modifier order changes input and output typing AND runtime acceptance behavior. `z.string().optional().default("x")` and `z.string().default("x").optional()` are NOT interchangeable. The v0.1 absence-semantics table is a contract; preserving it through generated Zod requires fixed ordering.

## The order

For any IR `SchemaNode`, the emitted chain is constructed in this exact sequence:

1. **Base schema** — `z.string()`, `z.number()`, `z.boolean()`, `z.literal(...)`, `z.enum(...)` / `z.union(...)`, `z.array(...)`, `z.object({...})`.
2. **Portable refinements** — each entry of `node.refinements` (skipping any `kind: "runtime"`), applied in IR insertion order. Examples: `.min(3)`, `.max(50)`, `.email()`, `.regex(...)`, `.int()`, `.gt()`, `.multipleOf()`.
3. **Description** — `.describe(text)` if `node.metadata.description` is set.
4. **Nullability** — `.nullable()` if `modifiers.nullable && !modifiers.optional`.
5. **Optionality** — `.optional()` if `modifiers.optional && !modifiers.nullable`.
6. **Nullish** — `.nullish()` if BOTH `modifiers.optional && modifiers.nullable`.
7. **Default LAST** — `.default(value)` if `modifiers.default` is set.

Steps 4 / 5 / 6 are mutually exclusive. Step 7 always comes last.

## Object unknown-keys

Applied to the base `z.object({...})` expression (effectively part of step 1), always explicit even though Zod's runtime default is `.strip()`:

| IR `unknownKeys` | Emitted |
|---|---|
| `"strict"` | `.strict()` |
| `"stripUnknown"` | `.strip()` |
| `"passthrough"` | `.passthrough()` |

## Worked examples

| v0.1 builder call | Emitted Zod chain |
|---|---|
| `s.string()` | `z.string()` |
| `s.string().min(3)` | `z.string().min(3)` |
| `s.string().optional()` | `z.string().optional()` |
| `s.string().nullable()` | `z.string().nullable()` |
| `s.string().nullish()` | `z.string().nullish()` |
| `s.string().default("x")` | `z.string().optional().default("x")` |
| `s.string().min(3).email().optional()` | `z.string().min(3).email().optional()` |
| `s.string().nullable().default("x")` | `z.string().nullish().default("x")` (see "Collapse rule" below) |
| `s.string().describe("d").optional()` | `z.string().describe("d").optional()` |
| `s.object({id: s.string()}).passthrough()` | `z.object({ id: z.string() }).passthrough()` |

## Collapse rule

v0.1's `.default()` sets `modifiers.optional = true` (because a defaulted field accepts missing input). When the user also calls `.nullable()`, the resulting IR has BOTH `optional` and `nullable` set, which step 6 collapses to `.nullish()`. So:

- `s.string().nullable().default("x")` → `z.string().nullish().default("x")`
- `s.string().nullish().default("x")` → `z.string().nullish().default("x")`

Both produce **identical Zod runtime behavior** (accept null, accept undefined → default applies). The collapse is correctness-preserving, not a loss.

## Required test matrix

[`../tests/generators/zod-modifier-composition.test.ts`](../tests/generators/zod-modifier-composition.test.ts) asserts on the emitted chain string for each row. [`../tests/generators/zod-execution.test.ts`](../tests/generators/zod-execution.test.ts) loads the generated code into a real Zod runtime and verifies behavior matches the v0.1 absence-semantics table for the same eight rows.

## Why a contract doc and not just code

Future generators (JSON Schema v0.3, OpenAPI v0.4) face the same question: in what order do modifiers compose? The constraints differ (no runtime in JSON Schema — `default` is metadata, not behavior), but the contract approach must repeat: pick an order, document it, test it. This doc is the template.
