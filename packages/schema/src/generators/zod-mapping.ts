/**
 * Shared Zod semantic mapping (Decision #6 of v0.6 plan).
 *
 * One module owns:
 *   - the IR traversal order
 *   - the fixed Zod modifier-application order (v0.2 contract — see
 *     `docs/ZOD_MODIFIER_ORDERING.md`):
 *
 *       1. base schema
 *       2. portable refinements (IR insertion order)
 *       3. describe
 *       4. nullable / optional / nullish (mutually exclusive)
 *       5. default (LAST)
 *
 *   - the rules for empty / single / all-string / mixed enums
 *   - the rules for the `unknownKeys` object policy
 *
 * Two consumers realize this mapping into different concrete outputs:
 *
 *   - `src/generators/zod.ts` (a `ZodEmitter<string>`) produces the
 *     deterministic TypeScript source text. v0.2 snapshot bytes must
 *     remain identical after this extraction.
 *
 *   - `src/runtime/zod-compile.ts` (a `ZodEmitter<ZodTypeAny>`) produces
 *     a live Zod schema value for runtime `parse` / `safeParse` /
 *     `validate`.
 *
 * The shared mapping is the contract; neither consumer stringifies the
 * other's output (no `eval`, no source-to-value parsing, no
 * value-to-source serialization).
 */

import type {
  ArrayNode,
  EnumNode,
  JsonValue,
  LiteralNode,
  ObjectNode,
  PortableRefinement,
  Refinement,
  SchemaNode,
  UnknownKeysPolicy,
} from "../ir/nodes.js";
import { UnsupportedNodeKindError } from "./errors.js";

/**
 * The per-operation surface a Zod consumer implements. `T` is the
 * consumer's output type (`string` for the source generator,
 * `ZodTypeAny` for the runtime compiler).
 *
 * Every method maps to one concrete Zod construction or chain step;
 * the shared traversal in `emit()` is responsible for *when* each
 * method is called, the consumer is responsible for *how* it realizes
 * the operation.
 */
export interface ZodEmitter<T> {
  // ---- Base producers ----
  stringBase(): T;
  numberBase(): T;
  booleanBase(): T;
  literalBase(value: JsonValue): T;
  /** Length >= 1, all values are strings — use `z.enum([...])`. */
  enumStringsBase(values: readonly string[]): T;
  /** Length === 1, value is non-string — collapse to `z.literal(v)`. */
  enumSingleLiteralBase(value: JsonValue): T;
  /** Length >= 2, mixed/numeric — `z.union([z.literal(...), ...])`. */
  enumUnionBase(values: readonly JsonValue[]): T;
  arrayBase(element: T): T;
  /**
   * @param fields Pre-emitted per-key children, in iteration order.
   * @param depth Nesting depth, supplied so a string consumer can
   *   compute indentation. The value consumer ignores it.
   */
  objectBase(fields: ReadonlyArray<readonly [key: string, value: T]>, depth: number): T;
  applyUnknownKeys(prev: T, policy: UnknownKeysPolicy): T;

  // ---- Portable refinement chain steps ----
  applyMinLength(prev: T, value: number): T;
  applyMaxLength(prev: T, value: number): T;
  applyLength(prev: T, value: number): T;
  applyRegex(prev: T, source: string, flags: string): T;
  applyEmail(prev: T): T;
  applyUuid(prev: T): T;
  applyUrl(prev: T): T;
  applyInt(prev: T): T;
  applyMin(prev: T, value: number): T;
  applyMax(prev: T, value: number): T;
  applyGt(prev: T, value: number): T;
  applyLt(prev: T, value: number): T;
  applyMultipleOf(prev: T, value: number): T;
  applyMinItems(prev: T, value: number): T;
  applyMaxItems(prev: T, value: number): T;

  // ---- Metadata + absence + default ----
  applyDescribe(prev: T, text: string): T;
  applyNullable(prev: T): T;
  applyOptional(prev: T): T;
  applyNullish(prev: T): T;
  applyDefault(prev: T, value: JsonValue): T;
}

/**
 * Entry point: walk a `SchemaNode` and produce the consumer's `T`.
 *
 * `depth` is threaded for the string consumer's indentation. Callers
 * outside this module should start at depth 0.
 */
export function emit<T>(node: SchemaNode, depth: number, emitter: ZodEmitter<T>): T {
  let expr = emitBase(node, depth, emitter);
  expr = applyPortableRefinements(expr, node.refinements ?? [], emitter);
  expr = applyDescribeStep(expr, node, emitter);
  expr = applyAbsenceModifiers(expr, node, emitter);
  expr = applyDefaultStep(expr, node, emitter);
  return expr;
}

function emitBase<T>(node: SchemaNode, depth: number, emitter: ZodEmitter<T>): T {
  switch (node.kind) {
    case "string":
      return emitter.stringBase();
    case "number":
      return emitter.numberBase();
    case "boolean":
      return emitter.booleanBase();
    case "literal":
      return emitter.literalBase((node as LiteralNode).value);
    case "enum":
      return emitEnum(node as EnumNode, emitter);
    case "array":
      return emitter.arrayBase(emit((node as ArrayNode).element, depth + 1, emitter));
    case "object":
      return emitObject(node as ObjectNode, depth, emitter);
    default:
      throw new UnsupportedNodeKindError({
        kind: (node as { kind: string }).kind,
        generator: "zod",
      });
  }
}

function emitEnum<T>(node: EnumNode, emitter: ZodEmitter<T>): T {
  // Empty enums should be rejected at the builder (`s.enum`); fail
  // loudly if one ever reaches here so we never emit invalid Zod.
  if (node.values.length === 0) {
    throw new Error("Cannot emit Zod for an empty enum");
  }
  const allStrings = node.values.every((v) => typeof v === "string");
  if (allStrings) {
    return emitter.enumStringsBase(node.values as readonly string[]);
  }
  // z.union requires >= 2 options; a single-value mixed/numeric enum
  // collapses to z.literal.
  if (node.values.length === 1) {
    return emitter.enumSingleLiteralBase(node.values[0] as JsonValue);
  }
  return emitter.enumUnionBase(node.values as readonly JsonValue[]);
}

function emitObject<T>(node: ObjectNode, depth: number, emitter: ZodEmitter<T>): T {
  const entries = Object.entries(node.fields).map(
    ([key, field]) => [key, emit(field, depth + 1, emitter)] as const,
  );
  return emitter.applyUnknownKeys(
    emitter.objectBase(entries, depth),
    node.unknownKeys,
  );
}

function applyPortableRefinements<T>(
  expr: T,
  refinements: readonly Refinement[],
  emitter: ZodEmitter<T>,
): T {
  let out = expr;
  for (const r of refinements) {
    if (r.kind === "runtime") {
      // Invariant 7: fail loudly. Silently dropping a runtime refinement
      // would emit a chain that accepts inputs the IR intends to reject.
      throw new UnsupportedNodeKindError({
        kind: "runtimeRefinement",
        generator: "zod",
      });
    }
    if (r.kind !== "portable") continue;
    out = applyPortableRefinement(out, r as PortableRefinement, emitter);
  }
  return out;
}

function applyPortableRefinement<T>(
  expr: T,
  r: PortableRefinement,
  emitter: ZodEmitter<T>,
): T {
  const params = r.params ?? {};
  switch (r.name) {
    case "minLength":
      return emitter.applyMinLength(expr, numParam(params.value));
    case "maxLength":
      return emitter.applyMaxLength(expr, numParam(params.value));
    case "length":
      return emitter.applyLength(expr, numParam(params.value));
    case "regex":
      return emitter.applyRegex(expr, String(params.source ?? ""), String(params.flags ?? ""));
    case "email":
      return emitter.applyEmail(expr);
    case "uuid":
      return emitter.applyUuid(expr);
    case "url":
      return emitter.applyUrl(expr);
    case "int":
      return emitter.applyInt(expr);
    case "min":
      return emitter.applyMin(expr, numParam(params.value));
    case "max":
      return emitter.applyMax(expr, numParam(params.value));
    case "gt":
      return emitter.applyGt(expr, numParam(params.value));
    case "lt":
      return emitter.applyLt(expr, numParam(params.value));
    case "multipleOf":
      return emitter.applyMultipleOf(expr, numParam(params.value));
    case "minItems":
      return emitter.applyMinItems(expr, numParam(params.value));
    case "maxItems":
      return emitter.applyMaxItems(expr, numParam(params.value));
  }
}

function applyDescribeStep<T>(expr: T, node: SchemaNode, emitter: ZodEmitter<T>): T {
  const desc = node.metadata?.description;
  if (!desc) return expr;
  return emitter.applyDescribe(expr, desc);
}

function applyAbsenceModifiers<T>(expr: T, node: SchemaNode, emitter: ZodEmitter<T>): T {
  const mods = node.modifiers ?? {};
  // Mutually exclusive — `.optional().nullable()` would produce a
  // different Zod type than `.nullish()` despite the surface
  // similarity.
  if (mods.optional && mods.nullable) return emitter.applyNullish(expr);
  if (mods.nullable) return emitter.applyNullable(expr);
  if (mods.optional) return emitter.applyOptional(expr);
  return expr;
}

function applyDefaultStep<T>(expr: T, node: SchemaNode, emitter: ZodEmitter<T>): T {
  const def = node.modifiers?.default;
  if (!def) return expr;
  return emitter.applyDefault(expr, def.value);
}

function numParam(value: unknown): number {
  if (typeof value !== "number") {
    throw new Error(`Expected numeric refinement param, got ${typeof value}`);
  }
  return value;
}
