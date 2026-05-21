# @nekostack/migrate-runner

> Downstream orchestrator that **executes** authored schema-data migrations against real records. The single package in the workspace allowed to call `migration.transform(input)`. `@nekostack/schema` and `@nekostack/cli` stay pure.

## Quick reference

| | |
|---|---|
| **Position** | Downstream of [`@nekostack/schema`](../schema/README.md) and [`@nekostack/cli`](../cli/README.md). Architectural **peer** to the CLI, not a dependent. |
| **What it does** | Walks a record stream through a chain-scoped migration plan, calls each migration's `transform(input)` per record, persists outputs, and writes an append-only audit log. |
| **What it does NOT do** | Rollback. Preempt sync transforms. Provide DB adapters in v0.1. Add a fifth `neko schema migrate *` verb. Widen `@nekostack/schema`'s `Migration` type. |
| **Plan** | [`packages/schema/docs/PHASE_PLAN_v0.9.md`](../schema/docs/PHASE_PLAN_v0.9.md) |
| **Contract** | [`docs/RUNNER.md`](./docs/RUNNER.md) |
| **Purity gate** | [`tests/purity.test.ts`](./tests/purity.test.ts) |
| **v0.8 invariants kept in force** | No `apply` verb in schema. No `.transform(` call anywhere in `@nekostack/schema/**` or `@nekostack/cli/**`. |

## Position in the stack

The v0.8 migration contract ([`MIGRATIONS.md`](../schema/docs/MIGRATIONS.md)) ships **planning + verification + stub generation only**. `@nekostack/schema` and `@nekostack/cli` never invoke a migration's `transform`. v0.9 introduces this package — a **separate workspace member** — as the downstream executor.

```
@nekostack/schema   →  Migration<Id, From, To>  type + planMigrationHandler + verifyMigrationsHandler + stubs
@nekostack/cli      →  neko schema migrate {list|plan|verify|stub}   (no apply, no execute)
@nekostack/migrate-runner   →  invokes migration.transform(input) per record
```

The runner consumes the read-only [`@nekostack/schema/cli`](../schema/src/cli-integration.ts) subpath. It does **not** import from [`@nekostack/cli`](../cli/README.md); the static purity gate in [`tests/purity.test.ts`](./tests/purity.test.ts) enforces that boundary.

## Public API

Re-exported from [`src/index.ts`](./src/index.ts):

| Export | Kind | Purpose |
|---|---|---|
| [`createMigrationRunner`](./src/runner.ts) | factory | Returns `MigrationRunner` with `auditAdapter` + `run(opts): Promise<RunResult>`. The orchestrator. |
| [`preFlight`](./src/pre-flight.ts) | function | Pure chain resolver + chain-scoped provenance verifier. Never calls a migration's `transform`. |
| [`runRecordPipeline`](./src/per-record-pipeline.ts) | function | Per-record `validate-input → transforms → validate-output`. The **ONE** function allowed to call `migration.transform(...)`. |
| [`createMemoryAuditAdapter`](./src/audit.ts) | factory | Default in-memory `AuditAdapter`. Append-only; frozen snapshots. |
| [`makeAuditEntry`](./src/audit.ts) | constructor | Constructs an `AuditEntry` with `__auditSchemaVersion: "1"` and ISO-8601 timestamp defaulting. |
| [`createJsonFileInputAdapter`](./src/adapters/json-file-input.ts) | factory | Reference `InputAdapter` reading `T[]` or `{ records: T[] }` from a JSON file. |
| [`createJsonFileOutputAdapter`](./src/adapters/json-file-output.ts) | factory | Reference `OutputAdapter` buffering records in memory; writes a JSON array on `flush()`. |
| [`createJsonlAuditAdapter`](./src/adapters/jsonl-audit.ts) | factory | Reference `AuditAdapter` appending one JSON object per line to a `.jsonl` file. Runtime-validates each line on `cursor(runId)`. |

Plus type-only re-exports: `RunnerOptions`, `RunOpts`, `RunMode`, `RunResult` / `RunSuccess` / `RunFailure`, `ErrorClassification`, `AuditEntry`, `InputAdapter` / `OutputAdapter` / `AuditAdapter`, `MemoryAuditAdapter`, `MigrationRunner`, `ResumeCursor`, the four `PreFlight*` shapes, and the four `PerRecordPipeline*` shapes. Full list and contract in [`docs/RUNNER.md`](./docs/RUNNER.md).

## Modes

Three modes, locked at the v0.9 plan (Decision #9). Documented in full in [`docs/RUNNER.md`](./docs/RUNNER.md#modes).

| Mode | Pre-flight | Stream walk | `transform()` | Persist | Flush | Audit per record |
|---|---|---|---|---|---|---|
| `validate-only` | yes | **no** | no | no | no | **no** (no records walked) |
| `dry-run` | yes | yes | yes | **no** | no | yes |
| `execute` | yes | yes | yes | yes | yes (after natural end) | yes |

**`validate-only` is pre-flight-only in v0.9.** It returns a `RunSuccess` with `recordCount: 0` after pre-flight passes. The locked interpretation is documented inline in [`src/runner.ts`](./src/runner.ts) and reinforced in [`docs/RUNNER.md`](./docs/RUNNER.md).

## What's not in scope (v0.1)

- **No rollback.** Forward-only by design. Failed runs are audited; rollback is the caller's concern.
- **No transform preemption.** `transformTimeoutMs` is wall-clock measurement **after** the synchronous transform returns. The runner does not interrupt a running transform; `AbortSignal` is checked only **before each record and between records** (Decision #8).
- **No DB adapters.** JSON / JSONL reference adapters only. Database adapters are deferred to v0.1.X+.
- **No CLI under `neko schema migrate *`.** If a thin CLI ever lands, it ships in this package's own `bin`.
- **No worker / thread / subprocess isolation.** In-process, single-thread (Decision #7).

Resume semantics are documented in [`docs/RUNNER.md`](./docs/RUNNER.md#resume-semantics): supply `resumeFrom: { runId }` and the orchestrator calls `auditAdapter.cursor(runId)` to skip every record-index already marked `success` for that run. The original `runId` is reused.

## Usage

Reference example using the JSON file input/output adapters and the JSONL audit log:

```ts
import {
  createMigrationRunner,
  createJsonFileInputAdapter,
  createJsonFileOutputAdapter,
  createJsonlAuditAdapter,
} from "@nekostack/migrate-runner";
import { buildRegistry, buildMigrationRegistry } from "@nekostack/schema/cli";

// 1. Construct schema + migration registries (caller's responsibility).
const schemaRegistry = buildRegistry(/* ... */);
const migrationRegistry = buildMigrationRegistry(/* ... */);

// 2. Wire adapters.
const runner = createMigrationRunner({
  schemaRegistry,
  migrationRegistry,
  inputAdapter: createJsonFileInputAdapter("./data/users.v1.json"),
  outputAdapter: createJsonFileOutputAdapter("./data/users.v3.json"),
  auditAdapter: createJsonlAuditAdapter("./data/users.audit.jsonl"),
});

// 3. Execute.
const result = await runner.run({
  schemaId: "com.x.User",
  fromVersion: "1.0.0",
  toVersion: "3.0.0",
  mode: "execute",
  onError: "continue",
});

if (result.success) {
  console.log(`migrated ${result.successCount}/${result.recordCount} records`);
} else {
  // Branch on result.classification — see docs/RUNNER.md "Error classifications".
  console.error(`${result.classification}: ${result.errorMessage}`);
}
```

To resume a prior run that left some records unmigrated, pass `resumeFrom`:

```ts
const result = await runner.run({
  schemaId: "com.x.User",
  fromVersion: "1.0.0",
  toVersion: "3.0.0",
  mode: "execute",
  resumeFrom: { runId: "<priorRunId>" },
});
```

For the full per-mode dispatch, per-record pipeline, audit-entry shape, error classifications, and the locked purity boundaries, see [`docs/RUNNER.md`](./docs/RUNNER.md).

## Status

- v0.1 candidate currently in PR [#31](https://github.com/cmclicker/NekoStack/pull/31) on the audit-gated step cadence locked by [`PHASE_PLAN_v0.9.md`](../schema/docs/PHASE_PLAN_v0.9.md).
- Steps 1–9 shipped (scaffold, types, pre-flight, per-record pipeline, audit, orchestrator, reference adapters, end-to-end tests, package-wide purity gates).
- Step 10 is this docs landing.
- Optional CLI (Steps 11–12) and post-merge tag / release (Steps 13–15) follow.

Cross-references:

- v0.9 plan: [`packages/schema/docs/PHASE_PLAN_v0.9.md`](../schema/docs/PHASE_PLAN_v0.9.md)
- v0.8 migration contract (what this package consumes): [`packages/schema/docs/MIGRATIONS.md`](../schema/docs/MIGRATIONS.md)
- Package-wide purity gate: [`tests/purity.test.ts`](./tests/purity.test.ts)
- Full runner contract: [`docs/RUNNER.md`](./docs/RUNNER.md)
