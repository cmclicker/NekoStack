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
        const entry = parseAuditEntryLine(trimmed, i + 1, path);
        if (entry.runId === runId && entry.status === "success") {
          out.push(entry.recordIndex);
        }
      }
      return out;
    },
  };
}

// =============================================================================
// Audit-entry line validator
// =============================================================================
//
// Audit is the truth source for resume. A line that's JSON-valid but
// structurally not an `AuditEntry` can poison the cursor — pushing
// `undefined` / non-number values that violate `cursor(runId):
// Promise<readonly number[]>` and silently break resume correctness.
//
// `parseAuditEntryLine` parses the JSON, runtime-validates the fields
// the cursor actually depends on (`__auditSchemaVersion`, `runId`,
// `status`, `recordIndex`), and throws an adapter-readable error
// naming the failing field. All resume-safety guarantees flow through
// here.

function parseAuditEntryLine(
  line: string,
  lineNumber: number,
  path: string,
): AuditEntry {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch (cause) {
    throw malformedLineError({
      lineNumber,
      path,
      field: "json",
      detail: `not valid JSON: ${errorMessageOf(cause)}`,
    });
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw malformedLineError({
      lineNumber,
      path,
      field: "shape",
      detail: "audit-entry line must be a JSON object",
    });
  }

  const obj = parsed as Record<string, unknown>;

  if (obj.__auditSchemaVersion !== "1") {
    throw malformedLineError({
      lineNumber,
      path,
      field: "__auditSchemaVersion",
      detail: `expected "1", got ${describeValue(obj.__auditSchemaVersion)}`,
    });
  }

  if (typeof obj.runId !== "string") {
    throw malformedLineError({
      lineNumber,
      path,
      field: "runId",
      detail: `expected string, got ${describeValue(obj.runId)}`,
    });
  }

  if (obj.status !== "success" && obj.status !== "failure") {
    throw malformedLineError({
      lineNumber,
      path,
      field: "status",
      detail: `expected "success" | "failure", got ${describeValue(obj.status)}`,
    });
  }

  if (
    typeof obj.recordIndex !== "number" ||
    !Number.isInteger(obj.recordIndex) ||
    obj.recordIndex < 0
  ) {
    throw malformedLineError({
      lineNumber,
      path,
      field: "recordIndex",
      detail: `expected non-negative integer, got ${describeValue(obj.recordIndex)}`,
    });
  }

  return obj as unknown as AuditEntry;
}

function malformedLineError(opts: {
  lineNumber: number;
  path: string;
  field: string;
  detail: string;
}): Error {
  return new Error(
    `JSONL audit adapter: malformed entry on line ${opts.lineNumber} of ${opts.path} — field \`${opts.field}\` (${opts.detail}).`,
  );
}

function describeValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return "array";
  return typeof value;
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
