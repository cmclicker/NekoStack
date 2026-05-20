/**
 * `neko schema migrate list` command implementation (v0.8 Step 20).
 *
 * First fully-wired v0.8 verb. Mirrors the v0.7 `runList` shape exactly
 * — same pure / writer-injected discipline (Master plan Decision #1).
 *
 * Flow:
 *
 *   1. `readMigrations({ root })` discovers and loads every
 *      `*.migration.ts` file under `root`.
 *   2. If any file failed to load → render failures, exit IO_ERROR.
 *   3. `buildMigrationRegistry(entries)` indexes the loaded migrations
 *      and parses each one's JSDoc provenance header.
 *   4. If the build returned issues:
 *      - any `integrity_error` → INTEGRITY_ERROR (4)
 *      - otherwise (e.g., `duplicate_migration`) → LOGICAL_FAILURE (1)
 *   5. `listMigrationsHandler({ migrationRegistry })` enumerates
 *      entries in `(schemaId, fromVersion, toVersion)` ascending order.
 *   6. Format and write:
 *      - `--json`  → one-line JSON `{ migrations: [...] }` to stdout
 *      - default   → padded table to stdout via `formatMigrationListPretty`
 *   7. Return SUCCESS.
 *
 * **Pure.** No `process.exit`, no `console.*`, no direct
 * `process.stdout` / `process.stderr` writes. The caller (the commander
 * action wired up in `cli.ts` — landing in a later step) injects
 * writers; tests pass collector functions.
 *
 * **`migration.transform` is NEVER invoked here.** The v0.8 boundary
 * (INVARIANTS — "no apply, no transform execution") stays in force.
 * Static-scan asserted by [`../../../../tests/commands/schema-migrate-list.test.ts`](../../../../tests/commands/schema-migrate-list.test.ts).
 *
 * JSON output shape is locked here so machine consumers have a stable
 * contract. The `migration` field on `MigrationEntry` — the live
 * `AnyMigration` carrying the `transform` closure — is deliberately
 * NOT included; it's not JSON-serializable, not a useful downstream
 * identifier, and touching it would tempt callers across the v0.8
 * boundary.
 *
 *     {
 *       "migrations": [
 *         {
 *           "schemaId":       "com.x.Tenant",
 *           "fromVersion":    "1.0.0",
 *           "toVersion":      "2.0.0",
 *           "sourcePath":     "schemas/tenant.1-0-0-to-2-0-0.migration.ts",
 *           "fromIrHash":     "sha256:...",
 *           "toIrHash":       "sha256:...",
 *           "fromSourceHash": "sha256:...",
 *           "toSourceHash":   "sha256:..."
 *         },
 *         …
 *       ]
 *     }
 */

import { buildMigrationRegistry, listMigrationsHandler } from "@nekostack/schema/cli";
import type { Issue } from "@nekostack/schema";
import { EXIT_CODES, type ExitCode } from "../../../exit-codes.js";
import { formatJson } from "../../../formatters/json.js";
import {
  formatIssuesPretty,
  formatLoadFailuresPretty,
  formatMigrationListPretty,
} from "../../../formatters/pretty.js";
import { readMigrations } from "../../../loaders/read-migrations.js";
import type { LoadFailure } from "../../../loaders/tsx-loader.js";

/**
 * Project a `LoadFailure` to a JSON-safe shape. `LoadFailure.cause` is
 * an `unknown` thrown by tsx/esbuild and may not serialize cleanly
 * (circular references, function values, etc.). The CLI's `--json`
 * contract for load failures is `{ path, reason, message }` only —
 * same projection rule as the v0.7 `runList`.
 */
function toSerializableLoadFailure(
  f: LoadFailure,
): { readonly path: string; readonly reason: LoadFailure["reason"]; readonly message: string } {
  return { path: f.path, reason: f.reason, message: f.message };
}

/**
 * Pick the exit code for a `buildMigrationRegistry` failure:
 *   - any `integrity_error` → INTEGRITY_ERROR
 *   - otherwise (e.g., `duplicate_migration`) → LOGICAL_FAILURE
 * Same dispatch rule as v0.7 `runCheck`'s handler-failure mapping.
 */
function pickRegistryFailureExitCode(issues: readonly Issue[]): ExitCode {
  for (const i of issues) {
    if (i.code === "integrity_error") return EXIT_CODES.INTEGRITY_ERROR;
  }
  return EXIT_CODES.LOGICAL_FAILURE;
}

export interface RunMigrateListOptions {
  readonly root: string;
  readonly json: boolean;
  readonly quiet: boolean;
  readonly stdout: (s: string) => void;
  readonly stderr: (s: string) => void;
}

export async function runMigrateList(
  opts: RunMigrateListOptions,
): Promise<ExitCode> {
  // 1. Walk the workspace and load every `*.migration.ts` file.
  const walk = await readMigrations({ root: opts.root });

  // 2. Per-file load failures → IO_ERROR. Render before returning.
  //    Failures are essential diagnostics; `--quiet` does not suppress
  //    them, matching v0.7 `runList`.
  if (walk.failures.length > 0) {
    if (opts.json) {
      opts.stdout(
        formatJson({
          failures: walk.failures.map(toSerializableLoadFailure),
        }),
      );
    } else {
      opts.stderr(
        formatLoadFailuresPretty(walk.failures, {
          noun: { singular: "migration file", plural: "migration files" },
        }),
      );
    }
    return EXIT_CODES.IO_ERROR;
  }

  // 3. Build the in-memory migration registry. `buildMigrationRegistry`
  //    returns a `Result` so `duplicate_migration` and provenance
  //    parse failures surface as `Issue[]` rather than throws.
  const reg = buildMigrationRegistry(walk.entries);
  if (!reg.success) {
    if (opts.json) {
      opts.stdout(formatJson({ issues: reg.issues }));
    } else {
      opts.stderr(formatIssuesPretty(reg.issues));
    }
    return pickRegistryFailureExitCode(reg.issues);
  }

  // 4. Enumerate. `listMigrationsHandler` has no failure mode today
  //    but treat any future failure defensively as LOGICAL_FAILURE.
  const result = listMigrationsHandler({ migrationRegistry: reg.data });
  if (!result.success) {
    if (opts.json) {
      opts.stdout(formatJson({ issues: result.issues }));
    } else {
      opts.stderr(formatIssuesPretty(result.issues));
    }
    return EXIT_CODES.LOGICAL_FAILURE;
  }

  // 5. Success — write the entries in the chosen format.
  if (opts.json) {
    opts.stdout(
      formatJson({
        migrations: result.data.entries.map((e) => ({
          schemaId: e.schemaId,
          fromVersion: e.fromVersion,
          toVersion: e.toVersion,
          sourcePath: e.sourcePath,
          fromIrHash: e.fromIrHash,
          toIrHash: e.toIrHash,
          fromSourceHash: e.fromSourceHash,
          toSourceHash: e.toSourceHash,
        })),
      }),
    );
  } else {
    opts.stdout(formatMigrationListPretty(result.data.entries));
  }
  return EXIT_CODES.SUCCESS;
}
