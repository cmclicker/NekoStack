/**
 * `formatJson(payload)` — single-line JSON output formatter (v0.7 Step 27).
 *
 * The `--json` flag on every `neko schema *` verb routes through this
 * function. CLI plan §"Output formats" locks the contract:
 *
 *   - One line per invocation (no pretty-printing) — pipeable.
 *   - Exactly one trailing newline so callers can `writeOut(formatJson(x))`
 *     without remembering to add `\n`.
 *   - `JSON.stringify` errors propagate. Unserializable inputs (cycles,
 *     `BigInt`, etc.) are programmer errors, not user errors; the
 *     dispatch layer treats an unhandled throw as an unexpected
 *     condition rather than masking it behind a fake success line.
 *
 * Pure utility — no `console.*`, no `process.*`, no `fs.*`. Static-
 * scan asserted by [`../../tests/formatters/json.test.ts`](../../tests/formatters/json.test.ts).
 *
 * Per-command JSON schemas (the shape each verb emits) are locked by
 * the schema-side `*Result` types those verbs wrap; this formatter
 * is shape-agnostic. When a `*Result` shape changes, the
 * corresponding command's snapshot test catches it without anything
 * here needing to change.
 */

export function formatJson(payload: unknown): string {
  return JSON.stringify(payload) + "\n";
}
