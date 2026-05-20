/**
 * `createMigrationRunner(options)` — runner orchestrator
 * (v0.9 Step 6, Decisions #4 / #5 / #6 / #8 / #9 / #10 / #14 / #16).
 *
 * The runner orchestrator wires the three pure primitives — pre-
 * flight, per-record pipeline, audit — into the end-to-end record
 * walk. It owns:
 *
 *   - the `runId` lifecycle (one ULID-style UUID per `run()` call,
 *     or the resumed runId from `opts.resumeFrom`)
 *   - the stream consumption from `inputAdapter`
 *   - the mode dispatch (`validate-only` / `dry-run` / `execute`)
 *   - the `AbortSignal` checkpointing (before-each-record only;
 *     v0.9 does not preempt synchronous transforms — Decision #8)
 *   - the `onError: "continue" | "stop"` policy
 *   - audit-entry construction + persistence to the audit adapter
 *   - `outputAdapter.persist` + optional `outputAdapter.flush` in
 *     `execute` mode
 *
 * **The runner does NOT call `migration.transform(...)` directly.**
 * Every transform invocation flows through
 * `runRecordPipeline(...)`, which is the ONE file in the package
 * statically permitted to invoke `.transform(`. The runner's own
 * static-scan test bans the pattern outright.
 *
 * **`validate-only` mode interpretation (locked here, v0.9):**
 * `validate-only` is treated as **pre-flight-only**. After pre-
 * flight succeeds, the runner returns `RunSuccess` with all
 * counts `0` and does NOT consume the input stream, does NOT
 * call the per-record pipeline, does NOT persist, does NOT write
 * audit entries. This matches Decision #9's "transform = ✗,
 * persist = ✗" column and gives the cleanest implementation in
 * v0.9. A future amendment may add a per-record validation pass
 * that walks the stream and validates inputs against the source
 * schema without invoking transforms; that's an explicit non-
 * change for v0.9.
 *
 * **Flush policy:** `outputAdapter.flush` (if provided) is called
 * **only in `execute` mode and only after the stream loop
 * completes naturally** (not on `onError: "stop"` early return,
 * not on `cancelled`). The thinking: durability for committed
 * records is best-effort; if the run was aborted, the caller
 * decides whether to flush.
 *
 * **`onError: "continue"` vs `"stop"`:**
 *   - `continue` (default): the runner records each per-record
 *     failure in the audit log and moves on. After the stream
 *     completes, if any record failed, the run returns
 *     `RunFailure` with the **first** per-record failure's
 *     classification as the run-level classification. The audit
 *     log carries the full picture.
 *   - `stop`: the first per-record failure aborts the loop. The
 *     run returns `RunFailure` immediately with that classification.
 *
 * **Adapter-stream errors:** if `inputAdapter.stream()` throws
 * during iteration, the runner classifies the run as
 * `adapter_init_failed` and returns `RunFailure`.
 *
 * **Pure with respect to side effects.** No `fs.*`, no
 * `console.*`, no `process.*`. The runner's static-scan test
 * enforces this on `src/runner.ts`.
 */

import { preFlight } from "./pre-flight.js";
import { runRecordPipeline } from "./per-record-pipeline.js";
import { createMemoryAuditAdapter, makeAuditEntry } from "./audit.js";
import type {
  AuditAdapter,
  AuditEntry,
  ErrorClassification,
  MigrationEntry,
  MigrationRunner,
  RunFailure,
  RunOpts,
  RunResult,
  RunnerOptions,
} from "./types.js";

// =============================================================================
// Factory
// =============================================================================

export function createMigrationRunner(
  options: RunnerOptions,
): MigrationRunner {
  const auditAdapter: AuditAdapter =
    options.auditAdapter ?? createMemoryAuditAdapter();

  async function run(opts: RunOpts): Promise<RunResult> {
    const runId = opts.resumeFrom?.runId ?? globalThis.crypto.randomUUID();

    // 1. Pre-flight against the workspace registries.
    const pre = preFlight({
      schemaRegistry: options.schemaRegistry,
      migrationRegistry: options.migrationRegistry,
      schemaId: opts.schemaId,
      fromVersion: opts.fromVersion,
      toVersion: opts.toVersion,
      ...(opts.allowCosmeticDrift !== undefined
        ? { allowCosmeticDrift: opts.allowCosmeticDrift }
        : {}),
    });
    if (!pre.success) {
      return {
        success: false,
        runId,
        mode: opts.mode,
        classification: "pre_flight_failed",
        errorMessage: pre.errorMessage,
      };
    }

    // 2. Empty chain — pre-flight said no transformation is
    //    needed. Runner is a no-op for the record walk; we don't
    //    even read the input stream.
    if (pre.chain.length === 0) {
      return {
        success: true,
        runId,
        mode: opts.mode,
        recordCount: 0,
        successCount: 0,
        failureCount: 0,
      };
    }

    // 3. `validate-only` mode (Decision #9): pre-flight-only.
    //    Stream is not consumed; transforms are not called; nothing
    //    is persisted. Audit is not written per-record (there are
    //    no records walked). This is the locked v0.9 interpretation.
    if (opts.mode === "validate-only") {
      return {
        success: true,
        runId,
        mode: opts.mode,
        recordCount: 0,
        successCount: 0,
        failureCount: 0,
      };
    }

    // 4. Resume cursor. If the caller is resuming a prior run,
    //    query the audit adapter for the set of recordIndexes
    //    already marked `success` for that runId and skip them.
    const skipSet = new Set<number>();
    if (opts.resumeFrom !== undefined) {
      const cursor = await auditAdapter.cursor(opts.resumeFrom.runId);
      for (const idx of cursor) skipSet.add(idx);
    }

    const onError: "continue" | "stop" = opts.onError ?? "continue";
    const chain = pre.chain as readonly [
      MigrationEntry,
      ...(readonly MigrationEntry[]),
    ];
    const chainEntriesForAudit: AuditEntry["chainEntries"] = chain.map(
      (entry) => ({
        fromVersion: entry.fromVersion,
        toVersion: entry.toVersion,
        sourcePath: entry.sourcePath,
      }),
    );

    let recordCount = 0;
    let successCount = 0;
    let failureCount = 0;
    let firstFailure:
      | { classification: ErrorClassification; message: string }
      | undefined;

    // 5. Pre-stream cancellation check. The signal might already
    //    be aborted before we read the first record.
    if (opts.signal?.aborted) {
      return cancelledResult(0);
    }

    // 6. Stream walk. Each iteration:
    //    a. Check the signal between records.
    //    b. Skip the record if its index is in the resume cursor.
    //    c. Invoke the per-record pipeline.
    //    d. Persist (execute mode only) and audit.
    try {
      for await (const input of options.inputAdapter.stream()) {
        if (opts.signal?.aborted) {
          return cancelledResult(recordCount);
        }

        const recordIndex = recordCount;
        recordCount += 1;

        if (skipSet.has(recordIndex)) {
          continue;
        }

        const pipeResult = runRecordPipeline({
          schemaRegistry: options.schemaRegistry,
          chain,
          input,
          ...(opts.transformTimeoutMs !== undefined
            ? { transformTimeoutMs: opts.transformTimeoutMs }
            : {}),
        });

        if (pipeResult.success) {
          // Execute mode persists; dry-run does not.
          if (opts.mode === "execute") {
            try {
              await options.outputAdapter.persist(pipeResult.output);
            } catch (cause) {
              const message = errorMessageOf(cause);
              await auditAdapter.append(
                makeAuditEntry({
                  runId,
                  schemaId: opts.schemaId,
                  fromVersion: opts.fromVersion,
                  toVersion: opts.toVersion,
                  chainEntries: chainEntriesForAudit,
                  recordIndex,
                  status: "failure",
                  classification: "persist_failed",
                  errorMessage: message,
                  ...(opts.auditBefore ? { before: input } : {}),
                  ...(opts.auditAfter ? { after: pipeResult.output } : {}),
                }),
              );
              failureCount += 1;
              if (firstFailure === undefined) {
                firstFailure = {
                  classification: "persist_failed",
                  message,
                };
              }
              if (onError === "stop") {
                return aggregateFailureResult();
              }
              continue;
            }
          }
          // Success audit (dry-run + execute both write a success
          // entry; validate-only never reaches this branch).
          await auditAdapter.append(
            makeAuditEntry({
              runId,
              schemaId: opts.schemaId,
              fromVersion: opts.fromVersion,
              toVersion: opts.toVersion,
              chainEntries: chainEntriesForAudit,
              recordIndex,
              status: "success",
              ...(opts.auditBefore ? { before: input } : {}),
              ...(opts.auditAfter ? { after: pipeResult.output } : {}),
            }),
          );
          successCount += 1;
        } else {
          // Per-record failure from the pipeline.
          await auditAdapter.append(
            makeAuditEntry({
              runId,
              schemaId: opts.schemaId,
              fromVersion: opts.fromVersion,
              toVersion: opts.toVersion,
              chainEntries: chainEntriesForAudit,
              recordIndex,
              status: "failure",
              classification: pipeResult.classification,
              errorMessage: pipeResult.errorMessage,
              ...(opts.auditBefore ? { before: input } : {}),
              // No `after` — pipeline never produced a valid output.
            }),
          );
          failureCount += 1;
          if (firstFailure === undefined) {
            firstFailure = {
              classification: pipeResult.classification,
              message: pipeResult.errorMessage,
            };
          }
          if (onError === "stop") {
            return aggregateFailureResult();
          }
        }
      }
    } catch (cause) {
      // The input adapter threw mid-iteration. Classify as
      // adapter_init_failed (the only run-level code that fits a
      // stream-shape error). Audit entries written so far are
      // preserved by the append-only contract.
      return {
        success: false,
        runId,
        mode: opts.mode,
        classification: "adapter_init_failed",
        errorMessage: `Input adapter threw during stream consumption: ${errorMessageOf(cause)}`,
        recordCount,
        successCount,
        failureCount,
      };
    }

    // 7. Flush — execute mode only, after the stream completed
    //    naturally. On `onError: "stop"` (early return) or cancel
    //    we do NOT flush; that's the documented contract.
    if (
      opts.mode === "execute" &&
      options.outputAdapter.flush !== undefined
    ) {
      try {
        await options.outputAdapter.flush();
      } catch (cause) {
        return {
          success: false,
          runId,
          mode: opts.mode,
          classification: "persist_failed",
          errorMessage: `Output adapter flush failed: ${errorMessageOf(cause)}`,
          recordCount,
          successCount,
          failureCount,
        };
      }
    }

    // 8. Final result. Any per-record failure flips the run to
    //    RunFailure; otherwise RunSuccess with the literal
    //    failureCount: 0.
    if (failureCount > 0) {
      return aggregateFailureResult();
    }
    return {
      success: true,
      runId,
      mode: opts.mode,
      recordCount,
      successCount,
      failureCount: 0,
    };

    // ---- run-local helpers --------------------------------------------------

    function aggregateFailureResult(): RunFailure {
      const fallback = {
        classification: "adapter_init_failed" as ErrorClassification,
        message: "no per-record failure recorded",
      };
      const ff = firstFailure ?? fallback;
      return {
        success: false,
        runId,
        mode: opts.mode,
        classification: ff.classification,
        errorMessage:
          failureCount > 1
            ? `${failureCount} of ${recordCount} record${recordCount === 1 ? "" : "s"} failed; first failure (\`${ff.classification}\`): ${ff.message}`
            : ff.message,
        recordCount,
        successCount,
        failureCount,
      };
    }

    function cancelledResult(processed: number): RunFailure {
      return {
        success: false,
        runId,
        mode: opts.mode,
        classification: "cancelled",
        errorMessage:
          processed === 0
            ? "Run cancelled before any record was processed."
            : `Run cancelled after ${processed} record${processed === 1 ? "" : "s"}.`,
        recordCount: processed,
        successCount,
        failureCount,
      };
    }
  }

  return {
    auditAdapter,
    run,
  };
}

// =============================================================================
// Helpers
// =============================================================================

function errorMessageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
