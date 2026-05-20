/**
 * `runRecordPipeline(opts)` — per-record migration pipeline
 * (v0.9 Step 4, Decision #6 + #8).
 *
 * **This is the ONE and ONLY file in `@nekostack/migrate-runner`
 * allowed to call `migration.transform(...)`.** Every other source
 * file under `packages/migrate-runner/src/` carries a static-scan
 * row banning `.transform(`. The cross-cutting Step 9 scan (and
 * each per-file scan in earlier steps) enforces this; the
 * per-record pipeline's own static-scan test ALLOWS `.transform(`
 * in exactly this file and confirms `console.*`, `process.*`, and
 * `fs` imports are still banned.
 *
 * For one input record:
 *
 *   1. Resolve the **source** schema via
 *      `findSchema(schemaRegistry, chain[0].schemaId, chain[0].fromVersion)`.
 *      If missing → `input_validation_failed` with a synthesized
 *      `schema_not_found` issue.
 *   2. `safeParse(sourceSchema, input)` — on failure return
 *      `input_validation_failed` with the parser's issues, never
 *      invoke `transform`.
 *   3. Walk the chain in order. For each entry:
 *
 *      - Read wall-clock time.
 *      - Invoke `entry.migration.transform(current)` synchronously.
 *      - If it throws → return `transform_threw` with `chainIndex: i`.
 *      - If wall-clock elapsed > `transformTimeoutMs` (when supplied)
 *        AFTER control returns → return `transform_timeout` with
 *        `chainIndex: i`. (Decision #8: post-hoc only — v0.9 does
 *        NOT preempt synchronous transforms.)
 *      - Otherwise, the transform's return value becomes the next
 *        iteration's input.
 *
 *   4. Resolve the **destination** schema via
 *      `findSchema(schemaRegistry, lastEntry.schemaId, lastEntry.toVersion)`.
 *      If missing → `output_validation_failed` with synthesized
 *      `schema_not_found`.
 *   5. `safeParse(destSchema, current)` — on failure return
 *      `output_validation_failed`.
 *   6. Success → return `{ success: true, output }`.
 *
 * **Pure with respect to side effects.** No `fs.*`, no
 * `console.*`, no `process.*`, no audit writes, no adapter
 * persistence. Writers and persistence are the orchestrator's
 * concern (Step 6). The pipeline is a pure data-in / data-out
 * inner-loop primitive: feed it a chain + an input record, get
 * back a per-record success or failure.
 */

import { safeParse } from "@nekostack/schema";
import { findSchema } from "@nekostack/schema/cli";
import type { Issue } from "@nekostack/schema";
import type {
  PerRecordPipelineOpts,
  PerRecordPipelineResult,
} from "./types.js";

// =============================================================================
// Public entry
// =============================================================================

export function runRecordPipeline(
  opts: PerRecordPipelineOpts,
): PerRecordPipelineResult {
  const { schemaRegistry, chain, input, transformTimeoutMs } = opts;

  // 1. Resolve source schema.
  const firstHop = chain[0];
  const sourceEntry = findSchema(
    schemaRegistry,
    firstHop.schemaId,
    firstHop.fromVersion,
  );
  if (sourceEntry === undefined) {
    return inputValidationFailure(
      `Source schema not found in registry: \`${firstHop.schemaId}\` @ ${firstHop.fromVersion}`,
      [schemaNotFoundIssue(firstHop.schemaId, firstHop.fromVersion, "source")],
    );
  }

  // 2. Validate input.
  const inputCheck = safeParse(sourceEntry.schema, input);
  if (!inputCheck.success) {
    return inputValidationFailure(
      `Input failed validation against \`${firstHop.schemaId}\` @ ${firstHop.fromVersion}: ${firstMessage(inputCheck.issues)}`,
      inputCheck.issues,
    );
  }

  // 3. Walk the chain — the ONLY place in the runner that calls
  //    `migration.transform(...)`.
  let current: unknown = inputCheck.data;
  for (let i = 0; i < chain.length; i++) {
    const entry = chain[i]!;
    const start = Date.now();
    let next: unknown;
    try {
      next = entry.migration.transform(current as never);
    } catch (cause) {
      return transformThrewFailure(i, errorMessageOf(cause));
    }
    const elapsed = Date.now() - start;
    if (transformTimeoutMs !== undefined && elapsed > transformTimeoutMs) {
      return transformTimeoutFailure(i, elapsed, transformTimeoutMs);
    }
    current = next;
  }

  // 4. Resolve destination schema (last hop's `toVersion`).
  const lastHop = chain[chain.length - 1]!;
  const destEntry = findSchema(
    schemaRegistry,
    lastHop.schemaId,
    lastHop.toVersion,
  );
  if (destEntry === undefined) {
    return outputValidationFailure(
      chain.length,
      `Destination schema not found in registry: \`${lastHop.schemaId}\` @ ${lastHop.toVersion}`,
      [schemaNotFoundIssue(lastHop.schemaId, lastHop.toVersion, "destination")],
    );
  }

  // 5. Validate output.
  const outputCheck = safeParse(destEntry.schema, current);
  if (!outputCheck.success) {
    return outputValidationFailure(
      chain.length,
      `Output failed validation against \`${lastHop.schemaId}\` @ ${lastHop.toVersion}: ${firstMessage(outputCheck.issues)}`,
      outputCheck.issues,
    );
  }

  // 6. Success.
  return { success: true, output: outputCheck.data };
}

// =============================================================================
// Failure constructors
// =============================================================================

function inputValidationFailure(
  errorMessage: string,
  issues: readonly Issue[],
): PerRecordPipelineResult {
  return {
    success: false,
    classification: "input_validation_failed",
    chainIndex: -1,
    errorMessage,
    issues,
  };
}

function transformThrewFailure(
  chainIndex: number,
  errorMessage: string,
): PerRecordPipelineResult {
  return {
    success: false,
    classification: "transform_threw",
    chainIndex,
    errorMessage,
    issues: [],
  };
}

function transformTimeoutFailure(
  chainIndex: number,
  elapsedMs: number,
  budgetMs: number,
): PerRecordPipelineResult {
  return {
    success: false,
    classification: "transform_timeout",
    chainIndex,
    errorMessage: `Transform at chain index ${chainIndex} exceeded ${budgetMs}ms wall-clock budget (elapsed ${elapsedMs}ms — measured post-hoc; v0.9 does not preempt synchronous transforms).`,
    issues: [],
  };
}

function outputValidationFailure(
  chainIndex: number,
  errorMessage: string,
  issues: readonly Issue[],
): PerRecordPipelineResult {
  return {
    success: false,
    classification: "output_validation_failed",
    chainIndex,
    errorMessage,
    issues,
  };
}

// =============================================================================
// Helpers
// =============================================================================

function schemaNotFoundIssue(
  schemaId: string,
  schemaVersion: string,
  role: "source" | "destination",
): Issue {
  return {
    code: "schema_not_found",
    path: [],
    message: `${role === "source" ? "Source" : "Destination"} schema \`${schemaId}\` @ ${schemaVersion} is not in the schema registry.`,
    severity: "error",
    metadata: { schemaId, schemaVersion, role },
  };
}

function firstMessage(issues: readonly Issue[]): string {
  return issues[0]?.message ?? "no diagnostic message provided";
}

function errorMessageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

