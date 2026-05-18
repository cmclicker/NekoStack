/**
 * Validate-only IR variant (Decision #8 of v0.6 plan).
 *
 * `stripDefaultsForValidate(node)` produces a new `SchemaNode` tree
 * with every default-bearing modifier removed and `optional: true`
 * set at that same level. The original IR is not mutated (the builder
 * deep-freezes the IR; this transform is non-destructive by
 * construction).
 *
 * **Why both at once.** Per v0.1 (Invariant 4 + the absence-semantics
 * table), `default(v)` means *input-optional + output-required* — a
 * missing default-bearing field is a valid input. So `validate` (which
 * returns `Result<s.input<S>>`, no fill) must (a) accept the absence,
 * which means flipping `optional: true`, and (b) NOT fill the default
 * value, which means dropping the `default` modifier. The combined
 * "strip default + flip to optional" is the only rule consistent with
 * both halves of the v0.1 absence-semantics contract for the validate
 * path.
 *
 * **What stays.** `nullable` / `nullish` modifiers, refinements,
 * metadata (`id`, `version`, `description`, `deprecated`), and every
 * field's `unknownKeys` policy are preserved verbatim. This is a
 * runtime compilation variant of the same schema, not a composition
 * operation — schema-level identity (id / version / description) may
 * matter for issue normalization downstream.
 *
 * **Recursion.** Object fields and array elements are walked
 * recursively. Other composite kinds (`union`, `transform`,
 * `recursiveRef`, `date`) are passed through unchanged here; the
 * compile layer (`runtime/compile.ts` → `runtime/zod-compile.ts`)
 * throws `UnsupportedNodeKindError` for those, so the strip transform
 * does not need to gate them itself.
 *
 * The returned tree has different object identity from the original
 * for every level that was touched. The compile cache keys on
 * `SchemaNode` identity (Decision #7), so the validate variant is
 * cached on its own slot automatically — no second `WeakMap` is
 * needed at this layer.
 */

import type {
  ArrayNode,
  ObjectNode,
  SchemaNode,
} from "../ir/nodes.js";

/**
 * Return a new `SchemaNode` tree suitable for `validate`. For every
 * default-bearing modifier in the tree:
 *   - drops `modifiers.default`
 *   - sets `modifiers.optional = true` at that same level
 *
 * Leaves `nullable` / `nullish`, refinements, metadata, and
 * unrelated fields untouched. Does not mutate the input.
 */
export function stripDefaultsForValidate(node: SchemaNode): SchemaNode {
  const recursed = recurseChildren(node);
  return stripOwnDefault(recursed);
}

function recurseChildren(node: SchemaNode): SchemaNode {
  if (node.kind === "array") {
    const arr = node as ArrayNode;
    const stripped = stripDefaultsForValidate(arr.element);
    return { ...arr, element: stripped };
  }
  if (node.kind === "object") {
    const obj = node as ObjectNode;
    const nextFields: Record<string, SchemaNode> = {};
    for (const [key, child] of Object.entries(obj.fields)) {
      nextFields[key] = stripDefaultsForValidate(child);
    }
    return { ...obj, fields: nextFields };
  }
  return node;
}

function stripOwnDefault(node: SchemaNode): SchemaNode {
  const mods = node.modifiers;
  if (!mods?.default) return node;
  // Drop `default`, force `optional: true`. Preserve `nullable` (and
  // therefore `nullish`, which is `optional + nullable`).
  const { default: _dropped, ...rest } = mods;
  return {
    ...node,
    modifiers: { ...rest, optional: true },
  } as SchemaNode;
}
