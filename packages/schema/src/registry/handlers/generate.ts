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
 * (Step 2), and that hash plus `irHash(schema.node)` are passed
 * through to each generator's `ProvenanceOptions` (Step 3 + Step 4)
 * so the emitted artifact bytes carry full provenance.
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
 *   <schema-dir>/<basename>.schema.{ts,js}
 *     ↓
 *   <schema-dir>/generated/<basename>.types.ts
 *   <schema-dir>/generated/<basename>.zod.ts
 *   <schema-dir>/generated/<basename>.json.schema.json
 *   <schema-dir>/generated/<basename>.openapi.json
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
    for (const schema of entry.schemas) {
      const schemaId = schema.node.metadata?.id;
      if (schemaId === undefined) continue; // anonymous → skip
      const schemaIrHash = `sha256:${irHash(schema.node)}` as const;

      for (const kind of GENERATOR_KINDS) {
        artifacts.push({
          schemaId,
          kind,
          suggestedPath: suggestedPathFor(entry.sourcePath, kind),
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
 * `<schema-dir>/<basename>.schema.ts` → `<schema-dir>/generated/<basename>.<ext>`.
 *
 * Pure string manipulation; no `node:path` import. Forward slashes
 * are the canonical separator in the suggested path even on Windows
 * — the CLI normalizes back to platform separators on write
 * (separate concern; Step 31).
 */
export function suggestedPathFor(
  sourcePath: string,
  kind: GeneratorKind,
): string {
  const normalized = sourcePath.replace(/\\/g, "/");
  const lastSlash = normalized.lastIndexOf("/");
  const dir = lastSlash >= 0 ? normalized.slice(0, lastSlash) : "";
  const filename =
    lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;
  const basename = basenameOf(filename);
  const prefix = dir ? `${dir}/generated/${basename}` : `generated/${basename}`;
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
