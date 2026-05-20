/**
 * `planMigrationHandler(opts)` — handler wrapper around the
 * diff-aware planner (v0.8 Step 8).
 *
 * Forwards directly to `planMigration` from `../plan-migration.js`.
 * The wrapper exists so the four-handler surface
 * (`list / plan / verify / stub`) reads uniformly to the CLI — and
 * so future cross-cutting concerns (telemetry tagging, opts
 * defaulting, etc.) have a single seam — but in v0.8 it is a thin
 * pass-through.
 *
 * **Pure.** No filesystem, no `import()`, no `process.*`, no
 * `console.*`. **Never invokes `migration.transform`** —
 * verification of the no-execute boundary lives in the planner
 * implementation; the wrapper inherits it.
 *
 * **Throws** propagate. If `planMigration` raises
 * `UnsupportedNodeKindError` (because `diffNodes` hit a `date` /
 * `union` / `recursiveRef` / `transform` IR kind), this handler
 * does NOT catch — the CLI dispatcher (Step 21) maps the throw to
 * a non-zero exit code at the CLI boundary, matching the v0.6 /
 * v0.7 fail-loud discipline.
 */

import { planMigration } from "../plan-migration.js";
import type {
  MigrationPlanOpts,
  MigrationPlanResult,
} from "../types.js";

export function planMigrationHandler(
  opts: MigrationPlanOpts,
): MigrationPlanResult {
  return planMigration(opts);
}
