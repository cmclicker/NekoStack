import type { JsonValue, SchemaNode } from "../ir/nodes.js";
import { irHash } from "../ir/hash.js";
import { GENERATOR_VERSION } from "./version.js";
import { JSON_SCHEMA_EXTENSIONS } from "./json-schema-meta.js";
import {
  canonicalize,
  emitSchemaFragment,
} from "./schema-fragment.js";
import type { OpenApiGeneratorOptions } from "./types.js";

/**
 * Generate an **OpenAPI 3.1 Schema Component** from a `SchemaNode`.
 *
 * The output is the value that would live under `components.schemas.<Name>`
 * in a full OpenAPI document — NOT the document itself. Composing it into
 * paths / operations / responses / requestBodies / etc. is the consumer's
 * job (or `@nekostack/api`'s when that package exists).
 *
 * Differences from {@link generateJsonSchema}:
 *  - No `$schema` keyword — OpenAPI 3.1 documents declare the schema dialect
 *    once at the document root via `jsonSchemaDialect`; component schemas
 *    inherit it.
 *  - No `$id` — component identity is the position in the document
 *    (`#/components/schemas/<Name>`), per Decision #5.
 *  - Provenance `generator: "openApi"`.
 *
 * The IR-to-fragment translation (absence semantics, object policy,
 * portable refinements, `stripUnknown` extension, throw paths,
 * canonicalization) is shared with the JSON Schema generator via
 * [`schema-fragment.ts`](./schema-fragment.ts). See
 * [`docs/JSON_SCHEMA_MAPPING.md`](../../docs/JSON_SCHEMA_MAPPING.md) for
 * the shared contract and the (small) OpenAPI deltas in
 * [`docs/OPENAPI_MAPPING.md`](../../docs/OPENAPI_MAPPING.md).
 *
 * Throws `UnsupportedNodeKindError({ ..., generator: "openApi" })` per
 * Invariant 7 for: IR kinds without v0.3-style mapping (`date`, `union`,
 * `recursiveRef`, `transform`), runtime refinements, and regex with
 * non-empty flags.
 */
export function generateOpenApiSchemaComponent(
  node: SchemaNode,
  options: OpenApiGeneratorOptions = {},
): string {
  const body = emitSchemaFragment(node, { generator: "openApi" });
  const provenance = emitProvenance(node, options.sourceHash);
  const root = {
    ...body,
    ...provenance,
  };
  return JSON.stringify(canonicalize(root), null, 2) + "\n";
}

/**
 * Same shape as the JSON Schema provenance block, but with
 * `generator: "openApi"`. v0.7 adds the optional `sourceHash` field
 * (Master plan Decision #8); when omitted, the field is absent
 * entirely from the emitted JSON (`canonicalize` drops `undefined`).
 */
function emitProvenance(
  node: SchemaNode,
  sourceHash: `sha256:${string}` | undefined,
): Record<string, JsonValue> {
  return {
    [JSON_SCHEMA_EXTENSIONS.provenance]: {
      generator: "openApi",
      generatorVersion: GENERATOR_VERSION,
      irHash: `sha256:${irHash(node)}`,
      ...(sourceHash !== undefined ? { sourceHash } : {}),
      schemaId: node.metadata?.id ?? null,
      schemaVersion: node.metadata?.version ?? null,
    },
  };
}
