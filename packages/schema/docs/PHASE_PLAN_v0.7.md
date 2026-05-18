# Phase Plan: `@nekostack/schema` v0.7 — Registry-lite + freshness

> **PLAN only — no code in the PR that lands this doc.** Same discipline as v0.2 / v0.3 / v0.4 / v0.5 / v0.6.
>
> Joint phase with `@nekostack/cli` v0.7 — the schema-side primitives (registry, diff, sourceHash, handler functions) and the CLI-side commands (`neko schema *`) ship together. See [`../../cli/docs/PHASE_PLAN_v0.7.md`](../../cli/docs/PHASE_PLAN_v0.7.md) for the CLI-side companion. This document is the master; the CLI plan defers to it for handler contracts.
>
> Reviewed against [`checklists/package/implementation-acceptance.md`](../../../checklists/package/implementation-acceptance.md). Once approved, implementation opens on `feat/schema-cli-v0.7-candidate`.

## Thesis-fit

> v0.7 makes "did my schema change in a way that breaks consumers?" a NekoStack workflow. Today the user has to run a build, diff generated files, eyeball the result, and decide. After v0.7 the user types `neko schema check` or `neko schema diff` and gets a structured answer.

### Workflow absorbed

v0.7 absorbs the manual freshness + change-detection workflow that every schema-bearing project currently does by hand:

1. Edit a `*.schema.ts` source file.
2. Re-run the regenerate script and inspect the diff.
3. Decide whether the diff is a breaking change (and therefore consumers need to bump versions) or an additive change (consumers can pick it up implicitly).
4. Hope you didn't forget step 2 entirely — stale generated files are a real failure mode.
5. Maintain a per-project list of schemas + versions in your head; cross-reference them across packages by grep.

After v0.7:

- `neko schema generate` regenerates artifacts for every schema in the workspace.
- `neko schema check` exits nonzero if any artifact is stale (covers step 4 by failing CI).
- `neko schema diff` produces a structured breaking/additive/cosmetic classification (covers step 3 with mechanical rules instead of judgment).
- `neko schema list` enumerates the registry (covers step 5).

### User-facing verb / API

The user-facing surface is the CLI. Schema-side primitives are **handler functions** consumed by the CLI; they are not exported on the public package surface in v0.7:

```text
neko schema generate [pattern]   # regenerate artifacts
neko schema check [pattern]      # freshness gate; exits nonzero on drift
neko schema diff <a> <b>         # breaking/additive/cosmetic between two refs
neko schema list                 # registry listing
```

The schema package exports the handler functions internally so the CLI can call them without going through the shell:

```ts
// packages/schema/src/registry.ts (internal — not re-exported from src/index.ts)
export function generateHandler(opts: GenerateOpts): GenerateResult;
export function checkHandler(opts: CheckOpts): CheckResult;
export function diffHandler(opts: DiffOpts): DiffResult;
export function listHandler(opts: ListOpts): ListResult;
```

Each `Result` is a discriminated union of `{ success: true; data }` and `{ success: false; issues: Issue[] }`. Same `IssueCode` vocabulary as v0.6 — registry-discovered problems surface as `Issue[]`, not throws.

The handlers are pure: no `process.exit`, no `console.log`, no `process.stdout.write`. The CLI owns I/O.

### Internal engine

v0.7's registry is filesystem-discovered, in-memory. No database, no daemon, no IPC. A "registry" call is:

1. Walk a configured root for `*.schema.ts` files (default: workspace root).
2. Import each file, read the exported `Schema` instance(s), extract `.node.metadata.id` and `.node.metadata.version`.
3. Build an in-memory `Map<schemaId, Map<version, RegistryEntry>>`.

Importing a schema file means the file's TypeScript must compile, but that's already a precondition for the rest of the toolchain. v0.7 does not introduce a separate parse-without-execute path.

A future phase may add a persistent registry (SQLite, JSON sidecar, etc.) when cross-process invalidation becomes the bottleneck. v0.7's in-memory model is sufficient for the CLI's per-invocation lifecycle.

### BOUNDARIES rows touched

In [`BOUNDARIES.md`](../../../BOUNDARIES.md) §7 ("Schema / types"), v0.7 implements:

- **Schema versioning** — gains the registry-lookup primitive (`findSchema(id, version)`) and the breaking-change diff classifier.
- **Cross-package shared type contracts** — `irHash` (v0.2) is paired with the new `sourceHash` for full freshness detection.

In §45 ("Developer command-line interface"), v0.7 implements:

- **`neko schema *` commands** — owned by `@nekostack/cli`, consuming `@nekostack/schema` handler functions.

v0.7 does **not** move:

- API request-body validation (still `@nekostack/api`, which consumes v0.6's runtime).
- Form input validation (still `@nekostack/form`).
- Schema migrations / migration execution (still v0.8+ per the locked ROADMAP).
- Cross-package `$ref` resolution at validation time (still future — v0.7 introduces registry lookup but the runtime parse path stays inline-only).
- Schema-version negotiation at parse time (the runtime continues to ignore registry; users call `findSchema` explicitly).

## Why this phase exists

Three problems compound when schemas live as code:

1. **Stale generated artifacts.** A schema source edit that isn't followed by regeneration leaves the generated `.zod.ts` / `.json.schema.json` / `.openapi.json` out of sync. Today nothing in CI catches this; review burden grows linearly with schema count.

2. **Implicit breaking changes.** A change like "remove a field from an enum" is a breaking change for every consumer, but the diff at the generated-artifact level looks like a normal text change. Reviewers have to know the rules in their heads.

3. **No registry-level view.** Knowing "how many schemas does this project have, and at what versions" requires `grep` across the tree. As the schema count grows (5 schemas today, 50 by v1.0), the lack of a structured view becomes a real friction.

v0.6's [`PRODUCT_THESIS`](../../../PRODUCT_THESIS.md) lens applies: the user currently does steps the package should absorb. v0.7 absorbs them.

Downstream phases also need v0.7 directly:

- **`@nekostack/migrate`** (v0.8+) — migration framework consumes the v0.7 diff classifier to know what's actually breaking.
- **`@nekostack/api`** (future) — registry lookup lets API servers ship schema versions in response headers without each consumer guessing.
- **`@nekostack/cli`** itself — every other CLI command (`neko codex export`, `neko sim run`, etc.) builds on v0.7's CLI substrate.

## Phase scope

### Schema-side primitives

```ts
// All internal-only; consumed by the CLI; not exported from src/index.ts.

// Registry — in-memory, filesystem-discovered.
export interface RegistryEntry {
  readonly schemaId: string;
  readonly schemaVersion: string;
  readonly irHash: string;
  readonly sourceHash: string;
  readonly sourcePath: string;
  readonly schema: AnySchema;
}
export function buildRegistry(opts: { roots: string[] }): Registry;
export function findSchema(
  reg: Registry,
  schemaId: string,
  version?: string,         // omitted → latest
): RegistryEntry | undefined;

// Source hashing — sha256 of the source file's text content.
export function sourceHash(filePath: string): Promise<string>;

// Diff — structural classification.
export type DiffSeverity = "breaking" | "additive" | "cosmetic";
export interface DiffChange {
  readonly severity: DiffSeverity;
  readonly path: IssuePath;
  readonly kind: DiffKind;          // locked enum; see Decision #6
  readonly before?: unknown;
  readonly after?: unknown;
  readonly message: string;
}
export function diffNodes(
  before: SchemaNode,
  after: SchemaNode,
): readonly DiffChange[];

// Handler functions for the CLI.
export function generateHandler(opts: GenerateOpts): GenerateResult;
export function checkHandler(opts: CheckOpts): CheckResult;
export function diffHandler(opts: DiffOpts): DiffResult;
export function listHandler(opts: ListOpts): ListResult;
```

### Header format extension

The deterministic `@generated` header gains one new line:

```ts
/**
 * @generated by @nekostack/schema
 * schemaId:         com.nekostack.tenant.Tenant
 * schemaVersion:    1.0.0
 * irHash:           sha256:7f3e2a9b...
 * sourceHash:       sha256:a02c4d18...      ← NEW in v0.7
 * generator:        typescript
 * generatorVersion: @nekostack/schema@0.7.0
 *
 * DO NOT EDIT MANUALLY.
 */
```

`sourceHash` is the sha256 of the originating `*.schema.ts` file's bytes. Two-hash discipline:

| `irHash` change | `sourceHash` change | Meaning |
|---|---|---|
| no | no | schema unchanged; artifact still fresh |
| **yes** | yes | semantic edit; regenerate required |
| no | **yes** | source-text edit with no semantic effect (renamed import, comment); regen safe to skip but record |
| **yes** | no | impossible without manual artifact edit; flagged as integrity error |

### Explicit non-scope

- **Persistent registry storage.** v0.7 is in-memory only. SQLite / JSON sidecar can land later if a real consumer needs cross-process state.
- **Schema migration execution.** v0.7 detects breaking changes; v0.8+ writes the migration framework. Per the locked ROADMAP.
- **Cross-package `$ref` resolution at parse time.** v0.7's registry is for tooling, not for runtime schema composition.
- **Plugin system for the CLI.** v0.7 ships the `neko schema *` family only. Plugin registration scaffolding waits until a second package needs subcommands.
- **`neko init` / `neko new` / `neko lint` / etc.** Out of v0.7 scope; see [`../../cli/docs/PHASE_PLAN_v0.7.md`](../../cli/docs/PHASE_PLAN_v0.7.md) for the locked CLI command list.
- **Public `findSchema` / `buildRegistry` exports.** Internal-only in v0.7. External consumers (e.g., `@nekostack/api`) get registry access via the CLI's JSON output mode or a future `@nekostack/registry` package.
- **Migration IR shape.** Not declared in v0.7. The diff output is what v0.8+'s migration framework will consume; the IR for migrations themselves is v0.8+'s decision.
- **Multi-workspace registry merging.** A v0.7 registry covers exactly one workspace root. Cross-workspace lookups are a v0.8+ concern.
- **Watch mode (`neko schema check --watch`).** Defer until the first consumer asks.

## Public API delta

**Zero new public exports from `packages/schema/src/index.ts`** in v0.7.

The handler functions, registry types, and diff types live behind internal paths (`packages/schema/src/registry/*`) and are imported by `@nekostack/cli` via direct subpath import. This mirrors the engine-swap-safe boundary from v0.6: a v0.8+ rewrite of the registry must not break public consumers.

The only **visible** schema-package change is the header format: every generated artifact now carries a `sourceHash` line. That's a one-line addition per existing header — no compat break for consumers that already ignore unknown header lines (the documented behavior).

## Internal file delta

```
packages/schema/src/
├── registry/                              # NEW DIRECTORY
│   ├── build-registry.ts                  # filesystem walk + Schema-import + lookup-map build
│   ├── source-hash.ts                     # sha256 over source file bytes
│   ├── diff.ts                            # SchemaNode → SchemaNode diff with severity classification
│   ├── handlers/
│   │   ├── generate.ts                    # generateHandler
│   │   ├── check.ts                       # checkHandler (freshness via irHash + sourceHash)
│   │   ├── diff.ts                        # diffHandler (wraps registry.diff for CLI consumption)
│   │   └── list.ts                        # listHandler
│   └── types.ts                           # RegistryEntry, DiffChange, DiffKind, *Opts, *Result
├── generators/
│   ├── header.ts                          # gains sourceHash line
│   └── ...                                # unchanged
└── ir/
    └── ...                                # unchanged
```

Tests:

```
packages/schema/tests/
├── registry/
│   ├── build-registry.test.ts             # filesystem walk + lookup map shape
│   ├── source-hash.test.ts                # sha256 over file bytes, deterministic
│   ├── diff-classifier.test.ts            # the Decision #6 breaking/additive/cosmetic matrix
│   ├── handler-generate.test.ts           # generateHandler I/O contract
│   ├── handler-check.test.ts              # checkHandler with stale + fresh fixtures
│   ├── handler-diff.test.ts               # diffHandler with two-version fixtures
│   └── handler-list.test.ts               # listHandler with multi-schema fixture
└── header-source-hash.test.ts             # generated headers carry the sourceHash line
```

## Dependency delta

- **No new runtime dependencies.** Filesystem walk uses Node's `node:fs` / `node:path`; sha256 via Node's `node:crypto`. `import()` for dynamic schema imports.
- **No new devDeps.** The vitest + ajv + zod setup from v0.6 covers the test surface.
- **No `@nekostack/*` imports.** Same Invariant 8 discipline.

## Decisions to lock before coding

Twelve decisions. Highest-stakes flagged.

### Registry shape (highest stakes)

1. **Registry is filesystem-discovered + in-memory per CLI invocation.** No database, no daemon. Decision basis: solo-dev scale, no cross-process invalidation problem to solve yet, simpler is better.

2. **Lookup key is `(schemaId, schemaVersion)`.** `findSchema(reg, id)` with no version returns the highest-version entry by semver compare. Multiple entries at the same `(id, version)` are an error, not a warning — caught by `buildRegistry` at construction time.

3. **Schema discovery walks for `*.schema.ts`.** Convention, not configurable in v0.7. Anonymous schemas (no `.id()`) are ignored by the registry (a warning is emitted on stderr by the CLI; not an error — anonymous schemas remain legal per v0.1).

### Hashing (load-bearing)

4. **`sourceHash` is sha256 of the source file's raw bytes.** Not the AST. Not a canonicalized form. The point is to detect any source-text edit; canonicalization would mask intentional reformatting and rebuild churn.

5. **Generated headers grow one new line: `sourceHash: sha256:<hex>`.** Positioned between `irHash` and `generator` for grep-discoverability. Existing parsers that ignore unknown header lines (the documented behavior since v0.2) keep working.

6. **The two-hash matrix is the freshness contract.**

   | `irHash` | `sourceHash` | `checkHandler` verdict |
   |---|---|---|
   | matches | matches | clean |
   | matches | differs | clean — warn on stderr (cosmetic source edit; regen optional) |
   | differs | differs | stale — regen required |
   | differs | matches | integrity error (impossible without manual artifact edit) |

### Diff classifier (load-bearing)

7. **Diff severity is `breaking | additive | cosmetic`.** Classifier walks both `SchemaNode` trees and emits `DiffChange[]`. Locked classification table:

   | Change | Severity | Notes |
   |---|---|---|
   | Add required field | breaking | consumers parsing old data fail validation |
   | Add optional / nullable / default-bearing field | additive | old data still validates |
   | Remove field (any kind) | breaking | consumers reading the field break |
   | Tighten refinement (`min` ↑, `max` ↓, `length` change, new `regex`) | breaking | inputs that passed now fail |
   | Loosen refinement (`min` ↓, `max` ↑, removed `regex`) | additive | strictly more accepting |
   | Tighten unknown-keys (`passthrough` → `strict`, `passthrough` → `stripUnknown`) | breaking | inputs with unknowns now rejected |
   | Loosen unknown-keys (`strict` → `passthrough` / `stripUnknown`) | additive | more accepting |
   | Add enum value | additive | strictly more accepting |
   | Remove enum value | breaking | inputs with that value now fail |
   | Change literal value | breaking | the only accepted value changed |
   | Add default | additive | input-optional, no break for existing inputs |
   | Remove default | breaking | now requires the value at output |
   | Change default value | breaking | downstream observers see a different filled value |
   | Change `optional` → `nullable` (and vice versa) | breaking | accepted set changes |
   | `optional` → `nullish` | additive | strictly more accepting |
   | `nullable` → `nullish` | additive | strictly more accepting |
   | Description / metadata-only edit | cosmetic | no validation effect |
   | Refinement reorder (same set, different order) | cosmetic | semantic equivalence |
   | `schemaVersion` field change | cosmetic | tracked separately |

   Edge cases land in [`docs/DIFF_CLASSIFICATION.md`](./DIFF_CLASSIFICATION.md) (new contract doc).

8. **Diff returns `readonly DiffChange[]`, never throws on classification.** Unsupported IR kinds (`date`, `union`, `recursiveRef`, `transform`) still throw `UnsupportedNodeKindError` at the boundary — same fail-loud discipline as v0.3 / v0.6.

### Handler-function contract (highest stakes)

9. **Handlers are pure functions.** No `process.exit`, no `console.log`, no `process.stdout.write`, no `process.stderr.write`. They take typed inputs, return typed outputs. The CLI owns I/O. This is the load-bearing schema/cli boundary.

10. **Handler results are discriminated unions.** Every handler returns `{ success: true; data: T } | { success: false; issues: readonly Issue[] }`. Reuse v0.6's `Issue` / `IssueCode` vocabulary; new codes (`schema_not_found`, `version_not_found`, `stale_artifact`, `duplicate_schema_id`, `integrity_error`) added per the change-control rule in [`src/errors/issue.ts`](../src/errors/issue.ts).

11. **Handlers are sync where possible, async only where filesystem requires.** `generateHandler` and `checkHandler` need to read files → async. `diffHandler` and `listHandler` operate over a pre-built registry → sync.

### Engine-swap-safety (continued from v0.6)

12. **Registry types are not on the public package surface.** Same engine-swap-safe rule as v0.6's runtime. If a future phase ships `@nekostack/registry` as its own package, this v0.7 surface can move there without breaking external consumers.

## Sequencing

Implementation order. Each numbered step is a separate commit with its own validation gate, mirroring the v0.6 sequencing discipline.

### Schema-side (this plan)

1. `src/registry/types.ts` — types only (RegistryEntry, DiffChange, DiffKind, *Opts, *Result). No logic.
2. `src/registry/source-hash.ts` — `sourceHash(filePath)` + test.
3. `src/generators/header.ts` — add `sourceHash` line emission. Regen snapshots.
4. `src/registry/build-registry.ts` — filesystem walk + Schema-import + lookup-map build + test.
5. `src/registry/diff.ts` — diff walker + classifier + the Decision #7 matrix as a test fixture set.
6. `src/registry/handlers/list.ts` — simplest handler; verifies the handler shape.
7. `src/registry/handlers/diff.ts` — wraps `diff.ts` for CLI consumption.
8. `src/registry/handlers/check.ts` — freshness via the two-hash matrix.
9. `src/registry/handlers/generate.ts` — invokes the existing v0.2–v0.6 generators.
10. `docs/DIFF_CLASSIFICATION.md` — contract doc for the breaking/additive/cosmetic table + edge cases.
11. `docs/REGISTRY.md` — contract doc for registry primitives (matches v0.6's `RUNTIME.md` shape).
12. Docs sweep (`SCOPE.md`, `INVARIANTS.md`, `ROADMAP.md`, `BOUNDARIES.md`, `USAGE.md`, `EXAMPLES.md`).
13. `GENERATOR_VERSION` bump to `@nekostack/schema@0.7.0`; regenerate v0.2 / v0.3 / v0.4 / v0.5 / v0.6 header snapshots (mechanical churn — only the version + new `sourceHash` line changes per file).

### CLI-side (companion plan)

See [`../../cli/docs/PHASE_PLAN_v0.7.md`](../../cli/docs/PHASE_PLAN_v0.7.md). Roughly:

14. Bin shape (`bin/neko`), argv parsing setup, exit-code table.
15. `neko schema list` — simplest dispatch; verifies the wiring.
16. `neko schema diff <a> <b>` — pretty + `--json` output.
17. `neko schema check [pattern]` — exit-nonzero gate.
18. `neko schema generate [pattern]` — last because it writes to disk.
19. CLI ROADMAP / SCOPE / INVARIANTS docs.

## Estimate

**6–8 focused days.** Larger than v0.6 because:

- Two packages instead of one, with a strict ownership boundary that has to hold.
- The diff classifier is genuinely subtle — every row of the locked table needs a fixture pair, and edge cases (multiple simultaneous changes; combined modifier flips) need explicit coverage.
- CLI testing infrastructure is new territory for this codebase; expect ~half a day of harness setup before commands start landing.
- `GENERATOR_VERSION` bump touches every existing snapshot once for the version, again for the `sourceHash` line — two-step regen with a verification pass after each.

Risk areas:

- **Diff classification correctness.** The locked table is correct in the common case; edge cases will surface during implementation. Mitigation: every table row has a fixture; CI gate fails the PR if any fixture's emitted severity differs from the table.
- **Filesystem walk performance.** Workspaces with hundreds of schema files would slow `neko schema check`. Mitigation: stat-skip files whose mtime hasn't changed since the last successful generate (sourceHash cache via `.neko/registry-cache.json`). Defer if not needed; current 5-schema scale is far below the threshold.
- **CLI cross-platform behavior.** Windows path separators, exit code semantics, terminal encoding. Mitigation: vitest snapshot tests use a normalized harness; CI runs on Windows + Linux + macOS.

## What this plan does NOT decide

- **Whether `findSchema` should also accept a `latestStable` predicate.** v0.7 ships `version === undefined` → highest version. A `latestStable` mode that excludes pre-1.0 or rc tags could land later.
- **Whether the diff output should include a Markdown renderer.** v0.7 emits structured `DiffChange[]`; the CLI prints a pretty table. A Markdown variant for GitHub PR comments could land as a `formatDiff(changes, "markdown")` later.
- **Whether `neko schema check` should auto-regenerate (`--fix`).** v0.7 ships check + generate as separate verbs; the `--fix` shortcut is a UX call best made after real consumer feedback.
- **CLI plugin registration.** Deferred; ships when a second package needs subcommands.
- **A `neko schema validate <file>` runtime-data command.** Different concern from registry/freshness; the v0.6 runtime is already importable. May land in v0.7.1 if a consumer asks.
- **`.neko/registry-cache.json` mtime-skip optimization.** Listed as a mitigation; defer to v0.7.1 unless real usage forces it earlier.

## Decision history

- **v0.7-plan, initial draft** — 12 decisions, plan-only PR. Joint schema + cli phase. First plan to span two packages; the schema/cli ownership boundary in §"Thesis-fit > User-facing verb / API" is load-bearing for keeping the two implementations from creeping into each other.

  Key shape choices baked in by the audit before drafting:
  - Joint plan in one PR across two parallel files (`packages/schema/docs/PHASE_PLAN_v0.7.md` master + `packages/cli/docs/PHASE_PLAN_v0.7.md` companion). Two files mirror per-package phase plan convention; one PR keeps the boundary aligned at review time.
  - CLI scope locked to schema commands only. Plugin scaffolding, `init`, `new`, `lint`, etc. are deferred to later phases — the ROADMAP framing of "v0.7 — Registry-lite + CLI" is honored, but "CLI" means "the `neko schema *` family," not "everything in `packages/cli/README.md`."
  - Migrations stay in v0.8+. v0.7 detects breaking changes; v0.8+ migrates them.

## Open questions for the audit

- **Decision #7 (diff classification table) — the round-up.** Every row is the conservative read; `optional` → `nullable` is rowed as breaking because the accepted set genuinely changes (null OK in one, undefined OK in the other, neither is a superset). If a consumer's data only ever uses one of the two, the round-up is theatre. Worth confirming the round-up is the right default.
- **Decision #9 (handler purity).** v0.7's handlers are pure. A future "stream-while-walking" mode for very large workspaces would need async generators or an event-emitter shape. Confirm pure-and-buffered is the right v0.7 baseline.
- **The `sourceHash` row's `differs / matches` integrity-error case.** This represents either a hand-edit of a generated file or a hash collision (the latter being astronomically unlikely). The CLI should fail loudly; auto-regenerating would mask the underlying problem. Confirm "integrity error, exit nonzero" is the right behavior.
- **GENERATOR_VERSION bump shape.** Step 13 bumps to `@nekostack/schema@0.7.0`. Every existing snapshot gains the new `sourceHash` line AND the new version string in a single regen pass — that's 62 files × 2 lines changed each, not 62 × 1. Confirm the two-line regen is acceptable, or whether `sourceHash` introduction should be a separate intermediate step before the version bump.
