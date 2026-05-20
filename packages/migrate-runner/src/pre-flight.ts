/**
 * `preFlight(opts)` — pre-flight chain resolution + verification
 * (v0.9 Step 3).
 *
 * Implements Decisions #5 and #15 of the v0.9 plan
 * ([`PHASE_PLAN_v0.9.md`](../../schema/docs/PHASE_PLAN_v0.9.md)):
 *
 *   1. Call `planMigrationHandler` over the **workspace** schema +
 *      migration registries to resolve the chain (or detect that no
 *      chain is required).
 *   2. If the planner refuses (`migration_missing_endpoint` /
 *      `migration_not_found` / `migration_chain_broken` /
 *      `migration_ambiguous_chain`), return a `PreFlightFailure`
 *      with `classification: "pre_flight_failed"` and the planner's
 *      issues preserved verbatim.
 *   3. If the planner returns an empty chain (`worstSeverity` is
 *      `null` / `cosmetic`, or additive without a registered
 *      migration), return success immediately. The runner will be a
 *      no-op for the record-walk. The planner's notes
 *      (`over_specified` / `additive_no_migration`) are passed
 *      through so the orchestrator can surface them.
 *   4. If the planner returns a non-empty chain, build a
 *      **chain-scoped** `MigrationRegistry` containing only the
 *      chain entries and call `verifyMigrationsHandler` against THAT
 *      registry — never the workspace registry. (Decision #15: "The
 *      runner never verifies the whole workspace migration registry
 *      and filters afterward.") Verifying chain-scoped is the safety
 *      property that makes it correct to refuse on any non-`bound`
 *      verdict.
 *   5. The schema-side verifier already returns `Result.failure` on
 *      `drift` / `missing_endpoint`. `cosmetic_drift` is on the
 *      verifier's success branch but is warning-class — pre-flight
 *      treats it as a failure UNLESS `opts.allowCosmeticDrift ===
 *      true` (default `false`, OQ-5).
 *
 * **Pure.** No `fs.*`, no dynamic `import()`, no `process.*`, no
 * `console.*`. **Never invokes `migration.transform`.** The function
 * does not have a code path that touches the `migration` field's
 * `transform` member at all — the per-record pipeline (Step 4) is
 * the only place in the entire runner package that does. Static-scan
 * gate in [`../tests/pre-flight.test.ts`](../tests/pre-flight.test.ts)
 * enforces this.
 */

import {
  planMigrationHandler,
  verifyMigrationsHandler,
} from "@nekostack/schema/cli";
import type {
  MigrationEntry,
  MigrationRegistry,
  MigrationVerdict,
} from "@nekostack/schema/cli";
import type { Issue } from "@nekostack/schema";
import type { PreFlightOpts, PreFlightResult } from "./types.js";

// =============================================================================
// Public entry
// =============================================================================

export function preFlight(opts: PreFlightOpts): PreFlightResult {
  // 1. Resolve the chain via the workspace registries.
  const plan = planMigrationHandler({
    schemaRegistry: opts.schemaRegistry,
    migrationRegistry: opts.migrationRegistry,
    schemaId: opts.schemaId,
    fromVersion: opts.fromVersion,
    toVersion: opts.toVersion,
  });

  // 2. Planner refusal → preserve issues verbatim, return failure.
  if (!plan.success) {
    return failure(
      `Migration plan refused for \`${opts.schemaId}\` ${opts.fromVersion} → ${opts.toVersion}: ${firstMessage(plan.issues)}`,
      plan.issues,
    );
  }

  // 3. Empty chain (null / cosmetic / additive-without-migration /
  //    over-specified) → no verification needed. The chain-scoped
  //    registry is empty; the runner will be a record-walk no-op.
  if (plan.data.chain.length === 0) {
    return {
      success: true,
      schemaId: opts.schemaId,
      fromVersion: opts.fromVersion,
      toVersion: opts.toVersion,
      chain: [],
      versionPath: plan.data.versionPath,
      worstSeverity: plan.data.worstSeverity,
      notes: plan.data.notes,
      chainScopedRegistry: emptyMigrationRegistry(),
    };
  }

  // 4. Non-empty chain — build a chain-scoped MigrationRegistry
  //    containing ONLY the resolved chain entries. The verifier
  //    will see exactly this registry; unrelated authored
  //    migrations elsewhere in the workspace registry cannot
  //    influence the verdict. Locked by Decision #15.
  const chainScopedRegistry = buildChainScopedRegistry(plan.data.chain);

  // 5. Run the verifier against the chain-scoped registry. The
  //    workspace registry is NOT passed here — never verify the
  //    whole workspace and filter afterward.
  const verify = verifyMigrationsHandler({
    schemaRegistry: opts.schemaRegistry,
    migrationRegistry: chainScopedRegistry,
  });

  // 6. Verifier refusal (drift / missing_endpoint on the chain) →
  //    preserve issues verbatim, return failure.
  if (!verify.success) {
    return failure(
      `Migration provenance verification failed for chain \`${opts.schemaId}\` ${opts.fromVersion} → ${opts.toVersion}: ${firstMessage(verify.issues)}`,
      verify.issues,
    );
  }

  // 7. Verifier success branch — but `cosmetic_drift` is permitted
  //    in the schema-side verifier (warning-class). Pre-flight is
  //    stricter by default: refuse cosmetic_drift unless the caller
  //    explicitly opted in.
  if (!opts.allowCosmeticDrift && verify.data.summary.cosmetic_drift > 0) {
    const cosmeticIssues = synthesizeCosmeticDriftIssues(verify.data.verdicts);
    const n = cosmeticIssues.length;
    return failure(
      `Chain has ${n} cosmetic_drift entr${n === 1 ? "y" : "ies"}; pass \`allowCosmeticDrift: true\` to proceed.`,
      cosmeticIssues,
    );
  }

  // 8. Success — frozen chain handed to the orchestrator.
  return {
    success: true,
    schemaId: opts.schemaId,
    fromVersion: opts.fromVersion,
    toVersion: opts.toVersion,
    chain: plan.data.chain,
    versionPath: plan.data.versionPath,
    worstSeverity: plan.data.worstSeverity,
    notes: plan.data.notes,
    chainScopedRegistry,
  };
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Build a chain-scoped `MigrationRegistry` from the resolved chain.
 * The structure mirrors `buildMigrationRegistry` (three-level
 * `Map`), but we go directly from a flat `MigrationEntry[]` since
 * the entries are already parsed and we don't re-run provenance
 * parsing. Insertion order is preserved by `Map`, so iteration
 * order matches the chain's traversal order.
 */
function buildChainScopedRegistry(
  chain: readonly MigrationEntry[],
): MigrationRegistry {
  const out = new Map<
    string,
    Map<string, Map<string, MigrationEntry>>
  >();
  for (const entry of chain) {
    let byFrom = out.get(entry.schemaId);
    if (byFrom === undefined) {
      byFrom = new Map();
      out.set(entry.schemaId, byFrom);
    }
    let byTo = byFrom.get(entry.fromVersion);
    if (byTo === undefined) {
      byTo = new Map();
      byFrom.set(entry.fromVersion, byTo);
    }
    byTo.set(entry.toVersion, entry);
  }
  return out as MigrationRegistry;
}

/** Empty `MigrationRegistry` placeholder for the empty-chain case. */
function emptyMigrationRegistry(): MigrationRegistry {
  return new Map() as MigrationRegistry;
}

/**
 * The schema-side verifier puts `cosmetic_drift` on the success
 * branch (warning-class). Pre-flight wants strict-by-default
 * behavior, so we synthesize one `Issue` per `cosmetic_drift`
 * verdict here. Uses the existing `migration_cosmetic_drift` code
 * (no new code added in this step).
 */
function synthesizeCosmeticDriftIssues(
  verdicts: readonly MigrationVerdict[],
): Issue[] {
  const out: Issue[] = [];
  for (const v of verdicts) {
    if (v.status !== "cosmetic_drift") continue;
    out.push({
      code: "migration_cosmetic_drift",
      path: [v.sourcePath],
      message:
        `Migration \`${v.schemaId}\` ${v.fromVersion} → ${v.toVersion} ` +
        `has cosmetic source drift; pass \`allowCosmeticDrift: true\` to proceed.`,
      severity: "warning",
      metadata: {
        schemaId: v.schemaId,
        fromVersion: v.fromVersion,
        toVersion: v.toVersion,
        sourcePath: v.sourcePath,
      },
    });
  }
  return out;
}

function failure(message: string, issues: readonly Issue[]): PreFlightResult {
  return {
    success: false,
    classification: "pre_flight_failed",
    errorMessage: message,
    issues,
  };
}

function firstMessage(issues: readonly Issue[]): string {
  return issues[0]?.message ?? "no diagnostic message provided";
}
