# Phase Plan: `@nekostack/cli` v0.7 — `neko schema *` (companion)

> **PLAN only — no code in the PR that lands this doc.**
>
> Companion to [`packages/schema/docs/PHASE_PLAN_v0.7.md`](../../schema/docs/PHASE_PLAN_v0.7.md) (the master). This document covers the CLI side of the v0.7 joint phase: command runtime, argv parsing, dispatch, exit codes, and I/O. **Schema-side primitives — registry, diff, source-hash, handler-function contracts — are defined in the master plan; this document does not duplicate them.**
>
> First implementation phase for `@nekostack/cli`. Reviewed against [`checklists/package/implementation-acceptance.md`](../../../checklists/package/implementation-acceptance.md). Once approved, implementation lands on `feat/schema-cli-v0.7-candidate` (shared branch with the schema-side plan).

## Thesis-fit

> v0.7 makes `neko schema *` the one command you type to interact with schemas. The schema-side handlers do the work; `@nekostack/cli` is the conductor.

### Workflow absorbed

v0.7 absorbs the manual "wire a vitest snapshot test to regenerate artifacts" + "grep across the tree to find schemas" + "diff committed files by eye" workflow into four CLI verbs. See the master plan for the workflow that the schema-side absorbs; this companion plan absorbs the **interaction surface** that lets a user trigger those operations from a terminal without writing one-off scripts.

### User-facing verb / API

Four commands in v0.7:

```text
neko schema generate [pattern]   regenerate artifacts for matching schemas
neko schema check [pattern]      freshness gate; exit nonzero on stale artifacts
neko schema diff <a> <b>         classify a → b as breaking / additive / cosmetic
neko schema list                 enumerate registry entries
```

Common flags:

```text
--json              machine-readable output to stdout
--quiet             suppress non-essential stderr output
--root <path>       explicit workspace root (default: cwd)
--help              per-command help text
--version           prints the @nekostack/cli version
```

No interactive prompts in v0.7 — every command is non-interactive and CI-safe by default.

### Internal engine

`@nekostack/cli` is the **filesystem-aware shell** around `@nekostack/schema`'s pure handlers. Architecture:

```
neko <argv>
  └─ argv parser (commander)
      └─ dispatch to commands/schema/<verb>.ts
          ├─ resolve workspace root (--root or process.cwd())
          ├─ glob-walk for *.schema.{ts,js}
          ├─ load each file via tsx (in-process)            ← CLI-side
          ├─ read source text for sourceHash inputs         ← CLI-side
          ├─ read committed artifacts (for `check`)         ← CLI-side
          ├─ build RegistrySourceEntry[] / CommittedArtifact[]
          ├─ call the schema-side *Handler                  ← pure, no I/O
          ├─ format the *Result for stdout (pretty / --json)
          ├─ write any GeneratedArtifact[] (for `generate`) ← CLI-side
          └─ choose exit code
```

The CLI owns every interaction with the outside world:
- Workspace root resolution + glob expansion
- Schema module loading (the `tsx` strategy locked in Decision #1)
- All filesystem reads (source text, committed artifacts)
- All filesystem writes (regenerated artifacts)
- stdout / stderr (pretty + `--json` formatters)
- Process exit codes (the locked enum, Decision #3)

The schema-side handlers — `listHandler`, `diffHandler`, `checkHandler`, `generateHandler` — are pure functions imported from `@nekostack/schema/cli` (see master plan Decision #10). They take typed data, return `Result<T>`, never call `fs.*` / `import()` / `process.exit` / `console.*`.

### BOUNDARIES rows touched

In [`BOUNDARIES.md`](../../../BOUNDARIES.md) §45 ("Developer command-line interface"):

- **`neko` binary** — implemented (was a placeholder).
- **Argv parsing** — owned by `@nekostack/cli`, executed via `commander`.
- **`neko schema *` subcommand family** — implemented for `generate` / `check` / `diff` / `list`.
- **Output formatters (pretty + `--json`)** — owned by `@nekostack/cli`.

v0.7 does **not** move:

- The schema generators themselves (still `@nekostack/schema`).
- The schema diff / freshness logic (still `@nekostack/schema`; CLI dispatches).
- Plugin registration contract (still placeholder; first plugin-bearing subcommand triggers the contract).
- Other planned subcommands (`init`, `new`, `codex export`, `lint`, `sim run`, etc.) — all deferred.

## Why this phase exists

Three CLI-side problems compound:

1. **No common verb.** Every project that uses `@nekostack/schema` today writes its own vitest-snapshot regenerate script. There is no `neko schema generate` to standardize on.

2. **No machine-readable freshness gate.** CI scripts that want to fail on stale artifacts have to invoke the regenerate path, diff the result, and parse the diff themselves.

3. **The CLI package is a placeholder.** `packages/cli/src/index.ts` literally contains `export {};` today. The plugin architecture documented in `packages/cli/README.md` is the long-term shape, but a working CLI has to ship before the plugin contract can be designed against real usage.

v0.7 ships the minimum CLI that justifies the package's existence: four `neko schema *` verbs, no plugin registration, no other subcommand families.

## Phase scope

### Locked subcommand surface

```text
neko schema generate [pattern]
  --root <path>          (default: process.cwd())
  --json
  --quiet
  --help

neko schema check [pattern]
  --root <path>
  --json
  --quiet
  --help

neko schema diff <a> <b>
  --root <path>
  --json
  --help

neko schema list
  --root <path>
  --json
  --help

neko schema --help          # lists the four subcommands

neko --help                 # lists `schema` (and notes other families are future)
neko --version              # prints @nekostack/cli version + node version
```

`<pattern>` for `generate` / `check` is an optional glob. Defaults to `**/*.schema.ts`. Filters which schema files the corresponding schema-side handler operates on.

`<a>` and `<b>` for `diff` are each one of:
- A schema id (`com.x.User`) — resolves to highest version in the registry
- A schema id + version (`com.x.User@1.0.0`)
- A file path (`packages/foo/schemas/user.schema.ts`)

### Exit codes

```text
0   success
1   logical failure (stale artifacts, breaking diff, missing schema)
2   argv / usage error (bad flags, malformed pattern)
3   I/O error (workspace not readable, schema file failed to import)
4   integrity error (irHash matches but sourceHash differs in an impossible way; per master plan Decision #6 fourth row)
```

Exit code 1 is the load-bearing "your CI should fail" signal. Anything ≥ 2 indicates a problem with the invocation itself, not with the schemas under inspection.

### Output formats

**Pretty (default):**

```text
$ neko schema list
3 schemas in workspace:
  com.nekostack.tenant.Tenant       1.0.0   packages/schema/examples/tenant.schema.ts
  com.nekostack.audit.AuditEvent    1.0.0   packages/schema/examples/audit-event.schema.ts
  com.nekostack.entitlement.Entitlement   1.0.0   packages/schema/examples/entitlement.schema.ts
```

**`--json`:**

```text
$ neko schema list --json
{"schemas":[{"schemaId":"com.nekostack.tenant.Tenant","schemaVersion":"1.0.0","sourcePath":"packages/schema/examples/tenant.schema.ts","irHash":"sha256:..."}, ...]}
```

JSON output is one line per invocation (no pretty-printing) so it's pipeable. Schema for each command's JSON output is locked in the implementation phase — keyed to the underlying schema-side `*Result` shape.

### Explicit non-scope

- **Plugin registration system.** No `defineCommand` / `registerCommand` API in v0.7. Plugin contract designed when a second package needs subcommands.
- **`neko init` / `neko new` / `neko lint` / etc.** Out of v0.7. The CLI's README lists these as eventual shape; v0.7 only locks the dispatch substrate that they'll later attach to.
- **Interactive prompts.** No clack, no inquirer, no readline. v0.7 is CI-first.
- **`--watch` mode** for `check` / `generate`. Defer.
- **Color output.** v0.7 ships plain ANSI; richer color (chalk-style) deferred. `--no-color` honored via standard `NO_COLOR` env var.
- **Configuration file (`neko.config.json`).** v0.7 uses convention (workspace root + `**/*.schema.ts`); a config file lands when the first option needs to outlive a single invocation.
- **Subcommand aliases.** No `neko g` for `neko schema generate`. Keep the verb space wide-open for future families.
- **i18n.** English messages only. Same posture as v0.6.

## Public API delta

`@nekostack/cli` has no library-level public exports in v0.7 — it's a binary. The `package.json` gains a `"bin": { "neko": "./dist/cli.js" }` entry pointing at the compiled CLI entry.

The package may export the dispatch internals (`buildCli()`, `dispatch(argv)`) as internal-only for unit-testability, but those stay off the documented surface.

## Internal file delta

```
packages/cli/
├── package.json                # gains "bin", "dependencies": { commander, @nekostack/schema }
├── bin/
│   └── neko                    # NEW — shebang script invoking dist/cli.js
├── src/
│   ├── cli.ts                  # NEW — argv parse + dispatch entry; replaces the empty index.ts
│   ├── exit-codes.ts           # NEW — locked enum
│   ├── formatters/
│   │   ├── pretty.ts           # NEW — terminal-friendly output (table + ANSI)
│   │   └── json.ts             # NEW — single-line JSON output
│   └── commands/
│       └── schema/
│           ├── generate.ts     # NEW — dispatch to generateHandler + format
│           ├── check.ts        # NEW
│           ├── diff.ts         # NEW
│           ├── list.ts         # NEW
│           └── index.ts        # NEW — `schema` family registration
└── docs/
    ├── PHASE_PLAN_v0.7.md      # this doc
    ├── ROADMAP.md              # NEW — mirrors schema-side ROADMAP shape
    └── (added during impl)     # SCOPE.md, INVARIANTS.md as the v0.7 commits land
```

Tests:

```
packages/cli/tests/
├── cli-harness.ts              # NEW — invokes built CLI in-process, captures stdout/stderr/exit
├── commands/
│   ├── schema-generate.test.ts # happy path + pattern filter + --json
│   ├── schema-check.test.ts    # fresh fixture + stale fixture (exit 1) + integrity-error fixture (exit 4)
│   ├── schema-diff.test.ts     # breaking / additive / cosmetic fixtures × pretty + --json
│   └── schema-list.test.ts     # multi-schema fixture × pretty + --json
├── argv.test.ts                # flag parsing + exit-code 2 on bad argv
└── help.test.ts                # --help text snapshot per command
```

## Dependency delta

- **New runtime dep:** `commander ^12.x` — argv parsing. Hand-rolling argv is the wrong tradeoff for a CLI that needs subcommand groups, help text generation, and flag inheritance. Commander is the smallest mainstream library that handles all three cleanly.
- **New runtime dep:** `tsx ^4.x` — schema module loading. Required to dynamic-import `*.schema.ts` files in-process. See Decision #1 for the locked rationale and alternatives considered.
- **New runtime dep:** `@nekostack/schema` (workspace `*`). The CLI imports handler functions from the `@nekostack/schema/cli` integration subpath defined in the master plan's Decision #10. First `@nekostack/*` cross-package dependency in the stack; Invariant 8 (no downstream package imports) applies to *schema*, not *cli* — cli is downstream by design.
- **No new devDeps** beyond what the workspace already provides.
- The CLI uses Node-built-in modules for filesystem operations (`node:fs`, `node:path`, `node:url`) and for sha256 (`node:crypto`) when needed locally — though most sha256 work goes through the schema-side `sourceHashFromText`.

## Decisions to lock before coding

Ten decisions. The schema-side master plan locks the primitives (registry, diff, sourceHash, handler contracts); these are the CLI-only choices.

### Schema module loading (highest stakes; mirrored from master plan Decision #2)

1. **`tsx` is the in-process TS loader for `*.schema.ts` files.**
   - `tsx` is a regular runtime dependency of `@nekostack/cli`.
   - Loading happens in-process via `tsx`'s ESM loader registration; no per-file child process.
   - `.schema.ts` and `.schema.js` are both supported. `.schema.mts` and `.schema.cts` are not in v0.7; if a real consumer ships one, it's a one-line glob change.
   - Schema files execute in-process. **Module-load-time side effects are the user's responsibility.** The CLI does not sandbox; documented in `SCOPE.md`.
   - **Errors map cleanly to `Issue[]` + exit code 3 (I/O class):**
     - File not readable → `schema_load_failed` with `metadata.reason: "io_error"`.
     - TypeScript compile failure (via `tsx`) → `schema_load_failed` with `metadata.reason: "compile_error"` and the underlying error's first line on the `message` field.
     - Runtime exception inside the schema file → `schema_load_failed` with `metadata.reason: "runtime_error"` and the thrown error's message.
     - Module loaded but does not export any `Schema` instance → `schema_load_failed` with `metadata.reason: "no_schema_export"`.
   - **Alternatives considered:**
     - `jiti` — roughly equivalent. Slightly more permissive of non-standard TS; `tsx` chosen because it follows Node ESM semantics more closely and aligns with the rest of the workspace's TS posture.
     - Precompiled-JS-only — rejected. The ROADMAP says `*.schema.ts`; forcing users to build before running `neko schema *` breaks the workflow-replacement thesis.
     - Spawning `tsc --noEmit` per file for type-check only — wrong shape; the CLI needs the *runtime* `Schema` instances to extract `node.metadata.id` / `.version` and to feed `buildRegistry`.

### Schema discovery (highest stakes)

2. **The CLI is the only filesystem walker.**
   - Default root: `process.cwd()`. Overridable with `--root <path>`.
   - Default pattern: `**/*.schema.{ts,js}`. Overridable with the optional `[pattern]` positional on `generate` and `check`.
   - Glob library: Node's built-in `fs.glob` (Node 22+, present in the workspace's `.nvmrc`). No external `fast-glob` / `glob` dependency.
   - Discovery returns paths only; per-file loading happens via the `tsx` loader (Decision #1) and produces `RegistrySourceEntry[]` the CLI hands to the schema-side handlers.
   - **Anonymous schemas** (no `.id()`) are loaded but flagged on stderr; they appear in `RegistrySourceEntry[]` so the CLI can warn per file, but `buildRegistry` (schema-side) ignores them per master plan Decision #5.

### Schema-side handler imports

3. **Handler imports go through `@nekostack/schema/cli`, never the root.** Per master plan Decision #10:

   ```ts
   import {
     listHandler,
     diffHandler,
     checkHandler,
     generateHandler,
     buildRegistry,
     sourceHashFromText,
     type RegistrySourceEntry,
     type CommittedArtifact,
     type GeneratedArtifact,
     type FreshnessVerdict,
   } from "@nekostack/schema/cli";
   ```

   The root `@nekostack/schema` import is reserved for the v0.6 runtime surface — even though the CLI doesn't currently use it, the import-path discipline is what keeps the engine-swap-safe boundary real.

### Argv + UX

4. **`commander ^12.x` for argv parsing.** Locked over yargs (heavier API surface) and hand-rolled (too much CLI UX overhead for v0.7). Commander's chainable-program style is closest to NekoStack's existing builder ergonomics. `clipanion`, `cmd-ts` considered; less mainstream maintenance.

5. **Bin name `neko`.** Matches the README. No collision check; if a real conflict surfaces, rename to `nekostack` at v1.0.

6. **Exit codes per the locked table.** 0 success, 1 logical failure (load-bearing CI signal), 2 argv / usage error, 3 I/O error (filesystem read failure, schema load failure), 4 integrity error (the impossible two-hash row from master plan Decision #6).

7. **Pretty default + `--json` opt-in.** Pretty output is unstable across versions (UX-driven); JSON output IS the contract for machine consumers. JSON schema per command is keyed to the schema-side `*Result` shape — when that shape changes, the JSON output changes correspondingly.

8. **CLI is non-interactive in v0.7.** No prompts. Confirmation patterns (e.g., for destructive operations) land when the first genuinely destructive verb does. `generate` is non-destructive in the sense that it writes alongside existing artifacts at paths the master plan's Decision #6 locks; users who want a pre-flight check use `--check-only`.

### Testing

9. **CLI tests use an in-process harness, not subprocess spawn.**
   - Harness imports `buildCli()` + `dispatch(argv)` directly.
   - Captures stdout / stderr via standard stream replacement.
   - Captures intended exit code via `process.exit` mock that throws a sentinel; the harness catches and reads the code.
   - Cross-platform exit-code semantics are still asserted because the harness mirrors the real `process.exit` codepath.
   - Subprocess tests deliberately rejected: they would require building the package first and slow CI substantially.

10. **`--help` text is generated, not hand-written.** Commander generates per-command help from the registered options + descriptions. Locking this prevents drift between code and `--help` output, which is a real risk for hand-written help.

## Sequencing

Implementation order. Begins after the schema-side master plan's steps 1–20 are in place — the CLI cannot test against handlers that don't exist yet.

21. `packages/cli/package.json` — add `bin` entry, `commander` + `tsx` + `@nekostack/schema` (workspace) deps. `bin/neko` shebang script.
22. `src/loaders/tsx-loader.ts` — register `tsx` ESM hook once per CLI invocation; expose `loadSchemaModule(path): Promise<LoadedSchemaModule>`. Failure cases map to the four `schema_load_failed` reasons per Decision #1.
23. `src/loaders/walk-workspace.ts` — `loadSchemaFiles(roots, pattern): Promise<RegistrySourceEntry[]>`. Uses Node's `fs.glob` + the tsx loader from step 22.
24. `src/loaders/read-artifacts.ts` — `loadCommittedArtifacts(generatedDir): Promise<CommittedArtifact[]>` for `check`.
25. `src/cli.ts` — argv parse, command registration, exit-code wiring. Includes `--help` and `--version`.
26. `src/exit-codes.ts` — locked enum (Decision #6).
27. `src/formatters/json.ts` — single-line JSON; verified by `--json` snapshot tests.
28. `src/formatters/pretty.ts` — terminal output; verified by per-command pretty snapshot tests.
29. `src/commands/schema/list.ts` — simplest dispatch. Proves the wiring: load files → `buildRegistry` → `listHandler` → format → exit.
30. `src/commands/schema/diff.ts` — `<a>` / `<b>` resolver (id, id@version, or file path) → `diffHandler` → format.
31. `src/commands/schema/check.ts` — load files + load committed artifacts → `checkHandler` → exit code per verdict (clean → 0; cosmetic_drift → 0 with stderr; stale → 1; integrity_error → 4).
32. `src/commands/schema/generate.ts` — load files → `generateHandler` → write each `GeneratedArtifact` to its `suggestedPath`. Last in sequence because it's the only command that writes to disk.
33. `tests/cli-harness.ts` — in-process invocation harness (Decision #9).
34. `tests/argv.test.ts` — argv parse + bad-flag → exit 2.
35. `tests/help.test.ts` — per-command `--help` snapshot.
36. `tests/commands/schema-*.test.ts` — one test file per subcommand; pretty + `--json` for each.
37. `tests/loaders/tsx-loader.test.ts` — every Decision #1 error class has a fixture (compile error, runtime exception, no-schema-export, IO error).
38. `packages/cli/docs/SCOPE.md`, `INVARIANTS.md`, plus a `ROADMAP.md` post-merge update — mark v0.7 shipped after the joint phase merges, set v0.8 active target.

## Estimate

**3–4 focused days on the CLI side**, on top of the schema-side estimate. The two packages share a candidate branch; the CLI can begin once the schema-side handlers (master plan steps 6–9) are in place — roughly mid-week.

Risk areas:

- **Commander's TypeScript types are looser than v0.7's discipline expects.** Mitigation: wrap commander's `.action()` callbacks in typed dispatcher functions; commander becomes an internal detail, not a leaked type.
- **`--json` output stability.** JSON schemas mirror the schema-side `*Result` shapes; if the master plan's handlers change shape during implementation review, CLI tests have to follow. Mitigation: schema-side types live in a single internal `types.ts`; CLI imports those types and pattern-matches.
- **Cross-platform path handling.** Windows path separators in JSON output, exit-code rendering. Mitigation: harness normalizes both directions; CI runs on three platforms.

## What this plan does NOT decide

- **Plugin contract (`defineCommand` shape).** Out of v0.7.
- **`neko init` / `neko new` / etc.** Out of v0.7.
- **REPL / interactive shell mode.** Out of scope per the CLI README.
- **Auto-update / version-check mechanism.** Out of v0.7.
- **`neko schema validate <file>` runtime-data command.** Different concern from registry/freshness; the v0.6 runtime is already library-importable. May land in v0.7.1 if a consumer asks.
- **Configuration file format.** Defer until a real option outlives a single invocation.

## Decision history

- **v0.7-plan, initial draft** — 8 CLI-side decisions. Filed as a companion to the schema-side master plan.

- **v0.7-plan, round-2 amendment** — two new decisions added in response to the first audit pass:

  - **Decision #1 added** (schema module loading via `tsx`) — the initial draft assumed schema files would be magically importable. The audit correctly flagged that a Node CLI cannot dynamic-import `.ts` without a loader. `tsx` is now the locked strategy; `jiti` listed as the considered alternative; precompiled-JS-only explicitly rejected. Every load-failure mode now maps to a specific `Issue` code + exit code 3.

  - **Decision #2 added** (CLI is the only filesystem walker) — the initial draft implied schema-side might walk too. The boundary is now strict: CLI walks, CLI loads, CLI reads / writes; schema-side takes loaded data and returns data. Node's built-in `fs.glob` (22+) chosen over `fast-glob` / `glob` for zero added dependency cost.

  - **Decision #3 amended** (handler imports from `@nekostack/schema/cli`, not the root) — initial draft said "direct from `@nekostack/schema`'s internal subpath" without specifying the shape. Now locked to the formal `package.json` `exports` map from the master plan's Decision #10. Root `@nekostack/schema` stays the v0.6 public surface.

  Key shape choices baked in by the original audit before drafting (still in force):
  - Two parallel plan files; this is the CLI companion.
  - Schema commands only — no plugin scaffolding, no `init`, no `lint`. Plugin system is its own future phase.
  - CLI ROADMAP created in this PR (alongside this plan), marking v0.7 as the active target.
