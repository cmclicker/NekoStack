# IR Contract

> Builders produce IR. Generators consume IR. Generators must not consume builder internals. IR must remain serializable and deterministic.

This one sentence is the load-bearing constraint on every future phase. The DSL is replaceable; the IR is not.

## What the IR is

A `SchemaNode` is a discriminated union of plain-data objects:

```ts
type SchemaNode =
  | StringNode | NumberNode | BooleanNode | DateNode
  | LiteralNode | EnumNode | ArrayNode | ObjectNode
  | UnionNode | RecursiveRefNode | TransformNode;
```

It is:
- **Serializable** — no functions, no symbols, no class instances. JSON-roundtrip-safe.
- **Deterministic** — `serializeIR(node)` is canonical (keys sorted, undefined dropped). Two structurally identical IRs always produce byte-identical output.
- **Deep-frozen by construction** — every node returned by a builder, and every nested node beneath it, is `Object.freeze`-d. Mutation in strict mode throws.
- **Free of builder coupling** — generators read `node.kind`, `node.modifiers`, `node.refinements`, etc. They never reach into `Schema` class internals.

## Builder → IR

Every builder method returns a *new* schema (no in-place mutation). Each schema instance carries a `readonly node: SchemaNode` that is the canonical IR for that schema.

```ts
const u = s.string().min(3).optional();
u.node; // { kind: "string", refinements: [...], modifiers: { optional: true } }
```

## v0.1 IR capacity vs capability

v0.1 declares the IR shape for all 12 node kinds, but only ships builders for seven:

| IR node kind | v0.1 builder? |
|---|---|
| `StringNode` | yes |
| `NumberNode` | yes |
| `BooleanNode` | yes |
| `LiteralNode` | yes |
| `EnumNode` | yes |
| `ArrayNode` | yes |
| `ObjectNode` | yes |
| `DateNode` | **no** — future (isoDateTime / isoDate / epochMs / dateObject variants) |
| `UnionNode` | **no** — future |
| `RecursiveRefNode` | **no** — future (requires schema id resolver) |
| `TransformNode` | **no** — future (runtime-only; needs parse engine) |

Node kinds without builders are **declared in the IR module but NOT re-exported from the public API**. They describe capacity, not capability. They will become public when their builders ship.

## Constraints on future generators

When the v0.2+ generators land (TS, Zod, JSON Schema, OpenAPI), they MUST:

1. **Consume only `SchemaNode`** — accept a node, walk it, emit output. Never accept a `Schema` instance.
2. **Be pure functions of the IR** — same IR + same generator version → byte-identical output.
3. **Mark semantic loss explicitly** — when an output format cannot faithfully represent a node (e.g., a runtime-only refinement in JSON Schema), emit metadata (`x-nekostack-*`) flagging the gap rather than silently lying.
4. **Live inside this package** initially. Third-party generator plugins are deferred to v1.0+.

If a generator pattern-matches against `StringSchema` (the class) instead of `node.kind === "string"` (the IR), reject it. That's the failure mode this contract exists to prevent.

## Tests that prove this

- [`tests/builders.test.ts`](../tests/builders.test.ts) — `describe("immutability")` proves freezing applies recursively and mutation throws.
- [`tests/ir.test.ts`](../tests/ir.test.ts) — `describe("serializeIR")` proves keys sort, undefined drops, equivalent IRs produce byte-identical output, distinct IRs differ.
