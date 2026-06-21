// =============================================================================
// Public API — @nekostack/schema v1.0.1
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
export { irHash } from "./ir/hash.js";

// ---- Generators ----
// Each generator consumes the canonical SchemaNode IR and returns a complete
// emit-ready artifact as a string. File-writing is intentionally a downstream
// concern.
//   - generateTypeScript / generateZod emit TS-source artifacts (header
//     comment + body code).
//   - generateJsonSchema / generateOpenApiSchemaComponent emit JSON artifacts
//     (provenance is embedded via the `x-nekostack` extension object — JSON
//     has no comment syntax).
// See docs/USAGE.md for per-generator details and docs/{HEADER_FORMAT,
// JSON_SCHEMA_MAPPING, OPENAPI_MAPPING}.md for the per-format contracts.
export { generateTypeScript } from "./generators/ts.js";
export { generateZod } from "./generators/zod.js";
export { generateJsonSchema } from "./generators/json-schema.js";
export { generateOpenApiSchemaComponent } from "./generators/openapi.js";
export type {
  GeneratorOptions,
  JsonSchemaGeneratorOptions,
  OpenApiGeneratorOptions,
  TypeScriptGeneratorOptions,
  ZodGeneratorOptions,
} from "./generators/types.js";
export { GENERATOR_VERSION } from "./generators/version.js";
export { UnsupportedNodeKindError } from "./generators/errors.js";

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

// ---- Composition (v0.5) ----
// Composition operators are methods on ObjectSchema; no new top-level
// functions. These public types are the constraint / options shapes —
// internal `*Shape` helpers (PickShape, MergeLeftShape, etc.) stay
// package-internal until a downstream consumer needs to write generic
// helpers over composed shapes.
export type { Mask, OverrideMask, MergeOptions } from "./types.js";

// ---- Runtime validation (v0.6) ----
// Three free-function entry points + one error class. See `docs/RUNTIME.md`
// for the full contract — default semantics, unknown-key policies, issue
// normalization, the validate-only IR variant, and the engine-swap-safe
// invariant that keeps Zod internal. The compile cache, the
// validate-variant cache, the Zod source-vs-runtime semantic mapping, and
// the `ZodError → Issue[]` normalizer are intentionally NOT re-exported:
// they are implementation surface that v0.7+ may rework without a major
// version bump.
export { parse, safeParse, validate } from "./runtime/parse.js";
export { ParseError } from "./runtime/errors.js";
