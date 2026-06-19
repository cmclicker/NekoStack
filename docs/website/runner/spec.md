# Runner Contract (v0.1)

> The v0.9-locked behavior of `@nekostack/migrate-runner` — package boundary, pre-flight semantics, per-record pipeline, mode dispatch, resume semantics, audit-entry shape, adapter interfaces, error classifications, and the static purity boundaries. Pairs with [`PHASE_PLAN_v0.9.md`](../../schema/docs/PHASE_PLAN_v0.9.md); the plan locks the decisions, this file documents the contract that resulted.

## Hard-locked package boundary

v0.1 of `@nekostack/migrate-runner` ships migration **execution** only. It does **NOT**:

- Add a `neko schema migrate apply` verb (Decision #2). `@nekostack/cli` stays at four verbs: `list` / `plan` / `verify` / `stub`.
- Make `@nekostack/schema` execute transforms (Decision #3). The v0.8 schema-side purity gate ([`packages/schema/tests/migrations/handler-purity.test.ts`](../../schema/tests/migrations/handler-purity.test.ts)) remains in force.
- Import from `@nekostack/cli`. The runner is an architectural **peer** to the CLI (Decision #1). Cross-cutting scan in [`tests/purity.test.ts`](../tests/purity.test.ts) gate #5 enforces this.
- Widen `@nekostack/schema`'s `Migration` type. The runner uses a loose `AnyMigration` and runtime-validates input + output per record via the schema package's `parse`.
- Provide rollback or DB adapters (Decisions #11 + #17). v0.1 ships JSON / JSONL reference adapters only.

The runner is the **first** workspace member allowed to:

- Invoke `migration.transform(input)`. Confined to [`src/per-record-pipeline.ts`](../src/per-record-pipeline.ts); gate #2 enforces.
- Import `node:fs/promises`. Confined to [`src/adapters/`](../src/adapters/); gate #3 enforces.

Every other `src/**/*.ts` file is `.transform(`-free and fs-free.

---

## Plan-time decisions → implementation map

The 18 v0.9 plan decisions plus the five resolved OQs map to runner source as follows.

| # | Decision | Where it lives |
|---|---|---|
| 1 | Separate `@nekostack/migrate-runner` package | This workspace ([`package.json`](../package.json)) |
| 2 | No fifth `neko schema migrate apply` verb | `@nekostack/cli` unchanged; this package owns no `bin` in v0.1 |
| 3 | `@nekostack/schema` stays pure | Enforced by the v0.8 schema-side gate; runner imports only `@nekostack/schema/cli` |
| 4 | `createMigrationRunner(opts).run(opts)` API shape | [`src/runner.ts`](../src/runner.ts); types in [`src/types.ts`](../src/types.ts) |
| 5 | Chain-scoped pre-flight | [`src/pre-flight.ts`](../src/pre-flight.ts) |
| 6 | Per-record pipeline | [`src/per-record-pipeline.ts`](../src/per-record-pipeline.ts) |
| 7 | In-process, single-thread (v0.1) | No worker / subprocess / thread spawn in any source file |
| 8 | Post-hoc `transformTimeoutMs`; no preemption; `AbortSignal` between records only | [`src/per-record-pipeline.ts`](../src/per-record-pipeline.ts) + [`src/runner.ts`](../src/runner.ts) |
| 9 | Three modes: `validate-only` / `dry-run` / `execute` | [`src/runner.ts`](../src/runner.ts) mode dispatch |
| 10 | `onError: continue` (default) / `stop`; cursor resume | [`src/runner.ts`](../src/runner.ts) |
| 11 | No rollback. Forward-only. | Not implemented; gate-level non-goal |
| 12 | Destructive migrations allowed in dry-run + execute; only execute persists | [`src/runner.ts`](../src/runner.ts) mode dispatch |
| 13 | Sequential per-record `AsyncIterable` input | `InputAdapter.stream()` shape in [`src/types.ts`](../src/types.ts) |
| 14 | 5 per-record + 3 run-level error codes | `ErrorClassification` in [`src/types.ts`](../src/types.ts) |
| 15 | Chain-scoped verify runs immediately before record walk; never workspace-wide-then-filter | [`src/pre-flight.ts`](../src/pre-flight.ts) builds a chain-scoped `MigrationRegistry` |
| 16 | Locked `AuditEntry` with `__auditSchemaVersion: "1"` | `AuditEntry` in [`src/types.ts`](../src/types.ts) + [`makeAuditEntry`](../src/audit.ts) |
| 17 | Three adapter interfaces + JSON/JSONL reference impls | [`src/adapters/`](../src/adapters/) |
| 18 | Optional thin CLI lives in this package's own `bin`, not under `neko schema migrate *` | Deferred to v0.1.X+; not shipped in v0.1 |

Resolved open questions: package name = `@nekostack/migrate-runner`, independent `migrate-runner-v0.1.0` version line, loose `AnyMigration` + per-record `parse`, `__auditSchemaVersion: "1"` from day one, `allowCosmeticDrift` default `false` (strict).

---

## Pre-flight

[`preFlight(opts)`](../src/pre-flight.ts) is the pure pre-walk step. It:

1. Calls `planMigrationHandler` from `@nekostack/schema/cli` to resolve the chain from `fromVersion` to `toVersion` for `schemaId`.
2. Builds a **chain-scoped** `MigrationRegistry` containing only the entries the chain references (Decision #15 — never workspace-wide-then-filter).
3. Calls `verifyMigrationsHandler` on the chain-scoped registry.
4. Returns `PreFlightSuccess { chain }` if every entry verifies as `bound` (or `bound | cosmetic_drift` when `allowCosmeticDrift: true`); otherwise `PreFlightFailure { classification: "pre_flight_failed", errorMessage }`.

`preFlight` is **pure**: no `fs.*`, no `import()`, no `process.*`, no `console.*`. Writers are injected by callers when needed. It never calls a migration's `transform`. The gate file ([`tests/pre-flight.test.ts`](../tests/pre-flight.test.ts)) seeds every fixture with a `poisonTransform()` that throws if called — and never fires.

**`allowCosmeticDrift` defaults to `false`** (strict). This is OQ-5 from the v0.9 plan; the strict default surfaces drifted artifacts before they reach a production migration run.

---

## Per-record pipeline

[`runRecordPipeline(opts)`](../src/per-record-pipeline.ts) is the **only file** in the package allowed to call `.transform(`. The cross-cutting scan in [`tests/purity.test.ts`](../tests/purity.test.ts) gate #2 enforces this with both a positive sentinel (this file MUST contain `.transform(`) and per-file negatives on every other source file.

Per-record steps:

1. **Validate input** against the chain's `from` schema. Failure → `input_validation_failed`.
2. **Walk the chain** in order. For each hop:
   - Start wall-clock.
   - Call `migration.transform(currentValue)` synchronously.
   - Stop wall-clock.
   - If the call threw → `transform_threw` (no later transforms invoked).
   - If `transformTimeoutMs` is set and elapsed > budget → `transform_timeout` (Decision #8 — post-hoc; the runner does NOT preempt a running transform).
3. **Validate output** against the chain's `to` schema. Failure → `output_validation_failed`.
4. Return `PerRecordPipelineSuccess { output }` or `PerRecordPipelineFailure { classification, errorMessage }`.

`PerRecordPipelineFailure.classification` is the locked 4-code subset: `input_validation_failed | transform_threw | transform_timeout | output_validation_failed`. The fifth per-record code (`persist_failed`) belongs to the orchestrator, not the pipeline — the pipeline is data-in / data-out.

Transform-call-count discipline (enforced by tests):

- ≤ 0 calls when input validation fails.
- Exactly N calls for a chain of N when every hop succeeds.
- Stops at the first throw / timeout — later transforms are not invoked.

---

## Runner orchestrator

[`createMigrationRunner(options): MigrationRunner`](../src/runner.ts). The handle exposes:

- `auditAdapter` — the audit sink (defaults to a fresh `createMemoryAuditAdapter()` when none is provided).
- `run(opts): Promise<RunResult>` — the entry point.

`run()` flow:

```
pre-flight
  → empty-chain short-circuit  (RunSuccess { recordCount: 0 }; no audit writes)
  → validate-only short-circuit (RunSuccess { recordCount: 0 }; no audit writes)
  → resume cursor   (auditAdapter.cursor(runId); throw → adapter_init_failed)
  → pre-stream signal check  (if aborted → cancelled, counts all 0)
  → for await record of inputAdapter.stream():
      → between-records signal check  (if aborted → cancelled, counts to here)
      → cursor skip check  (already success on this runId)
      → runRecordPipeline
      → (execute only) outputAdapter.persist
      → auditAdapter.append
      → onError: stop → return RunFailure with first per-record classification
  → (execute only) outputAdapter.flush  (called only after natural stream end)
  → aggregate RunResult
```

Locked behaviors:

- **`runId` generation.** `globalThis.crypto.randomUUID()` per `run()` call; reused on resume (`resumeFrom.runId`).
- **Stream-throw classification.** If the input adapter throws during stream iteration, the run fails as `adapter_init_failed`.
- **Audit cursor-throw classification.** If `auditAdapter.cursor(runId)` throws (e.g. malformed JSONL audit file), the run fails as `adapter_init_failed` (the audit adapter is also an adapter; the runner's contract is to return a `RunResult`, never throw).
- **Flush ordering.** `outputAdapter.flush()` is called **only after the input stream ends naturally** in `execute` mode. `onError: stop` first-failure abort, cancellation, and stream-throw do NOT call flush.
- **First-failure aggregate message.** Per-record-aggregate `RunFailure.classification` is the FIRST per-record failure's classification; `errorMessage` includes `N of M records failed`.

### Modes

| Mode | Pre-flight | Read input | `transform()` | Persist | Flush | Audit per record |
|---|---|---|---|---|---|---|
| `validate-only` | ✓ | **✗** | ✗ | ✗ | ✗ | **✗** |
| `dry-run` | ✓ | ✓ | ✓ | **✗** | ✗ | ✓ |
| `execute` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

**`validate-only` in v0.9 = pre-flight-only.** The stream is not consumed, transforms are not called, and **no audit entries are written**. The locked interpretation lives in [`src/runner.ts`](../src/runner.ts) and is regression-locked by tests in [`tests/runner.test.ts`](../tests/runner.test.ts).

**Empty-chain short-circuit.** When pre-flight resolves a zero-length chain (e.g. `fromVersion == toVersion`), the runner returns `RunSuccess { recordCount: 0 }` without reading the input stream and **without writing any audit entries**. The empty-chain case is genuinely a no-op.

### Partial failure / `onError`

- `onError: "continue"` (default) — failed records are audited; the walk continues to the next record. Aggregate `RunResult` reflects the full record count and the first-failure classification.
- `onError: "stop"` — first per-record failure aborts the run; remaining records are not read. Aggregate `RunFailure` uses the FIRST per-record failure's classification + message naming `N of M records failed`.

Both modes write per-record audit entries up to the abort point. Neither calls `outputAdapter.flush()` on an aborted run.

### Resume semantics

`RunOpts.resumeFrom: { runId }` triggers resume:

1. `runId` is reused (not regenerated).
2. The orchestrator calls `auditAdapter.cursor(runId)` to retrieve the set of `recordIndex` values already marked `success` for that `runId`.
3. The record walk skips those indexes — the input stream is iterated, but skipped records bypass the per-record pipeline.
4. `cursor()` returning only **success-status** indexes is part of the `AuditAdapter` contract: failed records are NOT skipped on resume (so they get re-attempted).
5. Cross-`runId` entries in the audit log are filtered out.
6. If `cursor()` throws (e.g. malformed JSONL audit file), the run fails as `adapter_init_failed`.

### Cancellation

`AbortSignal` is checked:

- **Pre-stream**, before the first record is read. Aborted here → `RunFailure { classification: "cancelled", recordCount: 0, successCount: 0, failureCount: 0 }`.
- **Between records**, after the prior record's audit write completes. Aborted here → `RunFailure { classification: "cancelled" }` with counts reflecting work completed up to the abort.

**It is NOT checked mid-transform.** Synchronous transforms run to completion — Decision #8 explicitly forbids preemption. If a transform never returns, the runner blocks forever. The `transformTimeoutMs` budget is **post-hoc only** (measured after the transform returns) — it classifies a slow transform as `transform_timeout` *after the fact*; it does not interrupt the transform.

---

## `AuditEntry` contract

```ts
interface AuditEntry {
  readonly __auditSchemaVersion: "1";       // literal — version-bumped on shape changes
  readonly runId: string;                    // UUID; reused across resume
  readonly schemaId: string;
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly recordIndex: number;              // 0-based; matches input order
  readonly status: "success" | "failure";
  readonly timestamp: string;                // ISO-8601
  readonly classification?: ErrorClassification;  // present iff status === "failure"
  readonly errorMessage?: string;            // present iff status === "failure"
  readonly before?: unknown;                 // present iff RunOpts.auditBefore === true
  readonly after?: unknown;                  // present iff RunOpts.auditAfter === true (success only)
}
```

Construction:

- [`makeAuditEntry(opts)`](../src/audit.ts) guarantees the `__auditSchemaVersion: "1"` literal and defaults `timestamp` to `new Date().toISOString()`.
- The in-memory adapter ([`createMemoryAuditAdapter`](../src/audit.ts)) returns frozen defensive snapshots from `entries`; individual entry references are stable across calls. Append-only; no replace, no delete.
- The JSONL adapter ([`createJsonlAuditAdapter`](../src/adapters/jsonl-audit.ts)) appends one JSON object per line to a `.jsonl` file. Tolerates blank lines. Missing file → empty cursor. **Fails loud on malformed audit-entry shape** — `cursor(runId)` runtime-validates each line via [`parseAuditEntryLine`](../src/adapters/jsonl-audit.ts): non-null object (not array), `__auditSchemaVersion === "1"`, `runId` string, `status ∈ { success, failure }`, `recordIndex` non-negative integer. Error format: `JSONL audit adapter: malformed entry on line N of <path> — field "<name>" (<detail>).`

Audit is the truth source for resume. A silent shape drift on resume would re-execute already-applied transforms; the runtime validator is the load-bearing defense.

---

## Adapter interfaces

Three adapter interfaces, all in [`src/types.ts`](../src/types.ts). Reference implementations in [`src/adapters/`](../src/adapters/).

```ts
interface InputAdapter<T = unknown> {
  stream(): AsyncIterable<T>;
}

interface OutputAdapter<T = unknown> {
  persist(record: T): void | Promise<void>;
  flush(): void | Promise<void>;
}

interface AuditAdapter {
  append(entry: AuditEntry): void | Promise<void>;
  cursor(runId: string): Promise<readonly number[]>;
}
```

**Reference adapters.** Reference implementations only — DB adapters are deferred to v0.1.X+.

| Adapter | Contract |
|---|---|
| [`createJsonFileInputAdapter`](../src/adapters/json-file-input.ts) | Reads a JSON file. Supports two top-level shapes: a bare array `T[]` and `{ records: T[] }`. Parses lazily at stream time. Throws `adapter_init_failed`-class error on malformed JSON. |
| [`createJsonFileOutputAdapter`](../src/adapters/json-file-output.ts) | Buffers records in memory; writes a single JSON array on `flush()`. **No writes before flush.** `mkdir -p` for the target directory. Deterministic on repeated `flush()`. |
| [`createJsonlAuditAdapter`](../src/adapters/jsonl-audit.ts) | Append-only JSONL. Fails loud on malformed JSON or malformed audit-entry shape during `cursor()`. Blank lines tolerated. Missing file → empty cursor. |

The JSONL adapter is the **only** persistent audit option in v0.1. The in-memory adapter from Step 5 is the default when the caller doesn't supply one — useful for tests and ephemeral runs, not durable.

---

## Error classifications

Locked by Decision #14. Five per-record + three run-level codes.

| Classification | Origin | When | Counts shape on `RunFailure` |
|---|---|---|---|
| `input_validation_failed` | per-record pipeline | record failed `from` schema parse | counts present, `failureCount > 0` |
| `transform_threw` | per-record pipeline | `migration.transform(...)` threw | counts present, `failureCount > 0` |
| `transform_timeout` | per-record pipeline | `transformTimeoutMs` exceeded (post-hoc) | counts present, `failureCount > 0` |
| `output_validation_failed` | per-record pipeline | record failed `to` schema parse | counts present, `failureCount > 0` |
| `persist_failed` | orchestrator | `outputAdapter.persist` or `flush` threw | counts present, `failureCount > 0` |
| `pre_flight_failed` | orchestrator | plan / chain-scoped verify refused | counts **absent** (walk never began) |
| `adapter_init_failed` | orchestrator | input adapter or `auditAdapter.cursor(runId)` threw | counts **absent** (walk never began) |
| `cancelled` | orchestrator | `AbortSignal` fired pre-stream or between records | counts present, `failureCount` MAY be `0` (pre-stream) or `> 0` (mid-walk) |

These map to the locked v0.7 CLI exit-code enum if a thin runner CLI ever lands in v0.1.X+ (Decision #18).

---

## `RunResult` shape notes

```ts
interface RunSuccess {
  readonly success: true;
  readonly runId: string;
  readonly mode: RunMode;
  readonly recordCount: number;
  readonly successCount: number;
  readonly failureCount: 0;          // literal — any per-record failure flips to RunFailure
}

interface RunFailure {
  readonly success: false;
  readonly runId: string;
  readonly mode: RunMode;
  readonly classification: ErrorClassification;
  readonly errorMessage: string;
  readonly recordCount?: number;     // absent for pre_flight_failed / adapter_init_failed
  readonly successCount?: number;
  readonly failureCount?: number;
}
```

- **`RunSuccess.failureCount` is the literal `0`.** Any per-record failure flips the whole result to `RunFailure`. Even an `onError: "continue"` run with one failed record returns `RunFailure`, not `RunSuccess`.
- **`RunFailure.recordCount` / `successCount` / `failureCount` are absent** when the run stopped before the walk began (`pre_flight_failed`, `adapter_init_failed`).
- **Cancellation may include counts with `failureCount: 0`** — pre-stream cancellation has all counts `0`; between-records cancellation has counts reflecting work done up to the abort.
- **Per-record failures have `failureCount > 0`** by construction (this is the per-record-aggregate shape).
- **`failureCount > 0` is NOT a global invariant of `RunFailure`.** Consumers should branch on `classification` to know which observable shape applies. The four shapes are: `pre_flight_failed` (counts absent), `adapter_init_failed` (counts absent), `cancelled` (counts present, `failureCount` MAY be `0`), per-record-aggregate (counts present, `failureCount > 0`).

---

## Purity boundaries

The package-wide source-boundary contract is the canonical authority of [`tests/purity.test.ts`](../tests/purity.test.ts). Seven gates, 129 test rows.

| # | Gate | Locked rule |
|---|---|---|
| 1 | File-inventory sentinel | Exact set of 10 `src/**/*.ts` files. Adding/removing a source file requires updating the sentinel. |
| 2 | Transform execution | `.transform(` lives ONLY in [`src/per-record-pipeline.ts`](../src/per-record-pipeline.ts) (positive + negative assertions). |
| 3 | Filesystem | `fs` / `node:fs[/...]` imports live ONLY under [`src/adapters/`](../src/adapters/). |
| 4 | Console / process / stdio | No `console.*`, `process.exit/abort`, `process.std{out,err}.write` in any source file. Writers are always injected. |
| 5 | CLI-import | No source file imports from `@nekostack/cli`. The runner is a peer to the CLI, not a dependent. |
| 6 | Public entry | [`src/index.ts`](../src/index.ts) specifically (explicit re-statement of #2 + #3 + #5). |
| 7 | Sentinel coverage | Proves the comment-stripper + each scanner pattern positively catch forbidden code AND ignore JSDoc / line-comment prose mentioning the pattern. |

The sentinel-coverage gate (#7) is load-bearing: without it, a future regex tweak that silently weakens the scanner (drops a word boundary, accidentally adds an `i` flag) would let regressions slip through.

`@nekostack/schema/cli` is a **legal** import — explicitly proven in sentinel-coverage row "does NOT match `@nekostack/schema/cli`" — and is the runner's read-only window into the schema package's CLI-integration surface.

---

## Non-goals

Explicit, locked, **out of scope for v0.1**.

- **No rollback.** Forward-only by design (Decision #11). Failed runs are audited; rollback is the caller's concern. A future "reverse migration" notion is not on the v0.9 roadmap.
- **No worker / thread / subprocess isolation.** In-process, single-thread (Decision #7). Workers may land in a later phase; the current contract assumes the host process owns the runner.
- **No transform cancellation / preemption.** `AbortSignal` is checked **only** before each record and between records (Decision #8). `transformTimeoutMs` is **post-hoc wall-clock measurement** — it does NOT interrupt a running transform.
- **No DB adapters.** Only JSON / JSONL reference adapters in v0.1. Database adapters are deferred to v0.1.X+ behind their own adapter-shape PRs.
- **No CLI under `neko schema migrate *`** (Decision #2). If a thin runner CLI ever ships, it lives in this package's own `bin` (Decision #18), not as a fifth verb on the schema CLI.
- **No `@nekostack/schema` `Migration` type widening.** The runner uses `AnyMigration` internally and runtime-validates per record via the schema package's `parse`. The authored `Migration<Id, From, To>` shape from [`MIGRATIONS.md`](../../schema/docs/MIGRATIONS.md) is unchanged.

---

## Cross-references

| Document | Purpose |
|---|---|
| [`packages/schema/docs/PHASE_PLAN_v0.9.md`](../../schema/docs/PHASE_PLAN_v0.9.md) | The v0.9 plan locking every decision documented here |
| [`packages/schema/docs/MIGRATIONS.md`](../../schema/docs/MIGRATIONS.md) | The v0.8 schema-data migration contract this package consumes |
| [`packages/migrate-runner/tests/purity.test.ts`](../tests/purity.test.ts) | Canonical package-wide purity-gate authority |
| [`packages/migrate-runner/src/runner.ts`](../src/runner.ts) | Orchestrator implementation |
| [`packages/migrate-runner/src/pre-flight.ts`](../src/pre-flight.ts) | Pre-flight chain-scoped plan + verify |
| [`packages/migrate-runner/src/per-record-pipeline.ts`](../src/per-record-pipeline.ts) | The ONE file allowed to call `.transform(` |
| [`packages/migrate-runner/src/audit.ts`](../src/audit.ts) | In-memory audit adapter + `makeAuditEntry` |
| [`packages/migrate-runner/src/adapters/`](../src/adapters/) | JSON / JSONL reference adapters |
| [`packages/migrate-runner/src/types.ts`](../src/types.ts) | Locked v0.9 type surface |
| [`packages/migrate-runner/tests/e2e/runner-e2e.test.ts`](../tests/e2e/runner-e2e.test.ts) | End-to-end matrix exercising every locked behavior |
