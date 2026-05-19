/**
 * `tsx`-backed schema-module loader (v0.7 Step 22).
 *
 * Loads a single `*.schema.{ts,js,mts,cts}` file in-process via tsx's
 * programmatic `tsImport` API, extracts every exported NekoStack `Schema`
 * instance, and returns a typed `LoadResult`. Pure data-in / data-out at
 * this layer — no `console.*`, no `process.exit`, no `stderr.write`. The
 * CLI dispatch layer (Steps 25+) maps `LoadFailure` payloads to
 * `schema_load_failed` `Issue`s and to exit code 3.
 *
 * Loader-level failures classify per the locked Master plan Decision #1
 * categories:
 *
 *   - `io_error`        — file missing / unreadable / not a regular file.
 *   - `compile_error`   — TS/JS syntax error; tsx (via esbuild) refused
 *                         to transform the source.
 *   - `runtime_error`   — module loaded but threw during evaluation
 *                         (top-level code, side-effect imports, etc.).
 *   - `no_schema_export` — module evaluated successfully but exposed
 *                         zero `Schema` instances on its exports.
 *
 * This module does NOT:
 *   - Walk a workspace (Step 23, `walk-workspace.ts`).
 *   - Read committed artifacts (Step 24, `read-artifacts.ts`).
 *   - Build a registry (Step 29's `list.ts` calls `buildRegistry` from
 *     `@nekostack/schema/cli`).
 *   - Format anything for stdout / stderr (Step 27 / Step 28).
 *
 * tsx detection notes — tsx wraps esbuild, and a TS/JS compile failure
 * surfaces as an error with one of three signals:
 *   1. `error.errors` (esbuild's `BuildFailure` shape — array of
 *      `Message`s).
 *   2. `error instanceof SyntaxError` (Node's own parser fallback or a
 *      genuine ESM syntax mismatch).
 *   3. The error's `name === "TransformError"` (some esbuild paths).
 * Anything else thrown while attempting to import the module is treated
 * as a runtime error.
 */

import { stat } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { register } from "tsx/esm/api";
import type { AnySchema } from "@nekostack/schema";

// Register tsx's ESM hook once at module load. Per-call `tsImport()`
// pays a fresh-context cost that compounds across many files (each
// call spins up new ESM resolution state), which on Windows pushes
// per-load latency above 1s and turns a normal `walkWorkspace` over
// a few schema files into a multi-minute hang. `register()` installs
// the loader globally for the lifetime of the process, after which a
// plain dynamic `import()` of a `.ts` file goes through tsx's
// transform pipeline and benefits from Node's module cache — the
// second load of any file (or any cross-test repeat) is effectively
// free.
register();

// =============================================================================
// Public types
// =============================================================================

export type LoadFailureReason =
  | "io_error"
  | "compile_error"
  | "runtime_error"
  | "no_schema_export";

export interface LoadFailure {
  readonly path: string;
  readonly reason: LoadFailureReason;
  readonly message: string;
  /**
   * The original error (if any) that triggered the failure. Carried so
   * the CLI dispatch layer can put it in `Issue.metadata.cause` for
   * diagnostic logging. Always `undefined` for `no_schema_export`.
   */
  readonly cause?: unknown;
}

export interface LoadedSchemaModule {
  readonly path: string;
  /**
   * Every exported value structurally recognized as a `Schema`,
   * sorted ascending by `schemaId` with anonymous schemas (no `.id()`)
   * pushed to the end in their original-iteration order. Sorting is
   * done here so callers see a deterministic shape regardless of how
   * the underlying ESM runtime iterates module namespaces — plain
   * Node + tsx's `register()` hook returns alphabetical-by-export-name
   * order, vitest's worker returns declaration order, and a future
   * Node release could change either. Downstream registry code
   * already sorts by `schemaId` (see `listHandler`); doing it here
   * means single-file callers also get the stable order without
   * re-sorting.
   */
  readonly schemas: readonly AnySchema[];
}

export type LoadResult =
  | { readonly success: true; readonly data: LoadedSchemaModule }
  | { readonly success: false; readonly failure: LoadFailure };

// =============================================================================
// Loader
// =============================================================================

/**
 * Load one schema-source file by absolute or workspace-relative path.
 *
 * `parentURL` is retained on the signature for API stability (some
 * future loader strategy may need it again) but is unused in the
 * current `register()`-based implementation — file URLs are absolute,
 * so resolution doesn't need a parent.
 */
export async function loadSchemaModule(
  path: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _parentURL: string = import.meta.url,
): Promise<LoadResult> {
  // 1. IO check — fail fast on missing / non-regular files. This catches
  //    typos and stale paths before tsx spins up an esbuild worker.
  const ioFailure = await checkRegularFile(path);
  if (ioFailure !== undefined) return { success: false, failure: ioFailure };

  // 2. Resolve to a file:// URL so plain dynamic import treats it as
  //    an absolute specifier regardless of platform path separator.
  const specifier = pathToFileURL(path).href;

  let mod: Record<string, unknown>;
  try {
    mod = (await import(specifier)) as Record<string, unknown>;
  } catch (cause) {
    const reason = classifyImportError(cause);
    return {
      success: false,
      failure: {
        path,
        reason,
        message: errorMessageOf(cause),
        cause,
      },
    };
  }

  // 3. Extract every Schema instance from the module namespace, then
  //    sort deterministically by schemaId so callers see a stable
  //    shape regardless of how the underlying ESM runtime iterates
  //    namespace exports.
  const schemas = sortSchemas(extractSchemas(mod));
  if (schemas.length === 0) {
    return {
      success: false,
      failure: {
        path,
        reason: "no_schema_export",
        message: `Module \`${path}\` evaluated successfully but exposed no \`Schema\` exports.`,
      },
    };
  }

  return { success: true, data: { path, schemas } };
}

// =============================================================================
// Helpers
// =============================================================================

async function checkRegularFile(path: string): Promise<LoadFailure | undefined> {
  try {
    const stats = await stat(path);
    if (!stats.isFile()) {
      return {
        path,
        reason: "io_error",
        message: `Path \`${path}\` is not a regular file.`,
      };
    }
    return undefined;
  } catch (cause) {
    return {
      path,
      reason: "io_error",
      message: errorMessageOf(cause),
      cause,
    };
  }
}

function classifyImportError(err: unknown): LoadFailureReason {
  if (err === null || typeof err !== "object") return "runtime_error";
  const e = err as {
    name?: unknown;
    errors?: unknown;
    code?: unknown;
    message?: unknown;
  };
  // 1. esbuild `BuildFailure` — has a populated `errors` array.
  if (Array.isArray(e.errors) && e.errors.length > 0) return "compile_error";
  // 2. Native `SyntaxError` raised by Node's ESM parser, or a tsx wrap of one.
  if (err instanceof SyntaxError) return "compile_error";
  // 3. tsx / esbuild sometimes surfaces a `TransformError` name.
  if (e.name === "TransformError") return "compile_error";
  // 4. Node module-loading error codes that mean "could not parse / load":
  if (e.code === "ERR_UNSUPPORTED_DIR_IMPORT" || e.code === "ERR_INVALID_MODULE_SPECIFIER") {
    return "compile_error";
  }
  // 5. Message-pattern fallback for environments where tsx's error
  //    propagation flattens `name` / `errors` to a plain `Error`. In
  //    vitest's worker pool, for instance, esbuild transform failures
  //    arrive as `new Error("Transform failed with N errors: ...")`
  //    with no other discriminating properties. The message prefix
  //    is esbuild's own and is stable across tsx/esbuild versions.
  if (typeof e.message === "string" && /^Transform failed/.test(e.message)) {
    return "compile_error";
  }
  return "runtime_error";
}

function extractSchemas(mod: Record<string, unknown>): AnySchema[] {
  const out: AnySchema[] = [];
  for (const value of Object.values(mod)) {
    if (isAnySchema(value)) out.push(value);
  }
  return out;
}

/**
 * Sort schemas ascending by `schemaId`. Anonymous schemas (id ===
 * undefined) are stable-sorted to the end, in their original index
 * order. Matches the convention `listHandler` uses on the registry
 * side so single-file and registry-level orderings agree.
 */
function sortSchemas(schemas: AnySchema[]): AnySchema[] {
  return schemas
    .map((s, i) => ({ s, i, id: s.node.metadata?.id }))
    .sort((a, b) => {
      // Anonymous-to-end, then by index for stability.
      if (a.id === undefined && b.id === undefined) return a.i - b.i;
      if (a.id === undefined) return 1;
      if (b.id === undefined) return -1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : a.i - b.i;
    })
    .map((r) => r.s);
}

/**
 * Structural Schema detector. `instanceof Schema` would be cleaner, but
 * tsx loads schema fixtures by resolving `@nekostack/schema` through a
 * different module-graph entry than the CLI's own static import — so
 * the `Schema` constructor identity differs between the two, and
 * `instanceof` always returns false. Duck-typing on the IR shape
 * (`node.kind: string`) is the robust alternative; the SchemaNode
 * contract guarantees every concrete builder produces an object with
 * `.node.kind` and `.node` is deep-frozen at construction. False
 * positives would require a non-schema value that mimics the IR
 * shape, which the CLI's own input surface does not produce.
 */
function isAnySchema(v: unknown): v is AnySchema {
  if (typeof v !== "object" || v === null) return false;
  const node = (v as { node?: unknown }).node;
  if (typeof node !== "object" || node === null) return false;
  return typeof (node as { kind?: unknown }).kind === "string";
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
