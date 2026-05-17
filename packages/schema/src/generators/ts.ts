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
  const expr = emitTypeExpression(node, mode, /*depth*/ 0);
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
 *
 * `depth` is the indentation depth of the *containing* construct (0 at top
 * level, +1 inside each enclosing object). Object types use it to indent
 * their own bodies one level deeper.
 */
function emitTypeExpression(
  node: SchemaNode,
  mode: Mode,
  depth: number,
): string {
  let inner = emitBareType(node, mode, depth);
  const mods = node.modifiers ?? {};
  if (mods.nullable) inner = `${inner} | null`;
  if (mods.optional) {
    const defaultApplied = mods.default !== undefined && mode === "output";
    if (!defaultApplied) inner = `${inner} | undefined`;
  }
  return inner;
}

// ---------- bare types ----------

function emitBareType(node: SchemaNode, mode: Mode, depth: number): string {
  // Runtime refinements are unsupported in v0.2 generators (Invariant 7).
  // The TS generator doesn't *use* refinement values, but a node carrying a
  // runtime refinement still represents validation the IR intends to enforce;
  // silently emitting the type without it would imply runtime semantics this
  // package can't (yet) guarantee. Fail loudly to match the Zod generator.
  for (const r of node.refinements ?? []) {
    if (r.kind === "runtime") {
      throw new UnsupportedNodeKindError({
        kind: "runtimeRefinement",
        generator: "typescript",
      });
    }
  }
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
      return emitArrayType(node as ArrayNode, mode, depth);
    case "object":
      return emitObjectType(node as ObjectNode, mode, depth);
    default:
      throw new UnsupportedNodeKindError({
        kind: (node as { kind: string }).kind,
        generator: "typescript",
      });
  }
}

function emitArrayType(node: ArrayNode, mode: Mode, depth: number): string {
  const elementExpr = emitTypeExpression(node.element, mode, depth);
  // Parenthesize when the element type contains a *top-level* union so `[]`
  // binds correctly. A naive `startsWith("{")` shortcut is wrong: an
  // object-then-union element like `{...} | undefined` (produced by
  // `s.array(s.object({...}).optional())`) starts with `{` but still needs
  // parens, otherwise we emit `{...} | undefined[]` which parses as
  // "object or array of undefined" — not what the IR means.
  return hasTopLevelUnion(elementExpr)
    ? `(${elementExpr})[]`
    : `${elementExpr}[]`;
}

/**
 * True if `expr` contains a `|` outside of all braces, parens, brackets,
 * and string literals. This is the structural check that distinguishes
 * `string | undefined` (top-level union → needs parens for `[]`) from
 * `{ foo: "a | b" }` (no top-level union → bare `[]` is fine).
 */
function hasTopLevelUnion(expr: string): boolean {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i]!;
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "(" || ch === "[") depth++;
    else if (ch === "}" || ch === ")" || ch === "]")
      depth = Math.max(0, depth - 1);
    else if (ch === "|" && depth === 0) return true;
  }
  return false;
}

/**
 * Emit a TS object body. `depth` is the indentation depth of THIS object:
 *  - depth 0 ⇒ top-level type alias body: inner fields at 2 spaces, `}` at column 0.
 *  - depth 1 ⇒ first-level nested object:  inner fields at 4 spaces, `}` at 2 spaces.
 *  - depth N ⇒ inner fields at 2*(N+1) spaces, `}` at 2*N spaces.
 *
 * Each enclosing object passes `depth + 1` to its field's emit, so nesting
 * grows the indent consistently. Mirrors what the Zod generator already does.
 */
function emitObjectType(
  node: ObjectNode,
  mode: Mode,
  depth: number,
): string {
  const entries = Object.entries(node.fields);
  if (entries.length === 0) return "{}";
  const fieldIndent = "  ".repeat(depth + 1);
  const closeIndent = "  ".repeat(depth);
  const lines = entries.map(([key, field]) => {
    const { keyMark, typeExpr } = emitObjectField(field, mode, depth + 1);
    const fieldDoc = emitFieldDocComment(field, fieldIndent);
    const safeKey = formatPropertyKey(key);
    return `${fieldDoc}${fieldIndent}${safeKey}${keyMark}: ${typeExpr};`;
  });
  return `{\n${lines.join("\n")}\n${closeIndent}}`;
}

/**
 * Emit an object property key. Identifier-safe keys go bare; anything else
 * (hyphens, spaces, leading digits, reserved characters) is quoted via
 * JSON.stringify so the generated type alias is valid TS for any IR-valid key.
 */
function formatPropertyKey(key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}

function emitObjectField(
  field: SchemaNode,
  mode: Mode,
  depth: number,
): { keyMark: string; typeExpr: string } {
  const mods = field.modifiers ?? {};
  let typeExpr = emitBareType(field, mode, depth);
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

function emitFieldDocComment(field: SchemaNode, indent: string): string {
  const lines: string[] = [];
  if (field.metadata?.description) lines.push(field.metadata.description);
  if (field.metadata?.deprecated) lines.push("@deprecated");
  if (lines.length === 0) return "";
  // Per-field JSDoc matches the field's indent so it lines up with the field.
  return `${indent}/**\n${lines.map((l) => `${indent} * ${l}`).join("\n")}\n${indent} */\n`;
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
