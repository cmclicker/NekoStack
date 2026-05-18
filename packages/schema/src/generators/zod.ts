import type {
  JsonValue,
  SchemaNode,
  UnknownKeysPolicy,
} from "../ir/nodes.js";
import { buildHeader } from "./header.js";
import type { ZodGeneratorOptions } from "./types.js";
import { emit, type ZodEmitter } from "./zod-mapping.js";

/**
 * Generate Zod 3.x schema code from a SchemaNode.
 *
 * Output is a complete TS module: header + `import { z } from "zod"` +
 * `export const <name> = <chain>;`.
 *
 * The per-node semantic mapping and modifier-application order live in
 * [`zod-mapping.ts`](./zod-mapping.ts) — see that file's header for the
 * v0.2 modifier-ordering contract. This file is the **string consumer**:
 * it realizes each op as TypeScript source text. The runtime compiler
 * in `src/runtime/zod-compile.ts` is the value consumer. They share
 * the mapping; neither converts the other's output.
 */
export function generateZod(
  node: SchemaNode,
  options: ZodGeneratorOptions = {},
): string {
  const constName = options.constName ?? "schema";
  const header = buildHeader(node, { generator: "zod" });
  const chain = emit(node, /*depth*/ 0, stringEmitter);
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

// ---------- string consumer ----------

const stringEmitter: ZodEmitter<string> = {
  stringBase: () => "z.string()",
  numberBase: () => "z.number()",
  booleanBase: () => "z.boolean()",
  literalBase: (value) => `z.literal(${formatJson(value)})`,
  enumStringsBase: (values) => {
    const list = values.map((v) => JSON.stringify(v)).join(", ");
    return `z.enum([${list}] as const)`;
  },
  enumSingleLiteralBase: (value) => `z.literal(${formatJson(value)})`,
  enumUnionBase: (values) => {
    const parts = values.map((v) => `z.literal(${formatJson(v)})`);
    return `z.union([${parts.join(", ")}])`;
  },
  arrayBase: (element) => `z.array(${element})`,
  objectBase: (fields, depth) => {
    if (fields.length === 0) return "z.object({})";
    const indent = "  ".repeat(depth + 1);
    const closeIndent = "  ".repeat(depth);
    const lines = fields.map(([key, value]) => {
      const safeKey = isSafeIdentifier(key) ? key : JSON.stringify(key);
      return `${indent}${safeKey}: ${value},`;
    });
    return `z.object({\n${lines.join("\n")}\n${closeIndent}})`;
  },
  applyUnknownKeys: (prev, policy) => {
    // Zod's default is "strip"; emit the explicit modifier so the
    // generated code is unambiguous about which policy applies.
    switch (policy) {
      case "strict":
        return `${prev}.strict()`;
      case "stripUnknown":
        return `${prev}.strip()`;
      case "passthrough":
        return `${prev}.passthrough()`;
      default:
        return assertUnreachable(policy);
    }
  },

  applyMinLength: (prev, value) => `${prev}.min(${value})`,
  applyMaxLength: (prev, value) => `${prev}.max(${value})`,
  applyLength: (prev, value) => `${prev}.length(${value})`,
  applyRegex: (prev, source, flags) =>
    `${prev}.regex(new RegExp(${JSON.stringify(source)}, ${JSON.stringify(flags)}))`,
  applyEmail: (prev) => `${prev}.email()`,
  applyUuid: (prev) => `${prev}.uuid()`,
  applyUrl: (prev) => `${prev}.url()`,
  applyInt: (prev) => `${prev}.int()`,
  applyMin: (prev, value) => `${prev}.min(${value})`,
  applyMax: (prev, value) => `${prev}.max(${value})`,
  applyGt: (prev, value) => `${prev}.gt(${value})`,
  applyLt: (prev, value) => `${prev}.lt(${value})`,
  applyMultipleOf: (prev, value) => `${prev}.multipleOf(${value})`,
  applyMinItems: (prev, value) => `${prev}.min(${value})`,
  applyMaxItems: (prev, value) => `${prev}.max(${value})`,

  applyDescribe: (prev, text) => `${prev}.describe(${JSON.stringify(text)})`,
  applyNullable: (prev) => `${prev}.nullable()`,
  applyOptional: (prev) => `${prev}.optional()`,
  applyNullish: (prev) => `${prev}.nullish()`,
  applyDefault: (prev, value) => `${prev}.default(${formatJson(value)})`,
};

// ---------- string-only helpers ----------

function emitTopLevelDocComment(node: SchemaNode): string {
  // `metadata.deprecated` is a source-level JSDoc concern; Zod has no
  // runtime "deprecated" marker, so the runtime value consumer ignores
  // it entirely.
  const lines: string[] = [];
  if (node.metadata?.deprecated) lines.push("@deprecated");
  if (lines.length === 0) return "";
  return `/**\n${lines.map((l) => ` * ${l}`).join("\n")}\n */\n`;
}

function formatJson(value: JsonValue | unknown): string {
  return JSON.stringify(value);
}

function isSafeIdentifier(s: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(s);
}

function assertUnreachable(value: never): never {
  throw new Error(`Unreachable: unknown unknownKeys policy ${String(value as UnknownKeysPolicy)}`);
}
