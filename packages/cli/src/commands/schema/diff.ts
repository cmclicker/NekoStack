/**
 * `neko schema diff <a> <b>` command implementation (v0.7 Step 30).
 *
 * Second real schema verb. Replaces the Step 25 placeholder.
 *
 * Flow:
 *   1. Walk the workspace + build the registry (same prelude as
 *      `runList`).
 *   2. Resolve each operand `<a>` / `<b>` to a `SchemaNode`. An
 *      operand is one of:
 *      - `schemaId`                — highest-semver entry for that id
 *      - `schemaId@version`        — exact id+version
 *      - file path (`/`, `\`, or `.ts` / `.js` / `.mts` / `.cts`
 *                                   suffix) — find the workspace
 *                                   entry whose `sourcePath` matches,
 *                                   take its first schema.
 *   3. Hand the pair to `diffHandler({ before, after })`.
 *   4. Format the `DiffResult.data` payload (`{ changes,
 *      worstSeverity }`):
 *        - `--json`  → one-line JSON of the payload
 *        - default   → `formatDiffPretty(payload)`
 *   5. Pick the exit code from `worstSeverity`:
 *        - `"breaking"`           → `LOGICAL_FAILURE`
 *        - `"additive"` / `"cosmetic"` / `null` → `SUCCESS`
 *
 * `UnsupportedNodeKindError` from `diffNodes` (date / union /
 * recursiveRef / transform IR) propagates out per the schema-side
 * convention. The CLI dispatch layer will gain explicit
 * unsupported-IR mapping when a real verb introduces a surface that
 * could throw beyond `Issue`s; v0.7 lets the throw fall through so
 * the failure is loud during development.
 *
 * Pure: no `process.exit`, no `console.*`, no direct `process.stdout`
 * / `process.stderr` writes. Writers are injected by the caller.
 */

import { isAbsolute, resolve, sep } from "node:path";
import {
  buildRegistry,
  diffHandler,
  findSchema,
  type Registry,
  type RegistrySourceEntry,
} from "@nekostack/schema/cli";
import type { Issue } from "@nekostack/schema";
import { EXIT_CODES, type ExitCode } from "../../exit-codes.js";
import { formatJson } from "../../formatters/json.js";
import {
  formatDiffPretty,
  formatIssuesPretty,
  formatLoadFailuresPretty,
} from "../../formatters/pretty.js";
import { walkWorkspace } from "../../loaders/walk-workspace.js";
import type { LoadFailure } from "../../loaders/tsx-loader.js";
import type { SchemaNode } from "@nekostack/schema";

// =============================================================================
// Public surface
// =============================================================================

export interface RunDiffOptions {
  readonly root: string;
  /** Left operand — `schemaId`, `schemaId@version`, or file path. */
  readonly a: string;
  /** Right operand — same forms as `a`. */
  readonly b: string;
  readonly json: boolean;
  readonly stdout: (s: string) => void;
  readonly stderr: (s: string) => void;
}

export async function runDiff(opts: RunDiffOptions): Promise<ExitCode> {
  // 1. Walk + build registry (shared prelude with `runList`).
  const walk = await walkWorkspace({ root: opts.root });
  if (walk.failures.length > 0) {
    writeLoadFailures(opts, walk.failures);
    return EXIT_CODES.IO_ERROR;
  }
  const reg = buildRegistry(walk.entries);
  if (!reg.success) {
    writeIssues(opts, reg.issues);
    return EXIT_CODES.LOGICAL_FAILURE;
  }

  // 2. Resolve each operand to a SchemaNode.
  const rootAbs = isAbsolute(opts.root) ? opts.root : resolve(opts.root);
  const a = resolveOperand(opts.a, rootAbs, walk.entries, reg.data);
  const b = resolveOperand(opts.b, rootAbs, walk.entries, reg.data);
  if (!a.ok || !b.ok) {
    const issues: Issue[] = [];
    if (!a.ok) issues.push(a.issue);
    if (!b.ok) issues.push(b.issue);
    writeIssues(opts, issues);
    return EXIT_CODES.LOGICAL_FAILURE;
  }

  // 3. Diff.
  const result = diffHandler({ before: a.node, after: b.node });
  if (!result.success) {
    writeIssues(opts, result.issues);
    return EXIT_CODES.LOGICAL_FAILURE;
  }

  // 4. Format.
  if (opts.json) {
    opts.stdout(
      formatJson({
        changes: result.data.changes,
        worstSeverity: result.data.worstSeverity,
      }),
    );
  } else {
    opts.stdout(formatDiffPretty(result.data));
  }

  // 5. Exit code from worstSeverity. Breaking is the only failure;
  //    additive / cosmetic / null (no-change) are all SUCCESS.
  return result.data.worstSeverity === "breaking"
    ? EXIT_CODES.LOGICAL_FAILURE
    : EXIT_CODES.SUCCESS;
}

// =============================================================================
// Operand resolution
// =============================================================================

type Resolved =
  | { readonly ok: true; readonly node: SchemaNode }
  | { readonly ok: false; readonly issue: Issue };

function resolveOperand(
  operand: string,
  rootAbs: string,
  entries: readonly RegistrySourceEntry[],
  registry: Registry,
): Resolved {
  const parsed = parseOperand(operand);

  if (parsed.kind === "file") {
    const entry = findEntryByFile(parsed.path, rootAbs, entries);
    if (entry === undefined) {
      return {
        ok: false,
        issue: {
          code: "schema_not_found",
          path: [],
          message: `File operand \`${operand}\` does not match any loaded schema file under \`${opts_root_display(rootAbs)}\`.`,
          severity: "error",
          metadata: { operand, kind: "file", root: rootAbs },
        },
      };
    }
    const node = entry.schemas[0]?.node;
    if (node === undefined) {
      return {
        ok: false,
        issue: {
          code: "schema_not_found",
          path: [],
          message: `File operand \`${operand}\` matched a workspace file but exported no schemas.`,
          severity: "error",
          metadata: { operand, kind: "file" },
        },
      };
    }
    return { ok: true, node };
  }

  // schemaId or schemaId@version.
  const entry = findSchema(registry, parsed.id, parsed.version);
  if (entry === undefined) {
    const idKnown = registry.has(parsed.id);
    if (parsed.version !== undefined && idKnown) {
      return {
        ok: false,
        issue: {
          code: "version_not_found",
          path: [],
          message: `Schema \`${parsed.id}\` exists but version \`${parsed.version}\` is not in the registry.`,
          severity: "error",
          metadata: {
            operand,
            kind: "id",
            schemaId: parsed.id,
            schemaVersion: parsed.version,
          },
        },
      };
    }
    return {
      ok: false,
      issue: {
        code: "schema_not_found",
        path: [],
        message: `Schema \`${parsed.id}\`${parsed.version === undefined ? "" : `@${parsed.version}`} is not in the registry.`,
        severity: "error",
        metadata: {
          operand,
          kind: "id",
          schemaId: parsed.id,
          schemaVersion: parsed.version ?? null,
        },
      },
    };
  }
  return { ok: true, node: entry.schema.node };
}

function parseOperand(
  op: string,
):
  | { readonly kind: "file"; readonly path: string }
  | { readonly kind: "id"; readonly id: string; readonly version?: string } {
  // File detection: contains a path separator or ends in a recognized
  // source-file extension.
  if (/[/\\]/.test(op) || /\.(ts|js|mts|cts)$/i.test(op)) {
    return { kind: "file", path: op };
  }
  // `id@version` — split at the first `@`. Reverse-DNS schemaIds
  // (`com.x.User`) do not contain `@`, so this is unambiguous.
  const at = op.indexOf("@");
  if (at > 0 && at < op.length - 1) {
    return {
      kind: "id",
      id: op.slice(0, at),
      version: op.slice(at + 1),
    };
  }
  return { kind: "id", id: op };
}

function findEntryByFile(
  filePath: string,
  rootAbs: string,
  entries: readonly RegistrySourceEntry[],
): RegistrySourceEntry | undefined {
  // Resolve the user's input against the workspace root. Absolute
  // paths pass through; relative paths anchor on `--root` so the
  // command behaves the same whether the user shelled in from
  // cwd === root or from somewhere else.
  const target = isAbsolute(filePath)
    ? resolve(filePath)
    : resolve(rootAbs, filePath);
  for (const entry of entries) {
    // entry.sourcePath is workspace-relative forward-slash. Rebuild
    // the absolute form by joining against rootAbs and normalizing
    // separators.
    const entryAbs = resolve(rootAbs, entry.sourcePath.split("/").join(sep));
    if (entryAbs === target) return entry;
  }
  return undefined;
}

function opts_root_display(rootAbs: string): string {
  return rootAbs;
}

// =============================================================================
// Failure output helpers (mirror runList)
// =============================================================================

function writeLoadFailures(
  opts: Pick<RunDiffOptions, "json" | "stdout" | "stderr">,
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
  opts: Pick<RunDiffOptions, "json" | "stdout" | "stderr">,
  issues: readonly Issue[],
): void {
  if (opts.json) {
    opts.stdout(formatJson({ issues }));
  } else {
    opts.stderr(formatIssuesPretty(issues));
  }
}
