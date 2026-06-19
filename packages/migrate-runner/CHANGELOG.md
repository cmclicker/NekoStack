# `@nekostack/migrate-runner` — Changelog

Per-milestone changes. Pairs with git tags (`migrate-runner-vX.Y.Z`) and [GitHub releases](https://github.com/cmclicker/NekoStack/releases). Format: newest first.

---

## migrate-runner-v1.0.0 — 2026-06-19

[Tag](https://github.com/cmclicker/NekoStack/releases/tag/migrate-runner-v1.0.0) · Published to npm as `@nekostack/migrate-runner` (Apache-2.0). First public release.

### What changed from v0.1.0

- Bumped to public v1.0.0; `private: false`, `license: "Apache-2.0"`.
- `@nekostack/schema` pinned to `^1.0.0` (peer dep, now on npm).
- Full purity suite confirmed at 405 passing (11 test files).

### API

Public surface is unchanged from v0.1.0. See the v0.1.0 entry for the full contract description.

### Test count

- 405 passing

---

## migrate-runner-v0.1.0 — 2026-05-21

[Tag](https://github.com/cmclicker/NekoStack/releases/tag/migrate-runner-v0.1.0) · merge commit [`53c0ba5`](https://github.com/cmclicker/NekoStack/commit/53c0ba57d73061f50d52fd6bc028063f0d4e8e0f). Schema-data migration runner library — the downstream package that executes authored migrations against real records. First release; ships the library surface only (no CLI).

### Shipped

- **`createMigrationRunner(options).run(opts)`** — the orchestrator. Wires pre-flight → input-stream walk → per-record pipeline → audit → optional output persist + flush. Returns a `RunResult` (never throws for operational failures). Handle exposes the `auditAdapter` for inspection.
- **`preFlight(opts)`** — pure chain resolver + chain-scoped provenance verifier. Calls `planMigrationHandler` + builds a chain-scoped `MigrationRegistry` + calls `verifyMigrationsHandler` on it (Decision #5/#15 — never workspace-wide-then-filter). Refuses on anything but `bound` (or `bound` / `cosmetic_drift` with `allowCosmeticDrift: true`; default strict). Never calls a migration's `transform`.
- **`runRecordPipeline(opts)`** — per-record `validate-input → chain transforms → validate-output`. **The only function in the package allowed to call `migration.transform(...)`.** Post-hoc `transformTimeoutMs` semantics (Decision #8 — measured after the synchronous transform returns; no preemption).
- **`createMemoryAuditAdapter()` + `makeAuditEntry(opts)`** — in-memory append-only `AuditAdapter` default + an entry constructor enforcing the locked `__auditSchemaVersion: "1"` literal and ISO-8601 timestamp defaulting. Frozen defensive snapshots per append.
- **JSON / JSONL reference adapters** — `createJsonFileInputAdapter`, `createJsonFileOutputAdapter`, `createJsonlAuditAdapter`.
- **Three modes** — `validate-only`, `dry-run`, `execute`.
- **Resume** — `resumeFrom: { runId }` skips records already marked `success`.
- **Cancellation** — `AbortSignal` checked pre-stream and between records.
- **Partial failure** — `onError: "continue"` (default) or `"stop"`.

### Runtime purity boundaries

Enforced by `tests/purity.test.ts`:

- `.transform(` lives **only** in `src/per-record-pipeline.ts`.
- `fs` / `node:fs` imports live **only** under `src/adapters/*`.
- **No** imports from `@nekostack/cli`.
- **No** `console.*`, `process.exit/abort`, or `process.std{out,err}.write` in any source file.

### Test count

- 405 passing
