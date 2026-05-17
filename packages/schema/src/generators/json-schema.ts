import type {
  ArrayNode,
  EnumNode,
  JsonValue,
  LiteralNode,
  ObjectNode,
  PortableRefinement,
  SchemaNode,
} from "../ir/nodes.js";
import { irHash } from "../ir/hash.js";
import { UnsupportedNodeKindError } from "./errors.js";
import { GENERATOR_VERSION } from "./version.js";
import type { JsonSchemaGeneratorOptions } from "./types.js";

/**
 * Generate a JSON Schema **draft 2020-12** document from a `SchemaNode`.
 *
 * Returns canonical, pretty-printed JSON (sorted keys at every level,
 * 2-space indent, trailing newline). Same IR + same generator version →
 * byte-identical output. See [`docs/JSON_SCHEMA_MAPPING.md`](../../docs/JSON_SCHEMA_MAPPING.md)
 * for the full contract (absence-semantics translation, refinement
 * mapping, `stripUnknown` representation, `$id` strategy).
 *
 * Output models **accepted input**. There is no `mode` option in v0.3 —
 * the output-shape variant (default-applied, all fields required) is not
 * representable as a single JSON Schema and is deferred.
 *
 * Throws `UnsupportedNodeKindError` (Invariant 7) when emitting would
 * change validation semantics:
 *  - IR kinds without v0.3 mapping: `date` / `union` / `recursiveRef` / `transform`.
 *  - Runtime refinements (`kind: "runtime"`) — would silently accept inputs the IR rejects.
 *  - Regex refinements with non-empty flags — JSON Schema `pattern` has no flag support, dropping them would lose case-insensitivity etc.
 */
export function generateJsonSchema(
  node: SchemaNode,
  options: JsonSchemaGeneratorOptions = {},
): string {
  const body = emitSchemaBody(node, options);
  const idBlock = emitRootIdBlock(node, options);
  const provenance = emitProvenance(node);
  const root = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    ...idBlock,
    ...body,
    ...provenance,
  };
  return JSON.stringify(canonicalize(root), null, 2) + "\n";
}

// ---------- root-level provenance + identity ----------

/**
 * v0.3 places provenance under a single `x-nekostack` extension object so
 * it doesn't pollute the top-level JSON Schema namespace and is easy for
 * downstream tooling to read or strip. Mirrors the v0.2 JSDoc header
 * concept, adapted for a comment-less format.
 */
function emitProvenance(node: SchemaNode): Record<string, JsonValue> {
  return {
    "x-nekostack": {
      generator: "jsonSchema",
      generatorVersion: GENERATOR_VERSION,
      irHash: `sha256:${irHash(node)}`,
      schemaId: node.metadata?.id ?? null,
      schemaVersion: node.metadata?.version ?? null,
    },
  };
}

function emitRootIdBlock(
  node: SchemaNode,
  options: JsonSchemaGeneratorOptions,
): Record<string, string> {
  const id = node.metadata?.id;
  if (!id) return {}; // anonymous → no $id (Decision #3)
  const version = node.metadata?.version;
  return { $id: formatId(id, version, options) };
}

/**
 * Decision #2: URN by default (`urn:nekostack:schema:<id>:<version>`).
 * URL-shaped IDs are opt-in via `options.idBase`. If `version` is absent,
 * emit the URN/URL without the trailing version segment.
 */
function formatId(
  id: string,
  version: string | undefined,
  options: JsonSchemaGeneratorOptions,
): string {
  if (options.idBase !== undefined) {
    const base = options.idBase.replace(/\/+$/, "");
    return version === undefined
      ? `${base}/${id}`
      : `${base}/${id}/${version}`;
  }
  return version === undefined
    ? `urn:nekostack:schema:${id}`
    : `urn:nekostack:schema:${id}:${version}`;
}

// ---------- per-node body emission ----------

/**
 * Emit the JSON Schema fragment for a node (without `$schema`, `$id`,
 * provenance — those are root-only). Recursive; called with `depth` only
 * for future debug aids (we don't use it for layout because JSON.stringify
 * handles indentation).
 */
function emitSchemaBody(
  node: SchemaNode,
  options: JsonSchemaGeneratorOptions,
): Record<string, JsonValue> {
  // Guard: runtime refinements throw before we look at anything else
  // (Decision #11). Cheaper to fail fast than to emit a partial schema.
  for (const r of node.refinements ?? []) {
    if (r.kind === "runtime") {
      throw new UnsupportedNodeKindError({
        kind: "runtimeRefinement",
        generator: "jsonSchema",
      });
    }
  }

  const base = emitBareType(node, options);
  applyPortableRefinements(base, node.refinements ?? []);
  applyDescription(base, node);
  applyNullability(base, node);
  applyDefault(base, node);
  return base;
}

function emitBareType(
  node: SchemaNode,
  options: JsonSchemaGeneratorOptions,
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
        generator: "jsonSchema",
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
  options: JsonSchemaGeneratorOptions,
): Record<string, JsonValue> {
  return {
    type: "array",
    items: emitSchemaBody(node.element, options),
  };
}

function emitObject(
  node: ObjectNode,
  options: JsonSchemaGeneratorOptions,
): Record<string, JsonValue> {
  const entries = Object.entries(node.fields);
  const properties: Record<string, JsonValue> = {};
  const required: string[] = [];

  for (const [key, field] of entries) {
    properties[key] = emitSchemaBody(field, options);
    if (isObjectRequired(field)) required.push(key);
  }

  const out: Record<string, JsonValue> = {
    type: "object",
    properties,
  };
  if (required.length > 0) out.required = required;

  // Decision #12 (corrected): `stripUnknown` accepts unknown keys
  // (additionalProperties: true) and tags `x-nekostack-strip: true` so
  // NekoStack-aware consumers know to strip them. JSON Schema cannot
  // express mutation; stripping happens in the runtime.
  switch (node.unknownKeys) {
    case "strict":
      out.additionalProperties = false;
      break;
    case "passthrough":
      out.additionalProperties = true;
      break;
    case "stripUnknown":
      out.additionalProperties = true;
      out["x-nekostack-strip"] = true;
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
 *                                 default applied by runtime, not JSON Schema)
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
): void {
  for (const r of refinements) {
    if (r.kind !== "portable") continue; // runtime already threw
    applyPortableRefinement(out, r as PortableRefinement);
  }
}

function applyPortableRefinement(
  out: Record<string, JsonValue>,
  r: PortableRefinement,
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
          generator: "jsonSchema",
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
      // The `int` refinement narrows the JSON Schema `type` itself rather
      // than adding a separate constraint. Override the existing type.
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

/**
 * `nullable()` / `nullish()`: extend the `type` slot to include `"null"`.
 * Uses the type-array form supported by draft 2020-12 (e.g.
 * `type: ["string", "null"]`).
 *
 * `enum` and `const` nodes don't have a `type` to extend; for those, we
 * append `null` to the value list instead.
 */
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
    // A nullable literal becomes anyOf [const, null].
    const value = out.const;
    delete out.const;
    out.anyOf = [{ const: value }, { type: "null" }];
    return;
  }
}

/**
 * Decision #9 (corrected): `default` is JSON Schema annotation only.
 * Validators don't apply it. We tag `x-nekostack-default-applied-by:
 * "runtime"` so downstream consumers know the default has to be applied
 * by the runtime (or generated Zod), not by JSON Schema-level validation.
 */
function applyDefault(out: Record<string, JsonValue>, node: SchemaNode): void {
  const def = node.modifiers?.default;
  if (def === undefined) return;
  out.default = def.value;
  out["x-nekostack-default-applied-by"] = "runtime";
}

// ---------- helpers ----------

function numParam(value: unknown): number {
  if (typeof value !== "number") {
    throw new Error(`Expected numeric refinement param, got ${typeof value}`);
  }
  return value;
}

/**
 * Canonical key-sort, recursive. Mirrors `serializeIR`'s approach so the
 * JSON Schema output is byte-stable across runs.
 */
function canonicalize(value: unknown): unknown {
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
