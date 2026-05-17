import type {
  ArrayNode,
  EnumNode,
  JsonValue,
  LiteralNode,
  ObjectNode,
  PortableRefinement,
  SchemaNode,
} from "../ir/nodes.js";
import { UnsupportedNodeKindError } from "./errors.js";
import { JSON_SCHEMA_EXTENSIONS } from "./json-schema-meta.js";

/**
 * Shared IR → JSON-Schema-shaped fragment emitter consumed by both
 * `json-schema.ts` and `openapi.ts`.
 *
 * **Why this module exists** (Decision #3, v0.4 plan): OpenAPI 3.1 Schema
 * Objects are explicitly aligned with JSON Schema draft 2020-12 — the spec
 * calls them a superset. Each wrapper has its own root structure (`$schema`,
 * `$id`, provenance generator name), but the IR → fragment translation
 * itself is identical and must not be duplicated. Duplication would create
 * a real drift vector: bug fixes would have to land twice, behavior could
 * silently diverge.
 *
 * The wrappers own:
 *  - Root document structure
 *  - `$schema` / `$id` decisions
 *  - Provenance `generator` field value
 *
 * This module owns:
 *  - Primitive type mapping
 *  - Array + object body mapping (including `required` array per absence semantics)
 *  - Object unknown-key policy (including `x-nekostack-strip`)
 *  - Portable refinement → keyword mapping
 *  - Runtime-refinement and regex-with-flags throws (Invariant 7)
 *  - Canonical key sort (`canonicalize`)
 *
 * Throw guards use the wrapper's generator name via `options.generator` so
 * `UnsupportedNodeKindError` reports the right caller (`"jsonSchema"` vs
 * `"openApi"`) — tests assert on this field per the v0.2 stable-error
 * contract.
 */

export interface SchemaFragmentOptions {
  /**
   * Which wrapper is calling. Used only to populate the `generator` field
   * of any `UnsupportedNodeKindError` thrown during translation. The
   * emitted fragment itself is identical regardless — OpenAPI 3.1 Schema
   * Objects are draft-2020-12-compatible.
   */
  generator: "jsonSchema" | "openApi";
}

/**
 * Emit the JSON-Schema-shaped fragment for a node. Returns a plain object;
 * wrappers add `$schema` / `$id` / provenance and JSON-stringify.
 *
 * Throws `UnsupportedNodeKindError` with `options.generator` for runtime
 * refinements (Decision #11) before walking the node — cheaper to fail
 * fast than to emit a partial fragment.
 */
export function emitSchemaFragment(
  node: SchemaNode,
  options: SchemaFragmentOptions,
): Record<string, JsonValue> {
  for (const r of node.refinements ?? []) {
    if (r.kind === "runtime") {
      throw new UnsupportedNodeKindError({
        kind: "runtimeRefinement",
        generator: options.generator,
      });
    }
  }

  const base = emitBareType(node, options);
  applyPortableRefinements(base, node.refinements ?? [], options);
  applyDescription(base, node);
  applyNullability(base, node);
  applyDefault(base, node);
  return base;
}

function emitBareType(
  node: SchemaNode,
  options: SchemaFragmentOptions,
): Record<string, JsonValue> {
  switch (node.kind) {
    case "string":
      return { type: "string" };
    case "number":
      return { type: "number" };
    case "boolean":
      return { type: "boolean" };
    case "literal":
      return emitLiteral(node as LiteralNode);
    case "enum":
      return emitEnum(node as EnumNode);
    case "array":
      return emitArray(node as ArrayNode, options);
    case "object":
      return emitObject(node as ObjectNode, options);
    default:
      throw new UnsupportedNodeKindError({
        kind: (node as { kind: string }).kind,
        generator: options.generator,
      });
  }
}

function emitLiteral(node: LiteralNode): Record<string, JsonValue> {
  return { const: node.value };
}

function emitEnum(node: EnumNode): Record<string, JsonValue> {
  if (node.values.length === 0) {
    throw new Error("Cannot emit JSON Schema for an empty enum");
  }
  return { enum: [...node.values] as JsonValue[] };
}

function emitArray(
  node: ArrayNode,
  options: SchemaFragmentOptions,
): Record<string, JsonValue> {
  return {
    type: "array",
    items: emitSchemaFragment(node.element, options),
  };
}

function emitObject(
  node: ObjectNode,
  options: SchemaFragmentOptions,
): Record<string, JsonValue> {
  const entries = Object.entries(node.fields);
  const properties: Record<string, JsonValue> = {};
  const required: string[] = [];

  for (const [key, field] of entries) {
    properties[key] = emitSchemaFragment(field, options);
    if (isObjectRequired(field)) required.push(key);
  }

  const out: Record<string, JsonValue> = {
    type: "object",
    properties,
  };
  if (required.length > 0) out.required = required;

  // Decision #12 (corrected in v0.3): `stripUnknown` accepts unknown keys
  // (`additionalProperties: true`) and tags `x-nekostack-strip: true` so
  // NekoStack-aware consumers know to strip them. JSON Schema (and OpenAPI
  // Schema Objects) cannot express mutation; stripping happens in the
  // runtime.
  switch (node.unknownKeys) {
    case "strict":
      out.additionalProperties = false;
      break;
    case "passthrough":
      out.additionalProperties = true;
      break;
    case "stripUnknown":
      out.additionalProperties = true;
      out[JSON_SCHEMA_EXTENSIONS.strip] = true;
      break;
  }

  return out;
}

/**
 * Object-field requiredness per Decisions #6-#9:
 *  - `optional()`              → not in `required` array
 *  - `nullable()`              → IS in `required` (null is a value)
 *  - `nullish()`               → not in `required`
 *  - `default(v)`              → not in `required` (input-optional honored;
 *                                 default applied by runtime, not the schema)
 */
function isObjectRequired(node: SchemaNode): boolean {
  const mods = node.modifiers ?? {};
  if (mods.optional) return false;
  if (mods.default !== undefined) return false;
  return true;
}

// ---------- refinements ----------

function applyPortableRefinements(
  out: Record<string, JsonValue>,
  refinements: readonly { kind: string }[],
  options: SchemaFragmentOptions,
): void {
  for (const r of refinements) {
    if (r.kind !== "portable") continue; // runtime already threw
    applyPortableRefinement(out, r as PortableRefinement, options);
  }
}

function applyPortableRefinement(
  out: Record<string, JsonValue>,
  r: PortableRefinement,
  options: SchemaFragmentOptions,
): void {
  const params = r.params ?? {};
  switch (r.name) {
    case "minLength":
      out.minLength = numParam(params.value);
      return;
    case "maxLength":
      out.maxLength = numParam(params.value);
      return;
    case "length": {
      const v = numParam(params.value);
      out.minLength = v;
      out.maxLength = v;
      return;
    }
    case "regex": {
      // Decision #11a: regex with non-empty flags throws — emitting
      // source-only `pattern` would change validation behavior (drop
      // case-insensitivity etc.), and Invariant 7 forbids silent drops.
      const source = String(params.source ?? "");
      const flags = String(params.flags ?? "");
      if (flags.length > 0) {
        throw new UnsupportedNodeKindError({
          kind: "regexFlags",
          generator: options.generator,
        });
      }
      out.pattern = source;
      return;
    }
    case "email":
      out.format = "email";
      return;
    case "uuid":
      out.format = "uuid";
      return;
    case "url":
      out.format = "uri";
      return;
    case "int":
      out.type = "integer";
      return;
    case "min":
      out.minimum = numParam(params.value);
      return;
    case "max":
      out.maximum = numParam(params.value);
      return;
    case "gt":
      out.exclusiveMinimum = numParam(params.value);
      return;
    case "lt":
      out.exclusiveMaximum = numParam(params.value);
      return;
    case "multipleOf":
      out.multipleOf = numParam(params.value);
      return;
    case "minItems":
      out.minItems = numParam(params.value);
      return;
    case "maxItems":
      out.maxItems = numParam(params.value);
      return;
  }
}

// ---------- modifiers + description ----------

function applyDescription(out: Record<string, JsonValue>, node: SchemaNode): void {
  if (node.metadata?.description) out.description = node.metadata.description;
  if (node.metadata?.deprecated) out.deprecated = true;
}

function applyNullability(out: Record<string, JsonValue>, node: SchemaNode): void {
  if (!node.modifiers?.nullable) return;

  if ("type" in out && out.type !== undefined) {
    const current = out.type;
    if (Array.isArray(current)) {
      if (!current.includes("null")) out.type = [...current, "null"];
    } else {
      out.type = [current as string, "null"];
    }
    return;
  }

  if ("enum" in out && Array.isArray(out.enum)) {
    if (!out.enum.includes(null)) out.enum = [...out.enum, null];
    return;
  }

  if ("const" in out) {
    const value = out.const;
    delete out.const;
    out.anyOf = [{ const: value }, { type: "null" }];
    return;
  }
}

function applyDefault(out: Record<string, JsonValue>, node: SchemaNode): void {
  const def = node.modifiers?.default;
  if (def === undefined) return;
  out.default = def.value;
  out[JSON_SCHEMA_EXTENSIONS.defaultAppliedBy] = "runtime";
}

// ---------- helpers ----------

function numParam(value: unknown): number {
  if (typeof value !== "number") {
    throw new Error(`Expected numeric refinement param, got ${typeof value}`);
  }
  return value;
}

/**
 * Canonical key-sort, recursive. Wrappers apply this to the assembled root
 * before stringifying so the output is byte-stable across runs.
 */
export function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as object).sort()) {
    const v = (value as Record<string, unknown>)[key];
    if (v === undefined) continue;
    out[key] = canonicalize(v);
  }
  return out;
}
