/**
 * `neko schema generate [pattern]` command implementation (v0.7 Step 32).
 *
 * Fourth and final schema verb. Replaces the Step 25 placeholder.
 *
 * `generate` is the only v0.7 verb that writes files. The schema-side
 * `generateHandler` is pure — it returns a list of `GeneratedArtifact`
 * payloads with `suggestedPath` values; this command is responsible
 * for actually persisting them. Master plan Decision #1 keeps the
 * filesystem on the CLI side.
 *
 * Flow:
 *   1. `walkWorkspace({ root, pattern })`.
 *   2. Per-file load failures → `IO_ERROR`.
 *   3. `buildRegistry(entries)` runs purely for duplicate-id
 *      detection. The `generateHandler` itself doesn't use the
 *      registry, but two schemas sharing a `(schemaId, version)`
 *      would emit artifacts to the same `suggestedPath` and the
 *      second write would silently overwrite the first. Surfacing
 *      that as `duplicate_schema_id` keeps the failure mode loud.
 *   4. `generateHandler({ entries })` plans every artifact for every
 *      named schema. Anonymous schemas are silently skipped per
 *      schema-side Decision #5 — the CLI warns nothing here (the
 *      audit-noticeable surface is the count of generated artifacts).
 *   5. Write each artifact's `content` to `<root>/<suggestedPath>`.
 *      Parent directories are created as needed; existing files are
 *      overwritten. Partial-generation (a subset of artifact kinds)
 *      is not supported in v0.7 — Master plan Decision #6.
 *   6. Format + return `SUCCESS`. The empty-artifacts case (anonymous-
 *      only workspace, or empty workspace) is still `SUCCESS`.
 *
 * JSON output excludes the artifact `content` — that's potentially
 * many kilobytes per artifact and is not what a CI consumer needs:
 *
 *     {
 *       "artifacts": [
 *         { "schemaId": "com.x.User", "kind": "typescript",
 *           "suggestedPath": "schemas/generated/user.types.ts",
 *           "irHash": "sha256:…", "sourceHash": "sha256:…" },
 *         …
 *       ]
 *     }
 *
 * Pure with one exception — filesystem writes via `node:fs/promises`
 * are deliberately allowed here. `process.exit` / `console.*` /
 * direct stdout-stderr writes remain forbidden and are statically
 * scanned in tests.
 */

import { dirname, isAbsolute, resolve, sep } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import {
  buildRegistry,
  generateHandler,
  type GeneratedArtifact,
} from "@nekostack/schema/cli";
import type { Issue } from "@nekostack/schema";
import { EXIT_CODES, type ExitCode } from "../../exit-codes.js";
import { formatJson } from "../../formatters/json.js";
import {
  formatGeneratePretty,
  formatIssuesPretty,
  formatLoadFailuresPretty,
} from "../../formatters/pretty.js";
import { walkWorkspace } from "../../loaders/walk-workspace.js";
import type { LoadFailure } from "../../loaders/tsx-loader.js";

export interface RunGenerateOptions {
  readonly root: string;
  readonly pattern?: string;
  readonly json: boolean;
  readonly quiet: boolean;
  readonly stdout: (s: string) => void;
  readonly stderr: (s: string) => void;
}

export async function runGenerate(
  opts: RunGenerateOptions,
): Promise<ExitCode> {
  // 1. Walk.
  const walk = await walkWorkspace({
    root: opts.root,
    ...(opts.pattern !== undefined ? { pattern: opts.pattern } : {}),
  });
  if (walk.failures.length > 0) {
    writeLoadFailures(opts, walk.failures);
    return EXIT_CODES.IO_ERROR;
  }

  // 2. Duplicate-id safety check. `buildRegistry` doesn't feed
  //    `generateHandler` but it's the existing surface that catches
  //    `(schemaId, version)` collisions across files.
  const reg = buildRegistry(walk.entries);
  if (!reg.success) {
    writeIssues(opts, reg.issues);
    return EXIT_CODES.LOGICAL_FAILURE;
  }

  // 3. Plan artifacts.
  const result = generateHandler({ entries: walk.entries });
  if (!result.success) {
    writeIssues(opts, result.issues);
    return EXIT_CODES.LOGICAL_FAILURE;
  }

  // 4. Persist each artifact.
  const rootAbs = isAbsolute(opts.root) ? opts.root : resolve(opts.root);
  for (const a of result.data.artifacts) {
    const abs = resolve(rootAbs, a.suggestedPath.split("/").join(sep));
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, a.content, "utf8");
  }

  // 5. Format + return.
  if (opts.json) {
    opts.stdout(
      formatJson({
        artifacts: result.data.artifacts.map(toSerializableArtifact),
      }),
    );
  } else {
    opts.stdout(formatGeneratePretty(result.data.artifacts));
  }
  return EXIT_CODES.SUCCESS;
}

// =============================================================================
// JSON projection — omit `content` from machine-readable output
// =============================================================================

function toSerializableArtifact(
  a: GeneratedArtifact,
): {
  readonly schemaId: string;
  readonly kind: GeneratedArtifact["kind"];
  readonly suggestedPath: string;
  readonly irHash: GeneratedArtifact["irHash"];
  readonly sourceHash: GeneratedArtifact["sourceHash"];
} {
  return {
    schemaId: a.schemaId,
    kind: a.kind,
    suggestedPath: a.suggestedPath,
    irHash: a.irHash,
    sourceHash: a.sourceHash,
  };
}

// =============================================================================
// Failure output helpers (mirror the other verbs)
// =============================================================================

function writeLoadFailures(
  opts: Pick<RunGenerateOptions, "json" | "stdout" | "stderr">,
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
  opts: Pick<RunGenerateOptions, "json" | "stdout" | "stderr">,
  issues: readonly Issue[],
): void {
  if (opts.json) {
    opts.stdout(formatJson({ issues }));
  } else {
    opts.stderr(formatIssuesPretty(issues));
  }
}
