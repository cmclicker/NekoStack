/**
 * Runtime API entry points (Step 6 of v0.6 plan).
 *
 * Wires together the Decision #6 value consumer, the Decision #7
 * compile cache, the Decision #8 validate-only variant, the
 * Decision #12 issue normalizer, and `ParseError`.
 *
 * **Three entry points, one engine.**
 *
 *   parse(schema, input)     -> s.output<S>             | throws ParseError
 *   safeParse(schema, input) -> Result<s.output<S>>
 *   validate(schema, input)  -> Result<s.input<S>>
 *
 * `parse` is the friction-causing default — code that doesn't
 * explicitly want to handle issues gets loud failure. `safeParse` is
 * the Result-returning alternative for callers that branch on
 * success/failure. `validate` is the structural check that does NOT
 * apply defaults or transforms — see Decision #8 for the absence-
 * semantics rationale.
 *
 * **Validate-variant cache.** `stripDefaultsForValidate(node)` returns
 * a new tree each call, which would defeat the Step 2 compile cache
 * (the cache keys on `SchemaNode` identity). To keep validate paths
 * cache-friendly, we memoize the stripped variant by original-node
 * identity here. Subsequent `validate(schema, ...)` calls reuse the
 * same variant `SchemaNode` and therefore the same compiled Zod
 * schema.
 *
 * **Issue normalization.** Every failure path runs through
 * `normalizeIssues(error, schema.node)`. We pass the *original*
 * schema node — not the validate variant — so `schemaId` /
 * `schemaVersion` come from the consumer's source-of-truth metadata,
 * regardless of which compile path produced the failure.
 *
 * Internal-only at this step. Public re-exports of `parse` /
 * `safeParse` / `validate` / `ParseError` land in step 13.
 */

import type { SchemaNode } from "../ir/nodes.js";
import type { AnySchema } from "../builders/schema.js";
import type { Input, Output } from "../types.js";
import type { Result } from "../errors/issue.js";
import { compile } from "./compile.js";
import { stripDefaultsForValidate } from "./strip-defaults.js";
import { normalizeIssues } from "./normalize-issues.js";
import { ParseError } from "./errors.js";

/**
 * Memoize the validate-only variant by original `SchemaNode` identity.
 * Without this, `validate(sameSchema, ...)` would rebuild the
 * stripped tree on every call and miss the Step 2 compile cache.
 */
const validateNodeCache = new WeakMap<SchemaNode, SchemaNode>();

function getValidateNode(node: SchemaNode): SchemaNode {
  const cached = validateNodeCache.get(node);
  if (cached !== undefined) return cached;
  const variant = stripDefaultsForValidate(node);
  validateNodeCache.set(node, variant);
  return variant;
}

/**
 * Parse `input` against `schema`. Returns the output shape (defaults
 * applied, transforms run) on success; throws `ParseError` with the
 * full normalized issue list on failure.
 */
export function parse<S extends AnySchema>(
  schema: S,
  input: unknown,
): Output<S> {
  const zod = compile(schema.node);
  const result = zod.safeParse(input);
  if (result.success) return result.data as Output<S>;
  throw new ParseError(normalizeIssues(result.error, schema.node));
}

/**
 * Like `parse`, but returns a `Result` rather than throwing. Use
 * when the caller wants to branch on success/failure inline.
 */
export function safeParse<S extends AnySchema>(
  schema: S,
  input: unknown,
): Result<Output<S>> {
  const zod = compile(schema.node);
  const result = zod.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data as Output<S> };
  }
  return {
    success: false,
    issues: normalizeIssues(result.error, schema.node),
  };
}

/**
 * Structural validation. Compiles against the validate-only IR
 * variant (defaults stripped, default-bearing fields flipped to
 * optional per Decision #8). Returns `Result<s.input<S>>` — defaults
 * are NOT filled, transforms are NOT run.
 *
 * Use when the caller wants to know whether the input would parse,
 * without paying for transforms or accepting a default-filled output.
 */
export function validate<S extends AnySchema>(
  schema: S,
  input: unknown,
): Result<Input<S>> {
  const variant = getValidateNode(schema.node);
  const zod = compile(variant);
  const result = zod.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data as Input<S> };
  }
  // Pass the *original* schema node so schemaId / schemaVersion come
  // from the user-authored metadata regardless of which compile path
  // (parse or validate) produced the failure.
  return {
    success: false,
    issues: normalizeIssues(result.error, schema.node),
  };
}
