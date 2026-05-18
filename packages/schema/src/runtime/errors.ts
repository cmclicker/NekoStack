/**
 * `ParseError` — thrown by `parse(schema, input)` when validation
 * fails. Carries the full normalized `Issue` list so handlers can
 * `catch (e) { if (e instanceof ParseError) ... }` and inspect every
 * issue without re-running the parse.
 *
 * `safeParse` and `validate` do NOT throw this — they return a
 * `Result<...>`. The throw exists for the parse path because that's
 * the friction-causing default: code that doesn't explicitly want to
 * handle issues should get loud failure, not silent `undefined`.
 *
 * The `code` field is stable for switching (`"parse_failed"`); tests
 * assert on `code` / `name` / `issues` / `instanceof`, never on the
 * human-readable `message`.
 *
 * Internal-only at this step. The `parse` entry point lands in step 6;
 * the public `src/index.ts` re-export of `ParseError` lands in step 13.
 */

import type { Issue } from "../errors/issue.js";

export class ParseError extends Error {
  readonly code = "parse_failed" as const;
  readonly issues: readonly Issue[];

  constructor(issues: readonly Issue[], message?: string) {
    super(message ?? defaultMessage(issues));
    this.name = "ParseError";
    // Defensive copy — callers may mutate the array they passed in
    // (rare, but a `safeParse` implementation that batches issues in
    // a working array would otherwise leak that mutability into the
    // thrown error). Storing a frozen copy keeps the contract crisp.
    this.issues = Object.freeze(issues.slice());
  }
}

function defaultMessage(issues: readonly Issue[]): string {
  // Stable enough for humans without being something tests assert on.
  // The leading count gives a quick signal in logs; the first path /
  // code pair points the reader at the most relevant issue.
  const head = issues[0];
  if (head === undefined) return "Parse failed (no issues)";
  const where = head.path.length > 0 ? head.path.join(".") : "<root>";
  const extra = issues.length > 1 ? ` (+${issues.length - 1} more)` : "";
  return `Parse failed: ${head.code} at ${where}${extra}`;
}
