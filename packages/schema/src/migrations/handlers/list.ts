/**
 * `listMigrationsHandler({ migrationRegistry })` — enumerate every
 * `MigrationEntry` in a `MigrationRegistry`, in a stable order, as a
 * `Result<{ entries }>` (v0.8 Step 7).
 *
 * The simplest of the four v0.8 handlers; landing this commit first
 * pins the handler shape and the `Result<T>` discriminated-union
 * contract before `plan` / `verify` / `stub` add per-handler
 * complexity (Master plan sequencing step 7). Mirrors v0.7's
 * `listHandler` shape exactly.
 *
 * **Pure.** No filesystem, no `import()`, no `process.*`, no
 * `console.*`. Takes an already-built `MigrationRegistry` (Step 3's
 * `buildMigrationRegistry` output) and returns a `Result` over a flat
 * array. Master plan Decision #1 boundary.
 *
 * Ordering (deterministic; documented in tests):
 *
 *   1. **Across `schemaId`** — alphabetical ascending.
 *   2. **Within one `schemaId`, by `fromVersion`** — alphabetical
 *      ascending.
 *   3. **Within one `(schemaId, fromVersion)`, by `toVersion`** —
 *      alphabetical ascending.
 *
 * The lexicographic compare matches `verify-provenance.ts` (Step 5).
 * That means the list-handler's `entries` come out in the same order
 * the verifier visits them for the same data — useful for consumers
 * that join the two outputs by index.
 *
 * Never returns failure: enumeration has no failure mode. Empty
 * registry → `{ success: true, data: { entries: [] } }`.
 */

import type {
  MigrationEntry,
  MigrationListOpts,
  MigrationListResult,
} from "../types.js";

export function listMigrationsHandler(
  opts: MigrationListOpts,
): MigrationListResult {
  const entries: MigrationEntry[] = [];
  const schemaIds = [...opts.migrationRegistry.keys()].sort();
  for (const schemaId of schemaIds) {
    const byFrom = opts.migrationRegistry.get(schemaId);
    if (byFrom === undefined) continue; // unreachable given iteration source
    const fromVersions = [...byFrom.keys()].sort();
    for (const fromVersion of fromVersions) {
      const byTo = byFrom.get(fromVersion);
      if (byTo === undefined) continue;
      const toVersions = [...byTo.keys()].sort();
      for (const toVersion of toVersions) {
        const entry = byTo.get(toVersion);
        if (entry !== undefined) entries.push(entry);
      }
    }
  }
  return { success: true, data: { entries } };
}
