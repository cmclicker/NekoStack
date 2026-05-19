/**
 * `walkWorkspace({ root, pattern? })` — discover `*.schema.{ts,js}`
 * files under a workspace root and load each one into a
 * `RegistrySourceEntry`. v0.7 Step 23.
 *
 * The CLI is the only filesystem walker (Master plan / CLI plan
 * Decision #2). This function:
 *
 *   1. Glob-walks `pattern` (default `**​/*.schema.{ts,js}`) under
 *      `root` using Node's built-in `fs/promises.glob` (Node 22+).
 *      No external glob dep.
 *   2. Reads each match's UTF-8 source text.
 *   3. Hands the absolute path to `loadSchemaModule` from
 *      `tsx-loader.ts`.
 *   4. Builds one `RegistrySourceEntry` per successfully loaded module.
 *   5. Collects every per-file failure into a separate `failures`
 *      array — never short-circuits. The CLI dispatch layer (Steps
 *      25+) decides whether to surface them and what exit code to
 *      pick; this loader is silent.
 *
 * No `console.*`, no `process.exit`, no stderr / stdout writes —
 * static-scan asserted by [`../../tests/loaders/walk-workspace.test.ts`](../../tests/loaders/walk-workspace.test.ts).
 *
 * This module does NOT:
 *   - Build a `Registry` (that's `buildRegistry` on the schema side).
 *   - Call any schema-side handler (`listHandler` etc. — Steps 29+).
 *   - Format output (Steps 27 / 28).
 *   - Decide exit codes (Step 25 dispatch + Step 26 exit-codes enum).
 *
 * Pattern semantics: a caller-supplied `pattern` **replaces** the
 * default — it does not extend it. The CLI surface (Master plan CLI
 * companion §"Locked subcommand surface") spells this out for the
 * `[pattern]` positional on `generate` / `check`.
 *
 * Deterministic ordering: discovered paths are sorted ascending by
 * their workspace-relative form (forward-slash-normalized) before
 * loading. Downstream sort by `schemaId` is still required for
 * registry order (the listHandler does that); this sort is purely so
 * walk-time errors and CLI output have a stable order across runs.
 */

import { readFile } from "node:fs/promises";
import { glob } from "node:fs/promises";
import { isAbsolute, resolve, sep } from "node:path";
import type { RegistrySourceEntry } from "@nekostack/schema/cli";
import { loadSchemaModule, type LoadFailure } from "./tsx-loader.js";

export type { RegistrySourceEntry };

// =============================================================================
// Public types
// =============================================================================

export const DEFAULT_SCHEMA_PATTERN = "**/*.schema.{ts,js}";

export interface WalkOpts {
  /** Workspace root. Must be passed explicitly — the walker does not
   *  fall back to `process.cwd()`. CLI dispatch layer resolves
   *  `--root` (or its default) and hands the absolute path in. */
  readonly root: string;
  /** Optional glob, **replaces** {@link DEFAULT_SCHEMA_PATTERN}. */
  readonly pattern?: string;
}

export interface WalkResult {
  /** One entry per successfully loaded schema file, sorted by
   *  `sourcePath`. */
  readonly entries: readonly RegistrySourceEntry[];
  /** Per-file failures collected across the walk; ordered the same
   *  way as discovery. Empty array when every file loaded cleanly. */
  readonly failures: readonly LoadFailure[];
}

// =============================================================================
// Walker
// =============================================================================

export async function walkWorkspace(opts: WalkOpts): Promise<WalkResult> {
  const pattern = opts.pattern ?? DEFAULT_SCHEMA_PATTERN;
  const rootAbs = isAbsolute(opts.root) ? opts.root : resolve(opts.root);

  // Glob walk. `cwd` keeps relative output in sync with `rootAbs` so
  // we can compute both forms cheaply below.
  let relativePaths: string[];
  try {
    relativePaths = await collectGlob(pattern, rootAbs);
  } catch (cause) {
    return {
      entries: [],
      failures: [
        {
          path: rootAbs,
          reason: "io_error",
          message: errorMessageOf(cause),
          cause,
        },
      ],
    };
  }

  // Deterministic ordering: alphabetical on forward-slash-normalized
  // relative paths. Stable across Windows/POSIX and stable across runs.
  const normalized = relativePaths
    .map((p) => p.split(sep).join("/"))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const entries: RegistrySourceEntry[] = [];
  const failures: LoadFailure[] = [];

  for (const rel of normalized) {
    const abs = resolve(rootAbs, rel);

    let sourceText: string;
    try {
      sourceText = await readFile(abs, "utf8");
    } catch (cause) {
      failures.push({
        path: rel,
        reason: "io_error",
        message: errorMessageOf(cause),
        cause,
      });
      continue;
    }

    const r = await loadSchemaModule(abs);
    if (!r.success) {
      // Re-key the failure path to the workspace-relative form so
      // downstream output is consistent with `sourcePath` on the
      // successful entries.
      failures.push({ ...r.failure, path: rel });
      continue;
    }

    entries.push({
      sourcePath: rel,
      sourceText,
      schemas: r.data.schemas,
    });
  }

  return { entries, failures };
}

// =============================================================================
// Helpers
// =============================================================================

async function collectGlob(pattern: string, cwd: string): Promise<string[]> {
  const out: string[] = [];
  for await (const p of glob(pattern, { cwd })) out.push(p);
  return out;
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
