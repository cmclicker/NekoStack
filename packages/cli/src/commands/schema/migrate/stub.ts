/**
 * `neko schema migrate stub` command implementation (v0.8 Step 23).
 *
 * The only v0.8 migrate verb that writes a file. Mirrors v0.7's
 * `runGenerate` shape: the schema-side handler is pure and returns
 * `{ suggestedPath, content }`; this command is responsible for the
 * actual filesystem persistence. Master plan Decision #1 keeps the
 * filesystem on the CLI side.
 *
 * Flow:
 *
 *   1. `walkWorkspace({ root })` — load every `*.schema.{ts,js}`.
 *      Any per-file load failure → IO_ERROR.
 *   2. `buildRegistry(walk.entries)` — index the schemas.
 *      `duplicate_schema_id` → LOGICAL_FAILURE.
 *   3. `stubMigrationHandler({ schemaRegistry, schemaId, fromVersion,
 *      toVersion })` — generate the stub payload. Failure modes
 *      surface as `migration_missing_endpoint` →
 *      LOGICAL_FAILURE.
 *   4. **Refuse to overwrite.** Unlike `runGenerate` (which clobbers
 *      generated artifacts by default), `runMigrateStub` writes a
 *      file that contains hand-authored code. If the destination
 *      already exists, the command returns LOGICAL_FAILURE without
 *      modifying it. Decision #5 of the v0.8 phase plan locks this
 *      contract.
 *   5. `mkdir -p` the destination's parent + `writeFile` the
 *      stub content. Any thrown error (EACCES, ENOSPC, etc.) →
 *      IO_ERROR.
 *   6. Format and write:
 *      - `--json` (success) → `{ stub: { schemaId, fromVersion,
 *        toVersion, suggestedPath } }`. The `content` field is
 *        deliberately omitted — machine consumers don't need the
 *        full source body, and the file is already on disk.
 *      - pretty → `Wrote stub: <suggestedPath>`.
 *
 * **Pure helpers + bounded I/O.** `mkdir` and `writeFile` (and a
 * `stat` for the overwrite check) are the only `node:fs` calls.
 * `process.exit`, `console.*`, and direct stdout/stderr writes are
 * forbidden — static-scan asserted by
 * [`../../../../tests/commands/schema-migrate-stub.test.ts`](../../../../tests/commands/schema-migrate-stub.test.ts).
 *
 * **No `migration.transform`.** The stub command doesn't even own
 * a registry of authored migrations — only the schema registry. The
 * `.transform(` pattern still appears as a forbidden token in the
 * static scan so the v0.8 boundary stays enforced everywhere.
 */

import { dirname, isAbsolute, resolve, sep } from "node:path";
import { mkdir, stat, writeFile } from "node:fs/promises";
import {
  buildRegistry,
  stubMigrationHandler,
} from "@nekostack/schema/cli";
import type { Issue } from "@nekostack/schema";
import { EXIT_CODES, type ExitCode } from "../../../exit-codes.js";
import { formatJson } from "../../../formatters/json.js";
import {
  formatIssuesPretty,
  formatLoadFailuresPretty,
} from "../../../formatters/pretty.js";
import { walkWorkspace } from "../../../loaders/walk-workspace.js";
import type { LoadFailure } from "../../../loaders/tsx-loader.js";

// =============================================================================
// Options
// =============================================================================

export interface RunMigrateStubOptions {
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
// CLI-local failure shape
// =============================================================================

/**
 * CLI-side failure carrier for cases where the schema-side `Issue`
 * vocabulary doesn't apply. `runMigrateStub` produces two such cases:
 *
 *   - `stub_path_exists` — destination already on disk; the command
 *     refuses to overwrite hand-authored code.
 *   - `stub_write_failed` — `mkdir` or `writeFile` threw (EACCES,
 *     ENOSPC, etc.).
 *
 * Mirrors the `LoadFailure` shape (`path` / `reason` / `message`)
 * so machine consumers see one consistent failure envelope across
 * the loader and the writer.
 */
interface StubLocalFailure {
  readonly path: string;
  readonly reason: "stub_path_exists" | "stub_write_failed";
  readonly message: string;
}

// =============================================================================
// Public entry
// =============================================================================

export async function runMigrateStub(
  opts: RunMigrateStubOptions,
): Promise<ExitCode> {
  // 1. Schema walk + load failures → IO_ERROR.
  const walk = await walkWorkspace({ root: opts.root });
  if (walk.failures.length > 0) {
    writeLoadFailures(opts, walk.failures);
    return EXIT_CODES.IO_ERROR;
  }

  // 2. Build the schema registry.
  const reg = buildRegistry(walk.entries);
  if (!reg.success) {
    writeIssues(opts, reg.issues);
    return pickRegistryFailureExitCode(reg.issues);
  }

  // 3. Plan the stub. Failures (e.g., `migration_missing_endpoint`)
  //    surface as `LOGICAL_FAILURE`.
  const result = stubMigrationHandler({
    schemaRegistry: reg.data,
    schemaId: opts.schemaId,
    fromVersion: opts.fromVersion,
    toVersion: opts.toVersion,
  });
  if (!result.success) {
    writeIssues(opts, result.issues);
    return EXIT_CODES.LOGICAL_FAILURE;
  }

  const stub = result.data;
  const rootAbs = isAbsolute(opts.root) ? opts.root : resolve(opts.root);
  const destAbs = resolve(rootAbs, stub.suggestedPath.split("/").join(sep));

  // 4. Refuse to overwrite. The destination is hand-authored migration
  //    code; clobbering it would silently destroy the author's work.
  if (await pathExists(destAbs)) {
    const failure: StubLocalFailure = {
      path: stub.suggestedPath,
      reason: "stub_path_exists",
      message:
        `Refusing to overwrite existing file at \`${stub.suggestedPath}\`. ` +
        `Move or delete it first, or pick a different (from, to) pair.`,
    };
    writeLocalFailures(opts, [failure]);
    return EXIT_CODES.LOGICAL_FAILURE;
  }

  // 5. Persist. `mkdir -p` + `writeFile` may throw on I/O errors
  //    (EACCES, ENOSPC, etc.); surface those as IO_ERROR.
  try {
    await mkdir(dirname(destAbs), { recursive: true });
    await writeFile(destAbs, stub.content, "utf8");
  } catch (cause) {
    const failure: StubLocalFailure = {
      path: stub.suggestedPath,
      reason: "stub_write_failed",
      message: errorMessageOf(cause),
    };
    writeLocalFailures(opts, [failure]);
    return EXIT_CODES.IO_ERROR;
  }

  // 6. Success — emit the locked machine-readable shape (no `content`).
  if (opts.json) {
    opts.stdout(
      formatJson({
        stub: {
          schemaId: stub.schemaId,
          fromVersion: stub.fromVersion,
          toVersion: stub.toVersion,
          suggestedPath: stub.suggestedPath,
        },
      }),
    );
  } else {
    opts.stdout(`Wrote stub: ${stub.suggestedPath}\n`);
  }
  return EXIT_CODES.SUCCESS;
}

// =============================================================================
// Helpers
// =============================================================================

async function pathExists(abs: string): Promise<boolean> {
  try {
    await stat(abs);
    return true;
  } catch {
    return false;
  }
}

function errorMessageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/**
 * Pick exit code for `buildRegistry` failure. Same mapping as
 * `runMigratePlan` / `runMigrateVerify`.
 */
function pickRegistryFailureExitCode(issues: readonly Issue[]): ExitCode {
  for (const i of issues) {
    if (i.code === "integrity_error") return EXIT_CODES.INTEGRITY_ERROR;
  }
  return EXIT_CODES.LOGICAL_FAILURE;
}

function writeLoadFailures(
  opts: Pick<RunMigrateStubOptions, "json" | "stdout" | "stderr">,
  failures: readonly LoadFailure[],
): void {
  if (opts.json) {
    opts.stdout(
      formatJson({
        failures: failures.map((f) => ({
          path: f.path,
          reason: f.reason,
          message: f.message,
        })),
      }),
    );
  } else {
    opts.stderr(formatLoadFailuresPretty(failures));
  }
}

function writeIssues(
  opts: Pick<RunMigrateStubOptions, "json" | "stdout" | "stderr">,
  issues: readonly Issue[],
): void {
  if (opts.json) {
    opts.stdout(formatJson({ issues }));
  } else {
    opts.stderr(formatIssuesPretty(issues));
  }
}

function writeLocalFailures(
  opts: Pick<RunMigrateStubOptions, "json" | "stdout" | "stderr">,
  failures: readonly StubLocalFailure[],
): void {
  if (opts.json) {
    opts.stdout(formatJson({ failures }));
  } else {
    const header = failures.length === 1 ? "Stub failed:" : "Stub failed:";
    const lines = failures.map(
      (f) => `  [${f.reason}] ${f.path} — ${f.message}`,
    );
    opts.stderr([header, ...lines].join("\n") + "\n");
  }
}
