# `@nekostack/migrate-runner` — Changelog

Per-milestone changes. Pairs with the git tags (`migrate-runner-vX.Y.Z`) and the [GitHub releases](https://github.com/cmclicker/NekoStack/releases). Format: newest first.

This package is workspace-internal (`private: true`, version `0.0.0`). The milestone identifiers are git/release markers, not npm publications.

---

## migrate-runner-v0.1.0 — 2026-05-21

[Tag](https://github.com/cmclicker/NekoStack/releases/tag/migrate-runner-v0.1.0) · merge commit [`53c0ba5`](https://github.com/cmclicker/NekoStack/commit/53c0ba57d73061f50d52fd6bc028063f0d4e8e0f). Schema-data migration runner library — the downstream package that executes authored migrations against real records. First release; ships the library surface only (no CLI).

### Shipped

- **`createMigrationRunner(options).run(opts)`** — the orchestrator. Wires pre-flight → input-stream walk → per-record pipeline → audit → optional output persist + flush. Returns a `RunResult` (never throws for operational failures). Handle exposes the `auditAdapter` for inspection.
- **`preFlight(opts)`** — pure chain resolver + chain-scoped provenance verifier. Calls `planMigrationHandler` + builds a chain-scoped `MigrationRegistry` + calls `verifyMigrationsHandler` on it (Decision #5/#15 — never workspace-wide-then-filter). Refuses on anything but `bound` (or `bound` / `cosmetic_drift` with `allowCosmeticDrift: true`; default strict). Never calls a migration's `transform`.
- **`runRecordPipeline(opts)`** — per-record `validate-input → chain transforms → validate-output`. **The only function in the package allowed to call `migration.transform(...)`.** Post-hoc `transformTimeoutMs` semantics (Decision #8 — measured after the synchronous transform returns; no preemption).
- **`createMemoryAuditAdapter()` + `makeAuditEntry(opts)`** — in-memory append-only `AuditAdapter` default + an entry constructor enforcing the locked `__auditSchemaVersion: "1"` literal and ISO-8601 timestamp defaulting. Frozen defensive snapshots per append.
- **JSON / JSONL reference adapters** — `createJsonFileInputAdapter` (reads `T[]` or `{ records: T[] }`, lazy stream-time parsing), `createJsonFileOutputAdapter` (buffers in memory, writes a JSON array on `flush()`, `mkdir -p`, deterministic repeated flush), `createJsonlAuditAdapter` (append-only JSONL; tolerates blank lines; missing file → empty cursor; **fails loud on malformed audit-entry shape** during `cursor(runId)` via a runtime validator).
- **Locked v0.9 type surface** — `RunnerOptions`, `RunOpts`, `RunMode`, `RunResult` / `RunSuccess` (`failureCount` literal `0`) / `RunFailure`, `ErrorClassification` (5 per-record + 3 run-level), `AuditEntry`, `InputAdapter` / `OutputAdapter` / `AuditAdapter`, `MemoryAuditAdapter`, `MigrationRunner`, `ResumeCursor`, the four `PreFlight*` shapes, and the four `PerRecordPipeline*` shapes.
- **Three modes** (Decision #9) — `validate-only` (pre-flight-only in v0.9; stream not consumed; **no audit entries written**), `dry-run` (transform + audit, no persist), `execute` (transform + audit + persist + flush, flush only after natural stream end).
- **Resume** (Decision #10) — `resumeFrom: { runId }` reuses the prior `runId` and calls `auditAdapter.cursor(runId)` to skip every record-index already marked `success` for that run (failed records are re-attempted).
- **Cancellation** (Decision #8) — `AbortSignal` checked pre-stream and between records only; never interrupts an in-flight synchronous transform.
- **Partial failure** (Decision #10) — `onError: "continue"` (default) records the failure and proceeds; `"stop"` aborts on first failure. Any per-record failure flips the whole `RunResult` to `RunFailure`.

### Runtime boundaries (purity gate)

Enforced by [`tests/purity.test.ts`](tests/purity.test.ts) (129 rows, the canonical package-wide authority):

- `.transform(` lives **only** in `src/per-record-pipeline.ts`.
- `fs` / `node:fs[/...]` imports live **only** under `src/adapters/*`.
- **No** imports from `@nekostack/cli` (the runner is an architectural peer, not a dependent).
- **No** `console.*`, `process.exit/abort`, or `process.std{out,err}.write` in any source file — writers are always injected.

### New contract docs

- [`README.md`](README.md) — package overview, position in the stack, public API, modes, non-goals, JSON/JSONL usage example, resume semantics.
- [`docs/RUNNER.md`](docs/RUNNER.md) — full contract: every v0.9 plan decision mapped to its implementation site, pre-flight / per-record pipeline / orchestrator semantics, the `AuditEntry` contract, adapter interfaces, error classification table, `RunResult` shape notes, the seven purity boundaries, and the locked non-goals.

### Dependency changes

- New workspace package `@nekostack/migrate-runner` (`private: true`, `0.0.0`). Declares `@nekostack/schema: "*"` as a normal **dependency** (not a peer). **No** `@nekostack/cli` dependency. No new third-party runtime deps.

### Test count

- 405 passing (new package: 11 test files including pre-flight, per-record pipeline, audit, orchestrator, three reference adapters, end-to-end matrix, package-wide purity gate, and 57 type-level rows). `@nekostack/schema` (1292) and `@nekostack/cli` (504) unchanged — this release touched neither package.

### Still deferred

- **Steps 11–12 — optional thin runner CLI** under this package's own `bin`. Deferred to v0.1.X+. No CLI ships in v0.1.0.
- **Database / non-file adapters** — reference JSON / JSONL adapters only in v0.1; DB adapters deferred to v0.1.X+.
- **Rollback / reverse migrations** — forward-only by design (Decision #11).
- **Transform preemption / cancellation of an in-flight transform** — Decision #8 is locked; `transformTimeoutMs` is post-hoc measurement only.
- **Worker / thread / subprocess isolation** — in-process, single-thread (Decision #7).

### Locked non-additions

- **No** `neko schema migrate apply` verb was added — the schema CLI stays at `list / plan / verify / stub`.
- **No** schema-package execution behavior was added — `@nekostack/schema` remains planning + verification + stub generation only.
- **No** `@nekostack/cli` dependency was added.
