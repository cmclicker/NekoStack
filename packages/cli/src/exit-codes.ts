/**
 * CLI exit-code contract (v0.7 Step 26).
 *
 * The locked five-value enum from CLI plan Decision #6. Imported by
 * `dispatch()` in `cli.ts` and by each schema-verb command module
 * (Steps 29–32) so every code path uses the same vocabulary instead
 * of inlining magic numbers.
 *
 * Semantics:
 *
 *   0  SUCCESS           — command completed without issue.
 *   1  LOGICAL_FAILURE   — load-bearing CI signal. Verdict-level
 *                          problems found by the verb itself: stale
 *                          generated artifacts (`check`), a breaking
 *                          diff (`diff`), a missing schema referenced
 *                          on the argv (`diff` / `check`), etc.
 *                          CI should fail on this.
 *   2  USAGE_ERROR       — argv shape is wrong: unknown command,
 *                          missing argument, unknown option, bad
 *                          flag value.
 *   3  IO_ERROR          — workspace not readable, schema source
 *                          file failed to load (any of the four
 *                          `schema_load_failed` reasons), committed
 *                          artifact unreadable.
 *   4  INTEGRITY_ERROR   — the "impossible" two-hash row from
 *                          Master plan Decision #6: the artifact's
 *                          recorded `sourceHash` matches the schema
 *                          source but the `irHash` differs. Suggests
 *                          hand-edited artifact or tampered
 *                          provenance. The CLI does NOT auto-
 *                          regenerate when this fires.
 *
 * Anything ≥ 2 is a problem with the invocation or the workspace,
 * not with the schemas under inspection. Tooling layered on top of
 * `neko schema *` (e.g., CI helpers, future `@nekostack/migrate`)
 * should treat 1 as "the schemas need attention" and ≥ 2 as
 * "something else is wrong before we can even check the schemas."
 */

export const EXIT_CODES = {
  SUCCESS: 0,
  LOGICAL_FAILURE: 1,
  USAGE_ERROR: 2,
  IO_ERROR: 3,
  INTEGRITY_ERROR: 4,
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];
