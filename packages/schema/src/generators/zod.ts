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
import { buildHeader } from "./header.js";
import type { ZodGeneratorOptions } from "./types.js";

/**
 * Generate Zod 3.x schema code from a SchemaNode.
 *
 * Output is a complete TS module: header + `import { z } from "zod"` +
 * `export const <name> = <chain>;`.
 *
 * **Modifier ordering contract (Decision #8)** — the order modifiers are
 * applied in the emitted chain matters because Zod's input/output typing
 * depends on it. The order is fixed:
 *
 *   1. base schema (`z.string()`, `z.object({...})`, …)
 *   2. portable refinements (`.min()`, `.email()`, …) in IR insertion order
 *   3. nullability — `.nullable()` if `modifiers.nullable && !modifiers.optional`
 *   4. optionality — `.optional()` if `modifiers.optional && !modifiers.nullable`
 *   5. nullish — `.nullish()` if both `optional && nullable`
 *   6. **default LAST** — `.default(value)` if `modifiers.default` is set
 *
 * Default applies last so the IR's "input-optional, output-required"
 * absence-semantics contract is preserved end-to-end through Zod's runtime.
 *
 * `metadata.description` → `.describe(text)`. `metadata.deprecated` → JSDoc
 * comment only (Zod has no deprecated marker).
 */
export function generateZod(
  node: SchemaNode,
  options: ZodGeneratorOptions = {},
): string {
  const constName = options.constName ?? "schema";
  const header = buildHeader(node, { generator: "zod" });
  const chain = emitZodExpression(node, /*depth*/ 0);

  const doc = emitTopLevelDocComment(node);
  return [
    header,
    "",
    `import { z } from "zod";`,
    "",
    `${doc}export const ${constName} = ${chain};`,
    "",
  ].join("\n");
}

// ---------- expression emission (base + refinements + modifiers in order) ----------

function emitZodExpression(node: SchemaNode, depth: number): string {
  let expr = emitBase(node, depth);
  expr = applyPortableRefinements(expr, node.refinements ?? []);
  expr = applyDescribe(expr, node);
  expr = applyAbsenceModifiers(expr, node);
  expr = applyDefault(expr, node);
  return expr;
}

// ---------- base ----------

function emitBase(node: SchemaNode, depth: number): string {
  switch (node.kind) {
    case "string":
      return "z.string()";
    case "number":
      return "z.number()";
    case "boolean":
      return "z.boolean()";
    case "literal":
      return `z.literal(${formatJson((node as LiteralNode).value)})`;
    case "enum":
      return emitEnum(node as EnumNode);
    case "array":
      return `z.array(${emitZodExpression((node as ArrayNode).element, depth + 1)})`;
    case "object":
      return emitObject(node as ObjectNode, depth);
    default:
      throw new UnsupportedNodeKindError({
        kind: (node as { kind: string }).kind,
        generator: "zod",
      });
  }
}

function emitEnum(node: EnumNode): string {
  // Defensive: empty enums should be rejected at the builder level
  // (s.enum throws), but if one ever reaches here it would emit invalid
  // Zod. Fail loudly instead.
  if (node.values.length === 0) {
    throw new Error("Cannot emit Zod for an empty enum");
  }
  // z.enum is string-only in Zod 3. For string enums, use z.enum.
  const allStrings = node.values.every((v) => typeof v === "string");
  if (allStrings) {
    const list = (node.values as readonly string[])
      .map((v) => JSON.stringify(v))
      .join(", ");
    return `z.enum([${list}] as const)`;
  }
  // Numeric or mixed enum. A union of one literal is invalid in Zod
  // (z.union requires >= 2 options), so collapse a single-value enum to
  // z.literal directly.
  if (node.values.length === 1) {
    return `z.literal(${formatJson(node.values[0])})`;
  }
  const parts = node.values.map((v) => `z.literal(${formatJson(v)})`);
  return `z.union([${parts.join(", ")}])`;
}

function emitObject(node: ObjectNode, depth: number): string {
  const entries = Object.entries(node.fields);
  if (entries.length === 0) {
    return wrapUnknownKeys("z.object({})", node.unknownKeys);
  }
  const indent = "  ".repeat(depth + 1);
  const closeIndent = "  ".repeat(depth);
  const lines = entries.map(([key, field]) => {
    const safeKey = isSafeIdentifier(key) ? key : JSON.stringify(key);
    return `${indent}${safeKey}: ${emitZodExpression(field, depth + 1)},`;
  });
  const body = `z.object({\n${lines.join("\n")}\n${closeIndent}})`;
  return wrapUnknownKeys(body, node.unknownKeys);
}

function wrapUnknownKeys(expr: string, policy: ObjectNode["unknownKeys"]): string {
  // Zod's default is "strip"; we always emit the explicit modifier so the
  // generated code is unambiguous about which policy applies.
  switch (policy) {
    case "strict":
      return `${expr}.strict()`;
    case "stripUnknown":
      return `${expr}.strip()`;
    case "passthrough":
      return `${expr}.passthrough()`;
  }
}

// ---------- portable refinements (step 2 in the ordering contract) ----------

function applyPortableRefinements(
  expr: string,
  refinements: readonly { kind: string }[],
): string {
  let out = expr;
  for (const r of refinements) {
    if (r.kind === "runtime") {
      // Fail loudly per Invariant 7. Runtime refinements are unsupported in
      // v0.2 generators — silently dropping them would emit a chain that
      // accepts inputs the IR intends to reject.
      throw new UnsupportedNodeKindError({
        kind: "runtimeRefinement",
        generator: "zod",
      });
    }
    if (r.kind !== "portable") continue;
    const p = r as PortableRefinement;
    out += emitPortableRefinement(p);
  }
  return out;
}

function emitPortableRefinement(r: PortableRefinement): string {
  const params = r.params ?? {};
  switch (r.name) {
    case "minLength":
      return `.min(${jsonNum(params.value)})`;
    case "maxLength":
      return `.max(${jsonNum(params.value)})`;
    case "length":
      return `.length(${jsonNum(params.value)})`;
    case "regex": {
      const source = String(params.source ?? "");
      const flags = String(params.flags ?? "");
      return `.regex(new RegExp(${JSON.stringify(source)}, ${JSON.stringify(flags)}))`;
    }
    case "email":
      return `.email()`;
    case "uuid":
      return `.uuid()`;
    case "url":
      return `.url()`;
    case "int":
      return `.int()`;
    case "min":
      return `.min(${jsonNum(params.value)})`;
    case "max":
      return `.max(${jsonNum(params.value)})`;
    case "gt":
      return `.gt(${jsonNum(params.value)})`;
    case "lt":
      return `.lt(${jsonNum(params.value)})`;
    case "multipleOf":
      return `.multipleOf(${jsonNum(params.value)})`;
    case "minItems":
      return `.min(${jsonNum(params.value)})`;
    case "maxItems":
      return `.max(${jsonNum(params.value)})`;
  }
}

// ---------- describe (between refinements and absence) ----------

function applyDescribe(expr: string, node: SchemaNode): string {
  const desc = node.metadata?.description;
  if (!desc) return expr;
  return `${expr}.describe(${JSON.stringify(desc)})`;
}

// ---------- absence modifiers (steps 3-5: nullable / optional / nullish) ----------

function applyAbsenceModifiers(expr: string, node: SchemaNode): string {
  const mods = node.modifiers ?? {};
  // We are exclusive between the three to avoid `.optional().nullable()`
  // (which produces a different Zod type than `.nullish()` despite looking
  // semantically equivalent).
  if (mods.optional && mods.nullable) return `${expr}.nullish()`;
  if (mods.nullable) return `${expr}.nullable()`;
  if (mods.optional) return `${expr}.optional()`;
  return expr;
}

// ---------- default (step 6: LAST) ----------

function applyDefault(expr: string, node: SchemaNode): string {
  const def = node.modifiers?.default;
  if (!def) return expr;
  return `${expr}.default(${formatJson(def.value)})`;
}

// ---------- helpers ----------

function emitTopLevelDocComment(node: SchemaNode): string {
  const lines: string[] = [];
  if (node.metadata?.deprecated) lines.push("@deprecated");
  if (lines.length === 0) return "";
  return `/**\n${lines.map((l) => ` * ${l}`).join("\n")}\n */\n`;
}

function formatJson(value: JsonValue | unknown): string {
  return JSON.stringify(value);
}

function jsonNum(value: unknown): string {
  if (typeof value !== "number") {
    throw new Error(`Expected numeric refinement param, got ${typeof value}`);
  }
  return String(value);
}

function isSafeIdentifier(s: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(s);
}
