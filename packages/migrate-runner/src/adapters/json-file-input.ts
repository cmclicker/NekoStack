/**
 * `createJsonFileInputAdapter(path)` — reference `InputAdapter`
 * backed by a single JSON file on disk (v0.9 Step 7).
 *
 * The orchestrator pulls records sequentially via `stream()`. This
 * adapter parses the file lazily on the first iteration, so
 * construction is cheap (no I/O) — invalid JSON / unsupported
 * shape errors surface at stream-iteration time, where the runner
 * catches them and classifies the run as `adapter_init_failed`
 * (Decision #14).
 *
 * **Supported file shapes:**
 *
 *   - A top-level JSON array: `[r0, r1, r2, ...]`
 *   - A top-level object with a `records` array:
 *     `{ "records": [r0, r1, r2, ...] }`
 *
 * Any other top-level shape throws an adapter-readable error.
 *
 * **Boundaries:**
 *
 *   - This file is one of the few in the package allowed to import
 *     `node:fs/promises`. The cross-cutting scan in
 *     `tests/scaffold.test.ts` enforces "fs imports only in
 *     `src/adapters/*`".
 *   - Never calls `migration.transform(...)`. Static scan in
 *     `tests/adapters/json-file-input.test.ts` enforces.
 *   - Never logs / never exits / never writes to stdout / stderr.
 *   - Does NOT mutate parsed records — they're handed to the
 *     orchestrator as-is.
 */

import { readFile } from "node:fs/promises";
import type { InputAdapter } from "../types.js";

export function createJsonFileInputAdapter(
  path: string,
): InputAdapter<unknown> {
  return {
    async *stream(): AsyncIterable<unknown> {
      const text = await readFile(path, "utf8");
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (cause) {
        throw new Error(
          `JSON input adapter: file at ${path} is not valid JSON: ${errorMessageOf(cause)}`,
        );
      }
      const records = extractRecords(parsed, path);
      for (const record of records) yield record;
    },
  };
}

// =============================================================================
// Helpers
// =============================================================================

function extractRecords(parsed: unknown, path: string): readonly unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (
    parsed !== null &&
    typeof parsed === "object" &&
    Array.isArray((parsed as { records?: unknown }).records)
  ) {
    return (parsed as { records: readonly unknown[] }).records;
  }
  throw new Error(
    `JSON input adapter: file at ${path} must be either a top-level array or an object with a \`records\` array (got ${describeShape(parsed)}).`,
  );
}

function describeShape(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
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
