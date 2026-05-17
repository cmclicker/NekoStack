import type { JsonValue, SchemaNode } from "../ir/nodes.js";
import { irHash } from "../ir/hash.js";
import { GENERATOR_VERSION } from "./version.js";
import { JSON_SCHEMA_EXTENSIONS } from "./json-schema-meta.js";
import {
  canonicalize,
  emitSchemaFragment,
} from "./schema-fragment.js";
import type { JsonSchemaGeneratorOptions } from "./types.js";

/**
 * Generate a JSON Schema **draft 2020-12** document from a `SchemaNode`.
 *
 * v0.4: refactored to a thin root wrapper that delegates the IR-to-fragment
 * translation to {@link emitSchemaFragment}. The wrapper owns:
 *  - `$schema` (draft 2020-12 URL)
 *  - `$id` strategy (URN by default; URL via `options.idBase`)
 *  - `x-nekostack` provenance with `generator: "jsonSchema"`
 *  - Canonical serialization + trailing newline
 *
 * The wrapper does NOT own: absence semantics, object policy, portable
 * refinements, runtime-refinement / regex-with-flags throws, canonical
 * key sort. Those live in [`schema-fragment.ts`](./schema-fragment.ts) and
 * are shared with the OpenAPI generator (v0.4+). See
 * [`docs/JSON_SCHEMA_MAPPING.md`](../../docs/JSON_SCHEMA_MAPPING.md) for
 * the contract.
 *
 * Throws `UnsupportedNodeKindError({ ..., generator: "jsonSchema" })`
 * (Invariant 7) for: IR kinds without v0.3 mapping (`date` / `union` /
 * `recursiveRef` / `transform`), runtime refinements, and regex with
 * non-empty flags.
 */
export function generateJsonSchema(
  node: SchemaNode,
  options: JsonSchemaGeneratorOptions = {},
): string {
  const body = emitSchemaFragment(node, { generator: "jsonSchema" });
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
 * v0.3 placed provenance under a single `x-nekostack` extension object so
 * it doesn't pollute the top-level JSON Schema namespace and is easy for
 * downstream tooling to read or strip. Mirrors the v0.2 JSDoc header
 * concept, adapted for a comment-less format.
 */
function emitProvenance(node: SchemaNode): Record<string, JsonValue> {
  return {
    [JSON_SCHEMA_EXTENSIONS.provenance]: {
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
