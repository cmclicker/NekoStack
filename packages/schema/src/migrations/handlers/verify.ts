/**
 * `verifyMigrationsHandler(opts)` — handler wrapper around the
 * provenance verifier (v0.8 Step 9).
 *
 * Forwards directly to `verifyMigrationProvenance` from
 * `../verify-provenance.js`. Same role as
 * `planMigrationHandler` — a uniform four-handler surface for the
 * CLI plus a future seam for cross-cutting concerns. In v0.8 it is
 * a thin pass-through.
 *
 * **Pure.** No filesystem, no `import()`, no `process.*`, no
 * `console.*`. **Never invokes `migration.transform`** —
 * verification is a `provenance-says-what-it-says` check, not a
 * behavior check. Transform execution is deferred to v0.9+.
 *
 * The verifier never throws (provenance verification is
 * structural; mismatches surface as `drift` /
 * `missing_endpoint` verdicts on the failure branch). Even so the
 * wrapper does not catch — any future throw from upstream code
 * propagates to the CLI dispatcher (Step 22) and the locked
 * fail-loud discipline.
 */

import { verifyMigrationProvenance } from "../verify-provenance.js";
import type {
  MigrationVerifyOpts,
  MigrationVerifyResult,
} from "../types.js";

export function verifyMigrationsHandler(
  opts: MigrationVerifyOpts,
): MigrationVerifyResult {
  return verifyMigrationProvenance(opts);
}
