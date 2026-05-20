/**
 * `@nekostack/migrate-runner` — public package entry.
 *
 * This package is the downstream orchestrator that **invokes** authored
 * migrations' `transform(input)` functions against real data. It sits
 * **outside** `@nekostack/schema` and `@nekostack/cli`; both of those
 * packages remain pure per their v0.7 / v0.8 contracts. The v0.9 plan
 * ([`packages/schema/docs/PHASE_PLAN_v0.9.md`](../../schema/docs/PHASE_PLAN_v0.9.md))
 * is the load-bearing design doc.
 *
 * ## Public surface (current)
 *
 *   - **`PACKAGE_NAME`** (Step 1) — runtime package-identity constant.
 *   - **`preFlight`** (Step 3) — pure pre-flight chain resolver + chain-
 *     scoped provenance verifier. Returns a `PreFlightResult` and never
 *     invokes a migration's `transform`. See [`./pre-flight.ts`](./pre-flight.ts)
 *     for the contract.
 *   - **Type-only re-exports** from [`./types.ts`](./types.ts) covering
 *     the locked v0.9 contract (`RunnerOptions`, `RunOpts`, `RunMode`,
 *     `RunResult` / `RunSuccess` / `RunFailure`, `ErrorClassification`,
 *     `AuditEntry`, the three adapter interfaces, `ResumeCursor`, and
 *     the four `PreFlight*` shapes).
 *
 * ## Still ahead (sequenced behind audit gates)
 *
 *   - Step 4 — per-record pipeline (`./per-record-pipeline.ts`): the
 *     **only** file in the package allowed to call
 *     `migration.transform(...)`. The static-scan boundary widens to
 *     allow `.transform(` there and stays banned everywhere else.
 *   - Step 5 — audit (`./audit.ts`).
 *   - Step 6 — orchestrator (`./runner.ts`) exporting
 *     `createMigrationRunner(...)`.
 *   - Step 7 — JSON-file reference adapters.
 *
 * ## What this file MUST NOT do (now or ever)
 *
 *   - It MUST NOT call `migration.transform(input)`. The per-record
 *     pipeline (Step 4) is the sole `transform` site. Touching it from
 *     the package entry would invert the v0.9 plan's locked sequencing.
 *   - It MUST NOT import from `@nekostack/cli`. The runner is a peer
 *     to the CLI, not a dependency on it.
 *   - It MUST NOT widen `@nekostack/schema`'s `Migration` type or
 *     touch the schema package in any way.
 *
 * For the full plan + locked decisions, see
 * [`PHASE_PLAN_v0.9.md`](../../schema/docs/PHASE_PLAN_v0.9.md).
 */

/**
 * Package identity. Exported so workspace consumers (and the
 * package's own tests) can detect the runner is loaded. Bumped
 * alongside the future `migrate-runner-vX.Y.Z` git tag line.
 */
export const PACKAGE_NAME = "@nekostack/migrate-runner" as const;

// =============================================================================
// Step 2 — core type surface (see `./types.ts` for the locked contract)
// =============================================================================
//
// Type-only re-exports. The runtime exports (`preFlight`,
// future-step `createMigrationRunner`, etc.) live in their own
// sections below.

export type {
  AuditAdapter,
  AuditEntry,
  DiffSeverity,
  ErrorClassification,
  InputAdapter,
  MigrationEntry,
  MigrationRegistry,
  OutputAdapter,
  PlanNote,
  PreFlightFailure,
  PreFlightOpts,
  PreFlightResult,
  PreFlightSuccess,
  Registry,
  ResumeCursor,
  RunFailure,
  RunMode,
  RunOpts,
  RunResult,
  RunSuccess,
  RunnerOptions,
} from "./types.js";

// =============================================================================
// Step 3 — pre-flight (chain-scoped plan + verify)
// =============================================================================

export { preFlight } from "./pre-flight.js";
