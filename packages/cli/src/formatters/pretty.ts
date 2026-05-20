/**
 * Terminal-readable formatters for the four `neko schema *` verbs
 * plus the two cross-cutting result kinds (load failures and Issues).
 * v0.7 Step 28.
 *
 * Each function returns a `string` ending in exactly one trailing
 * newline — same shape as `formatJson` (Step 27), so command modules
 * can write either through the same `stdout`/`stderr` writer without
 * remembering to add `\n`.
 *
 * Pure utility. No `console.*`, no `process.*`, no `fs.*`. Static-
 * scan asserted by [`../../tests/formatters/pretty.test.ts`](../../tests/formatters/pretty.test.ts).
 *
 * Color is NOT applied here. CLI plan §"Explicit non-scope" defers
 * richer color to a later phase; v0.7 ships plain ANSI-free output
 * that respects `NO_COLOR` by default (i.e., never emits codes).
 *
 * Output stability — pretty output is **not** a contract across
 * versions (the locked promise is `--json`, see [`./json.ts`](./json.ts)).
 * These functions still aim for a deterministic shape so snapshot
 * tests can compare against known strings; downstream consumers
 * should consume `--json` rather than parsing pretty output.
 *
 * Pure: takes data in, returns a string. Inputs are never mutated;
 * sorted/iterated lazily and the caller's arrays are preserved.
 */

import type {
  DiffChange,
  DiffSeverity,
  FreshnessVerdict,
  GeneratedArtifact,
  MigrationEntry,
  RegistryEntry,
} from "@nekostack/schema/cli";
import type { Issue } from "@nekostack/schema";
import type { LoadFailure } from "../loaders/tsx-loader.js";

// =============================================================================
// `neko schema list`
// =============================================================================

/**
 * Render a registry-listing as a fixed-width table. Format matches
 * the example in the CLI companion plan:
 *
 *     3 schemas in workspace:
 *       com.nekostack.tenant.Tenant      1.0.0          path/to/tenant.schema.ts
 *       com.nekostack.audit.AuditEvent   1.0.0          path/to/audit-event.schema.ts
 *
 * Empty input produces a single human-readable line. Versions are
 * displayed as `(unversioned)` when the entry's `schemaVersion` is
 * `undefined`. Entries are NOT re-sorted here — `listHandler`
 * already returns them in deterministic schemaId-ascending order.
 */
export function formatListPretty(
  entries: readonly RegistryEntry[],
): string {
  if (entries.length === 0) return "No schemas found in workspace.\n";

  const header = `${pluralize(entries.length, "schema", "schemas")} in workspace:`;
  const rows = entries.map((e) => ({
    id: e.schemaId,
    version: e.schemaVersion ?? "(unversioned)",
    path: e.sourcePath,
  }));
  const idWidth = maxWidth(rows.map((r) => r.id));
  const versionWidth = maxWidth(rows.map((r) => r.version));

  const lines = rows.map(
    (r) =>
      `  ${r.id.padEnd(idWidth)}   ${r.version.padEnd(versionWidth)}   ${r.path}`,
  );
  return [header, ...lines].join("\n") + "\n";
}

// =============================================================================
// `neko schema migrate list`
// =============================================================================

/**
 * Render a migration-listing as a fixed-width table. Same shape as
 * `formatListPretty` but with `(schemaId, fromVersion → toVersion,
 * sourcePath)` columns. Entries are NOT re-sorted —
 * `listMigrationsHandler` already returns them in
 * `(schemaId, fromVersion, toVersion)` ascending order.
 *
 * The `migration` field on `MigrationEntry` (the loaded `AnyMigration`)
 * is deliberately NOT rendered: it carries a closure `transform` that
 * the v0.8 boundary forbids touching here, and the pretty output is
 * for human review of the registry shape only.
 */
export function formatMigrationListPretty(
  entries: readonly MigrationEntry[],
): string {
  if (entries.length === 0) return "No migrations found in workspace.\n";

  const header = `${pluralize(entries.length, "migration", "migrations")} in workspace:`;
  const rows = entries.map((e) => ({
    id: e.schemaId,
    versions: `${e.fromVersion} → ${e.toVersion}`,
    path: e.sourcePath,
  }));
  const idWidth = maxWidth(rows.map((r) => r.id));
  const versionsWidth = maxWidth(rows.map((r) => r.versions));

  const lines = rows.map(
    (r) =>
      `  ${r.id.padEnd(idWidth)}   ${r.versions.padEnd(versionsWidth)}   ${r.path}`,
  );
  return [header, ...lines].join("\n") + "\n";
}

// =============================================================================
// `neko schema diff`
// =============================================================================

/**
 * Render a `DiffResult.data` payload (the unwrapped success branch).
 * Header carries the count + `worstSeverity`; rows list each change
 * as `[severity] kind at path — message`.
 *
 * Empty change list prints `No changes.` with the worst-severity
 * sentinel `null`. Non-empty lists print the count and severity in
 * a uniform header so machine post-processing (e.g., a CI script
 * grepping the pretty output, even though `--json` is the contract)
 * has a stable single-line summary at the top.
 */
export function formatDiffPretty(
  payload: {
    readonly changes: readonly DiffChange[];
    readonly worstSeverity: DiffSeverity | null;
  },
): string {
  if (payload.changes.length === 0) return "No changes.\n";

  const header = `${pluralize(payload.changes.length, "change", "changes")} (worst severity: ${payload.worstSeverity}):`;
  const lines = payload.changes.map((c) => formatDiffChange(c));
  return [header, ...lines].join("\n") + "\n";
}

function formatDiffChange(c: DiffChange): string {
  const pathText = formatIssuePath(c.path);
  const where = pathText === "" ? "(root)" : pathText;
  return `  [${c.severity}] ${c.kind} at ${where} — ${c.message}`;
}

// =============================================================================
// `neko schema check`
// =============================================================================

/**
 * Render a list of freshness verdicts (`CheckResult.data.verdicts`).
 * Header is a per-status tally:
 *
 *     4 artifacts: 2 clean, 1 cosmetic_drift, 1 stale
 *
 * Body lists each verdict as `[status] artifactPath` in input order
 * (the schema-side handler emits in the order the CLI handed it the
 * artifacts, which is already deterministic — see Step 24).
 *
 * Empty input prints a single human-readable line; the CLI dispatch
 * layer is responsible for deciding what an empty `check` exits as.
 */
export function formatCheckPretty(
  verdicts: readonly FreshnessVerdict[],
): string {
  if (verdicts.length === 0) return "No artifacts to check.\n";

  const counts: Record<FreshnessVerdict["status"], number> = {
    clean: 0,
    cosmetic_drift: 0,
    stale: 0,
    integrity_error: 0,
  };
  for (const v of verdicts) counts[v.status] += 1;

  const tally = (
    [
      ["clean", counts.clean],
      ["cosmetic_drift", counts.cosmetic_drift],
      ["stale", counts.stale],
      ["integrity_error", counts.integrity_error],
    ] as const
  )
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${k}`)
    .join(", ");

  const header = `${pluralize(verdicts.length, "artifact", "artifacts")}: ${tally}`;
  const lines = verdicts.map((v) => `  [${v.status}] ${v.artifactPath}`);
  return [header, ...lines].join("\n") + "\n";
}

// =============================================================================
// `neko schema generate`
// =============================================================================

/**
 * Render the list of `GeneratedArtifact`s `generateHandler` returned.
 * The CLI dispatch layer is what actually writes each artifact's
 * `content` to its `suggestedPath`; this formatter only summarizes
 * the plan for the user's terminal.
 *
 *     Generated 12 artifacts (3 schemas × 4 kinds):
 *       com.x.Tenant     typescript    schemas/generated/tenant.types.ts
 *       com.x.Tenant     zod           schemas/generated/tenant.zod.ts
 *       …
 *
 * Empty input prints a single human-readable line. Artifacts are
 * NOT re-sorted — `generateHandler` already emits them in
 * deterministic schemaId-then-kind order.
 */
export function formatGeneratePretty(
  artifacts: readonly GeneratedArtifact[],
): string {
  if (artifacts.length === 0) return "No artifacts generated.\n";

  const schemaIds = new Set(artifacts.map((a) => a.schemaId));
  const header = `Generated ${pluralize(artifacts.length, "artifact", "artifacts")} (${pluralize(schemaIds.size, "schema", "schemas")} × ${Math.round(artifacts.length / Math.max(schemaIds.size, 1))} kinds):`;

  const idWidth = maxWidth(artifacts.map((a) => a.schemaId));
  const kindWidth = maxWidth(artifacts.map((a) => a.kind));

  const lines = artifacts.map(
    (a) =>
      `  ${a.schemaId.padEnd(idWidth)}   ${a.kind.padEnd(kindWidth)}   ${a.suggestedPath}`,
  );
  return [header, ...lines].join("\n") + "\n";
}

// =============================================================================
// Load failures (CLI-side `LoadFailure[]` from the workspace walker)
// =============================================================================

/**
 * Render `LoadFailure[]` from `walk-workspace.ts`. Each row carries
 * the schema-file path, the locked reason, and the underlying
 * message. Used by the CLI dispatch layer when one or more schema
 * files failed to load — distinct concern from `Issue[]` (the
 * schema-side normalized error vocabulary).
 */
export function formatLoadFailuresPretty(
  failures: readonly LoadFailure[],
): string {
  if (failures.length === 0) return "No load failures.\n";

  const header = `${pluralize(failures.length, "schema file failed", "schema files failed")} to load:`;
  const lines = failures.map(
    (f) => `  [${f.reason}] ${f.path} — ${f.message}`,
  );
  return [header, ...lines].join("\n") + "\n";
}

// =============================================================================
// Schema-side `Issue[]` rendering
// =============================================================================

/**
 * Render a list of `Issue`s — used when a schema-side handler returns
 * `Result.failure` and the CLI needs a human-readable digest.
 * Severity prefixes the message; `error` is the only severity v0.7
 * emits, but the formatter handles the full vocabulary for
 * forward compatibility.
 */
export function formatIssuesPretty(issues: readonly Issue[]): string {
  if (issues.length === 0) return "No issues.\n";

  const header = `${pluralize(issues.length, "issue", "issues")}:`;
  const lines = issues.map((i) => {
    const where = formatIssuePath(i.path);
    const pathPart = where === "" ? "" : ` at ${where}`;
    return `  [${i.severity}] ${i.code}${pathPart} — ${i.message}`;
  });
  return [header, ...lines].join("\n") + "\n";
}

// =============================================================================
// Helpers
// =============================================================================

function pluralize(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

function maxWidth(values: readonly string[]): number {
  let max = 0;
  for (const v of values) {
    if (v.length > max) max = v.length;
  }
  return max;
}

function formatIssuePath(path: readonly (string | number)[]): string {
  return path
    .map((segment) =>
      typeof segment === "number" ? `[${segment}]` : segment,
    )
    .join(".")
    .replace(/\.\[/g, "[");
}
