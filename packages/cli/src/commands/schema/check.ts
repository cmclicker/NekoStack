/**
 * `neko schema check [pattern]` command implementation (v0.7 Step 31).
 *
 * Third real schema verb. Replaces the Step 25 placeholder.
 *
 * Flow:
 *   1. Walk the workspace + build the registry (shared prelude with
 *      `list` / `diff`).
 *   2. Compute the set of generated/ directories implied by the
 *      loaded source files: for every `<dir>/<basename>.schema.ts`,
 *      `<dir>/generated/` is read. The set is deduplicated so a
 *      workspace with N schemas in one directory only reads
 *      `<dir>/generated/` once.
 *   3. `loadCommittedArtifacts` reads each generated/ directory.
 *      Per-artifact paths are re-prefixed with their source
 *      directory so the merged `CommittedArtifact[]` has unique
 *      workspace-relative paths (otherwise two `user.types.ts`
 *      files in different subtrees would collide).
 *   4. `checkHandler({ registry, committedArtifacts })` classifies
 *      each artifact via the two-hash matrix.
 *   5. Format + exit:
 *      - `--json` → `{ verdicts, summary: { clean, cosmetic_drift,
 *        stale, integrity_error } }` to stdout.
 *      - default → per-status tally header + verdict rows via
 *        `formatCheckPretty`.
 *      - any `integrity_error` → `INTEGRITY_ERROR` (4).
 *      - any `stale`           → `LOGICAL_FAILURE` (1).
 *      - otherwise (only `clean` / `cosmetic_drift` / empty) →
 *        `SUCCESS` (0).
 *
 * `--quiet` suppresses non-essential stderr only (v0.7 doesn't yet
 * produce any non-essential stderr from this verb, but the flag is
 * accepted for forward compatibility with the locked CLI surface).
 * The primary verdict output goes to stdout in both pretty and JSON
 * modes and is NEVER suppressed.
 *
 * Pure: no `process.exit`, no `console.*`, no direct `process.stdout`
 * / `process.stderr` writes. The caller injects writers.
 *
 * `checkHandler` failures classify in two layers:
 *   - any issue with `code === "integrity_error"` → INTEGRITY_ERROR
 *   - everything else (schema_not_found, version_not_found) →
 *     LOGICAL_FAILURE
 */

import { isAbsolute, resolve, sep } from "node:path";
import {
  buildRegistry,
  checkHandler,
  type CommittedArtifact,
  type FreshnessVerdict,
  type RegistrySourceEntry,
} from "@nekostack/schema/cli";
import type { Issue } from "@nekostack/schema";
import { EXIT_CODES, type ExitCode } from "../../exit-codes.js";
import { formatJson } from "../../formatters/json.js";
import {
  formatCheckPretty,
  formatIssuesPretty,
  formatLoadFailuresPretty,
} from "../../formatters/pretty.js";
import { loadCommittedArtifacts } from "../../loaders/read-artifacts.js";
import { walkWorkspace } from "../../loaders/walk-workspace.js";
import type { LoadFailure } from "../../loaders/tsx-loader.js";

// =============================================================================
// Public surface
// =============================================================================

export interface RunCheckOptions {
  readonly root: string;
  readonly pattern?: string;
  readonly json: boolean;
  readonly quiet: boolean;
  readonly stdout: (s: string) => void;
  readonly stderr: (s: string) => void;
}

export async function runCheck(opts: RunCheckOptions): Promise<ExitCode> {
  // 1. Walk + buildRegistry prelude.
  const walk = await walkWorkspace({
    root: opts.root,
    ...(opts.pattern !== undefined ? { pattern: opts.pattern } : {}),
  });
  if (walk.failures.length > 0) {
    writeLoadFailures(opts, walk.failures);
    return EXIT_CODES.IO_ERROR;
  }
  const reg = buildRegistry(walk.entries);
  if (!reg.success) {
    writeIssues(opts, reg.issues);
    return EXIT_CODES.LOGICAL_FAILURE;
  }

  // 2. Read committed artifacts from each implied generated/ dir.
  const rootAbs = isAbsolute(opts.root) ? opts.root : resolve(opts.root);
  const committedArtifacts = await readWorkspaceArtifacts(
    rootAbs,
    walk.entries,
  );

  // 3. Run the freshness handler.
  const result = checkHandler({
    registry: reg.data,
    committedArtifacts,
  });
  if (!result.success) {
    writeIssues(opts, result.issues);
    return pickHandlerFailureExitCode(result.issues);
  }

  // 4. Format output + pick exit code from verdicts.
  const summary = tallyVerdicts(result.data.verdicts);
  if (opts.json) {
    opts.stdout(
      formatJson({
        verdicts: result.data.verdicts,
        summary,
      }),
    );
  } else {
    opts.stdout(formatCheckPretty(result.data.verdicts));
  }
  return pickVerdictExitCode(summary);
}

// =============================================================================
// Generated-directory discovery + artifact merge
// =============================================================================

/**
 * Compute the set of `<source-dir>/generated/` directories implied
 * by the loaded entries, read each via {@link loadCommittedArtifacts},
 * and merge into one workspace-relative `CommittedArtifact[]`. Each
 * artifact's `path` is re-prefixed with the workspace-relative
 * generated-directory so paths are unique across the workspace.
 */
async function readWorkspaceArtifacts(
  rootAbs: string,
  entries: readonly RegistrySourceEntry[],
): Promise<readonly CommittedArtifact[]> {
  // Compute and dedupe `<dir>/generated/` per entry. `sourcePath` is
  // workspace-relative forward-slash; we slice off the basename and
  // append "generated".
  const generatedRelDirs = new Set<string>();
  for (const entry of entries) {
    const sourcePath = entry.sourcePath;
    const lastSlash = sourcePath.lastIndexOf("/");
    const dir = lastSlash >= 0 ? sourcePath.slice(0, lastSlash) : "";
    const generated = dir === "" ? "generated" : `${dir}/generated`;
    generatedRelDirs.add(generated);
  }

  const out: CommittedArtifact[] = [];
  for (const relDir of generatedRelDirs) {
    const absDir = resolve(rootAbs, relDir.split("/").join(sep));
    const arts = await loadCommittedArtifacts(absDir);
    for (const a of arts) {
      // `loadCommittedArtifacts` returns paths relative to `absDir`.
      // Re-prefix with `relDir` to produce a workspace-relative path,
      // forward-slash normalized.
      out.push({
        path: `${relDir}/${a.path}`,
        content: a.content,
      });
    }
  }
  return out;
}

// =============================================================================
// Verdict tally + exit-code mapping
// =============================================================================

interface VerdictSummary {
  readonly clean: number;
  readonly cosmetic_drift: number;
  readonly stale: number;
  readonly integrity_error: number;
}

function tallyVerdicts(
  verdicts: readonly FreshnessVerdict[],
): VerdictSummary {
  let clean = 0;
  let cosmeticDrift = 0;
  let stale = 0;
  let integrityError = 0;
  for (const v of verdicts) {
    switch (v.status) {
      case "clean":
        clean += 1;
        break;
      case "cosmetic_drift":
        cosmeticDrift += 1;
        break;
      case "stale":
        stale += 1;
        break;
      case "integrity_error":
        integrityError += 1;
        break;
    }
  }
  return {
    clean,
    cosmetic_drift: cosmeticDrift,
    stale,
    integrity_error: integrityError,
  };
}

function pickVerdictExitCode(summary: VerdictSummary): ExitCode {
  if (summary.integrity_error > 0) return EXIT_CODES.INTEGRITY_ERROR;
  if (summary.stale > 0) return EXIT_CODES.LOGICAL_FAILURE;
  return EXIT_CODES.SUCCESS;
}

function pickHandlerFailureExitCode(issues: readonly Issue[]): ExitCode {
  for (const i of issues) {
    if (i.code === "integrity_error") return EXIT_CODES.INTEGRITY_ERROR;
  }
  return EXIT_CODES.LOGICAL_FAILURE;
}

// =============================================================================
// Failure output helpers
// =============================================================================

function writeLoadFailures(
  opts: Pick<RunCheckOptions, "json" | "stdout" | "stderr">,
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
  opts: Pick<RunCheckOptions, "json" | "stdout" | "stderr">,
  issues: readonly Issue[],
): void {
  if (opts.json) {
    opts.stdout(formatJson({ issues }));
  } else {
    opts.stderr(formatIssuesPretty(issues));
  }
}
