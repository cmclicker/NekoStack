# Phase Plan: `@nekostack/schema` v0.9 — migration apply / runner safety

> **PLAN only — no code in the PR that lands this doc.**
>
> Reviewed against [`checklists/package/implementation-acceptance.md`](../../../checklists/package/implementation-acceptance.md). Once approved, implementation lands on a separate `feat/...` branch behind its own audit cadence. The plan-only PR can be merged as soon as the audit clears.
>
> **Hard-locked at the start of the plan:** v0.9 introduces the *runner* — the component that actually invokes `migration.transform(input)` against real data. The v0.8 INVARIANTS stay in force unchanged: `@nekostack/schema` itself never calls `transform`, never owns filesystem I/O, never gains an `apply` verb on the `neko schema migrate *` surface. The runner lives **outside** `@nekostack/schema`. This is the load-bearing decision the whole plan is shaped against.
>
> **What "v0.9 = runner" means precisely.** The runner is the orchestrator that walks a `MigrationPlan` (already produced by the v0.8 `planMigrationHandler`) over a stream of records, calling each chain hop's `transform` in order, validating input against the source schema and output against the destination schema, recording an audit trail. Authorship, provenance, registry build, chain resolution, verdict classification, and stub generation are all v0.8 concerns and stay in `@nekostack/schema` (pure) + `@nekostack/cli` (filesystem + tsx loader). v0.9 builds *on top of* the v0.8 contract; it does not modify it.

## Thesis-fit

> v0.9 closes the last half of the schema-data migration workflow: from "I have a plan and verified provenance" to "I have transformed data". The runner makes NekoStack the owner of an end-to-end migration story — authorship (v0.8) → planning (v0.8) → verification (v0.8) → **execution (v0.9)** — without ever letting the foundational `@nekostack/schema` package import data-mutating code.

### Workflow absorbed

Today, with v0.8, a user can:

- author a migration with the locked 9-field provenance header.
- ask the CLI what chain is required to go from `1.0.0` → `2.0.0` (`neko schema migrate plan`).
- verify every authored migration's provenance against the live schema registry (`neko schema migrate verify`).
- generate a skeleton migration file with `neko schema migrate stub`.

But there is no NekoStack-owned answer to "I have a plan + verified migrations — now run them over my v1 records and produce v2 records." Today every consumer either:

- writes a one-off `for (const record of records) { transform(record) }` script with no pre/post validation, no provenance re-check, no audit log;
- gives up and uses a database-DDL migration tool (Prisma, Drizzle, etc.) which doesn't understand schema-data shape changes;
- silently lets unmigrated v1 data leak into a v2 consumer.

v0.9 absorbs the execution half. The author of a migration just writes the `transform`; the runner handles input validation, chain orchestration, output validation, provenance re-check, audit recording, partial-failure resume.

### User-facing surface

The runner exposes a **library API** in a new downstream package, plus an optional thin CLI verb in that same package — **NOT** in `@nekostack/cli`'s `neko schema migrate *` group. The locked `neko schema migrate {list,plan,verify,stub}` surface stays at four verbs forever; an apply verb under that group would visually imply schema-package ownership, which v0.8 hard-locks forbid.

```ts
// Conceptual shape — frozen by Decision #4 below.
import { createMigrationRunner } from "@nekostack/migrate-runner";

const runner = createMigrationRunner({
  schemaRegistry,
  migrationRegistry,
  inputAdapter,   // pluggable: JSON file / SQL / in-memory / …
  outputAdapter,  // same
  auditAdapter,   // pluggable: JSON file / event stream / …
});

const result = await runner.run({
  schemaId: "com.x.Tenant",
  fromVersion: "1.0.0",
  toVersion: "2.0.0",
  mode: "execute", // or "dry-run" / "validate-only"
});
```

## v0.8 invariants that stay in force (unchanged)

| Invariant | v0.9 impact |
|---|---|
| `@nekostack/schema` is pure: no `fs.*`, no `import()`, no `process.*`, no `console.*`, no `.transform(` | **Unchanged.** v0.9 adds no schema-package code paths. |
| `neko schema migrate *` = four verbs: `list / plan / verify / stub` | **Unchanged.** No fifth verb under this group. |
| Root `@nekostack/schema` doesn't export migration internals | **Unchanged.** v0.9 adds nothing to the root surface. |
| v0.8 migration surface only via `@nekostack/schema/cli` | **Unchanged.** The runner imports `AnyMigration`, `MigrationEntry`, `MigrationPlan`, `MigrationRegistry`, `Registry` etc. from `@nekostack/schema/cli`. |
| Forward-only (Decision #2) | **Unchanged.** No reverse runner. No rollback. |
| One `schemaId` per migration (Decision #4) | **Unchanged.** The runner handles a single `schemaId` per run; multi-schema runs are N sequential runner invocations. |
| Append-only (v0.8 INVARIANTS) | **Unchanged.** Migrations are not edited in place; if the schema evolves further, a new migration is authored. |
| Content-addressed by `(fromIrHash, toIrHash)` | **Reinforced.** The runner re-runs `verifyMigrationProvenance` before applying and refuses to run unless all migrations on the chain are `bound`. `cosmetic_drift` is allowed behind an explicit opt-in flag. |
| Master plan Decision #1 — schema owns no filesystem | **Unchanged.** The runner package owns its own filesystem I/O. |

## Locked decisions

### Decision #1 — The runner does NOT live in `@nekostack/schema`.

**Locked.** A new downstream package, working name `@nekostack/migrate-runner`, owns the runner. `@nekostack/schema` continues to ship only pure planning / verification / stub primitives.

Rationale:
- v0.8 INVARIANTS explicitly forbid `migration.transform` execution from `@nekostack/schema`. The runner's whole job is to execute `transform`. If it lives in `@nekostack/schema`, the static-scan gates ([handler-purity.test.ts](../tests/migrations/handler-purity.test.ts) etc.) fail by construction.
- Engine-swap-safety: the root `@nekostack/schema` surface is a long-lived consumer contract. Adding a runner there couples consumers to a runtime they may not want.
- The runner needs adapters (data input, data output, audit). Adapters mean optional peer deps. `@nekostack/schema` keeps its dep tree minimal.

### Decision #2 — The runner does NOT live in `@nekostack/cli` either.

**Locked.** The locked `neko schema migrate {list,plan,verify,stub}` verb set stays at four. No fifth verb. No `neko schema migrate apply`.

Rationale:
- `@nekostack/cli` is the dev-time workspace tool — discovery, planning, freshness, stub generation. It deliberately avoids data-mutating code.
- A CLI verb named `apply` under `schema migrate` would visually suggest schema-package ownership, contradicting Decision #1.
- The runner's CLI surface (if any) lives in its own package, exposed as a separate `bin` (e.g., `neko-migrate-run` or the runner package's own command). Whether `@nekostack/cli` ever proxies to it is a v0.9.X+ question, not this phase.

### Decision #3 — Why `@nekostack/schema` must remain pure.

**Restated and locked.** This is a recap of the master-plan contract — v0.9 changes nothing.

- Master plan Decision #1: schema package is data-in / data-out. Pure handlers; the boundary lives at `@nekostack/cli`.
- Engine-swap-safety: the root surface stays stable so the internal validation engine (Zod today; possibly an IR-walker later) can be swapped without breaking consumers.
- Foundational position: schema sits at the bottom of the dependency graph. Adding runtime concerns there forces every consumer to pay for them.
- v0.8 INVARIANTS lock `.transform(` out of every schema-side module via static-scan gates.

### Decision #4 — Runner library shape (the public API).

**Locked.** The interface below carries **every** option referenced anywhere in this plan; no decision references a field outside this shape.

```ts
export interface RunnerOptions {
  readonly schemaRegistry: Registry;       // from @nekostack/schema/cli
  readonly migrationRegistry: MigrationRegistry;
  readonly inputAdapter:  InputAdapter<unknown>;
  readonly outputAdapter: OutputAdapter<unknown>;
  readonly auditAdapter?: AuditAdapter;     // optional; in-memory default
}

export interface RunOpts {
  readonly schemaId: string;
  readonly fromVersion: string;
  readonly toVersion: string;

  readonly mode: "execute" | "dry-run" | "validate-only";

  /** Allow `cosmetic_drift` to count as `bound` for the pre-flight verify
   *  (Decision #5, #15). Default `false` (strict). */
  readonly allowCosmeticDrift?: boolean;

  /** Per-record best-effort timeout for the synchronous transform call
   *  (Decision #8). v0.9 cannot forcibly interrupt CPU-bound sync code;
   *  this is a soft guard for transforms that yield (microtask boundary,
   *  generator iteration, etc.) or for the surrounding pipeline awaiting
   *  validators. Default `5000`. */
  readonly transformTimeoutMs?: number;

  /** Partial-failure policy (Decision #10). Default `"continue"`. */
  readonly onError?: "continue" | "stop";

  /** Audit retention flags (Decision #16). Default `false` for both —
   *  authors opt in to before/after retention because records can be
   *  large or sensitive. */
  readonly auditBefore?: boolean;
  readonly auditAfter?: boolean;

  /** Resume from a checkpoint produced by a prior run (Decision #10). */
  readonly resumeFrom?: ResumeCursor;

  /** Caller-supplied cancellation (Decision #8) — surfaces a top-level
   *  abort path. Does NOT preempt a synchronous in-flight transform. */
  readonly signal?: AbortSignal;
}

export type RunResult = RunSuccess | RunFailure;
```

- `mode: "validate-only"` runs input validation but does NOT call `transform`. Useful as a CI gate.
- `mode: "dry-run"` runs the full chain INCLUDING `transform` but does NOT call `outputAdapter.persist(...)`. The audit log records the transformed value as `would-have-persisted`.
- `mode: "execute"` is the only mode that writes to `outputAdapter`.
- `createMigrationRunner(opts)` returns a runner instance; calling `runner.run(...)` invokes the orchestration.

**Sync-only transform contract.** The v0.8 `Migration` type pins `transform: (input: Input) => Output` — a **synchronous** function. v0.9 does not widen it. The runner therefore treats `transform` as sync; any timeout / cancellation interaction with `transform` itself is best-effort only (see Decision #8). True async transforms, Promise transforms, or AbortSignal-aware transforms would require a schema-side type change, which is out of scope for v0.9.

The three adapter interfaces — input / output / audit — are the runner's seam for plugging in data backends. v0.9 ships **one reference implementation per interface** (JSON-file / JSONL adapters); database adapters come later.

### Decision #5 — Pre-flight chain.

**Locked.** Before invoking `transform` on any record, the runner executes the steps below. The branching is keyed off the **actual fields on `MigrationPlan`** — `worstSeverity` (`null` / `"cosmetic"` / `"additive"` / `"breaking"`), `chain` (the resolved `readonly MigrationEntry[]`), and `notes` (the `PlanNote[]` discriminator covering `over_specified` / `additive_no_migration`). There is no `plan.kind` on `MigrationPlan` itself.

1. **Resolve the chain.** Call `planMigrationHandler({ schemaRegistry, migrationRegistry, schemaId, fromVersion, toVersion })`. Branch on the success-branch fields:
   - `plan.worstSeverity === null` or `plan.worstSeverity === "cosmetic"` → no migration needed. `plan.chain.length === 0` by the v0.8 planner contract; if a `PlanNote` of kind `over_specified` is present, surface it as a warning. The runner is a no-op: returns success with `recordCount: 0` and the warning.
   - `plan.worstSeverity === "additive"` AND `plan.chain.length === 0` (i.e., `plan.notes` carries `additive_no_migration`) → no-op as above; surface the `additive_no_migration` note as a warning.
   - `plan.worstSeverity === "additive"` AND `plan.chain.length === 1` → proceed.
   - `plan.worstSeverity === "breaking"` AND `plan.chain.length >= 1` → proceed.
   - Any planner-branch failure (`Result.failure` with `migration_missing_endpoint` / `migration_not_found` / `migration_chain_broken` / `migration_ambiguous_chain`) → runner returns failure with the same issue code; **never invokes** `transform`.
2. **Build a chain-scoped migration registry.** From `plan.chain` (the resolved `MigrationEntry[]`), construct a fresh `MigrationRegistry` containing **only** the chain entries — the same three-level `(schemaId → fromVersion → toVersion)` Map shape, populated from the chain alone. This is the runner's responsibility, not the schema package's; the schema-side primitives stay unchanged.
3. **Re-verify provenance on the chain-scoped registry.** Call `verifyMigrationsHandler({ schemaRegistry, migrationRegistry: chainScopedRegistry })`. The reason this MUST be on a chain-scoped registry — not the workspace registry — is that v0.8's `verifyMigrationProvenance` returns `Result.failure` with **only** issues on the failure branch (verdicts are dropped). A workspace-wide verify can fail because of an authored migration that lies entirely outside the planned chain; the runner then cannot reliably reason about chain entries afterward. Scoping the registry to the chain BEFORE verifying guarantees that any failure issue references an entry the runner is actually about to execute.
   - Refuse unless every chain entry verifies as `bound`.
   - Allow `cosmetic_drift` only when `RunOpts.allowCosmeticDrift === true` (default `false` — see Decision #4).
   - `drift` or `missing_endpoint` on any chain entry → runner returns failure with the verifier's issues; never invokes `transform`.
4. **Lock the chain.** From this point, the chain entries used for execution are fixed for the entire run. The runner does NOT re-query the registries mid-run; data shape changes during a long run can't silently swap the active migration set.

### Decision #6 — Per-record execution model.

**Locked.** For every input record:

1. **Validate input** against the source schema via `parse(<source>.schema, record)`. On failure, classify as `input_validation_failed` and apply the partial-failure policy (#10).
2. **Apply chain** by composing `transform`s in order: `out = chain[0].transform(in); for i in 1..N: out = chain[i].transform(out);`. Throws are caught and classified as `transform_threw` failures.
3. **Validate output** against the destination schema via `parse(<dest>.schema, out)`. On failure, classify as `output_validation_failed` and apply the partial-failure policy.
4. **Persist** via `outputAdapter.persist(record-out)`. On adapter throw, classify as `persist_failed`.
5. **Audit-record** the per-record outcome.

Records are processed serially by default. A future opt-in `concurrency: N` option may be added in a v0.9.X phase, but v0.9 ships sequential to keep the safety story simple.

### Decision #7 — Sandboxing / isolation.

**Locked for v0.9: in-process, single-thread.** No V8 isolates, no worker threads, no subprocess. The runner runs each `transform` in the same process that constructed the runner.

Rationale:
- v0.9 is a dev-time-first runner. Authors run it on their own laptops over fixture data or local DBs.
- In-process keeps the type story straightforward — `migration.transform(input)` is invoked directly with the validated input value.
- Authors are advised in [`docs/MIGRATIONS.md`](./MIGRATIONS.md) (existing v0.8 contract) to keep `transform` pure, side-effect-free, and synchronous (the schema-side type pins it as sync — `(input: Input) => Output`). The runner's `transformTimeoutMs` (Decision #8) is a best-effort backstop only — it cannot preempt a CPU-bound sync transform mid-execution.
- Production-grade isolation (per-record V8 isolate, etc.) is a future v0.9.X+ concern, gated by its own thesis-fit audit.

### Decision #8 — Transform timeout + cancellation (best-effort, sync-bounded).

**Locked: sync-first, best-effort cancellation only.**

The v0.8 `Migration.transform` signature is **synchronous** (`(input: Input) => Output`). A synchronous in-process function call CANNOT be preempted from the same thread; CPU-bound code holds the event loop until it returns. v0.9 does not change the schema-side type, so it cannot promise true per-transform interruption.

What v0.9 does ship:

- **Run-level `AbortSignal`** (`RunOpts.signal`). The runner checks the signal **between records** — after a per-record pipeline completes (or fails) and before pulling the next input. Aborting stops the next iteration cleanly; it does not unwind a transform already in flight.
- **`transformTimeoutMs` as a soft guard.** A per-record `setTimeout(transformTimeoutMs)` runs alongside the pipeline. If the timeout fires before the per-record pipeline resolves, the record is classified as `transform_timeout` and the partial-failure policy (Decision #10) applies. Because the transform itself runs synchronously on the same thread, the timeout cannot interrupt a CPU-bound transform mid-execution — it can only mark the record post-hoc once control returns to the runner. The flag is useful for transforms that yield at microtask boundaries, iterate generators, or await downstream validators; it is a backstop, not a hard kill.
- **No subprocess / worker / V8-isolate execution in v0.9.** True preemption requires moving `transform` out-of-process. That's a future amendment (see Decision #7 + non-goals).

Authors who need hard timeout discipline must keep `transform` cheap, deterministic, and non-blocking. The plan explicitly states (and [`docs/MIGRATIONS.md`](./MIGRATIONS.md) already documents) that `transform` should be pure and side-effect-free.

### Decision #9 — Dry-run + validate-only modes.

**Locked.**

| Mode | Loads schemas | Resolves chain | Calls `transform` | Calls `outputAdapter.persist` | Writes audit |
|---|---|---|---|---|---|
| `validate-only` | ✓ | ✓ | ✗ | ✗ | ✓ (records "validated", no transform attempted) |
| `dry-run` | ✓ | ✓ | ✓ | ✗ | ✓ (records the transformed value as `would-have-persisted`) |
| `execute` | ✓ | ✓ | ✓ | ✓ | ✓ |

`validate-only` is the CI mode: assert all inputs match the source schema without doing anything potentially destructive.

`dry-run` exercises the full transform chain and surfaces transform-correctness issues without committing to writing the output. Useful as a final pre-deploy gate.

### Decision #10 — Partial failure / resume.

**Locked.** When a per-record error occurs:

- **`continue` (default).** Record the failure, leave the source unchanged, move to the next input. At the end, the run returns `success: false` with `successCount` and `failureCount` populated. Authors fix the offending records and re-run.
- **`stop`.** First failure aborts the run. Subsequent records are not processed. Useful when downstream correctness depends on full migration of every record (e.g., when v2 records reference v2-only fields populated by transform).

Mode is selected via `RunOpts.onError: "continue" | "stop"` (default `"continue"`).

**Resume** works via the audit log's per-record cursor. Re-invoking `runner.run({ ..., resumeFrom: cursor })` skips records the audit log marks as `success` and re-processes only those marked `failure` / `not-yet-processed`. The cursor is opaque to the caller; the runner produces it and consumes it.

### Decision #11 — Rollback policy.

**Locked: no rollback.** Forward-only is a v0.8 hard-lock (Decision #2). v0.9 does not break it.

If a migration produces bad output and is detected after the fact:
- Author a NEW forward migration `(toVersion → toVersion+ε)` that corrects the bad output.
- Run the runner on the same input range with the new (toVersion → toVersion+ε) chain.
- The original `(fromVersion → toVersion)` migration stays in the corpus — append-only.

There is intentionally no `runner.rollback(...)` method. There is intentionally no flag to invert a transform.

### Decision #12 — Destructive migrations.

**Locked behavior.** A "destructive" migration is one whose forward diff is `breaking` AND drops information (field removal, type narrowing that can't round-trip).

- The runner does NOT refuse destructive migrations; the planner already classifies the diff and the user authored the migration deliberately.
- Destructive migrations follow the **same mode rules as every other migration** — `validate-only` does not call `transform`; `dry-run` calls `transform` (potentially simulating destructive output) but never calls `outputAdapter.persist`; `execute` calls both. There is **no** special "destructive migrations require `mode: 'execute'`" rule. Dry-run a destructive migration freely; the runner won't write anything.
- Audit log records the BEFORE record verbatim alongside the AFTER record (when `auditBefore` / `auditAfter` are enabled), so destructive migrations leave a forensic trail. Audit retention is the consumer's concern.

### Decision #13 — Batch / stream execution.

**Locked.** Inputs come from `inputAdapter.stream()` which returns an `AsyncIterable<unknown>`. The runner pulls records one at a time. No materialization of the full input set in memory. Output is symmetric: `outputAdapter.persist(record)` is called per-record.

A batched-flush optimization (`outputAdapter.flush()` called every N records) may be added later as a Decision #13.X amendment if benchmarks show a need; v0.9 ships sequential per-record.

### Decision #14 — Error classification + exit-code mapping.

**Locked.** Per-record errors are classified into:

- `input_validation_failed`
- `transform_threw`
- `transform_timeout`
- `output_validation_failed`
- `persist_failed`

Run-level errors:

- `pre_flight_failed` — planner or verifier refused; never invoked `transform`.
- `adapter_init_failed` — input/output/audit adapter setup threw.
- `cancelled` — `AbortSignal` fired mid-run.

If the runner ships a thin CLI alongside the library, the CLI maps these to the same v0.7 exit-code enum as the schema CLI:
- success → `0`
- per-record validation/transform failures with `onError: "continue"` and `failureCount > 0` → `1` (LOGICAL_FAILURE)
- `pre_flight_failed` (planner integrity_error) → `4` (INTEGRITY_ERROR)
- adapter init failures → `3` (IO_ERROR)
- argv misuse → `2` (USAGE_ERROR)
- `pre_flight_failed` (planner logical failure) → `1`

### Decision #15 — Provenance re-check before execution.

**Locked.** Restated from Decision #5 for emphasis: `verifyMigrationProvenance` runs immediately before the runner walks the input stream. If anything but `bound` (or `bound` / `cosmetic_drift` with explicit opt-in) → refuse to run. This is the load-bearing safety check that ties v0.9 execution to the v0.8 verifier contract.

### Decision #16 — Audit log shape.

**Locked baseline.** Pluggable via `AuditAdapter`, but the **interface** is locked:

```ts
interface AuditEntry {
  /** Locked audit-entry schema version (OQ-4). Bumped on any breaking
   *  change to this interface; consumers reading older entries branch
   *  on the field. Always present from day one. */
  readonly __auditSchemaVersion: "1";

  readonly runId: string;             // ULID per runner.run() invocation
  readonly schemaId: string;
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly chainEntries: readonly { fromVersion: string; toVersion: string; sourcePath: string }[];
  readonly recordIndex: number;       // 0-based
  readonly recordKey?: string;        // optional consumer-supplied stable id
  readonly status: "success" | "failure";
  readonly classification?: ErrorClassification; // only present when status = "failure"
  readonly errorMessage?: string;
  readonly before?: unknown;          // input record, OR undefined per RunOpts.auditBefore
  readonly after?:  unknown;          // output record, OR undefined per RunOpts.auditAfter
  readonly timestamp: string;         // ISO-8601
}
```

`before` / `after` retention is opt-in per `RunOpts.auditBefore: boolean` / `auditAfter: boolean` (both default `false` for production — they can be large). The reference JSON-file adapter writes one JSONL line per entry.

The audit log is **append-only**. The runner never rewrites entries.

### Decision #17 — Adapter interfaces.

**Locked.** Three interfaces, each minimal:

```ts
interface InputAdapter<T> {
  stream(): AsyncIterable<T>;
}

interface OutputAdapter<T> {
  persist(record: T): Promise<void>;
  flush?(): Promise<void>;            // optional
}

interface AuditAdapter {
  append(entry: AuditEntry): Promise<void>;
  /** Look up the cursor for resume — returns set of recordIndexes already
   *  marked `success` for the given `runId` / schemaId / version pair. */
  cursor(runId: string): Promise<readonly number[]>;
}
```

v0.9 ships JSON-file reference implementations: `jsonFileInputAdapter(path)`, `jsonFileOutputAdapter(path)`, `jsonlAuditAdapter(path)`.

### Decision #18 — Where does the runner's CLI live?

**Locked: in `@nekostack/migrate-runner` if at all.** The eventual `neko-migrate-run` (or similar) binary, IF it ships in v0.9, lives in the runner package's own `bin` entry. `@nekostack/cli` does NOT proxy to it.

A v0.9.X+ phase may revisit whether `@nekostack/cli` should add a thin pass-through verb under a new top-level command group (e.g., `neko run migrate`). That's a separate decision.

## Non-goals (hard-locked)

These remain explicit non-goals through v0.9 — not deferred items, **not in scope ever for the schema package or for v0.9 itself**:

| Non-goal | Why |
|---|---|
| `apply` verb under `neko schema migrate *` | v0.8 hard-lock; locked surface stays at 4 verbs. |
| `migration.transform` execution inside `@nekostack/schema` | v0.8 INVARIANTS; static-scan gates would fail. |
| Reverse / rollback / undo migrations | Decision #2 (v0.8) — forward-only. v0.9 doesn't change it. |
| Cross-schema migrations in a single runner invocation | Decision #4 (v0.8) — one `schemaId` per migration. Multi-schema = N invocations. |
| Database / DDL migrations | `@nekostack/migrate`'s concern. The runner orchestrates schema-data; it does not alter database schemas. |
| Multi-hop chain skip / chain rewriting | Planner enumerates chains; runner walks them. Never bypasses intermediates. |
| Transform correctness proof | v0.9 ships pre/post-validation against schemas; it does NOT verify that the transform itself is "right". Authors own that. |
| Online (zero-downtime) migration | The runner is a batch tool. Strangler-fig / read-replica swaps are out of scope. |
| Distributed / cluster-coordinated execution | Single-process, single-thread. Multi-machine coordination is out of scope. |
| Subprocess / sandbox / V8-isolate execution of `transform` | Decision #7 — in-process for v0.9. Sandboxing is a future amendment. |
| Concurrency / parallel record processing | Decision #6 / #13 — sequential per-record for v0.9. |
| Production-grade scheduling (cron, etc.) | The runner is a library + thin CLI. Scheduling is the consumer's concern. |

## Sequencing (placeholder for the eventual implementation PR)

The plan-only PR (this doc) does NOT lock the implementation sequence. The sequence below is illustrative — the eventual `feat/migrate-runner-v0.9-candidate` branch will land its own step list (mirroring the v0.8 plan's 29-step shape).

### Schema-side

There is **no schema-side work** in v0.9. The schema package is read by the runner via the existing `@nekostack/schema/cli` subpath; no new exports, no new modules, no new tests. (A docs sweep to add a "runner workflow" preview to `USAGE.md` may land separately.)

### Runner package (`@nekostack/migrate-runner` — new)

1. `package.json` + `tsconfig.json` + workspace registration. Depends on `@nekostack/schema`; uses `@nekostack/schema/cli` subpath for the migration primitives.
2. Core types — `RunnerOptions`, `RunOpts`, `RunResult`, `RunSuccess`, `RunFailure`, `ErrorClassification`, `AuditEntry`, `InputAdapter`, `OutputAdapter`, `AuditAdapter`, `ResumeCursor`.
3. `pre-flight.ts` — calls `planMigrationHandler` + `verifyMigrationsHandler`, returns a locked chain or a `Result.failure`. Pure; no I/O.
4. `per-record-pipeline.ts` — `validateInput → transform → validateOutput`. Pure (consumes parsed schemas; the runner caller hands them in). Static-scan gate ensures the `.transform(` call sits ONLY in this file (every other runner source file is `.transform(`-free).
5. `audit.ts` — interface + in-memory default + JSONL reference adapter.
6. `runner.ts` — orchestrator. Wires pre-flight + per-record pipeline + adapter calls + audit writes.
7. JSON-file adapters — `json-file-input.ts`, `json-file-output.ts`, `jsonl-audit.ts`.
8. Tests — runner unit tests with in-memory adapters; reference-adapter tests with temp dirs; full end-to-end test driving a real fixture chain (`schema vN → vN+1 → vN+2`); static-scan tests proving `.transform(` lives in exactly one file.
9. Static + runtime purity gates — borrow the v0.7/v0.8 pattern. The runner is allowed `fs.*` (it's the data boundary), but is banned from `console.*`, `process.exit`, and direct `process.std{out,err}.write`. Writers are injected.
10. Docs — `RUNNER.md` (contract doc) + `README.md` + maybe a worked example in the schema repo's `examples/migrations/`.

### CLI (optional, possibly deferred)

11. (Optional) `bin/neko-migrate-run` thin CLI in the runner package. argv parsing via commander; mirrors the v0.7 `neko schema *` shape. Maps internal classifications to the locked exit-code enum.
12. (Optional) CLI tests — dispatch + argv + help + JSON envelope.

### Post-merge

13. Tag (the runner package's own `migrate-runner-vN` tag scheme — TBD, since this is a new package). Release. Status / ROADMAP sweep.

## Locked plan-time decisions (formerly "open questions")

These were the five open questions at first draft. Round-2 review locked defaults; the implementation PR inherits them.

| # | Question | **Locked answer** |
|---|---|---|
| OQ-1 | Package name | **`@nekostack/migrate-runner`**. Working name in the plan body is the locked name. |
| OQ-2 | Initial versioning | **Independent package version line**, starting `migrate-runner-v0.1.0`. The runner does NOT share the `schema-vX.Y.Z` tag scheme; it ships its own roadmap, its own CHANGELOG, its own release cadence. |
| OQ-3 | Runtime type strategy for `Migration<...>` | **Loose at runtime.** The runner pins migrations as `AnyMigration` at the registry boundary; correctness is enforced by the per-record pipeline's `parse(<source>, input)` and `parse(<dest>, output)` calls. Type safety lives at authoring time (the `Migration<SchemaId, From, To, Input, Output>` generic in the migration file). The runner does NOT re-derive types from schemas at runtime. |
| OQ-4 | `AuditEntry` schema versioning | **Include `__auditSchemaVersion: "1"` from day one.** Cheap insurance against later breaking changes to the entry shape; consumers reading the audit log can branch on the field. Listed in the locked `AuditEntry` interface in Decision #16. |
| OQ-5 | `allowCosmeticDrift` default | **`false` (strict).** `cosmetic_drift` does NOT count as `bound` unless the caller explicitly passes `allowCosmeticDrift: true`. The safest default — surfaces a known-source-edit mismatch instead of running silently. |

## Risks

- **Authors mis-implement `transform`** — input validates, output validates, but the transformed value is semantically wrong. The runner cannot detect this. Mitigation: explicit non-goal #7 ("transform correctness proof"); rely on author testing.
- **Long runs over large datasets** — sequential per-record is slow. Mitigation: it's a v0.9 trade-off for safety; concurrency is a v0.9.X amendment.
- **Adapter sprawl** — every new data backend wants its own adapter. Mitigation: ship one reference adapter per interface in v0.9; community / consumer code can ship more.
- **`@nekostack/schema/cli` subpath churn breaks the runner** — the subpath is explicitly "package-internal" per v0.7/v0.8 INVARIANTS. Mitigation: the runner is itself a NekoStack package and is allowed to import from the subpath; treat the runner's coupling to the subpath as an internal cross-package contract maintained in lockstep, same as `@nekostack/cli` already does.

## Reference index

- v0.8 contract: [`MIGRATIONS.md`](./MIGRATIONS.md)
- v0.8 phase plan (this doc's parent): [`PHASE_PLAN_v0.8.md`](./PHASE_PLAN_v0.8.md)
- v0.8 INVARIANTS: [`INVARIANTS.md`](./INVARIANTS.md) (search "v0.8")
- v0.8 SCOPE: [`SCOPE.md`](./SCOPE.md) (search "v0.8-specific scope")
- v0.7 generator + CLI plan (pattern for the runner's CLI): [`PHASE_PLAN_v0.7.md`](./PHASE_PLAN_v0.7.md)
- Master plan boundary doctrine: [`../../../BOUNDARIES.md`](../../../BOUNDARIES.md)
- Master plan Decision #1 (schema is pure): the boundary that defines why the runner cannot live in `@nekostack/schema`.
