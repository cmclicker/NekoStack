/**
 * Cached IR → Zod compiler (Decision #7 of v0.6 plan).
 *
 * The runtime entry points (`parse` / `safeParse` / `validate`, landing
 * in later commits) call `compile(node)` to obtain a live `ZodTypeAny`.
 * Repeated calls with the **same** `SchemaNode` instance return the
 * **same** compiled Zod value — built once, reused thereafter.
 *
 * Cache key is `SchemaNode` *identity*, not IR equality. Two builder
 * outputs with byte-identical IR but different instance identity are
 * NOT shared (per Decision #7); explicit dedup via `irHash` (v0.2)
 * remains a v0.7 registry concern, not a runtime one. The IR is frozen
 * by the builder, so storing the live Zod schema next to its key is
 * safe — the IR cannot mutate out from under the cached value.
 *
 * Compile is lazy on first call (Decision #9). Schemas that are
 * defined-but-never-validated never build their Zod schema.
 *
 * The `WeakMap` lets the entire `(node, compiled)` pair be GC'd when
 * the consumer drops its reference to the schema. Long-running
 * processes that build per-request schemas (anti-pattern, but possible)
 * therefore don't leak.
 *
 * Concurrency: Node is single-threaded, so first-call wins by default
 * and there is no race. A future worker-threads consumer that shares a
 * `SchemaNode` across threads would get a per-thread cache; that
 * trade-off is documented in `docs/RUNTIME.md` (step 9). No v0.6
 * mitigation.
 */

import type { ZodTypeAny } from "zod";
import type { SchemaNode } from "../ir/nodes.js";
import { compileZodSchema } from "./zod-compile.js";

const cache = new WeakMap<SchemaNode, ZodTypeAny>();

/**
 * Return the compiled Zod schema for `node`, building (and caching)
 * it on the first call. Subsequent calls with the same `SchemaNode`
 * instance return the same `ZodTypeAny` reference.
 */
export function compile(node: SchemaNode): ZodTypeAny {
  const cached = cache.get(node);
  if (cached !== undefined) return cached;
  const built = compileZodSchema(node);
  cache.set(node, built);
  return built;
}
