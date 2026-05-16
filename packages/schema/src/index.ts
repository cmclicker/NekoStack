// =============================================================================
// Public API — @nekostack/schema v0.1
//
// Surface is intentionally narrow. Anything not re-exported here is package-
// internal and may change without a major version bump. See docs/SCOPE.md.
// =============================================================================

// ---- DSL entry point ----
export { s } from "./builders/s.js";

// ---- Base schema (for generic constraints) ----
export { Schema, type AnySchema } from "./builders/schema.js";

// ---- Concrete schema *types* (runtime classes are intentionally internal) ----
// Exported as types so consumers can write `(arg: StringSchema) => ...` without
// being able to construct one directly — schemas are always built via `s.*`.
export type { ArraySchema } from "./builders/array.js";
export type { ObjectSchema } from "./builders/object.js";
export type {
  BooleanSchema,
  EnumSchema,
  LiteralSchema,
  NumberSchema,
  StringSchema,
} from "./builders/primitives.js";

// ---- IR ----
// Only node kinds with v0.1 builders are surfaced. Future IR kinds (DateNode,
// UnionNode, RecursiveRefNode, TransformNode) are declared in the internal IR
// module but NOT re-exported here — they describe capacity, not capability.
// They will become public when their builders ship in a later phase.
export type {
  ArrayNode,
  BooleanNode,
  EnumNode,
  JsonValue,
  LiteralNode,
  NumberNode,
  ObjectNode,
  SchemaNode,
  StringNode,
} from "./ir/nodes.js";

export { serializeIR } from "./ir/serialize.js";

// ---- Errors ----
export {
  ISSUE_CODES,
  type Issue,
  type IssueCode,
  type IssuePath,
  type Result,
} from "./errors/issue.js";

// ---- Type helpers (also reachable via s.infer / s.input / s.output) ----
export type { Infer, Input, Output } from "./types.js";
