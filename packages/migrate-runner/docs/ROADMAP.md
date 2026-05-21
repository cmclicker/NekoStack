# @nekostack/migrate-runner — Roadmap

Authoritative source for "what ships when" for the runner package. The full design rationale lives in the package [`README.md`](../README.md) and the contract in [`docs/RUNNER.md`](./RUNNER.md); this file is the operational checklist.

This package is the downstream executor for the v0.8 schema-data migration contract ([`../../schema/docs/MIGRATIONS.md`](../../schema/docs/MIGRATIONS.md)). It is a peer to [`@nekostack/cli`](../../cli), not a dependent, and it never touches `@nekostack/schema`'s source.

## v0.1 — Schema-data migration runner library

Status: **shipped** ([#31](https://github.com/cmclicker/NekoStack/pull/31), merged 2026-05-21 at [`53c0ba5`](https://github.com/cmclicker/NekoStack/commit/53c0ba57d73061f50d52fd6bc028063f0d4e8e0f)). Plan: [`../../schema/docs/PHASE_PLAN_v0.9.md`](../../schema/docs/PHASE_PLAN_v0.9.md). Contract: [`RUNNER.md`](./RUNNER.md). Tagged as [`migrate-runner-v0.1.0`](https://github.com/cmclicker/NekoStack/releases/tag/migrate-runner-v0.1.0); [GitHub release](https://github.com/cmclicker/NekoStack/releases/tag/migrate-runner-v0.1.0) published.

The downstream runner that **executes** authored migrations — the first and only workspace member allowed to call `migration.transform(input)`. Library surface only; no CLI in v0.1.

Ships:

- **`createMigrationRunner(options).run(opts)`** orchestrator — pre-flight → input-stream walk → per-record pipeline → audit → optional persist + flush. Returns `RunResult`; never throws for operational failures.
- **`preFlight`** — pure chain resolver + chain-scoped provenance verifier (Decision #5/#15). Strict `allowCosmeticDrift: false` default.
- **`runRecordPipeline`** — the only `.transform(` call site. Post-hoc `transformTimeoutMs` (Decision #8).
- **Audit** — `createMemoryAuditAdapter` (default, append-only) + `makeAuditEntry` (`__auditSchemaVersion: "1"`).
- **Reference adapters** — `createJsonFileInputAdapter`, `createJsonFileOutputAdapter`, `createJsonlAuditAdapter` (JSON / JSONL only).
- **Three modes** — `validate-only` (pre-flight-only; no audit), `dry-run` (transform + audit, no persist), `execute` (transform + audit + persist + flush).
- **Resume** (cursor over `success`-status indexes), **cancellation** (`AbortSignal` before/between records only), **partial failure** (`onError: continue` / `stop`).
- **Purity gate** — [`../tests/purity.test.ts`](../tests/purity.test.ts) (129 rows): `.transform(` only in `per-record-pipeline.ts`; fs only under `adapters/`; no `@nekostack/cli` import; no console/process/stdio.

Explicitly **not** shipped in v0.1:

- **No thin runner CLI** (Steps 11–12 of the v0.9 plan — deferred to v0.1.X+).
- **No database / non-file adapters** — JSON / JSONL reference adapters only.
- **No rollback / reverse migrations** — forward-only (Decision #11).
- **No transform preemption** — `transformTimeoutMs` is post-hoc only (Decision #8).
- **No worker / thread / subprocess isolation** — in-process, single-thread (Decision #7).
- **No `neko schema migrate apply` verb**, **no** schema-package execution behavior, **no** `@nekostack/cli` dependency.

405 tests (11 files incl. 57 type-level rows). `@nekostack/schema` (1292) and `@nekostack/cli` (504) unchanged.

## v0.1.X+ — Optional runner CLI + adapter expansion ← *active target*

Status: **not started.** No implementation work, no phase plan, no PR. This is a planning placeholder only — the active-target marker exists so the workspace status surface (`docs/STATUS.md`) has a non-empty pointer; it does NOT mean v0.1.X is in motion.

Likely focus areas (planning placeholder only — none committed to a phase plan; each requires its own thesis-fit audit before any implementation lands):

- **Thin runner CLI** (the deferred v0.9 Steps 11–12) — a `bin` in *this* package that maps the runner's internal `ErrorClassification` set to the locked v0.7 exit-code enum. **Never** a fifth verb under `neko schema migrate *` (Decision #18). Would need its own argv / help / `--json` envelope / release-surface work.
- **Database / non-file adapters** — concrete `InputAdapter` / `OutputAdapter` / `AuditAdapter` implementations beyond the JSON / JSONL reference set, each behind its own adapter-shape PR.

The v0.1 runtime boundaries remain in force regardless of what v0.1.X picks up: `.transform(` only in `per-record-pipeline.ts`, fs only under `adapters/`, no `@nekostack/cli` import, no console/process/stdio in source, forward-only, no transform preemption.
