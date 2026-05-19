/**
 * `listHandler({ registry })` — enumerate every `RegistryEntry` in a
 * `Registry`, in a stable order, as a `Result<{ entries }>`.
 *
 * The simplest of the four v0.7 handlers; landing this commit first
 * pins the handler shape and the `Result<T>` discriminated-union
 * contract before `diff` / `check` / `generate` add per-handler
 * complexity (Master plan sequencing step 8).
 *
 * **Pure.** No filesystem, no `import()`, no `process.*`, no
 * `console.*`. Takes an already-built `Registry` (Step 6's
 * `buildRegistry` output) and returns a `Result` over a flat array.
 * Master plan Decision #1 boundary.
 *
 * Ordering (deterministic; documented in tests):
 *
 * 1. **Across `schemaId`**: alphabetical ascending.
 * 2. **Within one `schemaId`**: versioned entries first, ascending
 *    by numeric major.minor.patch semver (so `1.0.0` < `2.0.0` <
 *    `10.0.0`, never lexicographic `10.0.0` < `2.0.0`). Unversioned
 *    entries (the empty-string inner key from Step 6) come **last**.
 *
 * Rationale for "unversioned last":
 * - Putting unversioned first would sort empty-string `""` before
 *   any semver — visually surprising in CLI output.
 * - Unversioned schemas are the v0.7 fallback for `.id()`-without-
 *   `.version()`. Most workspaces won't have any. Sorting them at
 *   the tail makes them visually distinct from the canonical
 *   versioned list.
 *
 * Empty registry: returns `{ success: true, data: { entries: [] } }`.
 * Never returns failure — list is read-only, has no failure mode.
 */

import type {
  ListOpts,
  ListResult,
  RegistryEntry,
} from "../types.js";

export function listHandler(opts: ListOpts): ListResult {
  const entries: RegistryEntry[] = [];
  const schemaIds = [...opts.registry.keys()].sort();
  for (const schemaId of schemaIds) {
    const inner = opts.registry.get(schemaId);
    if (inner === undefined) continue; // unreachable given iteration source

    const versionKeys: string[] = [];
    let hasUnversioned = false;
    for (const key of inner.keys()) {
      if (key === "") hasUnversioned = true;
      else versionKeys.push(key);
    }
    versionKeys.sort(compareSemver);

    for (const v of versionKeys) {
      const entry = inner.get(v);
      if (entry !== undefined) entries.push(entry);
    }
    if (hasUnversioned) {
      const entry = inner.get("");
      if (entry !== undefined) entries.push(entry);
    }
  }
  return { success: true, data: { entries } };
}

/**
 * Numeric semver compare on `major.minor.patch`. Falls back to
 * `localeCompare` for non-matching inputs so non-standard version
 * strings (e.g., `"1.0.0-rc.1"`) sort deterministically without
 * throwing. Duplicates `build-registry.ts`'s private helper; the
 * two consumers are small enough that DRY-vs-coupling is a wash
 * for v0.7. If a third consumer emerges, factor into a registry-
 * internal `semver.ts`.
 */
function compareSemver(a: string, b: string): number {
  const ax = a.match(/(\d+)\.(\d+)\.(\d+)/);
  const bx = b.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!ax || !bx) return a.localeCompare(b);
  for (let i = 1; i <= 3; i++) {
    const d = Number(ax[i]) - Number(bx[i]);
    if (d !== 0) return d;
  }
  return a.localeCompare(b);
}
