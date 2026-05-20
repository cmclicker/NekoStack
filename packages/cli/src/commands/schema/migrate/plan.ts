/**
 * `neko schema migrate plan` command implementation (v0.8 Step 21).
 *
 * The diff-aware planner CLI surface. Mirrors `runMigrateList`'s
 * pure / writer-injected discipline (Master plan Decision #1).
 *
 * Flow:
 *
 *   1. `walkWorkspace({ root })` — load every `*.schema.{ts,js}`.
 *      Any per-file load failure → IO_ERROR.
 *   2. `buildRegistry(walk.entries)` — index the schemas.
 *      `duplicate_schema_id` → LOGICAL_FAILURE; any `integrity_error`
 *      → INTEGRITY_ERROR.
 *   3. `readMigrations({ root })` — load every `*.migration.ts`.
 *      Any per-file load failure → IO_ERROR.
 *   4. `buildMigrationRegistry(migrationWalk.entries)` — index the
 *      migrations and parse each one's provenance.
 *      `duplicate_migration` → LOGICAL_FAILURE; any `integrity_error`
 *      → INTEGRITY_ERROR.
 *   5. `planMigrationHandler({ schemaRegistry, migrationRegistry,
 *      schemaId, fromVersion, toVersion })`. Failure-issue mapping:
 *      - `migration_missing_endpoint`  → LOGICAL_FAILURE
 *      - `migration_not_found`         → LOGICAL_FAILURE
 *      - `migration_chain_broken`      → LOGICAL_FAILURE
 *      - `migration_ambiguous_chain`   → LOGICAL_FAILURE
 *   6. Format and write:
 *      - `--json`  → one-line `{ plan: {...} }` to stdout
 *      - default   → pretty paragraph distinguishing the four success
 *                    shapes (no-change / over_specified /
 *                    additive_no_migration / chain).
 *   7. Return SUCCESS.
 *
 * **Pure.** No `process.exit`, no `console.*`, no direct
 * `process.stdout` / `process.stderr` writes. Writers are injected.
 *
 * **`migration.transform` is NEVER invoked here.** The planner is
 * structural — `diffNodes` + DFS chain enumeration. The v0.8
 * INVARIANTS ("no apply, no transform execution") stay in force.
 * Static-scan asserted by [`../../../../tests/commands/schema-migrate-plan.test.ts`](../../../../tests/commands/schema-migrate-plan.test.ts).
 *
 * **JSON output shape is locked.** The `MigrationEntry.migration`
 * field — the live `AnyMigration` carrying the `transform` closure —
 * is NEVER serialized (neither inside `chain` rows nor inside
 * `notes[].migration` projections):
 *
 *     {
 *       "plan": {
 *         "schemaId":      "com.x.Tenant",
 *         "fromVersion":   "1.0.0",
 *         "toVersion":     "2.0.0",
 *         "worstSeverity": "breaking" | "additive" | "cosmetic" | null,
 *         "versionPath":   ["1.0.0", "1.5.0", "2.0.0"],
 *         "notes": [
 *           { "kind": "over_specified", "migration": { schemaId, fromVersion, toVersion,
 *             sourcePath, fromIrHash, toIrHash, fromSourceHash, toSourceHash } },
 *           { "kind": "additive_no_migration", "worstSeverity": "additive" }
 *         ],
 *         "chain": [
 *           { "schemaId": "...", "fromVersion": "1.0.0", "toVersion": "1.5.0",
 *             "sourcePath": "...", "fromIrHash": "sha256:...", "toIrHash": "sha256:...",
 *             "fromSourceHash": "sha256:...", "toSourceHash": "sha256:..." },
 *           …
 *         ]
 *       }
 *     }
 */

import {
  buildMigrationRegistry,
  buildRegistry,
  planMigrationHandler,
} from "@nekostack/schema/cli";
import type {
  MigrationEntry,
  MigrationPlan,
  PlanNote,
} from "@nekostack/schema/cli";
import type { Issue } from "@nekostack/schema";
import { EXIT_CODES, type ExitCode } from "../../../exit-codes.js";
import { formatJson } from "../../../formatters/json.js";
import {
  formatIssuesPretty,
  formatLoadFailuresPretty,
} from "../../../formatters/pretty.js";
import { readMigrations } from "../../../loaders/read-migrations.js";
import { walkWorkspace } from "../../../loaders/walk-workspace.js";
import type { LoadFailure } from "../../../loaders/tsx-loader.js";

// =============================================================================
// Options
// =============================================================================

export interface RunMigratePlanOptions {
  readonly root: string;
  readonly schemaId: string;
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly json: boolean;
  readonly quiet: boolean;
  readonly stdout: (s: string) => void;
  readonly stderr: (s: string) => void;
}

// =============================================================================
// JSON projection — strip `migration` (the AnyMigration closure)
// =============================================================================

interface ProjectedMigrationEntry {
  readonly schemaId: string;
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly sourcePath: string;
  readonly fromIrHash: string;
  readonly toIrHash: string;
  readonly fromSourceHash: string;
  readonly toSourceHash: string;
}

function projectMigrationEntry(e: MigrationEntry): ProjectedMigrationEntry {
  return {
    schemaId: e.schemaId,
    fromVersion: e.fromVersion,
    toVersion: e.toVersion,
    sourcePath: e.sourcePath,
    fromIrHash: e.fromIrHash,
    toIrHash: e.toIrHash,
    fromSourceHash: e.fromSourceHash,
    toSourceHash: e.toSourceHash,
  };
}

type ProjectedPlanNote =
  | { readonly kind: "over_specified"; readonly migration: ProjectedMigrationEntry }
  | { readonly kind: "additive_no_migration"; readonly worstSeverity: string };

function projectPlanNote(note: PlanNote): ProjectedPlanNote {
  if (note.kind === "over_specified") {
    return { kind: "over_specified", migration: projectMigrationEntry(note.migration) };
  }
  return { kind: "additive_no_migration", worstSeverity: note.worstSeverity };
}

interface ProjectedPlan {
  readonly schemaId: string;
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly worstSeverity: string | null;
  readonly versionPath: readonly string[];
  readonly notes: readonly ProjectedPlanNote[];
  readonly chain: readonly ProjectedMigrationEntry[];
}

function projectPlan(
  plan: MigrationPlan,
  opts: { fromVersion: string; toVersion: string },
): ProjectedPlan {
  return {
    schemaId: plan.schemaId,
    fromVersion: opts.fromVersion,
    toVersion: opts.toVersion,
    worstSeverity: plan.worstSeverity,
    versionPath: plan.versionPath,
    notes: plan.notes.map(projectPlanNote),
    chain: plan.chain.map(projectMigrationEntry),
  };
}

// =============================================================================
// Load-failure projection (strip `cause`)
// =============================================================================

function toSerializableLoadFailure(
  f: LoadFailure,
): { readonly path: string; readonly reason: LoadFailure["reason"]; readonly message: string } {
  return { path: f.path, reason: f.reason, message: f.message };
}

// =============================================================================
// Exit-code mapping for issue lists
// =============================================================================

/**
 * `buildRegistry` / `buildMigrationRegistry` failure → exit code.
 * Any `integrity_error` → INTEGRITY_ERROR; otherwise LOGICAL_FAILURE
 * (covers `duplicate_schema_id` / `duplicate_migration`). Same rule
 * as the v0.7 `runCheck` handler-failure mapping and Step 20's
 * `runMigrateList`.
 */
function pickRegistryFailureExitCode(issues: readonly Issue[]): ExitCode {
  for (const i of issues) {
    if (i.code === "integrity_error") return EXIT_CODES.INTEGRITY_ERROR;
  }
  return EXIT_CODES.LOGICAL_FAILURE;
}

/**
 * `planMigrationHandler` failure → exit code. All four locked
 * failure codes (`migration_missing_endpoint` / `migration_not_found`
 * / `migration_chain_broken` / `migration_ambiguous_chain`) map to
 * `LOGICAL_FAILURE`. Defensive fallback also returns LOGICAL_FAILURE
 * — the v0.8 planner does not emit `integrity_error`.
 */
function pickPlannerFailureExitCode(_issues: readonly Issue[]): ExitCode {
  return EXIT_CODES.LOGICAL_FAILURE;
}

// =============================================================================
// Pretty formatter
// =============================================================================

function formatMigrationPlanPretty(
  plan: MigrationPlan,
  opts: { fromVersion: string; toVersion: string },
): string {
  const header =
    `Plan: ${plan.schemaId}  ${opts.fromVersion} → ${opts.toVersion}` +
    `  (worstSeverity: ${plan.worstSeverity ?? "none"})`;
  const lines: string[] = [header];

  if (plan.chain.length === 0) {
    if (plan.notes.length === 0) {
      lines.push("  No migration needed — diff has no breaking or additive changes.");
    } else {
      for (const note of plan.notes) {
        if (note.kind === "over_specified") {
          lines.push(
            `  No migration needed — diff is cosmetic/none, but a migration is registered at \`${note.migration.sourcePath}\`. (over_specified)`,
          );
        } else {
          lines.push(
            `  No migration registered — diff is additive (\`${note.worstSeverity}\`); a migration is optional. (additive_no_migration)`,
          );
        }
      }
    }
  } else {
    lines.push(`  Chain (${plan.chain.length} hop${plan.chain.length === 1 ? "" : "s"}):`);
    for (let i = 0; i < plan.chain.length; i++) {
      const hop = plan.chain[i]!;
      lines.push(
        `    ${i + 1}. ${hop.fromVersion} → ${hop.toVersion}  ${hop.sourcePath}`,
      );
    }
    lines.push(`  Version path: ${plan.versionPath.join(" → ")}`);
  }

  return lines.join("\n") + "\n";
}

// =============================================================================
// Public entry
// =============================================================================

export async function runMigratePlan(
  opts: RunMigratePlanOptions,
): Promise<ExitCode> {
  // 1. Schema walk + load failures → IO_ERROR.
  const walk = await walkWorkspace({ root: opts.root });
  if (walk.failures.length > 0) {
    if (opts.json) {
      opts.stdout(
        formatJson({
          failures: walk.failures.map(toSerializableLoadFailure),
        }),
      );
    } else {
      opts.stderr(formatLoadFailuresPretty(walk.failures));
    }
    return EXIT_CODES.IO_ERROR;
  }

  // 2. Build the schema registry.
  const reg = buildRegistry(walk.entries);
  if (!reg.success) {
    if (opts.json) {
      opts.stdout(formatJson({ issues: reg.issues }));
    } else {
      opts.stderr(formatIssuesPretty(reg.issues));
    }
    return pickRegistryFailureExitCode(reg.issues);
  }

  // 3. Migration walk + load failures → IO_ERROR.
  const migWalk = await readMigrations({ root: opts.root });
  if (migWalk.failures.length > 0) {
    if (opts.json) {
      opts.stdout(
        formatJson({
          failures: migWalk.failures.map(toSerializableLoadFailure),
        }),
      );
    } else {
      opts.stderr(
        formatLoadFailuresPretty(migWalk.failures, {
          noun: { singular: "migration file", plural: "migration files" },
        }),
      );
    }
    return EXIT_CODES.IO_ERROR;
  }

  // 4. Build the migration registry.
  const migReg = buildMigrationRegistry(migWalk.entries);
  if (!migReg.success) {
    if (opts.json) {
      opts.stdout(formatJson({ issues: migReg.issues }));
    } else {
      opts.stderr(formatIssuesPretty(migReg.issues));
    }
    return pickRegistryFailureExitCode(migReg.issues);
  }

  // 5. Dispatch to the planner.
  const result = planMigrationHandler({
    schemaRegistry: reg.data,
    migrationRegistry: migReg.data,
    schemaId: opts.schemaId,
    fromVersion: opts.fromVersion,
    toVersion: opts.toVersion,
  });
  if (!result.success) {
    if (opts.json) {
      opts.stdout(formatJson({ issues: result.issues }));
    } else {
      opts.stderr(formatIssuesPretty(result.issues));
    }
    return pickPlannerFailureExitCode(result.issues);
  }

  // 6. Success.
  if (opts.json) {
    opts.stdout(
      formatJson({
        plan: projectPlan(result.data, {
          fromVersion: opts.fromVersion,
          toVersion: opts.toVersion,
        }),
      }),
    );
  } else {
    opts.stdout(
      formatMigrationPlanPretty(result.data, {
        fromVersion: opts.fromVersion,
        toVersion: opts.toVersion,
      }),
    );
  }
  return EXIT_CODES.SUCCESS;
}
