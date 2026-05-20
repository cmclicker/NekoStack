/**
 * `@nekostack/migrate-runner` — scaffold entry (Step 1).
 *
 * This package is the downstream orchestrator that **invokes** authored
 * migrations' `transform(input)` functions against real data. It sits
 * **outside** `@nekostack/schema` and `@nekostack/cli`; both of those
 * packages remain pure per their v0.7 / v0.8 contracts. The v0.9 plan
 * ([`packages/schema/docs/PHASE_PLAN_v0.9.md`](../../schema/docs/PHASE_PLAN_v0.9.md))
 * is the load-bearing design doc.
 *
 * **Scaffold step — no runtime surface yet.** This module exists so:
 *
 *   1. The workspace can resolve `@nekostack/migrate-runner` and load
 *      this package alongside `@nekostack/schema` + `@nekostack/cli`.
 *   2. Subsequent steps (core types, pre-flight, per-record pipeline,
 *      adapters, runner orchestrator, audit) have a place to land.
 *   3. `tsc --noEmit` and `vitest run` both succeed on the empty
 *      package, proving the build / test wiring is in place before
 *      any real code is written.
 *
 * **What this file MUST NOT do (now or ever):**
 *
 *   - It MUST NOT call `migration.transform(input)`. That is the
 *     runner's job once the orchestrator lands in a later step. Step 1
 *     ships zero behavior; calling `transform` here would violate the
 *     v0.9 plan's locked sequencing.
 *   - It MUST NOT import from `@nekostack/cli`. The runner is a peer
 *     to the CLI, not a dependency on it.
 *   - It MUST NOT widen `@nekostack/schema`'s `Migration` type or
 *     touch the schema package in any way.
 *
 * For the full plan + locked decisions, see
 * [`PHASE_PLAN_v0.9.md`](../../schema/docs/PHASE_PLAN_v0.9.md).
 */

/**
 * Package identity. Exported so workspace consumers (currently: only
 * this package's own tests) can detect the scaffold is loaded.
 * Bumped alongside the future `migrate-runner-vX.Y.Z` git tag line.
 */
export const PACKAGE_NAME = "@nekostack/migrate-runner" as const;
