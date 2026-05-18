/**
 * Runtime Zod compiler — value consumer of the shared semantic mapping
 * in `src/generators/zod-mapping.ts`.
 *
 * Produces a live `ZodTypeAny` from a `SchemaNode`. Used by
 * `parse` / `safeParse` / `validate` (lands in subsequent commits).
 *
 * **No source involvement.** This consumer never parses generated
 * source text; the source generator (`src/generators/zod.ts`) never
 * stringifies a compiled value. Their only shared surface is the
 * `ZodEmitter` interface and the traversal order in `zod-mapping.ts`.
 *
 * No caching at this layer — the per-`SchemaNode` `WeakMap` lives in
 * `runtime/compile.ts` (next commit). Repeated calls here re-build.
 */

import { z, type ZodTypeAny } from "zod";
import type { JsonValue, SchemaNode, UnknownKeysPolicy } from "../ir/nodes.js";
import { emit, type ZodEmitter } from "../generators/zod-mapping.js";

/**
 * Compile an IR `SchemaNode` into a live Zod schema.
 *
 * Same semantic mapping and modifier ordering as `generateZod`; differs
 * only in producing a `ZodTypeAny` value instead of TypeScript source.
 */
export function compileZodSchema(node: SchemaNode): ZodTypeAny {
  return emit(node, /*depth*/ 0, valueEmitter);
}

/** Alias matching the v0.6 plan's naming. */
export const irToZodSchema = compileZodSchema;

const valueEmitter: ZodEmitter<ZodTypeAny> = {
  stringBase: () => z.string(),
  numberBase: () => z.number(),
  booleanBase: () => z.boolean(),
  literalBase: (value) => z.literal(value as never),
  enumStringsBase: (values) => {
    // z.enum requires a non-empty tuple; the shared traversal guarantees
    // length >= 1 by the time it reaches here.
    return z.enum(values as unknown as [string, ...string[]]);
  },
  enumSingleLiteralBase: (value) => z.literal(value as never),
  enumUnionBase: (values) => {
    const options = values.map((v) => z.literal(v as never));
    // z.union requires at least 2 options — the shared traversal already
    // collapses length === 1 to z.literal via enumSingleLiteralBase.
    return z.union(options as unknown as [ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]]);
  },
  arrayBase: (element) => z.array(element),
  objectBase: (fields, _depth) => {
    const shape: Record<string, ZodTypeAny> = {};
    for (const [key, value] of fields) shape[key] = value;
    return z.object(shape);
  },
  applyUnknownKeys: (prev, policy) => {
    // Mirror the source generator's explicit-policy emission: every
    // object gets an explicit modifier, no implicit "strip" fallback.
    const obj = prev as ReturnType<typeof z.object>;
    switch (policy) {
      case "strict":
        return obj.strict();
      case "stripUnknown":
        return obj.strip();
      case "passthrough":
        return obj.passthrough();
      default:
        return assertUnreachable(policy);
    }
  },

  applyMinLength: (prev, value) => (prev as ReturnType<typeof z.string>).min(value),
  applyMaxLength: (prev, value) => (prev as ReturnType<typeof z.string>).max(value),
  applyLength: (prev, value) => (prev as ReturnType<typeof z.string>).length(value),
  applyRegex: (prev, source, flags) =>
    (prev as ReturnType<typeof z.string>).regex(new RegExp(source, flags)),
  applyEmail: (prev) => (prev as ReturnType<typeof z.string>).email(),
  applyUuid: (prev) => (prev as ReturnType<typeof z.string>).uuid(),
  applyUrl: (prev) => (prev as ReturnType<typeof z.string>).url(),
  applyInt: (prev) => (prev as ReturnType<typeof z.number>).int(),
  applyMin: (prev, value) => (prev as ReturnType<typeof z.number>).min(value),
  applyMax: (prev, value) => (prev as ReturnType<typeof z.number>).max(value),
  applyGt: (prev, value) => (prev as ReturnType<typeof z.number>).gt(value),
  applyLt: (prev, value) => (prev as ReturnType<typeof z.number>).lt(value),
  applyMultipleOf: (prev, value) => (prev as ReturnType<typeof z.number>).multipleOf(value),
  applyMinItems: (prev, value) => (prev as ReturnType<typeof z.array>).min(value),
  applyMaxItems: (prev, value) => (prev as ReturnType<typeof z.array>).max(value),

  applyDescribe: (prev, text) => prev.describe(text),
  applyNullable: (prev) => prev.nullable(),
  applyOptional: (prev) => prev.optional(),
  applyNullish: (prev) => prev.nullish(),
  applyDefault: (prev, value) => prev.default(value as JsonValue),
};

function assertUnreachable(value: never): never {
  throw new Error(`Unreachable: unknown unknownKeys policy ${String(value as UnknownKeysPolicy)}`);
}
