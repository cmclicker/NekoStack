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
 *   - **`runRecordPipeline`** (Step 4) — per-record pipeline. The ONE
 *     file in the package allowed to call `migration.transform(...)`.
 *     Pure: data-in / data-out, no persistence, no audit writes, no
 *     console / process / fs side effects. See
 *     [`./per-record-pipeline.ts`](./per-record-pipeline.ts) for the
 *     contract.
 *   - **`createMemoryAuditAdapter`** + **`makeAuditEntry`** (Step 5) —
 *     in-memory audit adapter (the default sink when the
 *     orchestrator's caller doesn't supply one) and a constructor
 *     helper that guarantees `__auditSchemaVersion: "1"`. Pure;
 *     append-only; never logs / touches fs / touches process. See
 *     [`./audit.ts`](./audit.ts) for the contract.
 *   - **`createMigrationRunner`** (Step 6) — factory returning a
 *     `MigrationRunner` handle. The handle exposes the audit
 *     adapter (for inspection) and a `run(opts)` method that
 *     wires pre-flight → input-stream walk → per-record pipeline →
 *     audit → optional output persist + flush. Never calls
 *     `migration.transform` directly; every transform invocation
 *     flows through `runRecordPipeline`. See
 *     [`./runner.ts`](./runner.ts) for the full contract.
 *   - **Type-only re-exports** from [`./types.ts`](./types.ts) covering
 *     the locked v0.9 contract (`RunnerOptions`, `RunOpts`, `RunMode`,
 *     `RunResult` / `RunSuccess` / `RunFailure`, `ErrorClassification`,
 *     `AuditEntry`, the three adapter interfaces, `MemoryAuditAdapter`,
 *     `MigrationRunner`, `ResumeCursor`, the four `PreFlight*`
 *     shapes, and the four `PerRecordPipeline*` shapes).
 *
 *   - **JSON / JSONL reference adapters** (Step 7) —
 *     `createJsonFileInputAdapter(path)` reads a JSON array (or
 *     `{ records: [...] }`) from disk and streams sequentially;
 *     `createJsonFileOutputAdapter(path)` buffers records in memory
 *     and writes a single JSON array on `flush()`;
 *     `createJsonlAuditAdapter(path)` is the persistent JSONL
 *     audit log paired with the in-memory default from Step 5.
 *     These are the ONLY files in the package that import
 *     `node:fs/promises`; the cross-cutting scan in
 *     `tests/scaffold.test.ts` enforces "fs imports only under
 *     `src/adapters/`". See [`./adapters/`](./adapters/) for the
 *     individual contracts.
 *
 * ## Still ahead
 *
 *   - Step 8 — full test matrix sweep (end-to-end chain, cross-
 *     cutting purity, etc.).
 *   - Step 9 — runtime purity gates (formal cross-cutting static
 *     scan beyond the per-file scans).
 *   - Step 10 — docs (`README.md` + `docs/RUNNER.md`).
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
  MemoryAuditAdapter,
  MigrationEntry,
  MigrationRunner,
  MigrationRegistry,
  NonEmptyChain,
  OutputAdapter,
  PerRecordPipelineFailure,
  PerRecordPipelineOpts,
  PerRecordPipelineResult,
  PerRecordPipelineSuccess,
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

export type { MakeAuditEntryOpts } from "./audit.js";

// =============================================================================
// Step 3 — pre-flight (chain-scoped plan + verify)
// =============================================================================

export { preFlight } from "./pre-flight.js";

// =============================================================================
// Step 4 — per-record pipeline (THE ONLY file allowed to call .transform)
// =============================================================================

export { runRecordPipeline } from "./per-record-pipeline.js";

// =============================================================================
// Step 5 — audit (in-memory adapter + entry constructor)
// =============================================================================

export { createMemoryAuditAdapter, makeAuditEntry } from "./audit.js";

// =============================================================================
// Step 6 — runner orchestrator (the public `createMigrationRunner` factory)
// =============================================================================

export { createMigrationRunner } from "./runner.js";

// =============================================================================
// Step 7 — JSON / JSONL reference adapters
// =============================================================================

export {
  createJsonFileInputAdapter,
  createJsonFileOutputAdapter,
  createJsonlAuditAdapter,
} from "./adapters/index.js";
