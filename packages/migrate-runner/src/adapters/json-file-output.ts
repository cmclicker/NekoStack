/**
 * `createJsonFileOutputAdapter(path)` — reference `OutputAdapter`
 * that buffers persisted records in memory and writes a single
 * JSON array on `flush()` (v0.9 Step 7).
 *
 * **No disk writes happen before `flush()`.** Every `persist(record)`
 * call appends to an in-memory buffer; nothing touches the
 * filesystem until the orchestrator calls `flush()` at the end of
 * a successful `execute`-mode run. The runner's flush policy
 * (Step 6) calls `flush()` only after natural stream end —
 * cancellation and `onError: stop` early returns DO NOT trigger
 * flush, and DO NOT trigger disk writes from this adapter.
 *
 * **Repeated flush is deterministic.** The buffer is not reset
 * between flushes; calling `flush()` twice in a row writes the
 * same content twice. If the consumer persists additional records
 * between flushes, those records appear in the next flush.
 *
 * **Parent directory creation:** if `path`'s parent directory does
 * not exist, `flush()` creates it (`mkdir -p`). This is the
 * adapter's I/O side; the runner orchestrator stays filesystem-
 * free.
 *
 * Output format: pretty-printed JSON (2-space indent) with a
 * trailing newline. The choice is for human readability — the
 * file is a reference output adapter, not a hot-path format.
 *
 * **Boundaries:**
 *
 *   - Imports `node:fs/promises` (allowed in `src/adapters/*`).
 *   - Never calls `migration.transform(...)`.
 *   - Never logs / never exits / never writes to stdout / stderr.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { OutputAdapter } from "../types.js";

export function createJsonFileOutputAdapter(
  path: string,
): OutputAdapter<unknown> {
  const buffer: unknown[] = [];

  return {
    async persist(record: unknown): Promise<void> {
      buffer.push(record);
    },
    async flush(): Promise<void> {
      await mkdir(dirname(path), { recursive: true });
      const text = JSON.stringify(buffer, null, 2) + "\n";
      await writeFile(path, text, "utf8");
    },
  };
}
