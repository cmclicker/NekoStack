/**
 * `planMigration(opts)` — diff-aware migration planner (v0.8 Step 4).
 *
 * The v0.8 Round-3 lock: this primitive consumes BOTH the schema
 * registry AND the migration registry. Without the schema registry
 * it can't compute the diff that determines whether a missing
 * migration is acceptable; without the migration registry it can't
 * resolve a chain when one is required. The signature mirrors what
 * the audit pinned in `PHASE_PLAN_v0.8.md`.
 *
 * Locked behavior (Round-3 contract — restated here so the
 * implementation is easy to compare against the plan doc):
 *
 *   1. Resolve endpoints in `schemaRegistry`. If either is absent
 *      → `Result.failure` with `migration_missing_endpoint`. No
 *      diff is computed in this case.
 *   2. Compute `diffNodes(from.schema.node, to.schema.node)`.
 *      `worstSeverity` is the max-severity over the change list
 *      (precedence `breaking > additive > cosmetic`; `null` when
 *      empty), exactly as `diffHandler` aggregates it in v0.7.
 *   3. Look up the exact migration for `(schemaId, fromVersion,
 *      toVersion)` if any.
 *   4. Dispatch on `worstSeverity`:
 *      - `null` / `"cosmetic"` → success with empty chain. If an
 *        exact migration exists for the pair, attach an
 *        `over_specified` `PlanNote`. The migration is NOT included
 *        in the chain — at this severity the diff says no
 *        transformation is needed.
 *      - `"additive"` → if an exact migration exists, include it
 *        in the chain. If not, success with empty chain plus an
 *        `additive_no_migration` note.
 *      - `"breaking"` → chain is **required**. Run DFS chain
 *        resolution over the schemaId's `from → to` adjacency map.
 *        0 chains: `migration_not_found` (no migrations for the
 *        schemaId at all) or `migration_chain_broken` (some exist
 *        but can't bridge). 1 chain: success. 2+ chains:
 *        `migration_ambiguous_chain`.
 *
 * **Pure.** No `fs.*`, no `import()`, no `process.*`, no
 * `console.*`. **Never invokes `migration.transform`** — chain
 * resolution is structural; transform execution is v0.9+.
 *
 * `MigrationPlan.versionPath` always reflects the actual hop
 * sequence: `[fromVersion, toVersion]` for empty chains;
 * `[fromVersion, ...intermediateVersions, toVersion]` for non-empty
 * chains derived from the chain entries.
 */

import { findSchema } from "../registry/build-registry.js";
import { diffNodes } from "../registry/diff.js";
import type {
  DiffChange,
  DiffSeverity,
  Registry,
} from "../registry/types.js";
import type { Issue, Result } from "../errors/issue.js";
import type {
  MigrationEntry,
  MigrationPlan,
  MigrationPlanOpts,
  MigrationPlanResult,
  MigrationRegistry,
  PlanNote,
} from "./types.js";

// =============================================================================
// Public entry
// =============================================================================

export function planMigration(opts: MigrationPlanOpts): MigrationPlanResult {
  // 1. Resolve endpoints in the schema registry.
  const fromEntry = findSchema(opts.schemaRegistry, opts.schemaId, opts.fromVersion);
  const toEntry = findSchema(opts.schemaRegistry, opts.schemaId, opts.toVersion);

  if (fromEntry === undefined || toEntry === undefined) {
    return failure(
      missingEndpointIssue(
        opts.schemaId,
        opts.fromVersion,
        opts.toVersion,
        fromEntry === undefined,
        toEntry === undefined,
      ),
    );
  }

  // 2. Compute the endpoint-to-endpoint diff and worst severity.
  const changes = diffNodes(fromEntry.schema.node, toEntry.schema.node);
  const worstSeverity = computeWorstSeverity(changes);

  // 3. Look up the exact-pair migration (if any) for the
  //    over_specified / additive-with-migration branches.
  const exact = findExactMigration(
    opts.migrationRegistry,
    opts.schemaId,
    opts.fromVersion,
    opts.toVersion,
  );

  // 4. Dispatch on severity.
  if (worstSeverity === null || worstSeverity === "cosmetic") {
    const notes: PlanNote[] =
      exact !== undefined ? [{ kind: "over_specified", migration: exact }] : [];
    return success({
      schemaId: opts.schemaId,
      chain: [],
      versionPath: [opts.fromVersion, opts.toVersion],
      worstSeverity,
      notes,
    });
  }

  if (worstSeverity === "additive") {
    if (exact !== undefined) {
      return success({
        schemaId: opts.schemaId,
        chain: [exact],
        versionPath: [opts.fromVersion, opts.toVersion],
        worstSeverity,
        notes: [],
      });
    }
    return success({
      schemaId: opts.schemaId,
      chain: [],
      versionPath: [opts.fromVersion, opts.toVersion],
      worstSeverity,
      notes: [{ kind: "additive_no_migration", worstSeverity }],
    });
  }

  // worstSeverity === "breaking" — chain is required.
  const adjacency = opts.migrationRegistry.get(opts.schemaId);
  const noMigrationsForSchema =
    adjacency === undefined || adjacency.size === 0;
  if (noMigrationsForSchema) {
    return failure(
      notFoundIssue(opts.schemaId, opts.fromVersion, opts.toVersion),
    );
  }

  const chains = enumerateChains(adjacency, opts.fromVersion, opts.toVersion);
  if (chains.length === 0) {
    return failure(
      chainBrokenIssue(opts.schemaId, opts.fromVersion, opts.toVersion),
    );
  }
  if (chains.length > 1) {
    return failure(
      ambiguousChainIssue(
        opts.schemaId,
        opts.fromVersion,
        opts.toVersion,
        chains,
      ),
    );
  }

  const chain = chains[0]!;
  return success({
    schemaId: opts.schemaId,
    chain,
    versionPath: versionPathFromChain(opts.fromVersion, chain),
    worstSeverity,
    notes: [],
  });
}

// =============================================================================
// Helpers — registry lookups
// =============================================================================

function findExactMigration(
  registry: MigrationRegistry,
  schemaId: string,
  fromVersion: string,
  toVersion: string,
): MigrationEntry | undefined {
  return registry.get(schemaId)?.get(fromVersion)?.get(toVersion);
}

// =============================================================================
// Helpers — worstSeverity (same precedence as v0.7 diffHandler)
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

// =============================================================================
// Helpers — chain resolution (DFS, simple-paths only)
// =============================================================================

type Adjacency = ReadonlyMap<string, ReadonlyMap<string, MigrationEntry>>;

/**
 * Enumerate every simple path of migration entries from `start` to
 * `end` over the schemaId's adjacency map. "Simple" = no version
 * is visited twice within a single chain (no cycles).
 *
 * v0.8 doesn't cap the number of enumerated chains — but it stops
 * walking each path at the first revisit of any version it already
 * entered on that path. The graph is the consumer's authored
 * migrations, so practical depth is small.
 */
function enumerateChains(
  adjacency: Adjacency,
  start: string,
  end: string,
): MigrationEntry[][] {
  if (start === end) return [];
  const out: MigrationEntry[][] = [];
  const visited = new Set<string>([start]);
  const chain: MigrationEntry[] = [];
  dfs(adjacency, start, end, visited, chain, out);
  return out;
}

function dfs(
  adjacency: Adjacency,
  current: string,
  end: string,
  visited: Set<string>,
  chain: MigrationEntry[],
  out: MigrationEntry[][],
): void {
  const outgoing = adjacency.get(current);
  if (outgoing === undefined) return;
  for (const [toVer, entry] of outgoing) {
    if (visited.has(toVer)) continue;
    chain.push(entry);
    if (toVer === end) {
      out.push([...chain]);
    } else {
      visited.add(toVer);
      dfs(adjacency, toVer, end, visited, chain, out);
      visited.delete(toVer);
    }
    chain.pop();
  }
}

function versionPathFromChain(
  fromVersion: string,
  chain: readonly MigrationEntry[],
): readonly string[] {
  if (chain.length === 0) return [fromVersion, fromVersion];
  const path: string[] = [fromVersion];
  for (const entry of chain) path.push(entry.toVersion);
  return path;
}

// =============================================================================
// Result + Issue helpers
// =============================================================================

function success(data: MigrationPlan): MigrationPlanResult {
  return { success: true, data };
}

function failure(issue: Issue): MigrationPlanResult {
  return { success: false, issues: [issue] };
}

function missingEndpointIssue(
  schemaId: string,
  fromVersion: string,
  toVersion: string,
  fromMissing: boolean,
  toMissing: boolean,
): Issue {
  const missing: string[] = [];
  if (fromMissing) missing.push(`from=${fromVersion}`);
  if (toMissing) missing.push(`to=${toVersion}`);
  return {
    code: "migration_missing_endpoint",
    path: [],
    message:
      `Cannot plan migration for \`${schemaId}\`: ` +
      `${missing.join(", ")} not in the schema registry.`,
    severity: "error",
    metadata: {
      schemaId,
      fromVersion,
      toVersion,
      missing: missing.map((s) => s.split("=")[0]!),
    },
  };
}

function notFoundIssue(
  schemaId: string,
  fromVersion: string,
  toVersion: string,
): Issue {
  return {
    code: "migration_not_found",
    path: [],
    message:
      `Breaking transition for \`${schemaId}\` requires a migration; ` +
      `no migrations are registered for this schemaId.`,
    severity: "error",
    metadata: { schemaId, fromVersion, toVersion },
  };
}

function chainBrokenIssue(
  schemaId: string,
  fromVersion: string,
  toVersion: string,
): Issue {
  return {
    code: "migration_chain_broken",
    path: [],
    message:
      `Migrations exist for \`${schemaId}\` but no chain bridges ` +
      `${fromVersion} → ${toVersion}.`,
    severity: "error",
    metadata: { schemaId, fromVersion, toVersion },
  };
}

function ambiguousChainIssue(
  schemaId: string,
  fromVersion: string,
  toVersion: string,
  chains: readonly (readonly MigrationEntry[])[],
): Issue {
  return {
    code: "migration_ambiguous_chain",
    path: [],
    message:
      `Multiple distinct migration chains bridge \`${schemaId}\` ` +
      `${fromVersion} → ${toVersion}; the planner refuses to pick. ` +
      `Remove one or constrain the registry.`,
    severity: "error",
    metadata: {
      schemaId,
      fromVersion,
      toVersion,
      chainCount: chains.length,
      chainSummaries: chains.map((chain) =>
        chain
          .map((entry) => `${entry.fromVersion}→${entry.toVersion}`)
          .join(", "),
      ),
    },
  };
}
