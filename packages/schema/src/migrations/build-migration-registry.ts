/**
 * `buildMigrationRegistry(entries)` — pure migration-registry
 * constructor (v0.8 Step 3).
 *
 * Walks the CLI-supplied `MigrationSourceEntry[]` (one per loaded
 * `*.migration.ts` file) and builds the three-level lookup map
 * `MigrationRegistry = ReadonlyMap<schemaId, ReadonlyMap<fromVersion,
 * ReadonlyMap<toVersion, MigrationEntry>>>`. Returns
 * `Result<MigrationRegistry>` — never throws.
 *
 * **Pure.** No `fs.*`, no `import()`, no `path.*`. The CLI is
 * responsible for reading the source text and dynamic-importing the
 * migration files; this function takes the loaded data and indexes
 * it. Master plan Decision #1 boundary applies.
 *
 * Failure-mode contract (v0.8 Round-2 lock — intentional departure
 * from v0.7 Decision #5):
 *
 * - **Malformed / missing provenance is fail-loud.** Every entry's
 *   `sourceText` runs through `parseMigrationProvenanceFromText`.
 *   Failures from the parser surface as `Result.failure` Issues
 *   with the migration's `sourcePath` attached via the issue's
 *   `path` so the CLI can pinpoint which file is bad.
 * - **Duplicate `(schemaId, fromVersion, toVersion)` triples** are
 *   collected as `duplicate_migration` Issues. The first-seen entry
 *   stays in the partial map so a single call doesn't return a
 *   torn lookup state.
 *
 * Both failure classes are **collected** across the full entry list
 * — `buildMigrationRegistry` never short-circuits on the first
 * problem. The returned `Result.failure` carries every Issue in one
 * payload so the CLI can render a single human-readable report.
 *
 * **Provenance ↔ source-entry binding is a soft check.** The
 * provenance header carries its own `schemaId / fromVersion /
 * toVersion`; the `MigrationSourceEntry.migration` value also has
 * `schemaId / from / to` fields. v0.8 indexes by the *provenance*
 * triple. If the loaded `migration` default-export disagrees with
 * its header, that's a separate verification concern (the runtime
 * vs. recorded provenance) and is not a registry-construction
 * failure. Step 5's verifier picks it up later if it matters.
 */

import type { Issue, IssuePath, Result } from "../errors/issue.js";
import {
  parseMigrationProvenanceFromText,
  type ParsedMigrationProvenance,
} from "./parse-provenance.js";
import type {
  MigrationEntry,
  MigrationRegistry,
  MigrationSourceEntry,
} from "./types.js";

// =============================================================================
// Public surface
// =============================================================================

export function buildMigrationRegistry(
  entries: readonly MigrationSourceEntry[],
): Result<MigrationRegistry> {
  const out = new Map<
    string,
    Map<string, Map<string, MigrationEntry>>
  >();
  const issues: Issue[] = [];

  for (const entry of entries) {
    const parsed = parseMigrationProvenanceFromText(entry.sourceText);
    if (!parsed.success) {
      // Re-key each parser failure to the offending file's
      // sourcePath so the CLI can pinpoint the bad file without
      // grepping the message text.
      for (const issue of parsed.issues) {
        issues.push(attachSourcePath(issue, entry.sourcePath));
      }
      continue;
    }

    const migrationEntry = buildEntry(entry, parsed.data);
    const { schemaId, fromVersion, toVersion } = migrationEntry;

    let byFrom = out.get(schemaId);
    if (byFrom === undefined) {
      byFrom = new Map();
      out.set(schemaId, byFrom);
    }
    let byTo = byFrom.get(fromVersion);
    if (byTo === undefined) {
      byTo = new Map();
      byFrom.set(fromVersion, byTo);
    }
    const existing = byTo.get(toVersion);
    if (existing !== undefined) {
      issues.push(
        duplicateMigrationIssue(
          schemaId,
          fromVersion,
          toVersion,
          [existing.sourcePath, entry.sourcePath],
        ),
      );
      // Keep the first-seen entry. Same rule as `buildRegistry`'s
      // duplicate handling (v0.7): re-indexing would let the
      // duplicate replace the original silently — the exact failure
      // mode this Result is meant to surface.
      continue;
    }
    byTo.set(toVersion, migrationEntry);
  }

  if (issues.length > 0) {
    return { success: false, issues };
  }
  return { success: true, data: out as MigrationRegistry };
}

// =============================================================================
// Entry construction
// =============================================================================

function buildEntry(
  entry: MigrationSourceEntry,
  prov: ParsedMigrationProvenance,
): MigrationEntry {
  return {
    schemaId: prov.schemaId,
    fromVersion: prov.fromVersion,
    toVersion: prov.toVersion,
    fromIrHash: prov.fromIrHash,
    toIrHash: prov.toIrHash,
    fromSourceHash: prov.fromSourceHash,
    toSourceHash: prov.toSourceHash,
    sourcePath: entry.sourcePath,
    // Preserves object identity — the same `AnyMigration` reference
    // the CLI handed in shows up on the indexed entry. Downstream
    // code can `===` it against the original.
    migration: entry.migration,
  };
}

// =============================================================================
// Issue helpers
// =============================================================================

function attachSourcePath(issue: Issue, sourcePath: string): Issue {
  const path: IssuePath = [sourcePath];
  return {
    ...issue,
    path,
    metadata: { ...(issue.metadata ?? {}), sourcePath },
  };
}

function duplicateMigrationIssue(
  schemaId: string,
  fromVersion: string,
  toVersion: string,
  sourcePaths: readonly string[],
): Issue {
  return {
    code: "duplicate_migration",
    path: [],
    message:
      `Duplicate migration for \`${schemaId}\` ${fromVersion} → ${toVersion} ` +
      `found in: ${sourcePaths.join(", ")}`,
    severity: "error",
    metadata: {
      schemaId,
      fromVersion,
      toVersion,
      sourcePaths: [...sourcePaths],
    },
  };
}
