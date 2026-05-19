/**
 * `diffHandler({ before, after })` — wraps Step 7's `diffNodes` and
 * adds the `worstSeverity` aggregation that Master plan Decision #13
 * relies on for CLI exit-code mapping.
 *
 * Pure. No filesystem, no `import()`, no `process.*`, no `console.*`.
 * Master plan Decision #1 boundary.
 *
 * **Severity precedence**: `breaking` > `additive` > `cosmetic`. The
 * `worstSeverity` field is `null` exactly when `changes.length === 0`.
 * Per Decision #13: a `schemaVersion`-only change paired with
 * structural changes inherits the worst structural severity — that
 * rule is realized naturally here because every change keeps its own
 * severity (set by `diffNodes`); `worstSeverity` is the max over the
 * full list.
 *
 * **`UnsupportedNodeKindError` propagates.** When `diffNodes` throws
 * for an unsupported IR kind (`date`, `union`, `recursiveRef`,
 * `transform`), this handler does NOT catch — it lets the throw
 * propagate to the CLI dispatcher (Step 28+), where it maps to a
 * non-zero exit code at the CLI boundary. This matches Master plan
 * Decision #14's "throw at the boundary" language and the v0.6
 * convention (`runtime/parse.ts` also propagates rather than
 * normalizing into `Result`). Treating an unsupported IR kind as an
 * `integrity_error` (the closest existing v0.7 code) would be
 * semantically wrong — the IR is well-formed; v0.7 just doesn't
 * know how to diff it. Inventing a new code (`schema_diff_failed`)
 * without it being in the locked plan would expand the v0.7 vocabulary
 * casually.
 */

import { diffNodes } from "../diff.js";
import type {
  DiffChange,
  DiffOpts,
  DiffResult,
  DiffSeverity,
} from "../types.js";

export function diffHandler(opts: DiffOpts): DiffResult {
  const changes = diffNodes(opts.before, opts.after);
  return {
    success: true,
    data: {
      changes,
      worstSeverity: computeWorstSeverity(changes),
    },
  };
}

// =============================================================================
// worstSeverity aggregation (Master plan Decision #13)
// =============================================================================

const SEVERITY_RANK: Record<DiffSeverity, number> = {
  cosmetic: 0,
  additive: 1,
  breaking: 2,
};

function computeWorstSeverity(
  changes: readonly DiffChange[],
): DiffSeverity | null {
  if (changes.length === 0) return null;
  let worst: DiffSeverity = "cosmetic";
  for (const c of changes) {
    if (SEVERITY_RANK[c.severity] > SEVERITY_RANK[worst]) {
      worst = c.severity;
    }
  }
  return worst;
}
