/**
 * Step 2 — type-level gate for the locked v0.9 runner contract.
 *
 * Every assertion runs at TypeScript-compile time via vitest's
 * `expectTypeOf` (the same mechanism the schema package uses for its
 * `.test-d.ts` files). The file ships no runtime behavior.
 *
 * Covers:
 *
 *   - all locked types are importable from both `./src/types.ts` and
 *     the package public entry `./src/index.ts`
 *   - `RunMode` and `ErrorClassification` are exact string-literal
 *     unions (no widening to `string`)
 *   - `RunOpts` carries every field the v0.9 plan locks
 *   - `RunResult` narrows on `success: true | false`
 *   - `AuditEntry.__auditSchemaVersion` is the literal `"1"`, not a
 *     widened `string`
 *   - `RunnerOptions` carries the three locked slots
 *     (`schemaRegistry`, `migrationRegistry`, `inputAdapter`,
 *     `outputAdapter`, optional `auditAdapter`)
 *   - the three adapter interfaces expose exactly the locked method
 *     names (`stream` / `persist` / `flush?` / `append` / `cursor`)
 *   - **negative gate** — no `Apply`, `Rollback`, `Reverse`,
 *     `ApplyMigration`, or `RollbackMigration` type is exported. Each
 *     row uses `@ts-expect-error` — if a future change adds the
 *     type, the directive becomes unused and `tsc --noEmit` fails.
 */

import { describe, expectTypeOf, it } from "vitest";
import * as RunnerNamespace from "../src/index.js";

// -----------------------------------------------------------------------------
// Source-contract imports — straight from `src/types.ts`.
//
// These prove the *source of truth* carries every locked field /
// every locked union shape. The public-entry positive gate below
// proves the *package entry* (`src/index.ts`) re-exports them all
// identity-preserving.
// -----------------------------------------------------------------------------

import type {
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
} from "../src/types.js";

// -----------------------------------------------------------------------------
// Public-entry imports — straight from `src/index.ts`.
//
// Aliased to `Index<Name>` so the positive public-entry gate (round-2
// cleanup on Step 2) can `toEqualTypeOf` against the source-contract
// types and prove the re-export bridge is identity-preserving. A
// future edit that breaks `src/index.ts`'s `export type { ... }`
// block trips this gate immediately — without it, the source-contract
// checks would stay green even with a broken public surface.
// -----------------------------------------------------------------------------

import type {
  AuditAdapter as IndexAuditAdapter,
  AuditEntry as IndexAuditEntry,
  DiffSeverity as IndexDiffSeverity,
  ErrorClassification as IndexErrorClassification,
  InputAdapter as IndexInputAdapter,
  MigrationEntry as IndexMigrationEntry,
  MigrationRegistry as IndexMigrationRegistry,
  OutputAdapter as IndexOutputAdapter,
  PlanNote as IndexPlanNote,
  PreFlightFailure as IndexPreFlightFailure,
  PreFlightOpts as IndexPreFlightOpts,
  PreFlightResult as IndexPreFlightResult,
  PreFlightSuccess as IndexPreFlightSuccess,
  Registry as IndexRegistry,
  ResumeCursor as IndexResumeCursor,
  RunFailure as IndexRunFailure,
  RunMode as IndexRunMode,
  RunOpts as IndexRunOpts,
  RunResult as IndexRunResult,
  RunSuccess as IndexRunSuccess,
  RunnerOptions as IndexRunnerOptions,
} from "../src/index.js";

// =============================================================================
// Public-surface presence
// =============================================================================

describe("@nekostack/migrate-runner — Step 2 type surface", () => {
  it("re-exports every locked type from the package entry", () => {
    // `import * as` over a type-only re-export only gives us types,
    // not runtime values. The assertion at compile time is enough.
    type Index = typeof RunnerNamespace;
    expectTypeOf<Index>().toHaveProperty("PACKAGE_NAME");
    // Type-only re-exports don't appear on the runtime namespace,
    // so the structural check below uses direct imports instead.
    expectTypeOf<RunnerOptions>().toBeObject();
    expectTypeOf<RunOpts>().toBeObject();
    expectTypeOf<RunResult>().not.toBeAny();
    expectTypeOf<RunSuccess>().toBeObject();
    expectTypeOf<RunFailure>().toBeObject();
    expectTypeOf<AuditEntry>().toBeObject();
    expectTypeOf<InputAdapter>().toBeObject();
    expectTypeOf<OutputAdapter>().toBeObject();
    expectTypeOf<AuditAdapter>().toBeObject();
    expectTypeOf<ResumeCursor>().toBeObject();
    expectTypeOf<Registry>().not.toBeAny();
    expectTypeOf<MigrationRegistry>().not.toBeAny();
    expectTypeOf<MigrationEntry>().toBeObject();
  });
});

// =============================================================================
// Public-entry positive gate (round-2 cleanup)
// =============================================================================
//
// Each row asserts `import type X from "../src/index.js"` resolves
// to exactly the same type as `import type X from "../src/types.js"`.
// This proves the public surface (the package entry) re-exports the
// full Step 2 type list identity-preserving — not just that the
// source-of-truth file declares them. A future edit that drops a
// `export type X` line from `src/index.ts` trips this gate.

describe("public-entry re-export gate: every locked type round-trips through `src/index.ts`", () => {
  it("`Registry` and `MigrationRegistry` re-export through the index", () => {
    expectTypeOf<IndexRegistry>().toEqualTypeOf<Registry>();
    expectTypeOf<IndexMigrationRegistry>().toEqualTypeOf<MigrationRegistry>();
    expectTypeOf<IndexMigrationEntry>().toEqualTypeOf<MigrationEntry>();
  });

  it("`RunMode` re-exports through the index", () => {
    expectTypeOf<IndexRunMode>().toEqualTypeOf<RunMode>();
  });

  it("`ErrorClassification` re-exports through the index", () => {
    expectTypeOf<IndexErrorClassification>().toEqualTypeOf<ErrorClassification>();
  });

  it("`InputAdapter` / `OutputAdapter` / `AuditAdapter` re-export through the index", () => {
    expectTypeOf<IndexInputAdapter>().toEqualTypeOf<InputAdapter>();
    expectTypeOf<IndexOutputAdapter>().toEqualTypeOf<OutputAdapter>();
    expectTypeOf<IndexAuditAdapter>().toEqualTypeOf<AuditAdapter>();
  });

  it("`AuditEntry` re-exports through the index", () => {
    expectTypeOf<IndexAuditEntry>().toEqualTypeOf<AuditEntry>();
  });

  it("`ResumeCursor` re-exports through the index", () => {
    expectTypeOf<IndexResumeCursor>().toEqualTypeOf<ResumeCursor>();
  });

  it("`RunnerOptions` re-exports through the index", () => {
    expectTypeOf<IndexRunnerOptions>().toEqualTypeOf<RunnerOptions>();
  });

  it("`RunOpts` re-exports through the index", () => {
    expectTypeOf<IndexRunOpts>().toEqualTypeOf<RunOpts>();
  });

  it("`RunSuccess` / `RunFailure` / `RunResult` re-export through the index", () => {
    expectTypeOf<IndexRunSuccess>().toEqualTypeOf<RunSuccess>();
    expectTypeOf<IndexRunFailure>().toEqualTypeOf<RunFailure>();
    expectTypeOf<IndexRunResult>().toEqualTypeOf<RunResult>();
  });

  it("`PreFlightOpts` / `PreFlightSuccess` / `PreFlightFailure` / `PreFlightResult` re-export through the index (Step 3)", () => {
    expectTypeOf<IndexPreFlightOpts>().toEqualTypeOf<PreFlightOpts>();
    expectTypeOf<IndexPreFlightSuccess>().toEqualTypeOf<PreFlightSuccess>();
    expectTypeOf<IndexPreFlightFailure>().toEqualTypeOf<PreFlightFailure>();
    expectTypeOf<IndexPreFlightResult>().toEqualTypeOf<PreFlightResult>();
  });

  it("`DiffSeverity` / `PlanNote` re-export through the index", () => {
    expectTypeOf<IndexDiffSeverity>().toEqualTypeOf<DiffSeverity>();
    expectTypeOf<IndexPlanNote>().toEqualTypeOf<PlanNote>();
  });
});

// =============================================================================
// Pre-flight types (Step 3)
// =============================================================================

describe("PreFlightOpts carries the locked Step 3 input shape", () => {
  it("has the operand triple + both registries", () => {
    expectTypeOf<PreFlightOpts["schemaRegistry"]>().toEqualTypeOf<Registry>();
    expectTypeOf<PreFlightOpts["migrationRegistry"]>().toEqualTypeOf<MigrationRegistry>();
    expectTypeOf<PreFlightOpts["schemaId"]>().toEqualTypeOf<string>();
    expectTypeOf<PreFlightOpts["fromVersion"]>().toEqualTypeOf<string>();
    expectTypeOf<PreFlightOpts["toVersion"]>().toEqualTypeOf<string>();
  });

  it("`allowCosmeticDrift` is optional with safe default", () => {
    expectTypeOf<PreFlightOpts["allowCosmeticDrift"]>().toEqualTypeOf<
      boolean | undefined
    >();
  });
});

describe("PreFlightResult is a `success`-discriminated union", () => {
  it("narrows to PreFlightSuccess when `result.success === true`", () => {
    type N<R extends PreFlightResult> = R extends { success: true }
      ? R
      : never;
    type N_S = N<Extract<PreFlightResult, { success: true }>>;
    expectTypeOf<N_S>().toEqualTypeOf<PreFlightSuccess>();
  });

  it("narrows to PreFlightFailure when `result.success === false`", () => {
    type N<R extends PreFlightResult> = R extends { success: false }
      ? R
      : never;
    type N_F = N<Extract<PreFlightResult, { success: false }>>;
    expectTypeOf<N_F>().toEqualTypeOf<PreFlightFailure>();
  });

  it("`PreFlightSuccess` carries the locked chain + chain-scoped registry", () => {
    expectTypeOf<PreFlightSuccess["chain"]>().toEqualTypeOf<
      readonly MigrationEntry[]
    >();
    expectTypeOf<PreFlightSuccess["chainScopedRegistry"]>().toEqualTypeOf<
      MigrationRegistry
    >();
    expectTypeOf<PreFlightSuccess["worstSeverity"]>().toEqualTypeOf<
      DiffSeverity | null
    >();
    expectTypeOf<PreFlightSuccess["notes"]>().toEqualTypeOf<
      readonly PlanNote[]
    >();
    expectTypeOf<PreFlightSuccess["versionPath"]>().toEqualTypeOf<
      readonly string[]
    >();
  });

  it("`PreFlightFailure.classification` is always the literal `\"pre_flight_failed\"`", () => {
    expectTypeOf<PreFlightFailure["classification"]>().toEqualTypeOf<
      "pre_flight_failed"
    >();
    expectTypeOf<PreFlightFailure["classification"]>().not.toEqualTypeOf<
      ErrorClassification
    >();
  });
});

// =============================================================================
// Exact unions
// =============================================================================

describe("RunMode is exactly the three locked literals", () => {
  it("equals `validate-only | dry-run | execute`", () => {
    expectTypeOf<RunMode>().toEqualTypeOf<
      "validate-only" | "dry-run" | "execute"
    >();
  });
});

describe("ErrorClassification is exactly the eight locked codes", () => {
  it("equals 5 per-record + 3 run-level codes", () => {
    expectTypeOf<ErrorClassification>().toEqualTypeOf<
      | "input_validation_failed"
      | "transform_threw"
      | "transform_timeout"
      | "output_validation_failed"
      | "persist_failed"
      | "pre_flight_failed"
      | "adapter_init_failed"
      | "cancelled"
    >();
  });
});

// =============================================================================
// RunnerOptions shape (Decision #4)
// =============================================================================

describe("RunnerOptions exposes the locked construction slots", () => {
  it("has schemaRegistry / migrationRegistry / inputAdapter / outputAdapter, optional auditAdapter", () => {
    expectTypeOf<RunnerOptions>().toHaveProperty("schemaRegistry");
    expectTypeOf<RunnerOptions>().toHaveProperty("migrationRegistry");
    expectTypeOf<RunnerOptions>().toHaveProperty("inputAdapter");
    expectTypeOf<RunnerOptions>().toHaveProperty("outputAdapter");
    expectTypeOf<RunnerOptions>().toHaveProperty("auditAdapter");

    expectTypeOf<RunnerOptions["schemaRegistry"]>().toEqualTypeOf<Registry>();
    expectTypeOf<RunnerOptions["migrationRegistry"]>().toEqualTypeOf<MigrationRegistry>();
    expectTypeOf<RunnerOptions["inputAdapter"]>().toEqualTypeOf<InputAdapter>();
    expectTypeOf<RunnerOptions["outputAdapter"]>().toEqualTypeOf<OutputAdapter>();
    // `auditAdapter` is optional, so its property type includes undefined.
    expectTypeOf<RunnerOptions["auditAdapter"]>().toEqualTypeOf<
      AuditAdapter | undefined
    >();
  });
});

// =============================================================================
// RunOpts shape (Decision #4 / #5 / #8 / #9 / #10 / #16)
// =============================================================================

describe("RunOpts carries every field the v0.9 plan locks", () => {
  it("has the locked operand triple + mode", () => {
    expectTypeOf<RunOpts["schemaId"]>().toEqualTypeOf<string>();
    expectTypeOf<RunOpts["fromVersion"]>().toEqualTypeOf<string>();
    expectTypeOf<RunOpts["toVersion"]>().toEqualTypeOf<string>();
    expectTypeOf<RunOpts["mode"]>().toEqualTypeOf<RunMode>();
  });

  it("carries every optional behavior knob from the plan", () => {
    expectTypeOf<RunOpts["allowCosmeticDrift"]>().toEqualTypeOf<
      boolean | undefined
    >();
    expectTypeOf<RunOpts["transformTimeoutMs"]>().toEqualTypeOf<
      number | undefined
    >();
    expectTypeOf<RunOpts["onError"]>().toEqualTypeOf<
      "continue" | "stop" | undefined
    >();
    expectTypeOf<RunOpts["auditBefore"]>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<RunOpts["auditAfter"]>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<RunOpts["resumeFrom"]>().toEqualTypeOf<
      ResumeCursor | undefined
    >();
    expectTypeOf<RunOpts["signal"]>().toEqualTypeOf<AbortSignal | undefined>();
  });

  it("does not lose the literal union on `mode` or `onError`", () => {
    // Make sure `mode` did not get widened to `string` somewhere.
    expectTypeOf<RunOpts["mode"]>().not.toEqualTypeOf<string>();
    type OnErrorNonUndef = Exclude<RunOpts["onError"], undefined>;
    expectTypeOf<OnErrorNonUndef>().toEqualTypeOf<"continue" | "stop">();
  });
});

// =============================================================================
// RunResult narrowing
// =============================================================================

describe("RunResult is a `success`-discriminated union", () => {
  it("narrows to RunSuccess when `result.success === true`", () => {
    // Compile-time narrow check via a conditional type.
    type Narrowed<R extends RunResult> = R extends { success: true }
      ? R
      : never;
    type Narrowed_T = Narrowed<Extract<RunResult, { success: true }>>;
    expectTypeOf<Narrowed_T>().toEqualTypeOf<RunSuccess>();
  });

  it("narrows to RunFailure when `result.success === false`", () => {
    type Narrowed<R extends RunResult> = R extends { success: false }
      ? R
      : never;
    type Narrowed_F = Narrowed<Extract<RunResult, { success: false }>>;
    expectTypeOf<Narrowed_F>().toEqualTypeOf<RunFailure>();
  });

  it("RunSuccess.failureCount is locked at the literal `0`", () => {
    expectTypeOf<RunSuccess["failureCount"]>().toEqualTypeOf<0>();
    expectTypeOf<RunSuccess["failureCount"]>().not.toEqualTypeOf<number>();
  });

  it("RunFailure.classification is exactly the ErrorClassification union", () => {
    expectTypeOf<RunFailure["classification"]>().toEqualTypeOf<ErrorClassification>();
  });
});

// =============================================================================
// AuditEntry shape (Decision #16)
// =============================================================================

describe("AuditEntry carries the locked v0.9 shape", () => {
  it("`__auditSchemaVersion` is the literal `\"1\"`, not widened `string`", () => {
    expectTypeOf<AuditEntry["__auditSchemaVersion"]>().toEqualTypeOf<"1">();
    expectTypeOf<AuditEntry["__auditSchemaVersion"]>().not.toEqualTypeOf<
      string
    >();
  });

  it("has every locked field", () => {
    expectTypeOf<AuditEntry>().toHaveProperty("runId");
    expectTypeOf<AuditEntry>().toHaveProperty("schemaId");
    expectTypeOf<AuditEntry>().toHaveProperty("fromVersion");
    expectTypeOf<AuditEntry>().toHaveProperty("toVersion");
    expectTypeOf<AuditEntry>().toHaveProperty("chainEntries");
    expectTypeOf<AuditEntry>().toHaveProperty("recordIndex");
    expectTypeOf<AuditEntry>().toHaveProperty("recordKey");
    expectTypeOf<AuditEntry>().toHaveProperty("status");
    expectTypeOf<AuditEntry>().toHaveProperty("classification");
    expectTypeOf<AuditEntry>().toHaveProperty("errorMessage");
    expectTypeOf<AuditEntry>().toHaveProperty("before");
    expectTypeOf<AuditEntry>().toHaveProperty("after");
    expectTypeOf<AuditEntry>().toHaveProperty("timestamp");
  });

  it("`status` is exactly `success | failure`", () => {
    expectTypeOf<AuditEntry["status"]>().toEqualTypeOf<"success" | "failure">();
  });

  it("`classification`, `errorMessage`, `before`, `after`, `recordKey` are optional (allow undefined)", () => {
    expectTypeOf<AuditEntry["classification"]>().toEqualTypeOf<
      ErrorClassification | undefined
    >();
    expectTypeOf<AuditEntry["errorMessage"]>().toEqualTypeOf<
      string | undefined
    >();
    expectTypeOf<AuditEntry["recordKey"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<AuditEntry["before"]>().toEqualTypeOf<unknown>();
    expectTypeOf<AuditEntry["after"]>().toEqualTypeOf<unknown>();
  });
});

// =============================================================================
// Adapter method names (Decision #17)
// =============================================================================

describe("Adapter interfaces expose the locked method names", () => {
  it("InputAdapter has `stream(): AsyncIterable<T>`", () => {
    expectTypeOf<InputAdapter<number>>().toHaveProperty("stream");
    expectTypeOf<InputAdapter<number>["stream"]>().toEqualTypeOf<
      () => AsyncIterable<number>
    >();
  });

  it("OutputAdapter has `persist(record): Promise<void>` + optional `flush`", () => {
    expectTypeOf<OutputAdapter<number>>().toHaveProperty("persist");
    expectTypeOf<OutputAdapter<number>["persist"]>().toEqualTypeOf<
      (record: number) => Promise<void>
    >();
    expectTypeOf<OutputAdapter<number>["flush"]>().toEqualTypeOf<
      (() => Promise<void>) | undefined
    >();
  });

  it("AuditAdapter has `append(entry): Promise<void>` + `cursor(runId): Promise<readonly number[]>`", () => {
    expectTypeOf<AuditAdapter>().toHaveProperty("append");
    expectTypeOf<AuditAdapter["append"]>().toEqualTypeOf<
      (entry: AuditEntry) => Promise<void>
    >();
    expectTypeOf<AuditAdapter>().toHaveProperty("cursor");
    expectTypeOf<AuditAdapter["cursor"]>().toEqualTypeOf<
      (runId: string) => Promise<readonly number[]>
    >();
  });
});

// =============================================================================
// ResumeCursor
// =============================================================================

describe("ResumeCursor wraps a `runId` only", () => {
  it("has the `runId` field", () => {
    expectTypeOf<ResumeCursor>().toHaveProperty("runId");
    expectTypeOf<ResumeCursor["runId"]>().toEqualTypeOf<string>();
  });
});

// =============================================================================
// Negative gate — no `apply` / `rollback` / `reverse` type leaks in
// =============================================================================
//
// Each row uses `@ts-expect-error` to suppress the "type does not
// exist" error. The directive is REQUIRED; the moment the named type
// starts to exist on the namespace, the directive becomes unused and
// `tsc --noEmit` fails the typecheck. Same negative-gate trick used
// by the v0.7 / v0.8 public-surface tests in the schema package.

describe("@nekostack/migrate-runner — negative type-surface gate", () => {
  it("no `Apply` type is exported", () => {
    // @ts-expect-error — v0.9 contract has no `Apply` runtime type.
    type _Apply = RunnerNamespace.Apply;
    type _Used = _Apply;
    void {} as unknown as _Used;
  });

  it("no `ApplyMigration` type is exported", () => {
    // @ts-expect-error — v0.9 contract has no `ApplyMigration` type.
    type _ApplyMigration = RunnerNamespace.ApplyMigration;
    type _Used = _ApplyMigration;
    void {} as unknown as _Used;
  });

  it("no `Rollback` type is exported", () => {
    // @ts-expect-error — v0.9 forward-only contract has no rollback.
    type _Rollback = RunnerNamespace.Rollback;
    type _Used = _Rollback;
    void {} as unknown as _Used;
  });

  it("no `RollbackMigration` type is exported", () => {
    // @ts-expect-error — v0.9 forward-only contract.
    type _RollbackMigration = RunnerNamespace.RollbackMigration;
    type _Used = _RollbackMigration;
    void {} as unknown as _Used;
  });

  it("no `Reverse` type is exported", () => {
    // @ts-expect-error — v0.9 forward-only contract.
    type _Reverse = RunnerNamespace.Reverse;
    type _Used = _Reverse;
    void {} as unknown as _Used;
  });

  it("no `ReverseMigration` type is exported", () => {
    // @ts-expect-error — v0.9 forward-only contract.
    type _ReverseMigration = RunnerNamespace.ReverseMigration;
    type _Used = _ReverseMigration;
    void {} as unknown as _Used;
  });
});
