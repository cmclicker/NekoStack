/**
 * `readMigrations({ root, pattern? })` — CLI-side discovery + load of
 * authored `*.migration.ts` files (v0.8 Step 19).
 *
 * The CLI is the only filesystem walker and the only place that
 * dynamic-imports authored migration modules (Master plan Decision #1;
 * v0.8 INVARIANTS — `no apply, no transform execution` stays in force).
 * This function:
 *
 *   1. Glob-walks `pattern` (default `**​/*.migration.ts`) under
 *      `root` using Node's built-in `fs/promises.glob` — same approach
 *      as the v0.7 `walk-workspace.ts`.
 *   2. Reads each match's UTF-8 source text verbatim.
 *   3. Hands the absolute path to a dynamic `import()` routed through
 *      the tsx ESM hook registered once by the sibling `tsx-loader.ts`
 *      module (importing it for the `register()` side effect is
 *      sufficient — no per-call `tsImport()`).
 *   4. Validates the module's default export structurally as an
 *      `AnyMigration` (`schemaId` / `from` / `to` strings + `transform`
 *      function). Anything else → `no_migration_export` failure.
 *   5. Pairs the load result with its `sourceText` and workspace-
 *      relative, forward-slash-normalized `sourcePath` into one
 *      `MigrationSourceEntry`.
 *   6. Collects every per-file failure into a separate `failures`
 *      array — never short-circuits.
 *
 * **Top-level evaluation nuance.** Authored migration files are
 * TypeScript modules. tsx evaluates their top-level code at import
 * time; this is the CLI side of the v0.8 boundary (the schema package
 * never imports authored migration modules). A top-level throw
 * classifies as `runtime_error` — the rest of the walk continues.
 *
 * **`transform` is NEVER invoked here.** This loader reads, imports,
 * validates the export shape, and stops. A static-scan test asserts
 * the source contains no `.transform(` call.
 *
 * No `console.*`, no `process.exit`, no stdout/stderr writes —
 * static-scan asserted by [`../../tests/loaders/read-migrations.test.ts`](../../tests/loaders/read-migrations.test.ts).
 *
 * This module does NOT:
 *   - Build a `MigrationRegistry` (that's `buildMigrationRegistry` on
 *     the schema side).
 *   - Parse the JSDoc provenance header (that's
 *     `parseMigrationProvenanceFromText` on the schema side).
 *   - Plan, verify, or stub migrations (Steps 21 / 22 / 23 commands).
 *   - Format output (later steps).
 *   - Decide exit codes (later steps).
 */

import { readFile } from "node:fs/promises";
import { glob } from "node:fs/promises";
import { isAbsolute, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { stat } from "node:fs/promises";
import type { AnyMigration, MigrationSourceEntry } from "@nekostack/schema/cli";
// Import the sibling loader purely for its `register()` side effect.
// `tsx-loader.ts` registers tsx's ESM hook once at module load, after
// which a plain dynamic `import()` of a `.ts` specifier routes through
// the tsx transform pipeline. Sharing the registration avoids paying
// the per-call `tsImport()` cost that compounds badly on Windows.
import {
  classifyImportError,
  errorMessageOf,
  type LoadFailure,
} from "./tsx-loader.js";

export type { MigrationSourceEntry, LoadFailure };

// =============================================================================
// Public types
// =============================================================================

export const DEFAULT_MIGRATION_PATTERN = "**/*.migration.ts";

export interface ReadMigrationsOpts {
  /** Workspace root. Must be passed explicitly; the loader does not
   *  fall back to `process.cwd()`. Dispatch layer resolves `--root`
   *  (or its default) and hands the absolute path in. */
  readonly root: string;
  /** Optional glob, **replaces** {@link DEFAULT_MIGRATION_PATTERN}. */
  readonly pattern?: string;
}

export interface ReadMigrationsResult {
  /** One entry per successfully loaded migration file, sorted by
   *  `sourcePath`. */
  readonly entries: readonly MigrationSourceEntry[];
  /** Per-file failures collected across the walk; ordered the same
   *  way as discovery. Empty array when every file loaded cleanly. */
  readonly failures: readonly LoadFailure[];
}

// =============================================================================
// Loader
// =============================================================================

export async function readMigrations(
  opts: ReadMigrationsOpts,
): Promise<ReadMigrationsResult> {
  const pattern = opts.pattern ?? DEFAULT_MIGRATION_PATTERN;
  const rootAbs = isAbsolute(opts.root) ? opts.root : resolve(opts.root);

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
  // relative paths. Same convention as `walk-workspace.ts`.
  const normalized = relativePaths
    .map((p) => p.split(sep).join("/"))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const entries: MigrationSourceEntry[] = [];
  const failures: LoadFailure[] = [];

  for (const rel of normalized) {
    const abs = resolve(rootAbs, rel);

    // IO check — fail fast on missing / non-regular files. Glob
    // results pass under normal conditions, but a race (file deleted
    // between discovery and read) lands here.
    const ioFailure = await checkRegularFile(abs, rel);
    if (ioFailure !== undefined) {
      failures.push(ioFailure);
      continue;
    }

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

    const specifier = pathToFileURL(abs).href;
    let mod: Record<string, unknown>;
    try {
      mod = (await import(specifier)) as Record<string, unknown>;
    } catch (cause) {
      failures.push({
        path: rel,
        reason: classifyImportError(cause),
        message: errorMessageOf(cause),
        cause,
      });
      continue;
    }

    const migration = extractMigration(mod);
    if (migration === undefined) {
      failures.push({
        path: rel,
        reason: "no_migration_export",
        message:
          `Module \`${rel}\` evaluated successfully but exposed no valid ` +
          `\`Migration\` default export (need \`{ schemaId: string, from: string, ` +
          `to: string, transform: (input) => output }\`).`,
      });
      continue;
    }

    entries.push({
      sourcePath: rel,
      sourceText,
      migration,
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

async function checkRegularFile(
  abs: string,
  rel: string,
): Promise<LoadFailure | undefined> {
  try {
    const stats = await stat(abs);
    if (!stats.isFile()) {
      return {
        path: rel,
        reason: "io_error",
        message: `Path \`${rel}\` is not a regular file.`,
      };
    }
    return undefined;
  } catch (cause) {
    return {
      path: rel,
      reason: "io_error",
      message: errorMessageOf(cause),
      cause,
    };
  }
}

/**
 * Structural `AnyMigration` validator on the module's default export.
 * Mirrors the duck-typing approach in `tsx-loader.ts`'s `isAnySchema`:
 * `instanceof` is unreliable because tsx and the CLI resolve
 * `@nekostack/schema` through different module-graph entries, so the
 * type identity differs across the boundary. Structural checks are
 * the robust alternative.
 *
 * Returns the migration on success, `undefined` if the default export
 * is missing or shaped incorrectly.
 */
function extractMigration(mod: Record<string, unknown>): AnyMigration | undefined {
  const def = mod.default;
  if (typeof def !== "object" || def === null) return undefined;
  const m = def as {
    schemaId?: unknown;
    from?: unknown;
    to?: unknown;
    transform?: unknown;
  };
  if (typeof m.schemaId !== "string") return undefined;
  if (typeof m.from !== "string") return undefined;
  if (typeof m.to !== "string") return undefined;
  if (typeof m.transform !== "function") return undefined;
  return def as AnyMigration;
}
