/**
 * `stubMigrationHandler(opts)` — handler wrapper around the
 * stub-content generator (v0.8 Step 10).
 *
 * Forwards directly to `stubMigration` from `../stub.js`. Same role
 * as `planMigrationHandler` and `verifyMigrationsHandler` — a
 * uniform four-handler surface for the CLI plus a future seam for
 * cross-cutting concerns. In v0.8 it is a thin pass-through.
 *
 * **Pure.** No filesystem, no `import()`, no `process.*`, no
 * `console.*`. The stub is *generated*, not *written* — file I/O
 * is the CLI's responsibility (Step 23 will `mkdir -p` +
 * `writeFile` against the returned `suggestedPath`, refusing to
 * overwrite an existing file at that path).
 *
 * **Never invokes `migration.transform`** — the stub generator
 * emits a transform-body skeleton in the file content string but
 * does not execute anything.
 */

import { stubMigration } from "../stub.js";
import type {
  MigrationStubOpts,
  MigrationStubResult,
} from "../types.js";

export function stubMigrationHandler(
  opts: MigrationStubOpts,
): MigrationStubResult {
  return stubMigration(opts);
}
