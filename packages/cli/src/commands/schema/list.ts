/**
 * `neko schema list` command implementation (v0.7 Step 29).
 *
 * First fully-wired schema verb. Replaces the Step 25 placeholder.
 * Flow:
 *
 *   1. `walkWorkspace({ root })` discovers and loads every
 *      `*.schema.{ts,js}` file under `root`.
 *   2. If any file failed to load → render failures, exit IO_ERROR.
 *   3. `buildRegistry(entries)` indexes the loaded schemas.
 *   4. If the build returned `duplicate_schema_id` Issues → render
 *      issues, exit LOGICAL_FAILURE.
 *   5. `listHandler({ registry })` enumerates entries in
 *      schemaId-ascending order (unversioned last).
 *   6. Format and write:
 *      - `--json`  → one-line JSON `{ schemas: [...] }` to stdout
 *      - default   → padded table to stdout via `formatListPretty`
 *   7. Return SUCCESS.
 *
 * Pure: no `process.exit`, no `console.*`, no direct `process.stdout`
 * / `process.stderr` writes. The caller (the commander action wired
 * up in `cli.ts`) injects writers; tests pass collector functions.
 *
 * JSON output shape is locked here so machine consumers have a
 * stable contract. The `schema` field of `RegistryEntry` (the live
 * `Schema` instance) is deliberately NOT included — it's not
 * JSON-serializable and not a useful identifier downstream.
 *
 *     {
 *       "schemas": [
 *         { "schemaId": "com.x.User", "schemaVersion": "1.0.0",
 *           "sourcePath": "schemas/user.schema.ts",
 *           "irHash": "sha256:...", "sourceHash": "sha256:..." },
 *         …
 *       ]
 *     }
 *
 * Unversioned entries surface as `"schemaVersion": null` so the
 * JSON shape stays uniform.
 */

import { buildRegistry, listHandler } from "@nekostack/schema/cli";
import { EXIT_CODES, type ExitCode } from "../../exit-codes.js";
import { formatJson } from "../../formatters/json.js";
import {
  formatIssuesPretty,
  formatListPretty,
  formatLoadFailuresPretty,
} from "../../formatters/pretty.js";
import { walkWorkspace } from "../../loaders/walk-workspace.js";

export interface RunListOptions {
  readonly root: string;
  readonly json: boolean;
  readonly quiet: boolean;
  readonly stdout: (s: string) => void;
  readonly stderr: (s: string) => void;
}

export async function runList(opts: RunListOptions): Promise<ExitCode> {
  // 1. Walk the workspace and load every matching schema file.
  const walk = await walkWorkspace({ root: opts.root });

  // 2. Per-file load failures → IO_ERROR. Render before returning.
  //    Failures are essential diagnostics; `--quiet` does not
  //    suppress them per the audit guidance for Step 29.
  if (walk.failures.length > 0) {
    if (opts.json) {
      opts.stdout(formatJson({ failures: walk.failures }));
    } else {
      opts.stderr(formatLoadFailuresPretty(walk.failures));
    }
    return EXIT_CODES.IO_ERROR;
  }

  // 3. Build the in-memory registry. `buildRegistry` returns a
  //    `Result` so duplicate-id collisions surface as `Issue[]`
  //    rather than throws.
  const reg = buildRegistry(walk.entries);
  if (!reg.success) {
    if (opts.json) {
      opts.stdout(formatJson({ issues: reg.issues }));
    } else {
      opts.stderr(formatIssuesPretty(reg.issues));
    }
    return EXIT_CODES.LOGICAL_FAILURE;
  }

  // 4. Enumerate. `listHandler` has no failure mode, but treat any
  //    future failure defensively as LOGICAL_FAILURE.
  const result = listHandler({ registry: reg.data });
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
        schemas: result.data.entries.map((e) => ({
          schemaId: e.schemaId,
          schemaVersion: e.schemaVersion ?? null,
          sourcePath: e.sourcePath,
          irHash: e.irHash,
          sourceHash: e.sourceHash,
        })),
      }),
    );
  } else {
    opts.stdout(formatListPretty(result.data.entries));
  }
  return EXIT_CODES.SUCCESS;
}
