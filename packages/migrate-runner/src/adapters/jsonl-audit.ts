/**
 * `createJsonlAuditAdapter(path)` — reference `AuditAdapter` backed
 * by a JSONL file on disk (v0.9 Step 7, paired with Step 5's
 * in-memory default).
 *
 * Each `append(entry)` writes one JSON-encoded line to `path`.
 * Lines are append-only — the adapter never rewrites existing
 * lines. `cursor(runId)` reads the file and returns the set of
 * `recordIndex` values for entries matching the given `runId` AND
 * `status: "success"`. Other entries (failures, other runIds,
 * blank lines) are filtered out.
 *
 * **Boundaries:**
 *
 *   - Imports `node:fs/promises` (allowed in `src/adapters/*`).
 *   - Never calls `migration.transform(...)`.
 *   - Never logs / never exits / never writes to stdout / stderr.
 *   - Append-only: never rewrites or deletes prior lines.
 *
 * **Malformed JSONL is fail-loud.** A non-empty line that isn't
 * valid JSON throws — silently skipping it could mask corruption
 * and let the runner skip records that should have been resumed.
 * (Decision #16: audit is the truth source for resume.)
 *
 * **Missing file is the empty cursor.** If the audit file doesn't
 * exist yet (no prior run with this adapter / path), `cursor()`
 * returns `[]`. This means a first-run resume call doesn't blow
 * up; it just skips nothing.
 *
 * **Parent directory creation:** `append()` lazily ensures the
 * parent directory exists on its first call, the same way
 * `json-file-output.ts` does on flush.
 */

import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AuditAdapter, AuditEntry } from "../types.js";

export function createJsonlAuditAdapter(path: string): AuditAdapter {
  let parentEnsured = false;
  return {
    async append(entry: AuditEntry): Promise<void> {
      if (!parentEnsured) {
        await mkdir(dirname(path), { recursive: true });
        parentEnsured = true;
      }
      await appendFile(path, JSON.stringify(entry) + "\n", "utf8");
    },
    async cursor(runId: string): Promise<readonly number[]> {
      let text: string;
      try {
        text = await readFile(path, "utf8");
      } catch (cause) {
        // Missing file = empty cursor (no prior run on this path).
        if (
          cause !== null &&
          typeof cause === "object" &&
          (cause as { code?: string }).code === "ENOENT"
        ) {
          return [];
        }
        throw cause;
      }
      const out: number[] = [];
      const lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const trimmed = line.trim();
        if (trimmed === "") continue; // blank lines are legal padding
        let parsed: AuditEntry;
        try {
          parsed = JSON.parse(trimmed) as AuditEntry;
        } catch (cause) {
          throw new Error(
            `JSONL audit adapter: malformed JSON on line ${i + 1} of ${path}: ${errorMessageOf(cause)}`,
          );
        }
        if (parsed.runId === runId && parsed.status === "success") {
          out.push(parsed.recordIndex);
        }
      }
      return out;
    },
  };
}

// =============================================================================
// Helpers
// =============================================================================

function errorMessageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
