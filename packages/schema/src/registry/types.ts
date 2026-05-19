/**
 * Type definitions for the v0.7 schema-side registry surface.
 *
 * This module is **types only** — no functions, no constants beyond
 * what TypeScript requires for the type definitions themselves. All
 * runtime behavior (registry construction, diff classification,
 * freshness verdict computation, generation planning) lives in the
 * sibling modules that import these types.
 *
 * Boundary recap (Master plan Decision #1):
 * - `@nekostack/schema` is **pure** — no `fs.*`, no `import()`, no
 *   `process.*`, no `console.*`. Takes data, returns data.
 * - `@nekostack/cli` is the **filesystem shell** — loads schema files
 *   via `tsx`, reads source bytes, reads committed artifacts, writes
 *   regenerated artifacts, owns stdout / stderr / exit codes.
 *
 * Re-exported from the package-internal integration subpath
 * `@nekostack/schema/cli` (Master plan Decision #10). Root
 * `@nekostack/schema` does NOT expose these names.
 */

import type { SchemaNode } from "../ir/nodes.js";
import type { AnySchema } from "../builders/schema.js";
import type { IssuePath, Result } from "../errors/issue.js";

// =============================================================================
// Registry input — what the CLI hands to `buildRegistry`
// =============================================================================

/**
 * One discovered `*.schema.{ts,js}` source file, after the CLI has
 * read its bytes and dynamic-imported it via `tsx`.
 *
 * `schemas` is the array of every `export const X = s.object(...)`
 * (or any other `Schema` instance) the file exposes. A file may
 * legitimately declare more than one schema; the registry indexes
 * each.
 */
export interface RegistrySourceEntry {
  readonly sourcePath: string;
  readonly sourceText: string;
  readonly schemas: readonly AnySchema[];
}

// =============================================================================
// Registry output — the in-memory lookup map `buildRegistry` produces
// =============================================================================

/**
 * One indexed schema. The registry stores these by
 * `(schemaId, schemaVersion)` (Master plan Decision #4).
 *
 * `schemaVersion` is `undefined` when the source schema omitted
 * `.version(...)`. In the `Registry` map's inner key the version is
 * stored as the empty string `""` for the unversioned case, so the
 * lookup type stays uniform.
 */
export interface RegistryEntry {
  readonly schemaId: string;
  readonly schemaVersion: string | undefined;
  readonly irHash: `sha256:${string}`;
  readonly sourceHash: `sha256:${string}`;
  readonly sourcePath: string;
  readonly schema: AnySchema;
}

/**
 * Two-level map: outer key is `schemaId`, inner key is `schemaVersion`
 * (or the empty string `""` for an entry whose source did not call
 * `.version(...)`). `buildRegistry` is the only legitimate producer
 * of `Registry` values; downstream callers treat them as opaque.
 */
export type Registry = ReadonlyMap<
  string,
  ReadonlyMap<string, RegistryEntry>
>;

// =============================================================================
// Diff classifier
// =============================================================================

/**
 * Severity of a single `DiffChange`. The `worstSeverity` field on
 * `DiffResult` is the max over a change set, with `breaking` >
 * `additive` > `cosmetic`. Master plan Decision #11 + #12 lock the
 * classification table; this enum is the column header.
 */
export type DiffSeverity = "breaking" | "additive" | "cosmetic";

/**
 * What kind of change a `DiffChange` represents. The shape of change
 * — not its severity. Locked per Master plan Decision #12; severity
 * for each kind depends on which row of the table the specific
 * before/after pair lands on.
 */
export type DiffKind =
  | "field_added"
  | "field_removed"
  | "refinement_changed"
  | "unknown_keys_changed"
  | "enum_value_added"
  | "enum_value_removed"
  | "literal_changed"
  | "default_added"
  | "default_removed"
  | "default_value_changed"
  | "absence_modifier_changed"
  | "metadata_changed"
  | "refinements_reordered"
  | "schema_version_changed";

export interface DiffChange {
  readonly severity: DiffSeverity;
  readonly path: IssuePath;
  readonly kind: DiffKind;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly message: string;
}

// =============================================================================
// Freshness verdict — emitted by `checkHandler` per committed artifact
// =============================================================================

/**
 * The per-artifact outcome of the two-hash freshness matrix
 * (Master plan §"Freshness verdict — two-hash discipline").
 *
 * - `clean`           — both hashes match the schema source.
 * - `cosmetic_drift`  — sourceHash differs, irHash matches. Source
 *                       text edited without semantic effect. CLI
 *                       prints a stderr warning; CI still passes.
 * - `stale`           — irHash differs. Regenerate required. CLI
 *                       exits 1.
 * - `integrity_error` — irHash matches, sourceHash differs. The
 *                       impossible row of the matrix; indicates a
 *                       hand-edit of the artifact (or astronomically
 *                       unlikely hash collision). CLI exits 4 and
 *                       refuses to auto-regenerate.
 */
export type FreshnessVerdict =
  | { readonly status: "clean"; readonly artifactPath: string }
  | { readonly status: "cosmetic_drift"; readonly artifactPath: string }
  | { readonly status: "stale"; readonly artifactPath: string }
  | { readonly status: "integrity_error"; readonly artifactPath: string };

// =============================================================================
// Generation planning
// =============================================================================

/**
 * The four artifact kinds `generateHandler` plans for every schema
 * in v0.7. Partial generation (subset of kinds) is explicitly NOT
 * supported in v0.7 — `generate` writes all four; `check` expects
 * all four (Master plan Decision #6).
 */
export type GeneratorKind = "typescript" | "zod" | "jsonSchema" | "openApi";

/**
 * One emit-ready artifact returned by `generateHandler`. The
 * schema-side handler does NOT write the file; it returns the
 * payload and the path the CLI should write it at. The
 * `suggestedPath` is relative to the source schema's directory and
 * follows the `<schema-dir>/generated/<basename>.<kind>` convention
 * locked in Master plan Decision #6.
 */
export interface GeneratedArtifact {
  readonly schemaId: string;
  readonly kind: GeneratorKind;
  readonly suggestedPath: string;
  readonly content: string;
  readonly irHash: `sha256:${string}`;
  readonly sourceHash: `sha256:${string}`;
}

// =============================================================================
// Committed artifact — what the CLI hands to `checkHandler`
// =============================================================================

/**
 * One on-disk artifact whose bytes the CLI has already read. The
 * handler parses the provenance block (JSDoc header for TS/Zod;
 * `x-nekostack` for JSON Schema / OpenAPI), compares against the
 * current schema source, and emits a `FreshnessVerdict`.
 */
export interface CommittedArtifact {
  readonly path: string;
  readonly content: string;
}

// =============================================================================
// Handler opts + results
// =============================================================================

export interface GenerateOpts {
  readonly entries: readonly RegistrySourceEntry[];
}
export type GenerateResult = Result<{
  readonly artifacts: readonly GeneratedArtifact[];
}>;

export interface CheckOpts {
  readonly entries: readonly RegistrySourceEntry[];
  readonly committedArtifacts: readonly CommittedArtifact[];
}
export type CheckResult = Result<{
  readonly verdicts: readonly FreshnessVerdict[];
}>;

export interface DiffOpts {
  readonly before: SchemaNode;
  readonly after: SchemaNode;
}
export type DiffResult = Result<{
  readonly changes: readonly DiffChange[];
  readonly worstSeverity: DiffSeverity | null;
}>;

export interface ListOpts {
  readonly registry: Registry;
}
export type ListResult = Result<{
  readonly entries: readonly RegistryEntry[];
}>;
