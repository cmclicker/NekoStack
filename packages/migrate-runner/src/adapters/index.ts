/**
 * Reference adapter barrel (v0.9 Step 7).
 *
 * The three reference adapters that ship in v0.9:
 *
 *   - `createJsonFileInputAdapter(path)` — reads a JSON array or
 *     `{ records: [...] }` object from disk; streams sequentially.
 *   - `createJsonFileOutputAdapter(path)` — buffers records in
 *     memory; writes a JSON array on `flush()`.
 *   - `createJsonlAuditAdapter(path)` — append-only JSONL audit
 *     log; `cursor(runId)` filters to success entries for resume.
 *
 * Database / streaming / cloud-storage adapters are out of scope
 * for v0.9; consumer code or a future v0.1.X+ may ship more.
 *
 * **Filesystem boundary:** these three files are the ONLY
 * `src/adapters/*` files that import `node:fs/promises`. The
 * cross-cutting boundary scan in `tests/scaffold.test.ts`
 * enforces "fs imports only under `src/adapters/`".
 */

export { createJsonFileInputAdapter } from "./json-file-input.js";
export { createJsonFileOutputAdapter } from "./json-file-output.js";
export { createJsonlAuditAdapter } from "./jsonl-audit.js";
