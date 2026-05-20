/**
 * `verifyMigrationProvenance(opts)` — per-migration two-hash
 * provenance verifier (v0.8 Step 5).
 *
 * For every `MigrationEntry` in the migration registry, compares
 * the migration's recorded `(fromIrHash, toIrHash, fromSourceHash,
 * toSourceHash)` against the current schema registry's
 * `findSchema(...).irHash` / `.sourceHash` for the same versions.
 * Emits one `MigrationVerdict` per migration plus a per-status
 * summary on the success branch.
 *
 * **Pure.** No `fs.*`, no `import()`, no `process.*`, no
 * `console.*`. **Never invokes `migration.transform`** — verification
 * is a `provenance-says-what-it-says` check, not a behavior check.
 * Transform execution is deferred to v0.9+.
 *
 * Verdict mapping (Decision #9 — mirrors the v0.7 two-hash
 * freshness matrix):
 *
 *   | irHash match | sourceHash match | verdict           |
 *   |--------------|-----------------|-------------------|
 *   | both         | both            | `bound`           |
 *   | both         | at least one ≠  | `cosmetic_drift`  |
 *   | at least one ≠ | (any)         | `drift`           |
 *   | endpoint absent | n/a          | `missing_endpoint`|
 *
 * Result-envelope rules:
 *
 *   - Every verdict is recorded in `verdicts[]` regardless of status.
 *   - `summary` carries per-status counts.
 *   - `Result.success` when every verdict is `bound` or
 *     `cosmetic_drift` (no `drift` and no `missing_endpoint`).
 *     `cosmetic_drift` is warning-class and does NOT fail the run.
 *   - `Result.failure` with one `Issue` per `drift` / `missing_endpoint`
 *     verdict otherwise. The CLI dispatcher (Step 9 handler / Step 22
 *     verb) maps to `LOGICAL_FAILURE`.
 *
 * Deterministic iteration: registry entries are visited in
 * `(schemaId, fromVersion, toVersion)` lexicographic order so the
 * `verdicts[]` array shape is stable regardless of how the input
 * registry was built. Downstream tooling (CLI pretty/JSON output)
 * relies on the order being predictable across runs.
 */

import { findSchema } from "../registry/build-registry.js";
import type { Issue, Result } from "../errors/issue.js";
import type {
  MigrationEntry,
  MigrationRegistry,
  MigrationVerdict,
  MigrationVerifyOpts,
  MigrationVerifyResult,
  VerificationResult,
} from "./types.js";

// =============================================================================
// Public entry
// =============================================================================

export function verifyMigrationProvenance(
  opts: MigrationVerifyOpts,
): MigrationVerifyResult {
  const verdicts: MigrationVerdict[] = [];
  const issues: Issue[] = [];
  const summary = {
    bound: 0,
    cosmetic_drift: 0,
    drift: 0,
    missing_endpoint: 0,
  };

  for (const entry of iterateRegistry(opts.migrationRegistry)) {
    const verdict = classifyMigration(entry, opts.schemaRegistry);
    verdicts.push(verdict);
    summary[verdict.status] += 1;
    if (verdict.status === "drift" || verdict.status === "missing_endpoint") {
      issues.push(verdictIssue(verdict));
    }
  }

  if (issues.length > 0) {
    return { success: false, issues };
  }
  const result: VerificationResult = { verdicts, summary };
  return { success: true, data: result };
}

// =============================================================================
// Deterministic iteration
// =============================================================================

/**
 * Yield every `MigrationEntry` in the registry in
 * `(schemaId, fromVersion, toVersion)` lexicographic order. The
 * underlying `Map`s preserve insertion order, but we sort
 * explicitly so the verifier's output is stable across different
 * upstream-build sequences.
 */
function* iterateRegistry(
  registry: MigrationRegistry,
): Iterable<MigrationEntry> {
  const schemaIds = [...registry.keys()].sort();
  for (const schemaId of schemaIds) {
    const byFrom = registry.get(schemaId)!;
    const fromVersions = [...byFrom.keys()].sort();
    for (const fromVersion of fromVersions) {
      const byTo = byFrom.get(fromVersion)!;
      const toVersions = [...byTo.keys()].sort();
      for (const toVersion of toVersions) {
        yield byTo.get(toVersion)!;
      }
    }
  }
}

// =============================================================================
// Classification
// =============================================================================

function classifyMigration(
  entry: MigrationEntry,
  schemaRegistry: MigrationVerifyOpts["schemaRegistry"],
): MigrationVerdict {
  const base = {
    sourcePath: entry.sourcePath,
    schemaId: entry.schemaId,
    fromVersion: entry.fromVersion,
    toVersion: entry.toVersion,
  } as const;

  const fromSchema = findSchema(schemaRegistry, entry.schemaId, entry.fromVersion);
  const toSchema = findSchema(schemaRegistry, entry.schemaId, entry.toVersion);

  if (fromSchema === undefined || toSchema === undefined) {
    return { status: "missing_endpoint", ...base };
  }

  const fromIrMatch = entry.fromIrHash === fromSchema.irHash;
  const toIrMatch = entry.toIrHash === toSchema.irHash;
  if (!fromIrMatch || !toIrMatch) {
    return { status: "drift", ...base };
  }

  const fromSourceMatch = entry.fromSourceHash === fromSchema.sourceHash;
  const toSourceMatch = entry.toSourceHash === toSchema.sourceHash;
  if (!fromSourceMatch || !toSourceMatch) {
    return { status: "cosmetic_drift", ...base };
  }

  return { status: "bound", ...base };
}

// =============================================================================
// Issue helpers
// =============================================================================

function verdictIssue(verdict: MigrationVerdict): Issue {
  if (verdict.status === "missing_endpoint") {
    return {
      code: "migration_missing_endpoint",
      path: [verdict.sourcePath],
      message:
        `Migration \`${verdict.schemaId}\` ` +
        `${verdict.fromVersion} → ${verdict.toVersion} references a schema ` +
        `version that is not in the registry.`,
      severity: "error",
      metadata: {
        schemaId: verdict.schemaId,
        fromVersion: verdict.fromVersion,
        toVersion: verdict.toVersion,
        sourcePath: verdict.sourcePath,
      },
    };
  }
  // drift
  return {
    code: "migration_drift",
    path: [verdict.sourcePath],
    message:
      `Migration \`${verdict.schemaId}\` ` +
      `${verdict.fromVersion} → ${verdict.toVersion} was authored against a ` +
      `schema state that has since changed (irHash mismatch).`,
    severity: "error",
    metadata: {
      schemaId: verdict.schemaId,
      fromVersion: verdict.fromVersion,
      toVersion: verdict.toVersion,
      sourcePath: verdict.sourcePath,
    },
  };
}
