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

v0.7's registry is **in-memory and pure**. The schema package never touches the filesystem. The CLI walks the workspace, dynamic-imports each `.schema.ts` / `.schema.js` file, reads the source text, then hands the loaded entries to `@nekostack/schema` as data:

```ts
// @nekostack/cli (filesystem-aware)
const entries: RegistrySourceEntry[] = await loadSchemaFiles(roots);

// @nekostack/schema (pure — no I/O; buildRegistry returns Result because
// duplicate (schemaId, schemaVersion) is reported as an Issue, never thrown)
const registryResult = buildRegistry(entries);
if (!registryResult.success) {
  return formatIssuesAndExit(registryResult.issues); // CLI-side
}
const registry = registryResult.data;
const result = diffHandler({ registry, before, after });
```

`@nekostack/cli` owns:
- workspace root resolution + glob expansion
- dynamic schema-file loading (the chosen TS-loader strategy is **Decision #2** below)
- filesystem reads (source text, committed artifacts) and writes (regenerated artifacts)
- stdout / stderr formatting
- process exit codes

`@nekostack/schema` owns:
- pure registry construction from loaded entries
- `sourceHashFromText(sourceText)` (no path argument)
- diff classifier (pure `SchemaNode` → `SchemaNode`)
- freshness classifier (pure: compares loaded source text + committed artifact bytes)
- generation **planning** (computes what should be written; returns a `GenerationPlan` the CLI executes)
- typed handler-result shapes (`Result<T>`)

Handler functions on the schema side are **pure**. They:
- Take typed opts (already-loaded entries, parsed artifact strings, etc.)
- Return `Result<T>` with `Issue[]` on failure
- Never call `process.exit`, `console.log`, `process.stdout.write`, `process.stderr.write`
- Never call `fs.*`, `path.resolve` against the user's workspace, or `import()` against a user file

The schema/cli boundary is what makes v0.7 testable in vitest without spawning subprocesses, and what makes a future `@nekostack/registry` extraction a no-op for consumers.

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

### Schema-side primitives (pure, data-in / data-out)

```ts
// All exported only from the package-internal `@nekostack/schema/cli`
// integration subpath. Root `@nekostack/schema` keeps the v0.6 surface
// (s, parse, safeParse, validate, ParseError, ...). See Decision #5.

// ---- Registry input (CLI fills these in by reading the filesystem) ----
export interface RegistrySourceEntry {
  readonly sourcePath: string;        // relative-to-workspace, presentation only
  readonly sourceText: string;        // raw file bytes as utf-8
  readonly schemas: readonly AnySchema[]; // every `export const X = s.object(...)` in the file
}

// ---- Registry output ----
export interface RegistryEntry {
  readonly schemaId: string;
  readonly schemaVersion: string | undefined; // undefined if .version() not set
  readonly irHash: string;            // sha256:<hex>
  readonly sourceHash: string;        // sha256:<hex> of the source file
  readonly sourcePath: string;        // copied from RegistrySourceEntry
  readonly schema: AnySchema;
}
export type Registry = ReadonlyMap<string, ReadonlyMap<string, RegistryEntry>>;
//                                  ^id              ^version

// buildRegistry returns Result<Registry> because duplicate
// (schemaId, schemaVersion) entries are reported as an Issue with code
// `duplicate_schema_id`, never thrown (Decision #4 + Decision #15).
export function buildRegistry(
  entries: readonly RegistrySourceEntry[],
): Result<Registry>;

export function findSchema(
  reg: Registry,
  schemaId: string,
  version?: string,                   // omitted → highest by semver
): RegistryEntry | undefined;

// ---- Source hashing ----
// Pure: takes the source text the CLI already read. No filesystem access.
export function sourceHashFromText(sourceText: string): `sha256:${string}`;

// ---- Diff ----
export type DiffSeverity = "breaking" | "additive" | "cosmetic";
export interface DiffChange {
  readonly severity: DiffSeverity;
  readonly path: IssuePath;
  readonly kind: DiffKind;            // locked enum; see Decision #7
  readonly before?: unknown;
  readonly after?: unknown;
  readonly message: string;
}
export function diffNodes(
  before: SchemaNode,
  after: SchemaNode,
): readonly DiffChange[];

// ---- Handler functions (pure; CLI calls these and owns I/O) ----
//
// All handlers return Result<T>. None of them call fs.*, import(),
// process.exit, console.log, or process.stdout.write.

export interface GenerateOpts {
  readonly entries: readonly RegistrySourceEntry[];
  // No `kinds` filter in v0.7. Generation writes all four artifact kinds
  // (TS / Zod / JSON Schema / OpenAPI) per Decision #6's artifact-layout
  // contract. Partial generation is deferred — `check` would not be able
  // to distinguish intentional absence from staleness without it.
}
export interface GeneratedArtifact {
  readonly schemaId: string;
  readonly kind: GeneratorKind;
  readonly suggestedPath: string;     // relative to source dir; see Decision #6
  readonly content: string;
  readonly irHash: string;
  readonly sourceHash: `sha256:${string}`;
}
export type GenerateResult = Result<{ artifacts: readonly GeneratedArtifact[] }>;
export function generateHandler(opts: GenerateOpts): GenerateResult;

export interface CheckOpts {
  readonly entries: readonly RegistrySourceEntry[];
  readonly committedArtifacts: readonly CommittedArtifact[]; // CLI loads these
}
export interface CommittedArtifact {
  readonly path: string;
  readonly content: string;           // bytes as read from disk
}
export type FreshnessVerdict =
  | { readonly status: "clean" }
  | { readonly status: "cosmetic_drift"; readonly artifactPath: string } // sourceHash differs, irHash matches
  | { readonly status: "stale"; readonly artifactPath: string }          // irHash differs
  | { readonly status: "integrity_error"; readonly artifactPath: string }; // see Decision #6
export type CheckResult = Result<{ verdicts: readonly FreshnessVerdict[] }>;
export function checkHandler(opts: CheckOpts): CheckResult;

export interface DiffOpts {
  readonly before: SchemaNode;
  readonly after: SchemaNode;
}
export type DiffResult = Result<{
  readonly changes: readonly DiffChange[];
  readonly worstSeverity: DiffSeverity | null; // null if no changes
}>;
export function diffHandler(opts: DiffOpts): DiffResult;

export interface ListOpts {
  readonly registry: Registry;
}
export type ListResult = Result<{ entries: readonly RegistryEntry[] }>;
export function listHandler(opts: ListOpts): ListResult;
```

**No filesystem access from schema-side handlers.** The CLI does every read and every write; the schema package computes and returns. This is the load-bearing schema/cli boundary; locking it now prevents `console.log` from creeping into a handler the first time someone wants a "quick diagnostic" message.

### Provenance extension — `sourceHash` propagates differently per artifact kind

TS and Zod artifacts carry provenance in a JSDoc comment header. JSON Schema and OpenAPI artifacts carry provenance in the `x-nekostack` extension object (JSON has no comment syntax). v0.7 adds `sourceHash` to **both** carriers, with format chosen per artifact.

**TS and Zod (JSDoc header):**

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

**JSON Schema and OpenAPI (`x-nekostack` extension):**

```json
{
  "x-nekostack": {
    "generator": "jsonSchema",
    "generatorVersion": "@nekostack/schema@0.7.0",
    "irHash": "sha256:7f3e2a9b...",
    "sourceHash": "sha256:a02c4d18...",
    "schemaId": "com.nekostack.tenant.Tenant",
    "schemaVersion": "1.0.0"
  }
}
```

**Generator signatures gain a provenance option** (see Decision #8 for the locked shape):

```ts
generateTypeScript(node, { sourceHash });
generateZod(node, { sourceHash });
generateJsonSchema(node, { sourceHash });
generateOpenApiSchemaComponent(node, { sourceHash });
```

`sourceHash` is the sha256 of the originating `*.schema.ts` file's bytes, computed via `sourceHashFromText`. The CLI passes it through to the generators. Direct generator calls (e.g., from a vitest-snapshot test) may omit it; when omitted, TS/Zod emit no `sourceHash:` header line and JSON/OpenAPI omit `x-nekostack.sourceHash`. No `null` is ever written. See Decision #8 for the locked rules.

### Freshness verdict — two-hash discipline

`checkHandler` compares the loaded schema source against the committed artifact's recorded hashes (parsed from the JSDoc header for TS/Zod, from `x-nekostack` for JSON/OpenAPI):

| Source `irHash` | Source `sourceHash` | `checkHandler` verdict |
|---|---|---|
| matches recorded | matches recorded | **clean** |
| matches recorded | differs from recorded | **cosmetic_drift** — source text edited but IR unchanged; warning on stderr, regen optional, CI passes |
| differs from recorded | differs from recorded | **stale** — semantic edit; regen required, exit nonzero |
| differs from recorded | matches recorded | **integrity_error** — impossible without a manual artifact edit (or hash collision); exit code 4, do not auto-regen |

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

**Zero new public exports from root `packages/schema/src/index.ts`** in v0.7.

The handler functions, registry types, and diff types are exported only from the package-internal integration subpath `@nekostack/schema/cli`. They are not exported from root `@nekostack/schema`. `package.json` gains the `exports` map that wires `"./cli"` to `src/cli-integration.ts` per Decision #10.

This mirrors the engine-swap-safe boundary from v0.6: a v0.8+ rewrite of the registry must not break root-public consumers. External consumers (apps importing `@nekostack/schema`) only see the v0.6 runtime surface; the `@nekostack/schema/cli` subpath is documented as internal-only and is intended for `@nekostack/cli` in v0.7.

The only **visible** schema-package change beyond the subpath is the provenance format: TS/Zod artifacts gain a `sourceHash:` JSDoc line; JSON/OpenAPI artifacts gain `x-nekostack.sourceHash`. Both are additive — consumers that ignore unknown header lines or unknown `x-nekostack` fields (the documented behavior) keep working.

## Internal file delta

```
packages/schema/
├── package.json                            # gains "exports" map ("." + "./cli")
└── src/
    ├── cli-integration.ts                  # NEW — public-by-subpath barrel: re-exports
    │                                         #       buildRegistry / findSchema /
    │                                         #       sourceHashFromText / diffNodes /
    │                                         #       *Handler / Registry / *Result types
    ├── registry/                           # NEW DIRECTORY (pure; no filesystem)
    │   ├── build-registry.ts               # buildRegistry(entries) — pure;
    │                                       #   Result<Registry>; duplicate
    │                                       #   (id, version) → duplicate_schema_id
    │   ├── source-hash.ts                  # sourceHashFromText(text) — pure
    │   ├── parse-provenance.ts             # NEW — parses JSDoc-header + x-nekostack
    │   ├── diff.ts                         # SchemaNode → SchemaNode diff classifier
    │   ├── handlers/
    │   │   ├── generate.ts                 # generateHandler (returns GeneratedArtifact[])
    │   │   ├── check.ts                    # checkHandler (returns FreshnessVerdict[])
    │   │   ├── diff.ts                     # diffHandler
    │   │   └── list.ts                     # listHandler
    │   └── types.ts                        # RegistrySourceEntry, RegistryEntry, Registry,
    │                                         #       DiffChange, DiffKind, FreshnessVerdict,
    │                                         #       CommittedArtifact, *Opts, *Result
    ├── generators/
    │   ├── header.ts                       # ProvenanceOptions support; sourceHash line
    │   │                                     #   emitted iff sourceHash is provided
    │   ├── ts.ts                           # accepts ProvenanceOptions
    │   ├── zod.ts                          # accepts ProvenanceOptions
    │   ├── json-schema.ts                  # accepts ProvenanceOptions; x-nekostack.sourceHash
    │   ├── openapi.ts                      # accepts ProvenanceOptions; x-nekostack.sourceHash
    │   ├── types.ts                        # ProvenanceOptions added to GeneratorOptions
    │   └── ...                             # unchanged
    └── ir/
        └── ...                             # unchanged
```

Tests:

```
packages/schema/tests/
├── registry/
│   ├── build-registry.test.ts              # entries → lookup-map shape; duplicate detection
│   ├── source-hash.test.ts                 # deterministic; same text → same hash
│   ├── parse-provenance.test.ts            # JSDoc-header + x-nekostack parsing; old-artifact
│   │                                       #   (no sourceHash) tolerance
│   ├── diff-classifier.test.ts             # every row of Decision #12 has a fixture pair
│   ├── handler-generate.test.ts            # entries → GeneratedArtifact[] (no filesystem)
│   ├── handler-check.test.ts               # two-hash matrix: clean / cosmetic_drift / stale /
│   │                                       #   integrity_error fixtures
│   ├── handler-diff.test.ts                # diffHandler with two-version fixtures
│   ├── handler-list.test.ts                # multi-schema registry → entries
│   └── handler-purity.test.ts              # NEW — handlers do not call fs.* / import() /
│                                            #   process.exit / console.* (asserted via spies)
├── registry-surface.test.ts                # NEW — @nekostack/schema/cli subpath exports the
│                                              #   v0.7 surface; root does not
├── public-surface.test.ts                  # extended — root still does not export registry
│                                              #   handlers (regression gate from v0.6)
├── generators/
│   └── provenance-options.test.ts          # NEW — every generator emits sourceHash when
│                                              #   provided, omits the field/line when not
└── header-source-hash.test.ts              # generated headers carry sourceHash when emitted
```

## Dependency delta

**Schema-side:**
- **No new runtime dependencies.** sha256 via Node's `node:crypto`. No filesystem access from the schema package, so no `node:fs` import either.
- **No new devDeps.** The vitest + ajv + zod setup from v0.6 covers the test surface.
- **No `@nekostack/*` imports.** Same Invariant 8 discipline.

**CLI-side** (see [the CLI plan](../../cli/docs/PHASE_PLAN_v0.7.md) for the full delta):
- New runtime deps: `commander` (argv), `tsx` (schema TS loading), `@nekostack/schema` (workspace `*`).
- The `tsx` dependency is the only one a v0.6-era user did not already have transitively; it's a CLI concern, not a schema concern. The schema package's own consumers do not gain `tsx`.

## Decisions to lock before coding

Sixteen decisions. Highest-stakes flagged.

### Schema/CLI boundary (highest stakes)

1. **Schema-side handlers are pure functions with no filesystem access.**
   - No `fs.*`, no `import()` against user files, no `path.resolve` against the workspace.
   - No `process.exit`, no `console.log`, no `process.stdout.write`, no `process.stderr.write`.
   - Handlers take loaded `RegistrySourceEntry[]` / `CommittedArtifact[]` / `Registry` etc. as typed input and return `Result<T>`.

   **The CLI owns:** workspace root resolution, glob expansion, schema module loading, source-text reading, committed-artifact reading, artifact writing, stdout / stderr formatting, process exit codes.

   **The schema package owns:** pure registry construction, `sourceHashFromText`, diff classifier, freshness verdict computation, generation **planning** (returns a list of artifacts the CLI writes; does not write itself), typed `Result<T>` shapes.

   This is the contract that lets the schema-side tests run in vitest without subprocess spawning, and that lets a future `@nekostack/registry` extraction be a no-op for consumers.

### Schema module loading (highest stakes — CLI-side; mirrored here because the master plan's primitives consume what the loader produces)

2. **The CLI uses `tsx` as the runtime TS loader for `*.schema.ts` files.**
   - Vendored as a regular runtime dependency of `@nekostack/cli`.
   - `*.schema.ts` files are loaded **in-process** via `tsx`'s ESM loader hook; no separate child process per file.
   - `*.schema.js` files are also loaded (anyone who pre-compiles their schemas to JS gets `neko schema *` working with no extra setup).
   - Schema files execute in-process. Side effects at module-load time are the user's responsibility; the CLI does not sandbox. Documented in the CLI's `SCOPE.md` (added during implementation).
   - Load failures (compile error, missing export, runtime exception inside the file) surface as `Issue[]` with code `schema_load_failed` and CLI exit code 3 (I/O error class).
   - Alternative considered: `jiti`. Roughly equivalent capability; `tsx` chosen because it follows Node ESM semantics more closely and the team is more familiar with it. The CLI plan locks this in [Decision #1 there](../../cli/docs/PHASE_PLAN_v0.7.md).
   - Alternative considered: precompiled-JS-only. Rejected because the ROADMAP explicitly says `*.schema.ts`; forcing users to add a TS → JS build step before they can use `neko schema *` breaks the workflow-replacement thesis.

### Registry shape

3. **Registry is in-memory per CLI invocation.** No database, no daemon, no IPC. Built from `RegistrySourceEntry[]` the CLI provides; reused across handler calls within the same invocation.

4. **Lookup key is `(schemaId, schemaVersion)`.** `findSchema(reg, id)` with no version returns the highest-version entry by semver compare. Multiple entries at the same `(id, version)` are an error caught by `buildRegistry` at construction time — surfaces as an `Issue` with code `duplicate_schema_id`, never via `throw`.

5. **Anonymous schemas (no `.id()`) are ignored by the registry.** The CLI emits a stderr warning per anonymous schema it finds. Anonymous schemas remain legal per v0.1; they just don't participate in registry lookup.

### Artifact path mapping (highest stakes)

6. **Source → generated artifact paths follow a fixed convention.**

   ```text
   <schema-dir>/<basename>.schema.ts
     ↓
   <schema-dir>/generated/<basename>.types.ts
   <schema-dir>/generated/<basename>.zod.ts
   <schema-dir>/generated/<basename>.json.schema.json
   <schema-dir>/generated/<basename>.openapi.json
   ```

   Mirrors the convention already in `packages/schema/examples/generated/` so existing artifacts pass `neko schema check` without renaming.

   Locked behaviors:

   | Concern | Behavior |
   |---|---|
   | Overwrite | `generate` overwrites by default. Use `neko schema check` for the no-write preflight. |
   | Missing artifact | `check` treats as **stale** (the four artifact kinds are mandatory in v0.7) |
   | Extra / unexpected artifact in `generated/` | `check` warns on stderr but does NOT fail; v0.7 does not own pruning |
   | "Partial" generation (only some kinds) | **Not supported in v0.7.** `generate` writes all four artifact kinds; `check` expects all four. Partial generation would create freshness ambiguity (`check` can't tell intentional absence from staleness) and is deferred until that distinction has a real consumer. |
   | Stale-artifact pruning | Out of v0.7 scope (a future `neko schema prune` could land in v0.8+) |
   | Committed in git | Convention — yes, per the existing examples — but the CLI does not enforce |

   The schema package's `generateHandler` returns `GeneratedArtifact[]` with `suggestedPath` set per this convention; the CLI writes them at those paths relative to each source file's directory.

### Hashing

7. **`sourceHash` is sha256 of the source file's raw UTF-8 bytes.** Not the AST. Not a canonicalized form. The point is to detect *any* source-text edit; canonicalization would mask intentional reformatting and rebuild churn.

   `sourceHashFromText(sourceText: string): \`sha256:${string}\`` is the pure entry point. The CLI reads the file, hands the text in, gets the hash out. Schema package never touches the path.

### sourceHash propagation (load-bearing)

8. **Generators take a new `ProvenanceOptions` slice.**

   ```ts
   interface ProvenanceOptions {
     readonly sourceHash?: `sha256:${string}`;  // optional; omitted == "unknown"
   }

   // Each generator's existing options interface gains the ProvenanceOptions members.
   generateTypeScript(node, { mode, sourceHash });
   generateZod(node, { sourceHash });
   generateJsonSchema(node, { idBase, sourceHash });
   generateOpenApiSchemaComponent(node, { sourceHash });
   ```

   Locked rules:
   - The CLI passes `sourceHash` through to every generator call.
   - Direct generator calls (vitest snapshot tests, ad-hoc scripts) may omit `sourceHash`. When omitted:
     - **TS / Zod header**: the `sourceHash:` line is **omitted entirely** (not emitted as `null`). Keeps the JSDoc clean.
     - **JSON Schema / OpenAPI `x-nekostack`**: the `sourceHash` field is **omitted** (not `null`). Canonical JSON has no `undefined`.
   - Header / `x-nekostack` parsers tolerate both shapes:
     - **Old artifact** (pre-v0.7, no `sourceHash`) → treated as `sourceHash: undefined` by `checkHandler` → freshness verdict can only be derived from `irHash`; missing `sourceHash` is **not** an integrity error in v0.7.
     - **New artifact** (v0.7+, has `sourceHash`) → full two-hash matrix applies.
   - The "old artifact compatibility" provision is deliberate: regenerating every artifact on the GENERATOR_VERSION bump means existing v0.6 artifacts gain `sourceHash` mechanically (Sequencing step 13). Until that pass runs, mixed states must work.

9. **Header / provenance parsing lives in one new module.** `src/registry/parse-provenance.ts` — handles both the JSDoc-header shape (TS / Zod) and the `x-nekostack` shape (JSON Schema / OpenAPI). Symmetric with the emitter side; both consumers (the v0.6 regenerate test + the v0.7 `checkHandler`) use it.

### Cross-package integration surface (highest stakes)

10. **Schema-side v0.7 surface ships behind `@nekostack/schema/cli`, not on the root.**

    `package.json` gains an `exports` map:

    ```json
    {
      "exports": {
        ".":     { "import": "./src/index.ts", "types": "./src/index.ts" },
        "./cli": { "import": "./src/cli-integration.ts", "types": "./src/cli-integration.ts" }
      }
    }
    ```

    Root `@nekostack/schema` keeps the v0.6 surface (`s`, `parse`, `safeParse`, `validate`, `ParseError`, IR types, generators). The new v0.7 surface — `buildRegistry`, `findSchema`, `sourceHashFromText`, `diffNodes`, `generateHandler`, `checkHandler`, `diffHandler`, `listHandler`, plus the `RegistrySourceEntry` / `RegistryEntry` / `Registry` / `*Opts` / `*Result` / `DiffChange` / `FreshnessVerdict` types — lives behind `@nekostack/schema/cli`.

    Consumer rule:
    ```ts
    // @nekostack/cli only
    import { listHandler, diffHandler, checkHandler, generateHandler }
      from "@nekostack/schema/cli";
    ```

    Documented in `docs/REGISTRY.md` (new): **`@nekostack/schema/cli` is a NekoStack-internal integration surface, not the public consumer API.** External consumers (apps importing `@nekostack/schema`) get the runtime via the v0.6 root surface; they do not import from `/cli`.

    Tests gate both directions:
    - `tests/public-surface.test.ts` — root `@nekostack/schema` does **not** export registry handlers.
    - `tests/registry-surface.test.ts` (new) — `@nekostack/schema/cli` **does** export the v0.7 handlers + types.

### Diff classifier (load-bearing)

11. **Diff severity is `breaking | additive | cosmetic`.** The classifier evaluates **input-acceptance compatibility**: would data that the *old* schema accepted still be accepted by the *new* schema? If no → breaking. If yes and old data may even reject new acceptable inputs → additive. If old and new accept identical sets → cosmetic.

    Output-shape compatibility is **a separate concern** noted on individual rows where it diverges from input compatibility (e.g., removing a `default` keeps input compatibility but breaks consumers expecting the field to be populated at output). The diff classifier in v0.7 outputs a single severity per change; consumers needing output-side reasoning read the `kind` field on each `DiffChange` and apply their own lens.

12. **Locked classification table.**

    | Change | Severity | Notes |
    |---|---|---|
    | Add **required** field | breaking | old data lacking the field now fails |
    | Add **nullable-only** field (required key, value may be null) | breaking | nullable does not imply optional — old data lacking the field still fails |
    | Add **optional** field | additive | absence permitted; old data still validates |
    | Add **nullish** field (optional + nullable) | additive | absence permitted |
    | Add **default-bearing** field | additive | input-optional; old data still validates and gains the default at output |
    | Remove field (any kind) | breaking | consumers reading the field break; old data with the field newly becomes unknown-key |
    | Tighten refinement (`min` ↑, `max` ↓, `length` change, new `regex`) | breaking | inputs that passed now fail |
    | Loosen refinement (`min` ↓, `max` ↑, removed `regex`) | additive | strictly more accepting |
    | Tighten unknown-keys (`passthrough` → `strict`, `passthrough` → `stripUnknown`) | breaking | inputs with unknowns now rejected |
    | Loosen unknown-keys (`strict` → `passthrough` / `stripUnknown`) | additive | more accepting |
    | Add enum value | additive | strictly more accepting |
    | Remove enum value | breaking | inputs with that value now fail |
    | Change literal value | breaking | the only accepted value changed |
    | Add `default` to existing required field | additive | input becomes more permissive (now input-optional). Output remains required. The default only affects newly-accepted missing-input cases; existing inputs are unaffected. |
    | Remove `default` from a default-bearing field | breaking | field flips to input-required AND output-required loses the fill |
    | Change default value | breaking | downstream observers see a different filled value at output |
    | `optional` → `nullable` (drop optional, add nullable) | breaking | now requires presence; old data lacking the key fails |
    | `nullable` → `optional` (drop nullable, add optional) | breaking | now rejects `null`; old data with `null` fails |
    | `optional` → `nullish` (add nullable to existing optional) | additive | strictly more accepting (null now ok) |
    | `nullable` → `nullish` (add optional to existing nullable) | additive | strictly more accepting (absence now ok) |
    | `nullish` → `optional` or `nullish` → `nullable` | breaking | drops half of the previously-accepted absence/null permission |
    | Description / metadata-only edit | cosmetic | no validation effect |
    | Refinement reorder (same set, different order) | cosmetic | semantic equivalence; the v0.2 ZOD_MODIFIER_ORDERING contract guarantees order normalization |
    | `schemaVersion`-only change | cosmetic | tracked separately |

    Edge cases and worked examples land in [`docs/DIFF_CLASSIFICATION.md`](./DIFF_CLASSIFICATION.md) (new contract doc).

13. **`schemaVersion`-only changes are cosmetic; `schemaVersion` changes alongside structural changes inherit the highest structural severity.**

    Rationale: bumping `.version("1.0.0")` → `.version("2.0.0")` with no other change is a metadata edit; the classifier surfaces it as cosmetic but consumers may treat the version itself as the breaking signal. When the version change is *paired* with structural changes, the diff result's `worstSeverity` is the highest structural severity, not "cosmetic." This matches what the CLI prints — `neko schema diff` reports the worst severity, never silently demoting a breaking change to cosmetic because the user also bumped the version field.

14. **Diff returns `readonly DiffChange[]`, never throws on classification.** Unsupported IR kinds (`date`, `union`, `recursiveRef`, `transform`) still throw `UnsupportedNodeKindError` at the boundary — same fail-loud discipline as v0.3 / v0.6.

### Handler-function contract

15. **Handler results are discriminated unions.** Every handler returns `{ success: true; data: T } | { success: false; issues: readonly Issue[] }`. Reuse v0.6's `Issue` / `IssueCode` vocabulary; new codes (`schema_load_failed`, `schema_not_found`, `version_not_found`, `stale_artifact`, `cosmetic_drift`, `duplicate_schema_id`, `integrity_error`) added per the change-control rule in [`src/errors/issue.ts`](../src/errors/issue.ts).

### Engine-swap-safety (continued from v0.6)

16. **Registry types are not on the **root** public package surface.** Same engine-swap-safe rule as v0.6's runtime. The `/cli` subpath exposes the v0.7 surface to one specific internal consumer; if a future phase ships `@nekostack/registry` as its own package, this v0.7 surface moves there with no impact on root consumers.

## Sequencing

Implementation order. Each numbered step is a separate commit with its own validation gate, mirroring the v0.6 sequencing discipline.

### Schema-side (this plan)

1. `src/registry/types.ts` — types only (`RegistrySourceEntry`, `RegistryEntry`, `Registry`, `DiffChange`, `DiffKind`, `FreshnessVerdict`, `CommittedArtifact`, `*Opts`, `*Result`). No logic.
2. `src/registry/source-hash.ts` — `sourceHashFromText(text)` + test. Pure; no filesystem.
3. `src/generators/types.ts` — `ProvenanceOptions` added to `GeneratorOptions`. Per-generator options gain the slice. No behavior change yet.
4. `src/generators/header.ts` + per-generator emit paths — emit `sourceHash` (JSDoc line for TS/Zod; `x-nekostack.sourceHash` for JSON/OpenAPI) **only when provided**. Regen all v0.2/v0.3/v0.4/v0.5/v0.6 snapshots — since tests still call generators without provenance options, snapshots stay byte-identical (no `sourceHash` field appears). This is the gate that proves backward compatibility.
5. `src/registry/parse-provenance.ts` — parses both JSDoc-header and `x-nekostack` shapes; tolerates absent `sourceHash` for v0.6-era artifacts. Tests cover both formats and the old-artifact-missing-sourceHash case.
6. `src/registry/build-registry.ts` — `buildRegistry(entries)` (pure; returns `Result<Registry>`) + `findSchema` + duplicate-detection (failure path emits `duplicate_schema_id` Issue, never throws). Tests use hand-constructed entries, not filesystem fixtures; duplicate-detection test asserts `success: false` with the expected `issues[0].code`, not a `toThrow`.
7. `src/registry/diff.ts` — diff walker + classifier + Decision #12 matrix as a test fixture set. Each row of the table gets a fixture pair; the test asserts on `severity` per pair.
8. `src/registry/handlers/list.ts` — simplest handler; verifies the handler shape and the `Result<T>` discriminated-union contract.
9. `src/registry/handlers/diff.ts` — wraps `diffNodes` + computes `worstSeverity` for CLI consumption.
10. `src/registry/handlers/check.ts` — freshness via the two-hash matrix (the locked rule in §"Freshness verdict" derived from Decision #7). Operates on `CommittedArtifact[]` the CLI provides; no filesystem.
11. `src/registry/handlers/generate.ts` — invokes the v0.2–v0.6 generators with `ProvenanceOptions`. Returns `GeneratedArtifact[]` with `suggestedPath` per Decision #6's artifact-layout convention. No `fs.writeFile`.
12. `src/registry/handlers/handler-purity.test.ts` — gate test that asserts none of the four handlers call `fs.*`, `import()`, `process.exit`, `console.*`, or `process.stdout.write` / `process.stderr.write`. Spy on those names during a representative handler invocation; fail the test if any spy is called.
13. `src/cli-integration.ts` — barrel re-export of the v0.7 surface for the `@nekostack/schema/cli` subpath.
14. `package.json` `exports` map — `"."` + `"./cli"` per Decision #10.
15. `tests/registry-surface.test.ts` — `@nekostack/schema/cli` exports the v0.7 surface; gate test.
16. `tests/public-surface.test.ts` extension — root `@nekostack/schema` does NOT export any v0.7 registry name (regression-gate for the engine-swap-safe boundary).
17. `docs/DIFF_CLASSIFICATION.md` — contract doc for the breaking/additive/cosmetic table + edge cases + the input-vs-output-compatibility lens.
18. `docs/REGISTRY.md` — contract doc for registry primitives (matches v0.6's `RUNTIME.md` shape; documents the `@nekostack/schema/cli` subpath as internal-only).
19. Docs sweep (`SCOPE.md`, `INVARIANTS.md`, `ROADMAP.md`, `BOUNDARIES.md`, `USAGE.md`, `EXAMPLES.md`).
20. `GENERATOR_VERSION` bump to `@nekostack/schema@0.7.0`. Two-stage regen so the diff stays auditable:
    - **20a:** version-line bump only (mechanical, mirrors v0.6 Step 12; 62 files × 1 line changed).
    - **20b:** add `sourceHash` provenance to the example artifacts only (CLI doesn't exist yet during this step — the snapshot tests update via a small helper that loads source via `node:fs` from the test harness). Snapshot tests stay sourceHash-free.

### CLI-side (companion plan)

See [`../../cli/docs/PHASE_PLAN_v0.7.md`](../../cli/docs/PHASE_PLAN_v0.7.md). Steps 21–34 roughly:

21. `packages/cli/package.json` — `bin`, `commander`, `tsx`, `@nekostack/schema` (workspace).
22. CLI `tsx` loader integration — load a `*.schema.ts` file, return the exported `Schema` instances + source text.
23. CLI workspace walker — `loadSchemaFiles(roots)` produces `RegistrySourceEntry[]`.
24. CLI artifact reader — for `check`, reads each `<generated>/*.{types,zod,json.schema,openapi}.{ts,json}` into `CommittedArtifact[]`.
25. `bin/neko` shebang + `src/cli.ts` argv parse + dispatch.
26. `src/exit-codes.ts` locked enum.
27. `src/formatters/{pretty,json}.ts`.
28. `src/commands/schema/list.ts` — simplest dispatch.
29. `src/commands/schema/diff.ts` — `<a>` / `<b>` resolution + dispatch.
30. `src/commands/schema/check.ts` — exit-1 / exit-4 paths.
31. `src/commands/schema/generate.ts` — writes the `GeneratedArtifact[]` payload at the suggested paths.
32. `tests/cli-harness.ts` — in-process invocation.
33. `tests/commands/schema-*.test.ts` — one file per subcommand; pretty + `--json` per command.
34. CLI ROADMAP / SCOPE / INVARIANTS docs (post-merge follow-up).

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
- **Stale-artifact pruning.** `check` warns; `generate` overwrites. Pruning unknown files in `generated/` is a future `neko schema prune` verb.
- **`@nekostack/schema/cli` graduation.** v0.7 makes the subpath internal-only by documentation, not by tooling (no `private-exports` flag, no lint rule). Promotion to a clearly-tooled internal-only contract is its own future change.

## Decision history

- **v0.7-plan, initial draft** — 12 decisions, plan-only PR. Joint schema + cli phase. First plan to span two packages.

- **v0.7-plan, round-2 amendment** — six blockers from the first audit pass corrected. Decision count grows from 12 to 16; the diff table and the sourceHash propagation rules were the most substantive changes.

  - **Decision #1 added** (handler purity boundary) — the previous draft said handlers were pure but also gave them filesystem responsibilities. New language explicitly assigns workspace root resolution, glob expansion, schema module loading, source-text reading, committed-artifact reading, artifact writing, stdout/stderr, and process exit codes to the CLI. The schema-side handlers take loaded data and return `Result<T>` — no `fs.*`, no `import()`, no `process.exit`, no `console.*`.

  - **Decision #2 added** (schema module loading) — the previous draft said v0.7 "imports each file" without specifying how. A Node CLI cannot dynamic-import `.ts` files without a loader. Locked to `tsx` as an internal CLI runtime dependency; `jiti` listed as the considered alternative; precompiled-JS-only explicitly rejected as breaking the workflow-replacement thesis.

  - **Decision #6 added** (artifact path mapping) — the previous draft said `generate` "regenerates artifacts" without specifying paths. Locked to `<schema-dir>/generated/<basename>.<artifact-kind>` mirroring `packages/schema/examples/generated/`. Overwrite / missing / extra / partial / pruning behaviors all rowed explicitly.

  - **Decision #8 added** (sourceHash propagation via `ProvenanceOptions`) — the previous draft said generators "gain a new header line" without saying how generators (which take only a `SchemaNode`) would learn the sourceHash. Locked to a `ProvenanceOptions` slice the CLI passes through; direct generator calls omit the field, parsers tolerate both shapes (old v0.6 artifacts without `sourceHash` are treated as "unknown" by `checkHandler`, not as integrity errors).

  - **Decision #10 added** (cross-package integration subpath) — the previous draft said handlers were internal AND that CLI would import them directly from an internal subpath. Locked to a real `package.json` `exports` map with `"./cli"` as the integration surface. Tests gate both directions: root does NOT export handlers; `/cli` DOES.

  - **Decision #11 + #12 + #13 amended** (diff classifier) — the previous draft's "Add optional / nullable / default-bearing field → additive" row conflated nullable-only fields (which keep the key required) with optional/nullish/default-bearing (which permit absence). New table splits the rows explicitly. Decision #11 also adds the "input-acceptance compatibility" lens with output-compatibility flagged on rows where the two diverge. Decision #13 adds the `schemaVersion`-only-vs-paired-with-structural-changes nuance — `schemaVersion` alone is cosmetic; alongside structural changes, the worst severity wins.

  Key shape choices baked in by the original audit before drafting (still in force):
  - Joint plan in one PR across two parallel files.
  - CLI scope locked to schema commands only.
  - Migrations stay in v0.8+.

## Open questions for the round-2 audit

- **Decision #2 — `tsx` vs `jiti`.** `tsx` is locked. `jiti` was considered. Both can load `.ts` in-process. `tsx` follows Node ESM semantics more closely; `jiti` is more permissive. If the audit prefers `jiti`, the swap is one runtime-dep line in `packages/cli/package.json` + one loader-init module in CLI.
- **Decision #8 — `sourceHash` representation when omitted.** Locked to "omit the field entirely" (no `null`). The audit feedback wrote `"omit one — choose one"`; this draft chose "omit." If `null` is preferred for downstream tools that want to distinguish "schema package didn't know" from "field is absent," flag and the emitters add `sourceHash: null` instead of skipping the field.
- **Decision #11 — diff lens.** Locked to **input-acceptance compatibility** as the primary severity. Rows where output-side semantics differ (e.g., add `default` to existing required field) are flagged inline. If the audit wants a single severity that combines both lenses ("max of input and output severity"), the table grows but the algorithm stays simple. Worth confirming.
- **Decision #12 — `nullable → optional` and `optional → nullable` both rowed as breaking.** Conservative because the accepted sets cross-cut. If real consumer data only uses one form, the round-up is theatre. Worth confirming whether v0.7 should also offer a `--lens=input-only | output-only | strict` flag on `neko schema diff` to surface the more permissive read on demand.
- **Step 20 GENERATOR_VERSION bump shape.** Split into two sub-steps (20a version-only; 20b add `sourceHash` to example artifacts). Snapshot tests stay sourceHash-free because they don't pass `ProvenanceOptions`. Confirm the split is acceptable, or whether 20a + 20b should be one commit.
