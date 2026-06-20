/**
 * `generateHandler({ entries })` — pure generation planner.
 *
 * For every **named** schema in every `RegistrySourceEntry`, emits
 * all four artifact kinds (TypeScript / Zod / JSON Schema / OpenAPI)
 * as `GeneratedArtifact` payloads with `suggestedPath`s relative to
 * the schema's source location. The CLI is responsible for writing
 * each payload to its suggested path; this handler never touches
 * the filesystem.
 *
 * Master plan Decision #1 boundary: pure, data-in / data-out. No
 * `fs.*`, no `import()`, no `process.*`, no `console.*`. The
 * `sourceText` is hashed once per entry via `sourceHashFromText`
 * (Step 2). `sourceHash` is passed through to each generator's
 * `ProvenanceOptions` (Step 3 + Step 4) so the emitted artifact
 * bytes carry provenance; `irHash(schema.node)` is recorded
 * separately on each `GeneratedArtifact` and independently emitted
 * by the generators from `schema.node` — the irHash field is NOT
 * part of `ProvenanceOptions`.
 *
 * **Anonymous schemas (no `.id()`)** are silently skipped — they
 * cannot participate in registry lookup downstream, so emitting
 * artifacts for them is meaningless. The CLI warns; this handler
 * is silent (Master plan Decision #5).
 *
 * **Partial generation is not supported in v0.7** (Master plan
 * Decision #6). `GenerateOpts` carries no `kinds` filter; every
 * named schema produces exactly 4 artifacts. The CLI's `check`
 * verb expects all 4 to be present on disk.
 *
 * ## Suggested path convention (Master plan Decision #6 locked)
 *
 * **Single named schema in a source file:**
 *
 *   <schema-dir>/<basename>.schema.{ts,js}
 *     ↓
 *   <schema-dir>/generated/<basename>.types.ts
 *   <schema-dir>/generated/<basename>.zod.ts
 *   <schema-dir>/generated/<basename>.json.schema.json
 *   <schema-dir>/generated/<basename>.openapi.json
 *
 * **Multiple named schemas in one source file** — paths gain a
 * schemaId-derived discriminator slug so the four-artifact set per
 * schema doesn't collide on disk:
 *
 *   <schema-dir>/<basename>.schema.ts
 *     export const Tenant = s.object(...).id("com.x.Tenant");
 *     export const Audit  = s.object(...).id("com.x.AuditEvent");
 *     ↓
 *   <schema-dir>/generated/<basename>.com-x-tenant.types.ts
 *   <schema-dir>/generated/<basename>.com-x-auditevent.types.ts
 *   <schema-dir>/generated/<basename>.com-x-tenant.zod.ts
 *   ... and so on for json/openapi.
 *
 * Slug rule: lowercase, non-alphanumeric runs collapse to `-`, with
 * leading/trailing `-` trimmed. If a source file declares the same
 * `schemaId` at multiple versions (rare; v0.7 doesn't endorse but
 * does tolerate), the discriminator additionally includes a slugged
 * version (`com-x-tenant-1-0-0`) so per-schema paths stay unique.
 *
 * The basename strips a `.schema.{ts,js,mts,cts}` suffix when
 * present; falls back to "filename minus last extension" otherwise.
 * Source-path parsing is plain string manipulation — no `node:path`
 * import — to keep the handler trivially platform-agnostic.
 */

import { irHash } from "../../ir/hash.js";
import { generateTypeScript } from "../../generators/ts.js";
import { generateZod } from "../../generators/zod.js";
import { generateJsonSchema } from "../../generators/json-schema.js";
import { generateOpenApiSchemaComponent } from "../../generators/openapi.js";
import { sourceHashFromText } from "../source-hash.js";
import type {
  GeneratedArtifact,
  GenerateOpts,
  GenerateResult,
  GeneratorKind,
  RegistrySourceEntry,
} from "../types.js";
import type { SchemaNode } from "../../ir/nodes.js";
import type { AnySchema } from "../../builders/schema.js";

const GENERATOR_KINDS: readonly GeneratorKind[] = [
  "typescript",
  "zod",
  "jsonSchema",
  "openApi",
];

export function generateHandler(opts: GenerateOpts): GenerateResult {
  const artifacts: GeneratedArtifact[] = [];

  for (const entry of opts.entries) {
    const entrySourceHash = sourceHashFromText(entry.sourceText);
    const discriminators = discriminatorsFor(entry);

    for (const schema of entry.schemas) {
      const schemaId = schema.node.metadata?.id;
      if (schemaId === undefined) continue; // anonymous → skip
      const schemaIrHash = `sha256:${irHash(schema.node)}` as const;
      const discriminator = discriminators.get(schema);

      for (const kind of GENERATOR_KINDS) {
        artifacts.push({
          schemaId,
          kind,
          suggestedPath: suggestedPathFor(entry.sourcePath, kind, {
            ...(discriminator !== undefined ? { discriminator } : {}),
          }),
          content: renderArtifact(kind, schema, entrySourceHash),
          irHash: schemaIrHash,
          sourceHash: entrySourceHash,
        });
      }
    }
  }

  return { success: true, data: { artifacts } };
}

// =============================================================================
// Per-entry discriminator slugs (Master plan Decision #6 multi-schema rule)
// =============================================================================

/**
 * For one `RegistrySourceEntry`, decide the discriminator slug each
 * named schema needs on its `suggestedPath`:
 *
 * - Entry contains exactly 0 or 1 named schemas → no discriminator.
 * - Entry contains 2+ named schemas with **distinct ids** →
 *   discriminator = `slugify(schemaId)`.
 * - Entry contains 2+ named schemas where **at least one id appears
 *   more than once** (different versions of the same id in one
 *   source file — rare) → for the IDs that repeat, the discriminator
 *   additionally embeds the slugged version so per-schema paths
 *   stay unique. IDs that appear only once still use the id-only
 *   slug.
 *
 * Returned `Map` is keyed by the original `AnySchema` instance so
 * the handler loop can look up each schema's discriminator without
 * re-deriving it. Anonymous schemas are not represented in the map.
 */
function discriminatorsFor(
  entry: RegistrySourceEntry,
): Map<AnySchema, string | undefined> {
  const result = new Map<AnySchema, string | undefined>();
  const named = entry.schemas.filter(
    (s) => s.node.metadata?.id !== undefined,
  );

  if (named.length <= 1) {
    for (const s of named) result.set(s, undefined);
    return result;
  }

  // Multiple named schemas — disambiguation needed. Count id
  // occurrences; if any id appears more than once, those entries
  // get the version-suffixed slug to stay unique.
  const idCounts = new Map<string, number>();
  for (const s of named) {
    const id = s.node.metadata?.id;
    if (!id) continue; // named was pre-filtered; this guard lets TypeScript narrow
    idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
  }

  for (const s of named) {
    const id = s.node.metadata?.id;
    if (!id) continue; // same guard
    const version = s.node.metadata?.version;
    const idSlug = slugify(id);
    const sameIdElsewhere = (idCounts.get(id) ?? 0) > 1;
    const slug =
      sameIdElsewhere && version !== undefined
        ? `${idSlug}-${slugify(version)}`
        : idSlug;
    result.set(s, slug);
  }
  return result;
}

/** Lowercase, non-alphanumeric runs → `-`, trim leading/trailing `-`. */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// =============================================================================
// Per-kind dispatch
// =============================================================================

function renderArtifact(
  kind: GeneratorKind,
  schema: AnySchema,
  sourceHash: `sha256:${string}`,
): string {
  const node: SchemaNode = schema.node;
  switch (kind) {
    case "typescript":
      return generateTypeScript(node, { sourceHash });
    case "zod":
      return generateZod(node, { sourceHash });
    case "jsonSchema":
      return generateJsonSchema(node, { sourceHash });
    case "openApi":
      return generateOpenApiSchemaComponent(node, { sourceHash });
  }
}

// =============================================================================
// Path convention
// =============================================================================

const KIND_TO_EXT: Record<GeneratorKind, string> = {
  typescript: ".types.ts",
  zod: ".zod.ts",
  jsonSchema: ".json.schema.json",
  openApi: ".openapi.json",
};

/**
 * `<schema-dir>/<basename>.schema.ts` → `<schema-dir>/generated/<basename>[.<discriminator>].<ext>`.
 *
 * Pure string manipulation; no `node:path` import. Forward slashes
 * are the canonical separator in the suggested path even on Windows
 * — the CLI normalizes back to platform separators on write
 * (separate concern; Step 31).
 *
 * The optional `discriminator` is inserted between the basename and
 * the artifact extension. The handler computes it per-entry via
 * `discriminatorsFor` (see above); callers that know they have a
 * single-schema source file may omit the option entirely.
 */
export function suggestedPathFor(
  sourcePath: string,
  kind: GeneratorKind,
  options: { readonly discriminator?: string } = {},
): string {
  const normalized = sourcePath.replace(/\\/g, "/");
  const lastSlash = normalized.lastIndexOf("/");
  const dir = lastSlash >= 0 ? normalized.slice(0, lastSlash) : "";
  const filename =
    lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;
  const basename = basenameOf(filename);
  const stem =
    options.discriminator !== undefined
      ? `${basename}.${options.discriminator}`
      : basename;
  const prefix = dir ? `${dir}/generated/${stem}` : `generated/${stem}`;
  return `${prefix}${KIND_TO_EXT[kind]}`;
}

function basenameOf(filename: string): string {
  // Preferred: strip the `.schema.{ts,js,mts,cts}` suffix.
  const schemaMatch = filename.match(/^(.+?)\.schema\.(ts|js|mts|cts)$/);
  if (schemaMatch) return schemaMatch[1]!;
  // Fallback for non-conventional input: drop the last extension.
  const lastDot = filename.lastIndexOf(".");
  return lastDot > 0 ? filename.slice(0, lastDot) : filename;
}

// Exported so the CLI can advertise the same path convention for
// `check`'s artifact-lookup, without re-deriving the rule.
export { GENERATOR_KINDS };

// Type-only re-export consumed by tests.
export type { RegistrySourceEntry };
