/**
 * `neko schema migrate verify` command implementation (v0.8 Step 22).
 *
 * Mirrors `runMigratePlan`'s pure / writer-injected discipline
 * (Master plan Decision #1).
 *
 * Flow:
 *
 *   1. `walkWorkspace({ root })` — load every `*.schema.{ts,js}`.
 *      Any per-file load failure → IO_ERROR.
 *   2. `buildRegistry(walk.entries)` — index the schemas.
 *      `duplicate_schema_id` → LOGICAL_FAILURE; `integrity_error` →
 *      INTEGRITY_ERROR.
 *   3. `readMigrations({ root })` — load every `*.migration.ts`.
 *      Any per-file load failure → IO_ERROR.
 *   4. `buildMigrationRegistry(migWalk.entries)` — index migrations
 *      and parse each one's provenance. `duplicate_migration` →
 *      LOGICAL_FAILURE; `integrity_error` → INTEGRITY_ERROR.
 *   5. **CLI-side verdict derivation** — walk the migration registry
 *      with the same classification rule as
 *      `verifyMigrationProvenance` so the CLI can surface verdicts +
 *      summary on BOTH the success and failure JSON branches. (The
 *      schema-side handler discards verdicts on failure; the v0.8
 *      verify-CLI contract requires them on both branches.)
 *   6. `verifyMigrationsHandler({ schemaRegistry, migrationRegistry })`
 *      — gets the official success/failure determination and any
 *      `migration_drift` / `migration_missing_endpoint` issues.
 *   7. Format and write:
 *      - `--json` (success) → `{ verdicts, summary }`
 *      - `--json` (failure) → `{ verdicts, summary, issues }`
 *      - pretty → summary header + per-verdict rows
 *   8. Exit-code mapping:
 *      - any drift / missing_endpoint → LOGICAL_FAILURE
 *      - only bound / cosmetic_drift (or empty registry) → SUCCESS
 *
 * **Pure.** No `process.exit`, no `console.*`, no direct
 * `process.stdout` / `process.stderr` writes. Writers are injected.
 *
 * **`migration.transform` is NEVER invoked here.** Verification is
 * provenance-only (the v0.8 INVARIANTS contract). Static-scan
 * asserted by [`../../../../tests/commands/schema-migrate-verify.test.ts`](../../../../tests/commands/schema-migrate-verify.test.ts).
 *
 * **JSON output never serializes `MigrationEntry.migration` or its
 * `transform` closure.** Verdicts are already shaped as
 * `{ status, schemaId, fromVersion, toVersion, sourcePath }` per the
 * `MigrationVerdict` type — no migration reference — so the projection
 * is the identity. Issue records likewise carry only structured
 * metadata.
 */

import {
  buildMigrationRegistry,
  buildRegistry,
  findSchema,
  verifyMigrationsHandler,
} from "@nekostack/schema/cli";
import type {
  MigrationEntry,
  MigrationRegistry,
  MigrationVerdict,
  Registry,
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

export interface RunMigrateVerifyOptions {
  readonly root: string;
  readonly json: boolean;
  readonly quiet: boolean;
  readonly stdout: (s: string) => void;
  readonly stderr: (s: string) => void;
}

// =============================================================================
// Verdict summary
// =============================================================================

interface VerdictSummary {
  readonly bound: number;
  readonly cosmetic_drift: number;
  readonly drift: number;
  readonly missing_endpoint: number;
}

interface DerivedVerdicts {
  readonly verdicts: readonly MigrationVerdict[];
  readonly summary: VerdictSummary;
}

/**
 * CLI-side mirror of `verifyMigrationProvenance`'s classification +
 * iteration discipline. Produces verdicts on **every** invocation —
 * the schema-side handler drops them on the failure branch, but the
 * CLI must surface them on both branches per the Step 22 JSON
 * contract.
 *
 * Source of truth for the classification rule is
 * [`packages/schema/src/migrations/verify-provenance.ts`](../../../../../schema/src/migrations/verify-provenance.ts).
 * Decision #9 (the four-way verdict matrix) is locked in
 * `packages/schema/docs/MIGRATIONS.md`; any future change there must
 * land here too.
 *
 * Iteration is `(schemaId, fromVersion, toVersion)` lex-ascending so
 * the CLI verdicts list matches the handler's on success.
 */
function deriveVerdicts(
  schemaRegistry: Registry,
  migrationRegistry: MigrationRegistry,
): DerivedVerdicts {
  const verdicts: MigrationVerdict[] = [];
  const counts = { bound: 0, cosmetic_drift: 0, drift: 0, missing_endpoint: 0 };

  for (const entry of iterateRegistry(migrationRegistry)) {
    const verdict = classifyEntry(entry, schemaRegistry);
    verdicts.push(verdict);
    counts[verdict.status] += 1;
  }

  return { verdicts, summary: counts };
}

function* iterateRegistry(
  registry: MigrationRegistry,
): Iterable<MigrationEntry> {
  const schemaIds = [...registry.keys()].sort();
  for (const schemaId of schemaIds) {
    const byFrom = registry.get(schemaId);
    if (byFrom === undefined) continue;
    const fromVersions = [...byFrom.keys()].sort();
    for (const fromVersion of fromVersions) {
      const byTo = byFrom.get(fromVersion);
      if (byTo === undefined) continue;
      const toVersions = [...byTo.keys()].sort();
      for (const toVersion of toVersions) {
        const entry = byTo.get(toVersion);
        if (entry !== undefined) yield entry;
      }
    }
  }
}

function classifyEntry(
  entry: MigrationEntry,
  schemaRegistry: Registry,
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
// Pretty formatter
// =============================================================================

function formatVerifyPretty(d: DerivedVerdicts): string {
  const { verdicts, summary } = d;
  const total = verdicts.length;
  if (total === 0) {
    return "No migrations to verify.\n";
  }

  const lines: string[] = [];
  lines.push(
    `Verified ${total} migration${total === 1 ? "" : "s"}:` +
      `  bound=${summary.bound}` +
      `  cosmetic_drift=${summary.cosmetic_drift}` +
      `  drift=${summary.drift}` +
      `  missing_endpoint=${summary.missing_endpoint}`,
  );

  const idWidth = maxWidth(verdicts.map((v) => v.schemaId));
  const versionsWidth = maxWidth(
    verdicts.map((v) => `${v.fromVersion} → ${v.toVersion}`),
  );
  for (const v of verdicts) {
    const versions = `${v.fromVersion} → ${v.toVersion}`;
    const tag =
      v.status === "bound"
        ? "[bound]"
        : v.status === "cosmetic_drift"
          ? "[warn ] cosmetic_drift"
          : v.status === "drift"
            ? "[FAIL ] drift"
            : "[FAIL ] missing_endpoint";
    lines.push(
      `  ${v.schemaId.padEnd(idWidth)}   ${versions.padEnd(versionsWidth)}   ${tag}   ${v.sourcePath}`,
    );
  }
  return lines.join("\n") + "\n";
}

function maxWidth(values: readonly string[]): number {
  let max = 0;
  for (const v of values) if (v.length > max) max = v.length;
  return max;
}

// =============================================================================
// Failure helpers
// =============================================================================

function toSerializableLoadFailure(
  f: LoadFailure,
): { readonly path: string; readonly reason: LoadFailure["reason"]; readonly message: string } {
  return { path: f.path, reason: f.reason, message: f.message };
}

/**
 * `buildRegistry` / `buildMigrationRegistry` failure → exit code.
 * Same mapping as `runMigratePlan` / `runMigrateList`.
 */
function pickRegistryFailureExitCode(issues: readonly Issue[]): ExitCode {
  for (const i of issues) {
    if (i.code === "integrity_error") return EXIT_CODES.INTEGRITY_ERROR;
  }
  return EXIT_CODES.LOGICAL_FAILURE;
}

// =============================================================================
// Public entry
// =============================================================================

export async function runMigrateVerify(
  opts: RunMigrateVerifyOptions,
): Promise<ExitCode> {
  // 1. Schema walk + load failures → IO_ERROR.
  const walk = await walkWorkspace({ root: opts.root });
  if (walk.failures.length > 0) {
    if (opts.json) {
      opts.stdout(
        formatJson({ failures: walk.failures.map(toSerializableLoadFailure) }),
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

  // 5. Derive verdicts on the CLI side (mirrors the handler's
  //    classification so verdicts + summary are available on the
  //    failure branch).
  const derived = deriveVerdicts(reg.data, migReg.data);

  // 6. Call the handler for success/failure determination + issues.
  const result = verifyMigrationsHandler({
    schemaRegistry: reg.data,
    migrationRegistry: migReg.data,
  });

  // 7. Emit and pick exit code.
  if (result.success) {
    if (opts.json) {
      opts.stdout(
        formatJson({
          verdicts: derived.verdicts,
          summary: derived.summary,
        }),
      );
    } else {
      opts.stdout(formatVerifyPretty(derived));
    }
    return EXIT_CODES.SUCCESS;
  }

  // Failure branch: verdicts + summary + issues all in the JSON.
  if (opts.json) {
    opts.stdout(
      formatJson({
        verdicts: derived.verdicts,
        summary: derived.summary,
        issues: result.issues,
      }),
    );
  } else {
    opts.stdout(formatVerifyPretty(derived));
    opts.stderr(formatIssuesPretty(result.issues));
  }
  return EXIT_CODES.LOGICAL_FAILURE;
}
