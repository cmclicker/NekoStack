import type {
  ArrayNode,
  EnumNode,
  LiteralNode,
  ObjectNode,
  SchemaNode,
} from "../ir/nodes.js";
import { UnsupportedNodeKindError } from "./errors.js";
import { buildHeader } from "./header.js";
import type { TypeScriptGeneratorOptions } from "./types.js";

type Mode = "input" | "output";

/**
 * Generate a TypeScript type alias from a SchemaNode.
 *
 * Modes (Decision #9):
 *  - "output" (default): post-default shape, matches `s.infer<T>` / `s.output<T>`.
 *  - "input":            pre-default shape, matches `s.input<T>`.
 *  - "both":             emits both `<Name>Input` and `<Name>Output`.
 *
 * Naming: derived from `metadata.id`'s last dotted segment, or
 * `options.typeName`, or `"Schema"` for anonymous schemas. In `"both"` mode,
 * the suffixes are always appended — no bare `<Name>`.
 *
 * Headers: deterministic JSDoc preamble per `buildHeader`. Same IR + same
 * generator version → byte-identical output.
 */
export function generateTypeScript(
  node: SchemaNode,
  options: TypeScriptGeneratorOptions = {},
): string {
  const mode = options.mode ?? "output";
  const baseName = options.typeName ?? deriveName(node);
  const header = buildHeader(node, { generator: "typescript" });

  if (mode === "both") {
    return [
      header,
      "",
      emitTypeAlias(node, "input", `${baseName}Input`),
      "",
      emitTypeAlias(node, "output", `${baseName}Output`),
      "",
    ].join("\n");
  }

  const name = mode === "input" ? `${baseName}Input` : baseName;
  return [header, "", emitTypeAlias(node, mode, name), ""].join("\n");
}

// ---------- top-level emit ----------

function emitTypeAlias(node: SchemaNode, mode: Mode, name: string): string {
  const doc = emitTopLevelDocComment(node);
  const expr = emitTypeExpression(node, mode);
  return `${doc}export type ${name} = ${expr};`;
}

function emitTopLevelDocComment(node: SchemaNode): string {
  const lines: string[] = [];
  if (node.metadata?.description) lines.push(node.metadata.description);
  if (node.metadata?.deprecated) lines.push("@deprecated");
  if (lines.length === 0) return "";
  return `/**\n${lines.map((l) => ` * ${l}`).join("\n")}\n */\n`;
}

// ---------- type expressions (non-field positions) ----------

/**
 * Emit a complete type expression honoring nullable/optional/default for the
 * current mode. Used at top level and inside array elements — anywhere that
 * is NOT directly an object field. Object fields use {@link emitObjectField}
 * because they handle optionality via the `?` key marker.
 */
function emitTypeExpression(node: SchemaNode, mode: Mode): string {
  let inner = emitBareType(node, mode);
  const mods = node.modifiers ?? {};
  if (mods.nullable) inner = `${inner} | null`;
  if (mods.optional) {
    const defaultApplied = mods.default !== undefined && mode === "output";
    if (!defaultApplied) inner = `${inner} | undefined`;
  }
  return inner;
}

// ---------- bare types ----------

function emitBareType(node: SchemaNode, mode: Mode): string {
  switch (node.kind) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "literal":
      return formatLiteral((node as LiteralNode).value);
    case "enum":
      return (node as EnumNode).values.map((v) => formatLiteral(v)).join(" | ");
    case "array":
      return emitArrayType(node as ArrayNode, mode);
    case "object":
      return emitObjectType(node as ObjectNode, mode);
    default:
      throw new UnsupportedNodeKindError({
        kind: (node as { kind: string }).kind,
        generator: "typescript",
      });
  }
}

function emitArrayType(node: ArrayNode, mode: Mode): string {
  const elementExpr = emitTypeExpression(node.element, mode);
  // Parenthesize when the element type contains a union (`|`), so the [] binds correctly.
  const needsParens = /[ |]/.test(elementExpr);
  return needsParens ? `(${elementExpr})[]` : `${elementExpr}[]`;
}

function emitObjectType(node: ObjectNode, mode: Mode): string {
  const entries = Object.entries(node.fields);
  if (entries.length === 0) return "{}";
  const lines = entries.map(([key, field]) => {
    const { keyMark, typeExpr } = emitObjectField(field, mode);
    const fieldDoc = emitFieldDocComment(field);
    return `${fieldDoc}  ${key}${keyMark}: ${typeExpr};`;
  });
  return `{\n${lines.join("\n")}\n}`;
}

function emitObjectField(
  field: SchemaNode,
  mode: Mode,
): { keyMark: string; typeExpr: string } {
  const mods = field.modifiers ?? {};
  let typeExpr = emitBareType(field, mode);
  if (mods.nullable) typeExpr = `${typeExpr} | null`;

  // In object-field position, optionality uses the `?` key marker; we do
  // NOT also append `| undefined` — that would produce noisier output that
  // is structurally identical (TS treats `field?: T` ≡ `field?: T | undefined`).
  let isOptional = false;
  if (mods.optional) {
    if (mods.default !== undefined) {
      isOptional = mode === "input"; // default makes input optional, output required
    } else {
      isOptional = true; // .optional() or .nullish()
    }
  }
  return { keyMark: isOptional ? "?" : "", typeExpr };
}

function emitFieldDocComment(field: SchemaNode): string {
  const lines: string[] = [];
  if (field.metadata?.description) lines.push(field.metadata.description);
  if (field.metadata?.deprecated) lines.push("@deprecated");
  if (lines.length === 0) return "";
  // Per-field JSDoc is indented to match the field's two-space indent.
  return `  /**\n${lines.map((l) => `   * ${l}`).join("\n")}\n   */\n`;
}

// ---------- helpers ----------

/**
 * Format a JsonValue as a TS literal-type expression.
 *
 * In practice v0.2 schemas use string/number/boolean/null literals; the IR
 * accepts the full `JsonValue` space (arrays / objects) for forward-compat,
 * so we accept it here and emit via `JSON.stringify`. Arrays/objects emit as
 * value-shaped JS literals — valid in expression position but not as TS
 * *literal types*. That's acceptable: nobody constructs schemas with
 * object-literal `s.literal(...)` today, and the alternative (throwing) is
 * worse than emitting a JSON-shaped fallback.
 */
function formatLiteral(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (value === null) return "null";
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function deriveName(node: SchemaNode): string {
  const id = node.metadata?.id;
  if (!id) return "Schema";
  const last = id.split(".").pop();
  return last && last.length > 0 ? last : "Schema";
}
