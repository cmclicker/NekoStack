/**
 * Provenance parser for generated artifacts (Master plan Step 5).
 *
 * Reads the provenance metadata back out of an emitted artifact so
 * `checkHandler` (Step 10) can compare it against the current schema
 * source. Two carrier shapes are supported, mirroring the Step 4
 * emitter side:
 *
 * - **JSDoc header** (TS / Zod) — `/** ... * /` block at the top of
 *   the file. Each provenance field lives on its own `* <name>: <value>`
 *   line. The `@generated` line, the `// anonymous schema` line, the
 *   blank `*` line, and the `DO NOT EDIT MANUALLY` line are skipped.
 *
 * - **`x-nekostack` block** (JSON Schema / OpenAPI) — a single object
 *   under the `x-nekostack` key at the document root. The provenance
 *   fields are own properties of that object.
 *
 * The function is **pure**: no `fs.*`, no `import()`, no path argument.
 * The CLI reads the artifact text from disk and hands it in; this
 * module parses and returns. Master plan Decision #1 boundary applies.
 *
 * **Backward compatibility (Master plan Decision #8):** v0.6-era
 * artifacts have no `sourceHash` line / field. They are parsed
 * successfully; `sourceHash` is `undefined` on the result, never
 * `null`. The freshness verdict in `checkHandler` treats absent
 * `sourceHash` as "unknown" — NOT as an integrity error.
 *
 * **Malformed / missing provenance** surfaces as `Result<...>` failure
 * with one `Issue` of code `"integrity_error"`. `metadata.reason`
 * records the specific sub-mode (unknown_format, missing_field,
 * malformed_hash, json_parse_error, etc.) so consumers downstream can
 * triage without parsing `message`. The CLI's `checkHandler` step
 * (Step 10) maps an integrity_error result onto the
 * `FreshnessVerdict.status = "integrity_error"` shape with exit code 4.
 */

import type { Issue, Result } from "../errors/issue.js";
import { JSON_SCHEMA_EXTENSIONS } from "../generators/json-schema-meta.js";

const PROVENANCE_KEY = JSON_SCHEMA_EXTENSIONS.provenance; // "x-nekostack"

const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;

/**
 * Parsed provenance fields. Matches the union of what TS/Zod JSDoc
 * headers and JSON-side `x-nekostack` blocks carry.
 *
 * `schemaId` / `schemaVersion` are `null` for anonymous / unversioned
 * schemas (the emitter writes the literal string `"null"` in JSDoc and
 * the JSON value `null` in `x-nekostack`; both decode to JS `null`
 * here). `sourceHash` is `undefined` when absent — never `null`.
 */
export interface ParsedProvenance {
  readonly generator: string;
  readonly generatorVersion: string;
  readonly schemaId: string | null;
  readonly schemaVersion: string | null;
  readonly irHash: `sha256:${string}`;
  readonly sourceHash: `sha256:${string}` | undefined;
}

/**
 * Parse the provenance block out of an artifact's text content.
 *
 * Auto-detects the carrier by leading non-whitespace character:
 *   `/`  → JSDoc header (TS / Zod source artifact)
 *   `{`  → JSON document (JSON Schema / OpenAPI artifact)
 *   else → integrity_error / unknown_format
 */
export function parseProvenanceFromText(
  content: string,
): Result<ParsedProvenance> {
  const trimmed = content.trimStart();
  if (trimmed.startsWith("/**")) {
    return parseJsdocHeader(content);
  }
  if (trimmed.startsWith("{")) {
    return parseJsonProvenance(content);
  }
  return fail(
    "unknown_format",
    "Artifact does not start with `/**` (TS/Zod) or `{` (JSON Schema / OpenAPI).",
  );
}

// =============================================================================
// JSDoc header parsing (TS / Zod)
// =============================================================================

const JSDOC_BLOCK = /\/\*\*([\s\S]*?)\*\//;
const JSDOC_FIELD = /^\s*\*\s+(\w+):\s*(.+?)\s*$/;

function parseJsdocHeader(content: string): Result<ParsedProvenance> {
  const block = JSDOC_BLOCK.exec(content);
  if (!block) {
    return fail(
      "missing_provenance",
      "No `/** ... */` JSDoc header found at the top of the artifact.",
    );
  }
  const fields = new Map<string, string>();
  for (const line of (block[1] ?? '').split(/\r?\n/)) {
    const m = JSDOC_FIELD.exec(line);
    if (!m) continue;
    const key = m[1];
    const value = m[2];
    if (key === undefined || value === undefined) continue;
    fields.set(key, value);
  }
  return assembleProvenance(fields);
}

// =============================================================================
// JSON `x-nekostack` parsing (JSON Schema / OpenAPI)
// =============================================================================

function parseJsonProvenance(content: string): Result<ParsedProvenance> {
  let doc: unknown;
  try {
    doc = JSON.parse(content);
  } catch (e) {
    return fail(
      "json_parse_error",
      `Artifact failed JSON.parse: ${(e as Error).message}`,
    );
  }
  if (doc === null || typeof doc !== "object" || Array.isArray(doc)) {
    return fail(
      "missing_provenance",
      "Parsed JSON is not an object; cannot read `x-nekostack` provenance.",
    );
  }
  const root = doc as Record<string, unknown>;
  const provenance = root[PROVENANCE_KEY];
  if (
    provenance === null ||
    typeof provenance !== "object" ||
    Array.isArray(provenance)
  ) {
    return fail(
      "missing_provenance",
      `Artifact has no \`${PROVENANCE_KEY}\` provenance object at the document root.`,
    );
  }
  const block = provenance as Record<string, unknown>;
  const fields = new Map<string, string>();
  for (const key of [
    "generator",
    "generatorVersion",
    "schemaId",
    "schemaVersion",
    "irHash",
    "sourceHash",
  ]) {
    const v = block[key];
    if (v === undefined) continue;
    // `schemaId` / `schemaVersion` may be JSON `null` for anonymous /
    // unversioned schemas. Normalize to the literal string "null" so
    // the assembler can apply the same rule as the JSDoc path.
    if (v === null) {
      fields.set(key, "null");
      continue;
    }
    if (typeof v !== "string") {
      return fail(
        "malformed_field",
        `Field \`${key}\` in \`${PROVENANCE_KEY}\` must be a string or null; got ${typeof v}.`,
      );
    }
    fields.set(key, v);
  }
  return assembleProvenance(fields);
}

// =============================================================================
// Shared field assembly + validation
// =============================================================================

function assembleProvenance(
  fields: Map<string, string>,
): Result<ParsedProvenance> {
  const generator = fields.get("generator");
  const generatorVersion = fields.get("generatorVersion");
  const schemaIdRaw = fields.get("schemaId");
  const schemaVersionRaw = fields.get("schemaVersion");
  const irHash = fields.get("irHash");
  const sourceHashRaw = fields.get("sourceHash");

  if (generator === undefined) {
    return fail("missing_field", "Provenance is missing `generator`.");
  }
  if (generatorVersion === undefined) {
    return fail("missing_field", "Provenance is missing `generatorVersion`.");
  }
  if (schemaIdRaw === undefined) {
    return fail("missing_field", "Provenance is missing `schemaId`.");
  }
  if (schemaVersionRaw === undefined) {
    return fail("missing_field", "Provenance is missing `schemaVersion`.");
  }
  if (irHash === undefined) {
    return fail("missing_field", "Provenance is missing `irHash`.");
  }
  if (!SHA256_PATTERN.test(irHash)) {
    return fail(
      "malformed_hash",
      `Provenance \`irHash\` must match \`sha256:<64 hex>\`; got "${irHash}".`,
    );
  }
  if (sourceHashRaw !== undefined && !SHA256_PATTERN.test(sourceHashRaw)) {
    return fail(
      "malformed_hash",
      `Provenance \`sourceHash\` must match \`sha256:<64 hex>\` when present; got "${sourceHashRaw}".`,
    );
  }
  return {
    success: true,
    data: {
      generator,
      generatorVersion,
      schemaId: schemaIdRaw === "null" ? null : schemaIdRaw,
      schemaVersion: schemaVersionRaw === "null" ? null : schemaVersionRaw,
      irHash: irHash as `sha256:${string}`,
      sourceHash:
        sourceHashRaw === undefined
          ? undefined
          : (sourceHashRaw as `sha256:${string}`),
    },
  };
}

// =============================================================================
// Failure helper
// =============================================================================

function fail(reason: string, message: string): Result<ParsedProvenance> {
  const issue: Issue = {
    code: "integrity_error",
    path: [],
    message,
    severity: "error",
    metadata: { reason },
  };
  return { success: false, issues: [issue] };
}
