/**
 * `buildRegistry(entries)` — pure registry construction (Master plan
 * Step 6).
 *
 * Walks the CLI-supplied `RegistrySourceEntry[]` (one per loaded
 * `*.schema.{ts,js}` file) and builds the two-level lookup map
 * `Registry = ReadonlyMap<schemaId, ReadonlyMap<versionKey,
 * RegistryEntry>>`. Returns `Result<Registry>` so duplicate detection
 * surfaces as `Issue[]` rather than `throw` (Master plan Decision #4).
 *
 * **Pure.** No `fs.*`, no `import()`, no `path.*`. The CLI is
 * responsible for reading the source text and dynamic-importing the
 * schema files; this function takes the loaded data and indexes it.
 * Master plan Decision #1 boundary.
 *
 * Rules:
 * - Anonymous schemas (no `.id()`) are silently ignored. They remain
 *   legal per v0.1; they just don't participate in registry lookup.
 *   The CLI emits a stderr warning per anonymous schema it finds
 *   (Master plan Decision #5), but that's an I/O concern owned by
 *   the CLI, not by this function.
 * - Unversioned schemas (`.id()` but no `.version()`) are indexed
 *   under the empty-string inner key. The on-entry
 *   `schemaVersion` field stays `undefined` per the Step 1 type.
 * - Duplicate `(schemaId, versionKey)` pairs across the entry list
 *   are collected into one `Issue` per dupe with code
 *   `"duplicate_schema_id"`. The function does not throw; the CLI
 *   formats the issue list and exits non-zero.
 *
 * `sourceHash` is computed once per `RegistrySourceEntry` via
 * `sourceHashFromText(entry.sourceText)`. All `RegistryEntry`s
 * produced from the same source file therefore share the same
 * `sourceHash` value — correct because they share the same source
 * text.
 *
 * `findSchema(registry, schemaId, version?)` is the lookup helper.
 * When `version` is omitted, returns the highest-semver entry for
 * the given id. If only unversioned entries exist for that id, the
 * unversioned entry is returned. See the function comment for the
 * full lookup rules.
 */

import { irHash } from "../ir/hash.js";
import type { Issue, Result } from "../errors/issue.js";
import { sourceHashFromText } from "./source-hash.js";
import type {
  Registry,
  RegistryEntry,
  RegistrySourceEntry,
} from "./types.js";

// =============================================================================
// buildRegistry
// =============================================================================

export function buildRegistry(
  entries: readonly RegistrySourceEntry[],
): Result<Registry> {
  const out = new Map<string, Map<string, RegistryEntry>>();
  const duplicates: Issue[] = [];

  for (const entry of entries) {
    const entrySourceHash = sourceHashFromText(entry.sourceText);
    for (const schema of entry.schemas) {
      const schemaId = schema.node.metadata?.id;
      if (schemaId === undefined) {
        // Anonymous schemas don't participate in registry lookup.
        // The CLI warns; this layer is silent.
        continue;
      }
      const schemaVersion = schema.node.metadata?.version;
      const versionKey = schemaVersion ?? "";

      const built: RegistryEntry = {
        schemaId,
        schemaVersion,
        irHash: `sha256:${irHash(schema.node)}`,
        sourceHash: entrySourceHash,
        sourcePath: entry.sourcePath,
        schema,
      };

      let inner = out.get(schemaId);
      if (inner === undefined) {
        inner = new Map();
        out.set(schemaId, inner);
      }
      const existing = inner.get(versionKey);
      if (existing !== undefined) {
        duplicates.push(
          duplicateIssue(schemaId, schemaVersion, [
            existing.sourcePath,
            entry.sourcePath,
          ]),
        );
        // Keep the first-seen entry. Re-indexing would let the
        // duplicate replace the original silently, which is the
        // exact failure mode this Result is meant to surface.
        continue;
      }
      inner.set(versionKey, built);
    }
  }

  if (duplicates.length > 0) {
    return { success: false, issues: duplicates };
  }
  return { success: true, data: out as Registry };
}

function duplicateIssue(
  schemaId: string,
  schemaVersion: string | undefined,
  sourcePaths: readonly string[],
): Issue {
  const versionLabel =
    schemaVersion === undefined ? "(unversioned)" : `v${schemaVersion}`;
  return {
    code: "duplicate_schema_id",
    path: [],
    message: `Duplicate schema "${schemaId}" ${versionLabel} found in: ${sourcePaths.join(
      ", ",
    )}`,
    severity: "error",
    metadata: {
      schemaId,
      schemaVersion: schemaVersion ?? null,
      sourcePaths: [...sourcePaths],
    },
  };
}

// =============================================================================
// findSchema
// =============================================================================

/**
 * Look up a schema by `(schemaId, schemaVersion)`.
 *
 * Rules:
 * - When `version` is provided: exact match against the inner key.
 *   - `findSchema(reg, "X", "1.0.0")` returns the entry whose
 *     `schemaVersion` is `"1.0.0"`, or `undefined`.
 *   - `findSchema(reg, "X", "")` returns the unversioned entry if
 *     one exists (the empty-string key); this is the intentional
 *     way to address an unversioned schema by exact lookup.
 * - When `version` is omitted: returns the highest-semver entry
 *   for `schemaId`. If only unversioned entries exist, returns the
 *   unversioned entry. If both versioned and unversioned entries
 *   exist for the same id, **versioned wins** — `findSchema` returns
 *   the highest semver, never the unversioned entry, when at least
 *   one versioned entry exists.
 * - Returns `undefined` if `schemaId` is not in the registry, or
 *   if the explicit `version` does not match any inner key.
 */
export function findSchema(
  registry: Registry,
  schemaId: string,
  version?: string,
): RegistryEntry | undefined {
  const inner = registry.get(schemaId);
  if (inner === undefined) return undefined;

  if (version !== undefined) {
    return inner.get(version);
  }

  // No version supplied — pick the highest-semver entry.
  const versionedKeys: string[] = [];
  let unversioned: RegistryEntry | undefined;
  for (const [key, entry] of inner) {
    if (key === "") {
      unversioned = entry;
    } else {
      versionedKeys.push(key);
    }
  }
  if (versionedKeys.length > 0) {
    versionedKeys.sort(compareSemver);
    return inner.get(versionedKeys[versionedKeys.length - 1]!);
  }
  return unversioned;
}

/**
 * Compare two semver-shaped strings numerically by major.minor.patch.
 * Falls back to `localeCompare` for non-matching inputs so we never
 * throw on a non-standard version string — that would defeat the
 * fail-loud-not-throw discipline. Matches the shape used by
 * `scripts/generate-status.mjs`.
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
