/**
 * Canonical Intermediate Representation for NekoStack schemas.
 *
 * Every builder produces a `SchemaNode`. Generators consume only IR — never
 * builder internals. This is the single contract that prevents drift between
 * the TS, Zod, JSON Schema, and OpenAPI outputs.
 *
 * The IR is JSON-serializable (no functions, no symbols, no class instances).
 * Runtime-only constructs (transforms, custom refinement predicates) are
 * stored as opaque metadata; the registry that owns the predicate is the
 * runtime, not the IR.
 */

export type SchemaNode =
  | StringNode
  | NumberNode
  | BooleanNode
  | DateNode
  | LiteralNode
  | EnumNode
  | ArrayNode
  | ObjectNode
  | UnionNode
  | RecursiveRefNode
  | TransformNode;

export interface NodeMetadata {
  id?: string;
  version?: string;
  description?: string;
  deprecated?: boolean;
}

export interface NodeModifiers {
  optional?: boolean;
  nullable?: boolean;
  /**
   * Stored as a serializable literal so the IR remains JSON-roundtrip-safe.
   * Functions-as-defaults are explicitly disallowed in v0.1.
   */
  default?: { value: JsonValue };
}

export type Refinement = PortableRefinement | RuntimeRefinement;

/**
 * A refinement representable in every output format (TS comments, Zod chain,
 * JSON Schema keyword, OpenAPI schema).
 */
export interface PortableRefinement {
  kind: "portable";
  name: PortableRefinementName;
  params?: Record<string, JsonValue>;
}

export type PortableRefinementName =
  // string
  | "minLength"
  | "maxLength"
  | "length"
  | "regex"
  | "email"
  | "uuid"
  | "url"
  // number
  | "int"
  | "min"
  | "max"
  | "gt"
  | "lt"
  | "multipleOf"
  // array
  | "minItems"
  | "maxItems";

/**
 * A custom predicate only the runtime can evaluate. Non-runtime outputs
 * (JSON Schema, OpenAPI) MUST emit semantic-loss metadata when present.
 */
export interface RuntimeRefinement {
  kind: "runtime";
  /** Stable, machine-readable issue code emitted on failure. */
  code: string;
  description?: string;
}

interface NodeBase {
  metadata?: NodeMetadata;
  modifiers?: NodeModifiers;
  refinements?: readonly Refinement[];
}

// ---- Leaf types ----

export interface StringNode extends NodeBase {
  kind: "string";
}

export interface NumberNode extends NodeBase {
  kind: "number";
}

export interface BooleanNode extends NodeBase {
  kind: "boolean";
}

/**
 * Date variants are explicit per the absence-of-ambiguity rule (no `s.date()`).
 *  - isoDateTime: ISO 8601 string (default for APIs / config)
 *  - isoDate:     YYYY-MM-DD string
 *  - epochMs:     integer milliseconds since epoch
 *  - dateObject:  runtime-only Date (never serialized)
 *
 * v0.1 declares the IR shape; builders ship in a later phase.
 */
export interface DateNode extends NodeBase {
  kind: "date";
  variant: "isoDateTime" | "isoDate" | "epochMs" | "dateObject";
}

export interface LiteralNode<T extends JsonValue = JsonValue> extends NodeBase {
  kind: "literal";
  value: T;
}

export interface EnumNode<T extends string | number = string | number>
  extends NodeBase {
  kind: "enum";
  values: readonly T[];
}

// ---- Composites ----

export interface ArrayNode extends NodeBase {
  kind: "array";
  element: SchemaNode;
}

export type UnknownKeysPolicy = "strict" | "stripUnknown" | "passthrough";

export interface ObjectNode extends NodeBase {
  kind: "object";
  fields: Readonly<Record<string, SchemaNode>>;
  unknownKeys: UnknownKeysPolicy;
}

export interface UnionNode extends NodeBase {
  kind: "union";
  options: readonly SchemaNode[];
  /** When set, the union is discriminated by this field. */
  discriminator?: string;
}

// ---- Reference / runtime-only ----

export interface RecursiveRefNode extends NodeBase {
  kind: "recursiveRef";
  /** Reverse-DNS schema id, e.g. "com.nekostack.auth.User". */
  targetId: string;
  /** Optional version pin; defaults to the latest registered. */
  targetVersion?: string;
}

export interface TransformNode extends NodeBase {
  kind: "transform";
  source: SchemaNode;
  /** Stable id of the transform; the runtime maps id → function. */
  transformId: string;
}

// ---- JSON value (constraint on serializable IR data) ----

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
