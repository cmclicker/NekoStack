/**
 * `@nekostack/migrate-runner` core type surface (v0.9 Step 2).
 *
 * Type-only file. **No runtime values.** Every export is a `type` or
 * `interface` declaration; the runner orchestrator (Step 6) imports
 * these to type its options, results, and adapter slots.
 *
 * Source of truth for the locked v0.9 contract is
 * [`packages/schema/docs/PHASE_PLAN_v0.9.md`](../../schema/docs/PHASE_PLAN_v0.9.md)
 * — every shape below cross-references the decision it implements.
 *
 * **Hard-locked rules this file encodes:**
 *
 *   - `migration.transform` is never called from this file (there are
 *     no function bodies here at all).
 *   - The runner consumes `Registry` + `MigrationRegistry` +
 *     `MigrationEntry` types **only** through `@nekostack/schema/cli`
 *     (Decision #1 + #18 — `@nekostack/schema` stays pure; the
 *     subpath is the only legal surface for the runner to import
 *     migration internals).
 *   - No `Apply`, `Rollback`, or `Reverse` type is declared. The
 *     scaffold-test negative gate in `tests/types.test-d.ts` enforces
 *     their absence via `@ts-expect-error`.
 *
 * @see [`PHASE_PLAN_v0.9.md` → Decisions #4, #6, #7, #8, #9, #10,
 *      #14, #16, #17](../../schema/docs/PHASE_PLAN_v0.9.md)
 */

import type {
  DiffSeverity,
  MigrationEntry,
  MigrationRegistry,
  PlanNote,
  Registry,
} from "@nekostack/schema/cli";
import type { Issue } from "@nekostack/schema";

// =============================================================================
// Run mode (Decision #9)
// =============================================================================

/**
 * Three modes the runner can be invoked in.
 *
 * | mode             | calls `transform` | calls `outputAdapter.persist` |
 * |------------------|-------------------|-------------------------------|
 * | `validate-only`  | ✗                 | ✗                             |
 * | `dry-run`        | ✓                 | ✗                             |
 * | `execute`        | ✓                 | ✓                             |
 *
 * Audit is always written.
 */
export type RunMode = "validate-only" | "dry-run" | "execute";

// =============================================================================
// Error classification (Decision #14)
// =============================================================================

/**
 * Locked classification union. Five per-record codes + three
 * run-level codes. Per-record codes surface inside
 * `AuditEntry.classification`; run-level codes surface inside
 * `RunFailure.classification`.
 *
 * Adding a new code is a contract change and requires an audit.
 */
export type ErrorClassification =
  // Per-record (Decision #14)
  | "input_validation_failed"
  | "transform_threw"
  | "transform_timeout"
  | "output_validation_failed"
  | "persist_failed"
  // Run-level (Decision #14)
  | "pre_flight_failed"
  | "adapter_init_failed"
  | "cancelled";

// =============================================================================
// Adapters (Decision #17)
// =============================================================================

/**
 * Pluggable data-input source. The runner pulls records one at a time
 * via `for await (const record of inputAdapter.stream())`.
 * Sequential per-record by design (Decision #13).
 */
export interface InputAdapter<T = unknown> {
  stream(): AsyncIterable<T>;
}

/**
 * Pluggable data-output sink. Called once per transformed record in
 * `execute` mode; never called in `validate-only` or `dry-run`
 * (Decision #9). `flush` is optional; reference adapters may use it
 * to batch writes, but the runner does not require it.
 */
export interface OutputAdapter<T = unknown> {
  persist(record: T): Promise<void>;
  flush?(): Promise<void>;
}

/**
 * Pluggable audit sink. Every record outcome — success or failure —
 * is appended. Resume support requires `cursor(runId)` to return the
 * set of record indexes already marked `success` for that run.
 */
export interface AuditAdapter {
  append(entry: AuditEntry): Promise<void>;
  /**
   * Set of record indexes already marked `success` for the given
   * `runId`. The runner uses this to skip those records when
   * resuming via `RunOpts.resumeFrom`.
   */
  cursor(runId: string): Promise<readonly number[]>;
}

// =============================================================================
// Audit entry (Decision #16)
// =============================================================================

/**
 * One audit-log entry per record. Append-only — the runner never
 * rewrites entries. `__auditSchemaVersion` is locked at `"1"` from
 * day one (round-2 resolution of OQ-4 in the v0.9 plan).
 *
 * `before` / `after` retention is opt-in per `RunOpts.auditBefore` /
 * `RunOpts.auditAfter` because record payloads can be large; both
 * default `false`.
 */
export interface AuditEntry {
  /** Locked at `"1"`. Bumping this is a contract change. */
  readonly __auditSchemaVersion: "1";
  /** ULID assigned by the runner per `runner.run()` invocation. */
  readonly runId: string;
  readonly schemaId: string;
  readonly fromVersion: string;
  readonly toVersion: string;
  /** The resolved chain at the time the run started (frozen by
   *  Decision #5 step 3). */
  readonly chainEntries: readonly {
    readonly fromVersion: string;
    readonly toVersion: string;
    readonly sourcePath: string;
  }[];
  /** 0-based index into the input stream. */
  readonly recordIndex: number;
  /** Optional consumer-supplied stable record id (e.g. row PK,
   *  document `_id`). Surfaces in failure diagnostics. */
  readonly recordKey?: string;
  readonly status: "success" | "failure";
  /** Present only when `status === "failure"`. */
  readonly classification?: ErrorClassification;
  /** Present only when `status === "failure"`. */
  readonly errorMessage?: string;
  /** Input record. Present only when `RunOpts.auditBefore === true`. */
  readonly before?: unknown;
  /** Transformed output (or "would-have-persisted" value in
   *  `dry-run`). Present only when `RunOpts.auditAfter === true`. */
  readonly after?: unknown;
  /** ISO-8601. */
  readonly timestamp: string;
}

// =============================================================================
// Resume cursor (Decision #10)
// =============================================================================

/**
 * Opaque resume marker produced by the runner and consumed by
 * `RunOpts.resumeFrom`. Wraps a `runId` so the runner can look up
 * the set of already-`success` record indexes through
 * `AuditAdapter.cursor(runId)` and skip them on resume.
 */
export interface ResumeCursor {
  readonly runId: string;
}

// =============================================================================
// Runner construction (Decision #4)
// =============================================================================

/**
 * Construction-time options for `createMigrationRunner(opts)`. Wires
 * the schema-side registries (consumed read-only from
 * `@nekostack/schema/cli`) and the three pluggable adapter slots.
 */
export interface RunnerOptions {
  readonly schemaRegistry: Registry;
  readonly migrationRegistry: MigrationRegistry;
  readonly inputAdapter: InputAdapter;
  readonly outputAdapter: OutputAdapter;
  /** Optional. If absent, the runner uses an in-memory default
   *  whose `cursor()` returns the empty set (no resume). */
  readonly auditAdapter?: AuditAdapter;
}

// =============================================================================
// Per-invocation options (Decision #4 / #5 / #8 / #9 / #10 / #16)
// =============================================================================

/**
 * Per-invocation options for `runner.run(opts)`. Every field beyond
 * the operand triple (`schemaId` / `fromVersion` / `toVersion`) and
 * `mode` is optional with safe defaults documented inline.
 */
export interface RunOpts {
  readonly schemaId: string;
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly mode: RunMode;
  /**
   * If `true`, the chain-scoped verifier (Decision #5/#15) treats
   * `cosmetic_drift` as success-compatible. Default: `false`
   * (strict — OQ-5 resolved during round-2).
   */
  readonly allowCosmeticDrift?: boolean;
  /**
   * Wall-clock budget around each synchronous `transform` call. If
   * elapsed time exceeds this value AFTER control returns, the
   * record is classified as `transform_timeout` (Decision #8 —
   * post-hoc only; the runner does NOT preempt a running transform).
   * Default: no budget (transforms can take arbitrary time).
   */
  readonly transformTimeoutMs?: number;
  /**
   * On per-record failure, `"continue"` records the failure and
   * processes the next record; `"stop"` aborts the run on first
   * failure. Default: `"continue"`.
   */
  readonly onError?: "continue" | "stop";
  /** Persist the input record in the audit entry's `before` field.
   *  Default: `false` (payloads can be large). */
  readonly auditBefore?: boolean;
  /** Persist the transformed record in the audit entry's `after`
   *  field. Default: `false`. */
  readonly auditAfter?: boolean;
  /** Resume from a prior run's cursor (Decision #10). Skips records
   *  marked `success` for that `runId` via
   *  `AuditAdapter.cursor(runId)`. */
  readonly resumeFrom?: ResumeCursor;
  /** Cancellation signal. Checked **before each record and between
   *  records only**; does NOT interrupt an in-flight synchronous
   *  transform (Decision #8). */
  readonly signal?: AbortSignal;
}

// =============================================================================
// Run result (Decision #4 / #14)
// =============================================================================

/**
 * Successful run. `failureCount` is `0` by construction — any
 * per-record failure flips the result to `RunFailure`.
 */
export interface RunSuccess {
  readonly success: true;
  readonly runId: string;
  readonly mode: RunMode;
  readonly recordCount: number;
  readonly successCount: number;
  readonly failureCount: 0;
}

/**
 * Failed run. Three failure shapes (Decision #14):
 *
 *   - Run-level: `classification` is one of `pre_flight_failed`,
 *     `adapter_init_failed`, or `cancelled`; the per-record counts
 *     are absent because the runner stopped before walking records.
 *   - Per-record aggregate: `classification` is one of the five
 *     per-record codes that triggered the failure (the most-severe
 *     code seen, or simply the first); the counts are populated.
 *   - `onError: "stop"` first-failure abort: classification is the
 *     per-record code that triggered the stop; counts reflect what
 *     was processed before the stop.
 *
 * `failureCount` is always > 0 here; otherwise the result would be
 * `RunSuccess`.
 */
export interface RunFailure {
  readonly success: false;
  readonly runId: string;
  readonly mode: RunMode;
  readonly classification: ErrorClassification;
  readonly errorMessage: string;
  /** Absent for run-level failures that stopped before walking
   *  records (`pre_flight_failed`, `adapter_init_failed`). Present
   *  otherwise. */
  readonly recordCount?: number;
  readonly successCount?: number;
  readonly failureCount?: number;
}

/**
 * Discriminated union — narrow on `result.success`.
 */
export type RunResult = RunSuccess | RunFailure;

// =============================================================================
// Pre-flight (Step 3 — Decision #5 + #15)
// =============================================================================

/**
 * Input to `preFlight(opts)`. Pure; no I/O. The runner orchestrator
 * (Step 6) will call this before walking the input stream.
 */
export interface PreFlightOpts {
  readonly schemaRegistry: Registry;
  readonly migrationRegistry: MigrationRegistry;
  readonly schemaId: string;
  readonly fromVersion: string;
  readonly toVersion: string;
  /**
   * When `true`, the chain-scoped verifier accepts `cosmetic_drift`
   * as success-compatible (warning-class). Default: `false`
   * (strict — OQ-5 resolved in the v0.9 plan round-2).
   */
  readonly allowCosmeticDrift?: boolean;
}

/**
 * Pre-flight success — the planner and the chain-scoped verifier
 * both accepted. Carries the **frozen** chain the runner walks plus
 * the chain-scoped `MigrationRegistry` it was verified against (so
 * the per-record pipeline doesn't re-derive it).
 *
 * `chain.length === 0` when the diff is null / cosmetic / additive-
 * without-migration. The `notes` field preserves the planner's
 * `over_specified` / `additive_no_migration` discriminators so the
 * orchestrator can surface them.
 */
export interface PreFlightSuccess {
  readonly success: true;
  readonly schemaId: string;
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly chain: readonly MigrationEntry[];
  readonly versionPath: readonly string[];
  readonly worstSeverity: DiffSeverity | null;
  readonly notes: readonly PlanNote[];
  /**
   * Three-level `Map` carrying ONLY the migrations on the resolved
   * chain. Built by `preFlight` from `plan.chain`. The verifier ran
   * against this registry, not the workspace one (Decision #15).
   * Empty when the chain is empty.
   */
  readonly chainScopedRegistry: MigrationRegistry;
}

/**
 * Pre-flight failure — planner refused, chain-scoped verifier
 * refused, or `cosmetic_drift` was present without
 * `allowCosmeticDrift: true`.
 *
 * `classification` is always `"pre_flight_failed"` (Decision #14).
 * The original `Issue[]` from the schema-side handlers is preserved
 * verbatim in `issues`; the orchestrator decides whether to surface
 * the first one or aggregate.
 *
 * **`migration.transform` is never invoked on this branch.** The
 * runner has no chain to walk.
 */
export interface PreFlightFailure {
  readonly success: false;
  readonly classification: "pre_flight_failed";
  readonly errorMessage: string;
  readonly issues: readonly Issue[];
}

export type PreFlightResult = PreFlightSuccess | PreFlightFailure;

// =============================================================================
// Per-record pipeline (Step 4 — Decision #6)
// =============================================================================

/**
 * Non-empty migration chain. The per-record pipeline cannot be
 * invoked on an empty chain (a chain of length 0 means no transform
 * needed; the orchestrator skips the record-walk in that case). The
 * non-empty-tuple type forces callers to check before invoking.
 */
export type NonEmptyChain = readonly [
  MigrationEntry,
  ...(readonly MigrationEntry[]),
];

/**
 * Input to `runRecordPipeline(opts)`. Pure; no I/O. The orchestrator
 * (Step 6) supplies the locked chain (from a `PreFlightSuccess`),
 * the schema registry the pre-flight verified against, the single
 * input record, and an optional per-transform wall-clock budget.
 */
export interface PerRecordPipelineOpts {
  readonly schemaRegistry: Registry;
  readonly chain: NonEmptyChain;
  readonly input: unknown;
  /**
   * Optional post-hoc wall-clock budget around each synchronous
   * transform call. Measured AFTER control returns from `transform`;
   * the pipeline does NOT preempt a running transform (Decision #8).
   * Default: no budget — transforms can take arbitrary time.
   */
  readonly transformTimeoutMs?: number;
}

/**
 * Per-record success. The transformed value has passed destination-
 * schema validation and is ready for the orchestrator to hand to
 * `outputAdapter.persist` (in `execute` mode) or discard (in
 * `dry-run`).
 */
export interface PerRecordPipelineSuccess {
  readonly success: true;
  readonly output: unknown;
}

/**
 * Per-record failure. `classification` is one of four locked codes
 * (no `persist_failed` here — that's the orchestrator's concern, not
 * the pipeline's). `chainIndex` pinpoints where the failure landed:
 *
 *   - `-1`              — input validation (before any transform call)
 *   - `0..chain.length-1` — the i-th transform threw or timed out
 *   - `chain.length`    — output validation (after the last transform)
 *
 * `issues` carries the source/destination schema's `Issue[]` for
 * validation failures, or a synthesized `schema_not_found` issue
 * when an endpoint schema can't be resolved. Empty array for
 * `transform_threw` / `transform_timeout`.
 *
 * **The pipeline never persists output and never writes an audit
 * entry.** Both are explicitly the orchestrator's concern; the
 * pipeline is the inner-loop primitive only.
 */
export interface PerRecordPipelineFailure {
  readonly success: false;
  readonly classification:
    | "input_validation_failed"
    | "transform_threw"
    | "transform_timeout"
    | "output_validation_failed";
  readonly chainIndex: number;
  readonly errorMessage: string;
  readonly issues: readonly Issue[];
}

export type PerRecordPipelineResult =
  | PerRecordPipelineSuccess
  | PerRecordPipelineFailure;

// =============================================================================
// Re-export schema-side types the runner consumes (for caller convenience)
// =============================================================================

export type { Registry, MigrationRegistry, MigrationEntry, PlanNote, DiffSeverity };
