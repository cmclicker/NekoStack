# Phase Plan: `@nekostack/schema` v0.8 — schema-data migrations (plan + verify only)

> **PLAN only — no code in the PR that lands this doc.**
>
> Reviewed against [`checklists/package/implementation-acceptance.md`](../../../checklists/package/implementation-acceptance.md). Once approved, implementation lands on `feat/schema-v0.8-candidate` (separate branch).
>
> **Hard-locked at the start of the plan:** v0.8 ships *migration planning, verification, and stub generation*. v0.8 does **NOT** ship `neko schema migrate apply` or any other verb that mutates data. Migration execution is deferred to v0.9+ behind its own plan and risk review. This is the load-bearing decision the whole plan is shaped against.
>
> **What "no apply" means precisely.** "No apply" means no v0.8 code path ever calls `migration.transform(input)` against any data, anywhere. It does **not** mean migration modules are inert at the file-system layer — they are loaded through `tsx` (the same loader v0.7 uses for schema files) during discovery, and any **module top-level code evaluates** at load time. Top-level evaluation failures are classified as load failures (`runtime_error`) by the existing tsx-loader contract. The authoring guidance ([`docs/MIGRATIONS.md`](./MIGRATIONS.md), Decision #5) **requires migration files to keep top-level code declarative and side-effect-free** — exports the `default` migration, optional helpers used by the eventual `transform`, nothing more. A migration whose top-level mutates data or calls an effect at module load violates the authoring contract and is a load failure waiting to happen.

## Thesis-fit

> v0.8 makes schema-version transitions a NekoStack-owned planning workflow. Users define migrations as authored TypeScript files; `neko schema migrate plan/verify/stub/list` answers "what migrations are needed?", "is each migration's provenance valid?", and "give me a skeleton to author". Actually applying a migration to data is a separate, higher-risk capability — explicitly out of scope for this phase.

### Workflow absorbed

Today, with v0.7, a user can:

- diff two versions of a schema and see what changed.
- detect that committed artifacts went stale across a version bump.

But there is no NekoStack-owned answer to "I bumped `com.x.User` from `1.0.0` to `2.0.0` — what code do I need to write to transform my v1 data into v2 data?" Today every consumer either:

- writes a one-off migration script ad-hoc with no provenance binding to the schemaIds/versions involved;
- relies on a database-DDL migration tool (`@nekostack/migrate`, Prisma, Drizzle, etc.) to handle data shape changes opportunistically; or
- silently lets unmigrated data drift through the system.

v0.8 absorbs the first half of that workflow: **migration authorship + provenance binding + transition planning**. The execution half is v0.9+.

### User-facing verb / API

Four commands. None of them mutate data:

```text
neko schema migrate list [pattern]
  enumerate every migration file the workspace declares.

neko schema migrate plan <schemaId> <fromVersion> <toVersion>
  resolve the chain of migrations needed to go from <fromVersion> to
  <toVersion> for <schemaId>. Returns the ordered plan, or a
  LOGICAL_FAILURE with `migration_not_found` / `migration_chain_broken`.

neko schema migrate verify [pattern]
  verify every migration file's provenance binds to the current
  registry's irHash/sourceHash for the (schemaId, from→to) pair the
  migration claims. Drift surfaces as `migration_drift` issues.

neko schema migrate stub <schemaId> <fromVersion> <toVersion>
  generate a skeleton migration file at the locked path. Writes one
  file. Does NOT inspect data or run any transformation.
```

Common flags mirror v0.7:

```text
--json              machine-readable output to stdout
--quiet             suppress non-essential stderr output
--root <path>       explicit workspace root (default: cwd)
--help              per-command help text
```

**`apply` is deliberately absent.** The CLI surface in v0.8 has no verb that takes a list of records and a migration and produces transformed records. Adding one without an authored apply plan is the explicit boundary v0.8 refuses to cross.

### Internal engine

Same shape as v0.7's master-plan Decision #1 boundary:

```
neko schema migrate <verb> <argv>
  └─ argv parser (commander)
      └─ dispatch to commands/schema/migrate/<verb>.ts
          ├─ resolve workspace root
          ├─ walk schema files               ← reuse v0.7's walker
          ├─ walk migration files            ← new, CLI-side
          ├─ load each via tsx                ← reuse v0.7's loader
          ├─ buildRegistry(schemas)           ← reuse v0.7
          ├─ buildMigrationRegistry(migrs)    ← new, schema-side, pure
          ├─ call schema-side migration handler   ← pure, no I/O
          ├─ format Result for stdout (pretty / --json)
          └─ choose exit code
```

The schema-side migration primitives (`buildMigrationRegistry`, `planMigration`, `verifyMigrationProvenance`, four pure handlers) are **data-in / data-out**. No `fs.*`, no `import()`, no `process.*`, no `console.*` — same purity contract as the v0.7 registry/diff/check/generate handlers.

### BOUNDARIES rows touched

In [`BOUNDARIES.md`](../../../BOUNDARIES.md) §7 (Schema / types):

- **NEW: "Schema-data migrations (planning + verification)"** → `schema` v0.8+. Pure data-in / data-out planner; the CLI owns filesystem and execution boundary.
- **NEW: "Migration file authoring contract"** → `schema` v0.8+. The locked file shape, naming, and provenance carrier.
- **`Schema migration registry` row** (currently `schema | (works with migrate for data-level migrations)`) — refine to make explicit that v0.8 ships *schema-data* migration registry + planning; *database DDL* migrations remain owned by `@nekostack/migrate`; *runtime data transformation execution* is deferred to v0.9+.

In §25 (Migrations / versioning of data):

- **`Database schema migrations`** → still `migrate` (unchanged).
- **`Data migrations (row-level transforms)`** → still `migrate` (unchanged). v0.8's planner *enables* `@nekostack/migrate` to consume a migration plan, but the actual row-level transform execution is `migrate`'s concern.
- **`Schema-version evolution for content`** → still `schema` (unchanged). v0.8 is the implementation of this row.

## Why this phase exists

Three problems compound:

1. **No NekoStack-owned authorship surface.** A schema versioned `1.0.0 → 2.0.0` has no canonical place to record "this is how 1.0.0 data becomes 2.0.0 data." Consumers re-invent the file location, the function signature, and the provenance binding every time.

2. **No drift detection.** Even when a migration *is* written, there is no automated way to detect that the schemas it was authored against have changed underneath it. A migration written when `User` had `{id, name}` is silently broken when `User` becomes `{id, name, email}` unless something compares the migration's recorded provenance to the registry's current irHash.

3. **No safe sequencing answer.** `1.0.0 → 3.0.0` may need `1.0.0 → 2.0.0` followed by `2.0.0 → 3.0.0` followed by `3.0.0 → 4.0.0`. A planner that resolves the chain (and refuses gracefully when the chain is broken) is the prerequisite to any safe apply phase later.

v0.8 solves authorship + drift detection + chain planning. v0.9+ may then solve execution, on top of an audited, verifiable plan.

## Phase scope

### Schema-side primitives (pure, data-in / data-out)

**`buildMigrationRegistry(entries: MigrationSourceEntry[]): Result<MigrationRegistry>`**

- Indexes migrations by `(schemaId, fromVersion, toVersion)`.
- Duplicate `(schemaId, fromVersion, toVersion)` triples surface as `Result.failure` with `duplicate_migration` Issues. Never throws. (Mirrors v0.7 Decision #4 / `duplicate_schema_id`.)
- **Malformed migration provenance is fail-loud, never silent.** A `.migration.ts` file exists specifically to declare a `(schemaId, fromVersion, toVersion)` transition. Missing or unparseable provenance is treated as an invalid declaration, not as a silent skip — silent skip would let a broken migration mask itself as "no migration found." `buildMigrationRegistry` returns `Result.failure` with an `integrity_error` Issue carrying `metadata.reason: "missing_migration_provenance"` (or one of the existing parse-provenance reason variants for malformed fields). The CLI surfaces the diagnostic. This is an **intentional departure from v0.7 Decision #5** (where anonymous *schemas* are tolerated because a schema file may legitimately export both indexed schemas and helper schemas) — a migration file has no analogous "helper migration" use case.

**`planMigration({ schemaRegistry, migrationRegistry, schemaId, fromVersion, toVersion }): Result<MigrationPlan>`**

The planner consumes **both** registries (and the diff classifier from v0.7) so it can honor Decision #10's severity → migration-requirement mapping. A migrations-only signature is insufficient: without the schema registry it cannot know whether the from/to versions exist; without the diff classifier it cannot know whether a missing migration is acceptable (`additive` / `cosmetic`) or fatal (`breaking`).

Locked behavior:

1. **Resolve endpoints in the schema registry.** `findSchema(schemaRegistry, schemaId, fromVersion)` and `(... toVersion)`. If either is `undefined` → `Result.failure` with `migration_missing_endpoint`. No diff is computed when an endpoint is missing.
2. **Classify the transition via `diffNodes`.** Compute `diffNodes(fromEntry.schema.node, toEntry.schema.node)` and the corresponding `worstSeverity` (`null` / `cosmetic` / `additive` / `breaking`).
3. **Map severity → plan shape:**
   - `worstSeverity === null` or `"cosmetic"` → `Result.success` with an **empty migration chain**. No migration is required; if one exists for the pair it is reported as `over_specified` in `MigrationPlan.notes` but not failed.
   - `worstSeverity === "additive"` → `Result.success` with an empty chain by default, plus a `MigrationPlan.notes` entry suggesting the consumer review whether an explicit migration is desired. If a migration *is* registered for the pair, it is included in the chain.
   - `worstSeverity === "breaking"` → a migration chain is **required**. The planner then runs the BFS/DFS step below.
4. **Chain resolution (only when severity requires it).** BFS from `fromVersion` over `migrationRegistry` indexed by `(schemaId, fromVersion)`. Returns the ordered list of `MigrationEntry`s reaching `toVersion`.
5. **Failure paths (post-severity-gating):**
   - `migration_not_found` — severity is `breaking`, no migrations registered for `schemaId` at all.
   - `migration_chain_broken` — severity is `breaking`, migrations exist for `schemaId` but none bridges `fromVersion → toVersion`.
   - `migration_ambiguous_chain` — severity is `breaking`, two or more distinct chains both reach `toVersion`. v0.8 refuses to pick; the consumer must remove the duplicate or constrain.
6. **`MigrationPlan` shape** — carries `chain: readonly MigrationEntry[]` (empty for null/cosmetic/additive-without-explicit-migration), `versionPath: readonly string[]` (the sequence `[fromVersion, ..., toVersion]`), `worstSeverity` (the diff result that drove the decision), and `notes: readonly PlanNote[]` (free-form annotations like `over_specified` or `additive_no_migration`).

Rationale for the heavier signature: without the schema registry + diff, a chain-only planner would either fail every missing migration (over-strict — refuses legitimate `cosmetic`/`additive` transitions) or accept every missing migration (under-strict — silently passes `breaking` transitions). Decision #10 demands the third behavior — **failure-by-severity** — and only a planner with full context can deliver it.

**`verifyMigrationProvenance({ migrations, registry }): Result<VerificationResult>`**

- For every migration, compare its recorded `fromIrHash` / `toIrHash` / `fromSourceHash` / `toSourceHash` against `findSchema(registry, schemaId, from|to).irHash` / `.sourceHash`.
- **Per-migration verdict — four values**, mirroring the v0.7 two-hash freshness matrix (Decision #9 / `migration_cosmetic_drift` / `migration_drift`):
  - `bound` — both `irHash` and `sourceHash` match at both endpoints.
  - `cosmetic_drift` — `irHash` matches at both endpoints, but at least one `sourceHash` differs. Source was edited without semantic effect; CI may treat as warning.
  - `drift` — at least one endpoint's `irHash` differs from the schema registry. The migration was authored against a schema state that has since changed semantically; the transform may no longer be correct. CLI maps to `LOGICAL_FAILURE`.
  - `missing_endpoint` — one or both versions are not in the schema registry. Surfaces `migration_missing_endpoint`.
- Cumulative failure: any `drift` or `missing_endpoint` surfaces an Issue. `cosmetic_drift` is a warning, not a failure (CLI prints stderr; exit code stays `SUCCESS` unless other verdicts fail).
- **Scope of "verification" — provenance + chain integrity only.** `verifyMigrationProvenance` does NOT prove transform correctness. Transform execution is deferred to v0.9+; v0.8 cannot inspect a function body to know whether it correctly maps `s.output<v1>` to `s.output<v2>`. A migration whose `transform` is `throw new Error("Not yet implemented")` verifies just as cleanly as one with a fully-authored body, as long as the provenance hashes bind. Authors who need transform correctness in v0.8 write their own unit tests against the migration module's default export. The verifier is a `provenance-says-what-it-says` check, not a behavior check.

**Stub generation** — `stubMigration({ schemaId, fromVersion, toVersion, registry }): Result<MigrationStub>`. Produces the file *contents* (provenance header + skeleton function signature). The CLI writes the file. Pure planner here.

**Four pure handlers** — `listMigrationsHandler`, `planMigrationHandler`, `verifyMigrationsHandler`, `stubMigrationHandler`. Same boundary as v0.7's four handlers; same purity gate.

### Migration file shape

Locked TS shape (Decision #5 below records the rationale):

```ts
// schemas/migrations/<basename>.<from-slug>-to-<to-slug>.migration.ts
//
// Authored by a human. Provenance header is generated by
// `neko schema migrate stub`; the function body is filled in by the
// author.

/**
 * @migration by @nekostack/schema
 * schemaId:        com.x.User
 * fromVersion:     1.0.0
 * toVersion:       2.0.0
 * fromIrHash:      sha256:<hex>
 * toIrHash:        sha256:<hex>
 * fromSourceHash:  sha256:<hex>
 * toSourceHash:    sha256:<hex>
 * generator:       neko-schema-migrate-stub
 * generatorVersion: @nekostack/schema@0.8.0
 *
 * DO NOT REMOVE THE HEADER. Authors EDIT THE BODY.
 */
import type { Migration } from "@nekostack/schema/cli";

const migration: Migration<"com.x.User", "1.0.0", "2.0.0"> = {
  schemaId: "com.x.User",
  from: "1.0.0",
  to: "2.0.0",
  transform(input) {
    // Author fills this in.
    throw new Error("Not yet implemented");
  },
};

export default migration;
```

- The header is a normal JSDoc-style block, parsed by an extension of v0.7's `parseProvenanceFromText` (renamed conceptually but reusing the JSDoc carrier — Decision #7).
- The exported `default` shape is fixed: `{ schemaId, from, to, transform }`. v0.8 ships the **type** but does NOT execute `transform` anywhere. The function body exists for v0.9+.
- The path convention (Decision #5) is `<schemas-dir>/migrations/<basename>.<from-slug>-to-<to-slug>.migration.ts`.

### Explicit non-scope

- **`neko schema migrate apply`.** No execution. No data transformation. No `transform(input)` is ever called by v0.8 code.
- **Reversible / down migrations.** Forward-only. The `Migration` type has no `down` field. v0.9+ may add one.
- **Multi-schema migrations.** A migration transforms one schemaId. Cross-schema migrations (e.g., splitting `User` into `User` + `Profile`) are out of scope. Authors who need this in v0.8 write two unrelated migrations.
- **Branching migrations / version trees.** Linear version chains only. If `2.0.0` has two possible successors (`3.0.0-a` and `3.0.0-b`), the planner refuses with `migration_ambiguous_chain`.
- **Migration scheduling / ordering across schemaIds.** The planner answers per-schema. Cross-schema ordering is a v1.0+ concern.
- **Distributed migration coordination.** Single-process planner only. No locks, no leases, no cluster awareness.
- **Online migrations.** Even when v0.9+ adds `apply`, the v0.8 plan does not pre-decide whether apply is offline or online. That decision is v0.9's to make.
- **Database DDL migrations.** Owned by `@nekostack/migrate` (BOUNDARIES §25). v0.8 produces plans `@nekostack/migrate` *could* consume, but the DDL execution belongs there, not here.

## Public API delta

The root `@nekostack/schema` import surface stays on the v0.6/v0.7 contract. **No v0.8 name is added at the root.** New names live under the existing `@nekostack/schema/cli` integration subpath (extending it; not adding a new subpath).

Additions to `@nekostack/schema/cli` (Decision #6 — same engine-swap-safe boundary as v0.7):

- Runtime functions: `buildMigrationRegistry`, `findMigration`, `planMigration`, `verifyMigrationProvenance`, `stubMigration`, `parseMigrationProvenance`, `listMigrationsHandler`, `planMigrationHandler`, `verifyMigrationsHandler`, `stubMigrationHandler`, plus path-helper `suggestedMigrationPathFor`.
- Type surface: `Migration<...>`, `MigrationSourceEntry`, `MigrationEntry`, `MigrationRegistry`, `MigrationPlan`, `MigrationStub`, `MigrationVerdict`, `VerificationResult`, plus the four handler `Opts`/`Result` pairs.

The root-leakage gate (`tests/public-surface.test.ts`) gains negative-assertion rows for every new v0.8 name. The positive subpath gate (`tests/registry-surface.test.ts` — likely renamed to `cli-surface.test.ts` in this phase) gains positive-assertion rows.

## Internal file delta

```
packages/schema/
├── src/
│   ├── migrations/                          # NEW
│   │   ├── types.ts                         # Migration<...> + the rest
│   │   ├── parse-provenance.ts              # migration-header parser
│   │   ├── build-migration-registry.ts
│   │   ├── plan-migration.ts                # chain resolver
│   │   ├── verify-provenance.ts
│   │   ├── stub.ts                          # file-content generator
│   │   └── handlers/
│   │       ├── list.ts
│   │       ├── plan.ts
│   │       ├── verify.ts
│   │       └── stub.ts
│   └── cli-integration.ts                   # extended to re-export above
└── docs/
    ├── MIGRATIONS.md                        # NEW — contract doc
    └── PHASE_PLAN_v0.8.md                   # this doc
```

```
packages/cli/
├── src/
│   ├── loaders/
│   │   └── read-migrations.ts               # NEW — walk *.migration.ts
│   └── commands/
│       └── schema/
│           └── migrate/                     # NEW — subcommand group
│               ├── index.ts
│               ├── list.ts
│               ├── plan.ts
│               ├── verify.ts
│               └── stub.ts
└── (tests/ mirror)
```

## Dependency delta

- **No new runtime deps.** Both schema and CLI sides are pure planning/verification work on top of v0.7 infrastructure (registry, walker, tsx loader, commander).
- **No new dev deps.** Existing vitest + tsx + typescript suffice.

## Decisions to lock before coding

Sixteen decisions. The hard-locked v0.8 scope ("no apply") is implicit in every other decision; it's the framing.

### Scope boundary (highest stakes)

1. **v0.8 ships migration PLANNING + VERIFICATION + STUB GENERATION. v0.8 does NOT ship migration EXECUTION.** No `apply` verb. No code path in v0.8 calls a migration's `transform` function. v0.9+ revisits execution behind its own plan and explicit safety review (pre/post validation, audit log emission, rollback semantics, dry-run vs apply boundary, online vs offline). Hard-locked at the start of the plan and reinforced in every section.

### Migration model

2. **Forward-only.** The `Migration` type has no `down` / `reverse` field. Bidirectional migrations are v0.9+ if ever. Rationale: every `down` migration needs its own authorship + test + verification, and the asymmetry (data loss on forward vs forward+down round-trip) is a separate risk-class decision.

3. **Schema-data only, NOT database DDL.** A v0.8 migration transforms a `s.output<v1>` value into a `s.output<v2>` value. It does NOT issue `ALTER TABLE`. Database-level DDL stays with [`@nekostack/migrate`](../../migrate) (BOUNDARIES §25). `@nekostack/migrate` may consume a v0.8 `MigrationPlan` to know *what* shape change to apply, but the DDL execution belongs there.

4. **One migration transforms one schemaId.** No cross-schema migrations. Splitting `User` into `User + Profile` is two separate plans the consumer composes. Cross-schema coordination is a v1.0+ concern.

### Migration file layout

5. **Path convention.** Locked:

    ```
    <schema-dir>/migrations/<basename>.<from-slug>-to-<to-slug>.migration.ts
    ```

    where `<basename>` strips the `.schema.{ts,js}` suffix from the matching schema source file, and `<from-slug>` / `<to-slug>` are the version strings normalized by **the same slug rule v0.7 uses for multi-schema artifact discriminators** ([`src/registry/handlers/generate.ts` `slugify()`](../src/registry/handlers/generate.ts)):

    ```
    lowercase → non-alphanumeric runs collapse to "-" → trim leading/trailing "-"
    ```

    Examples:

    ```
    1.0.0          → 1-0-0
    1.0.0-beta.1   → 1-0-0-beta-1
    2.0.0+build.5  → 2-0-0-build-5
    1.0            → 1-0           (non-strict but still unambiguous)
    ```

    Worked example:

    ```
    schemas/user.schema.ts
    schemas/migrations/user.1-0-0-to-2-0-0.migration.ts
    schemas/migrations/user.1-0-0-beta-1-to-1-0-0.migration.ts
    ```

    Rationale: mirrors the v0.7 `<schema-dir>/generated/` convention; lets `walk-workspace` discover both generated artifacts and migrations under the same root pattern. Reusing the exact `slugify()` from v0.7 means one slug rule across the whole package — no separate "migration version slug" function to maintain, and no semver-only restriction on the version string.

6. **Exports through `@nekostack/schema/cli`, not the root.** The v0.7 subpath is the established package-internal integration surface; v0.8 adds to it rather than introducing a new one. Root `@nekostack/schema` still exposes only the v0.6 contract.

### Provenance + binding

7. **Migration provenance carrier — JSDoc header, same parser shape as v0.7 artifacts.** The `parseProvenanceFromText` family (introduced in v0.7) extends to accept the migration-header field set (`fromVersion` / `toVersion` / `fromIrHash` / `toIrHash` / `fromSourceHash` / `toSourceHash` in addition to the existing `schemaId` / `irHash` / `sourceHash` / `generator` / `generatorVersion`). Same regex shape, same fail-loud-not-throw discipline.

8. **A migration is identified by `(schemaId, fromVersion, toVersion)`.** Storage key in `MigrationRegistry` is the triple. Provenance binding adds `fromIrHash` / `toIrHash` / `fromSourceHash` / `toSourceHash`; these are *not* part of identity but *are* part of verification.

9. **Drift detection rule (load-bearing).** A migration is `bound` when its recorded `fromIrHash` matches `findSchema(registry, schemaId, fromVersion).irHash` AND its recorded `toIrHash` matches `findSchema(registry, schemaId, toVersion).irHash`. Otherwise the migration is `drift`. Sourcehash mismatch alone is `cosmetic_drift` (matches v0.7 two-hash matrix terminology); irHash mismatch is `drift`. Missing-endpoint (either version absent from the schema registry) is `missing_endpoint`.

### Diff classifier coupling

10. **DiffChange severity → migration requirement.** v0.8 documents the relationship but does NOT auto-generate migrations:

    | Diff severity | Migration requirement |
    |---|---|
    | (no changes — `worstSeverity: null`) | none |
    | `cosmetic` | none |
    | `additive` | optional — author may skip if downstream consumers tolerate the change |
    | `breaking` | required — the planner refuses to bridge a `breaking` boundary without a registered migration |

    The stub generator may inspect the diff and pre-fill TODO comments for breaking changes ("the `email` field was removed; write code to handle this"), but never writes a transform body. Authors write transforms.

11. **Classifier freeze contract.** The migration verifier consumes the Decision #12 classification table from v0.7. The plan locks: any future change to a Decision #12 row's severity is a migration-compat issue and must be flagged at row-change time. v0.8 doesn't freeze the classifier; it documents the dependency. Future-v0.X classifier changes go through the same change-control rule as `ISSUE_CODES`.

### CLI verbs + exit codes

12. **CLI subcommand surface (locked).** Four verbs under `neko schema migrate`:

    ```
    neko schema migrate list [pattern]
    neko schema migrate plan <schemaId> <fromVersion> <toVersion>
    neko schema migrate verify [pattern]
    neko schema migrate stub <schemaId> <fromVersion> <toVersion>
    ```

    `stub` is the only verb that writes a file; the file is a stub at the locked path. No `apply`. The CLI's `.allowExcessArguments(false)` discipline (introduced in v0.7) applies.

13. **Exit codes — same five-value enum as v0.7.**

    - `0 SUCCESS`
    - `1 LOGICAL_FAILURE` — `migration_not_found` / `migration_chain_broken` / `migration_drift` / `migration_ambiguous_chain` / `duplicate_migration`
    - `2 USAGE_ERROR`
    - `3 IO_ERROR`
    - `4 INTEGRITY_ERROR` — migration provenance is malformed / tampered (mirrors the v0.7 impossible-row INTEGRITY_ERROR)

### Issue vocabulary

14. **New `ISSUE_CODES` added at first use site, per the established change-control rule:**

    - `migration_not_found` — no migration registered for the requested `(schemaId, fromVersion, toVersion)` AND no chain via intermediate versions.
    - `migration_chain_broken` — registered migrations exist for the schema, but none bridges the requested endpoints.
    - `migration_drift` — at least one migration's recorded `fromIrHash` or `toIrHash` does not match the schema registry's current `irHash` for that version. Cosmetic-only drift (sourceHash mismatch with irHash intact) is reported under `migration_cosmetic_drift` (CI may treat as warning).
    - `migration_cosmetic_drift` — sourceHash mismatch only; irHash intact. Equivalent to v0.7's `cosmetic_drift` freshness verdict.
    - `migration_ambiguous_chain` — two distinct migration chains both reach the requested target. Planner refuses to pick.
    - `migration_missing_endpoint` — a migration references a `(schemaId, version)` that is not in the registry. Indicates a stale migration or a deleted schema version.
    - `duplicate_migration` — two migration files claim the same `(schemaId, fromVersion, toVersion)` triple.

### Engine-swap-safety (continued from v0.6 / v0.7)

15. **Migration types are NOT on the root public surface.** Same rule as v0.6 runtime types and v0.7 registry types. The `/cli` subpath is the only entry point. If a future phase ships `@nekostack/migrations` as its own package, this v0.8 surface moves there with no impact on root consumers.

### Test discipline

16. **Static + runtime purity gates extend to migration handlers.** Same approach as the v0.7 `handler-purity.test.ts`: static file-level import scan for `fs.*` / dynamic `import()` / `console.*` / `process.exit` / `process.abort` over each migration handler's module-graph reach, plus runtime spies. Sentinel tests verify the gate catches what it claims.

## Sequencing

Implementation order. Each numbered step is a separate commit with its own validation gate, mirroring v0.6 / v0.7 sequencing discipline.

### Schema-side

1. `src/migrations/types.ts` — types only (`Migration<...>`, `MigrationSourceEntry`, `MigrationEntry`, `MigrationRegistry`, `MigrationPlan`, `MigrationStub`, `MigrationVerdict`, `VerificationResult`, `*Opts`, `*Result`). No logic. Mirror v0.7 Step 1.
2. `src/migrations/parse-provenance.ts` — extend the v0.7 provenance parser to accept the migration-header field set. Return shape adds `fromVersion`, `toVersion`, `fromIrHash`, `toIrHash`, `fromSourceHash`, `toSourceHash`. Failure paths preserve the existing `integrity_error` + `metadata.reason` contract.
3. `src/migrations/build-migration-registry.ts` — pure constructor; `duplicate_migration` Issues on triple collision; never throws. Tests use hand-constructed entries.
4. `src/migrations/plan-migration.ts` — diff-aware planner. Signature `planMigration({ schemaRegistry, migrationRegistry, schemaId, fromVersion, toVersion }): Result<MigrationPlan>`. Resolves endpoints in `schemaRegistry`, computes `worstSeverity` via `diffNodes`, severity-gates the chain requirement (null/cosmetic → empty plan; additive → empty plan + note; breaking → required chain). When required, BFS over `migrationRegistry` indexed by `(schemaId, fromVersion)`. Cover the four failure modes: `missing_endpoint` / `not_found` (breaking + no migrations) / `chain_broken` (breaking + no path) / `ambiguous_chain` (breaking + 2+ paths). Plan-only — never executes a `transform`.
5. `src/migrations/verify-provenance.ts` — per-migration four-way verdict (`bound` / `cosmetic_drift` / `drift` / `missing_endpoint`) mirroring the v0.7 two-hash matrix. `VerificationResult` carries summary + per-verdict array. No filesystem.
6. `src/migrations/stub.ts` — pure file-content generator. Reads `findSchema(registry, ...)` for the from/to irHash + sourceHash; emits the locked header + skeleton body string. The CLI writes it.
7. `src/migrations/handlers/list.ts` — pure handler; simplest dispatch surface (mirrors v0.7's listHandler-first pattern).
8. `src/migrations/handlers/plan.ts` — wraps `planMigration`; takes both registries as opts; maps the four failure modes to Issues.
9. `src/migrations/handlers/verify.ts` — wraps `verifyMigrationProvenance` + computes a summary (count by verdict).
10. `src/migrations/handlers/stub.ts` — wraps `stubMigration`; returns `{ suggestedPath, content }` shape mirroring `GeneratedArtifact`.
11. `tests/migrations/handler-purity.test.ts` — extend the v0.7 static + runtime purity gate to cover the four new handlers' module-graph reach. Sentinel rows.
12. `src/cli-integration.ts` — extended barrel re-export.
13. `tests/registry-surface.test.ts` — extend to assert every new v0.8 runtime/type name is reachable through `@nekostack/schema/cli`.
14. `tests/public-surface.test.ts` — extend the negative root-leakage gate with rows for every new v0.8 runtime/type name.
15. `docs/MIGRATIONS.md` — contract doc (migration model, file shape, provenance, planning, verification, diff coupling, non-goals).
16. Docs sweep (`SCOPE.md`, `INVARIANTS.md`, `ROADMAP.md`, `USAGE.md`, `EXAMPLES.md`).
17. New INVARIANTS corollaries — migrations are forward-only; migrations are append-only; migration files are content-addressed by `(fromIrHash, toIrHash)`; the v0.8 boundary explicitly excludes execution.
18. `GENERATOR_VERSION` bump to `@nekostack/schema@0.8.0`. Two-stage regen identical to v0.7 Steps 20a / 20b (version-line-only + provenance-addition for new example migrations).

### CLI-side

19. `packages/cli/src/loaders/read-migrations.ts` — walk `**/*.migration.ts` under each schema dir; load via existing tsx loader; index by `(schemaId, fromVersion, toVersion)` from the loaded default export.
20. `src/commands/schema/migrate/list.ts` — dispatch to `listMigrationsHandler`; pretty + JSON shapes.
21. `src/commands/schema/migrate/plan.ts` — operand parser for `<schemaId> <fromVersion> <toVersion>`; walks both schemas and migrations (reusing v0.7's walker + new Step 19 migration loader), builds both registries, dispatches to `planMigrationHandler({ schemaRegistry, migrationRegistry, ... })`. Maps `migration_missing_endpoint` / `migration_not_found` / `migration_chain_broken` / `migration_ambiguous_chain` to `LOGICAL_FAILURE`; `integrity_error` → `INTEGRITY_ERROR`. Empty-plan success paths (null/cosmetic/additive) print the diff classification and the `over_specified` / `additive_no_migration` notes.
22. `src/commands/schema/migrate/verify.ts` — dispatch to `verifyMigrationsHandler`; per-verdict tally header in pretty output.
23. `src/commands/schema/migrate/stub.ts` — the only verb that writes a file. `mkdir -p` + `writeFile`. Refuses to overwrite an existing migration file at the suggested path (unlike `generate`'s overwrite-by-default behavior, since `generate` overwrites generated artifacts but `stub` would overwrite hand-authored code).
24. `src/cli.ts` — wire the `migrate` subcommand group under `schema`. `.allowExcessArguments(false)` on every verb.
25. CLI tests — one test file per verb + envelope tests + help tests + argv tests, mirroring v0.7's `tests/commands/schema-*.test.ts` structure.
26. Final hardening (post-formal-sequence) — help-output gate extended; JSON-envelope gate extended.

### Post-merge

27. Tag `schema-v0.8.0` at the merge commit.
28. GitHub release with structured notes.
29. ROADMAP / CHANGELOG / STATUS follow-up PR.

## Estimate

**5–7 focused days, schema + CLI combined.** Lighter than v0.7's joint phase because v0.8 reuses v0.7's walker, loader, formatters, exit-code enum, and JSON-envelope discipline. The two genuinely new pieces are the chain resolver (`planMigration`) and the verification matrix (`verifyMigrationProvenance`). Risk areas:

- **Chain-resolution edge cases.** Multi-hop chains, version-string comparison (semver vs string), ambiguous-chain detection at scale. Mitigation: every shape has a fixture in the test plan before the implementation lands.
- **Stub-overwrite policy.** `generate` overwrites by default; `stub` writes to a path that contains hand-authored code. The stub command MUST refuse to overwrite. Mitigation: write-skip-if-exists with a clear error message; CLI test for "stub against existing file" failure path.
- **Diff classifier coupling.** v0.8 documents the dependency; v0.X future classifier changes need migration-compat review. Mitigation: docs sweep adds this to the `DIFF_CLASSIFICATION.md` "downstream consumers" section; an INVARIANTS corollary makes the contract explicit.

## What this plan does NOT decide

- **`neko schema migrate apply`.** Out of v0.8. v0.9+ revisits.
- **Reversible migrations.** Out of v0.8.
- **Cross-schema migrations.** Out of v0.8.
- **Online / live-data migration.** Even when apply lands in v0.9+, the apply phase's plan decides offline-vs-online; v0.8 does not pre-decide.
- **Migration scheduling / orchestration.** v1.0+.
- **`@nekostack/migrate` DDL integration.** v0.8 produces plans that downstream tools could consume; the integration shape is the consuming tool's decision, not v0.8's.
- **Authoring conventions beyond the file shape.** v0.8 locks the file shape, the path convention, the provenance carrier, and the type signature. It does NOT lock author idioms (helper libraries, testing patterns, snapshot strategies). Those land as `docs/MIGRATIONS_AUTHORING.md` content in a later docs sweep if the community converges on a pattern.

## Decision history

- **v0.8-plan, initial draft** — 16 decisions. Hard-locked at the start: v0.8 is plan + verify + stub only. No apply. Migration execution is deferred to v0.9+ behind its own plan and explicit safety review.
- **Round-1 audit anticipation** — risk areas likely to be flagged: (a) is "forward-only" too restrictive? — argument: bidirectional migrations are a separate authorship surface and should not piggyback on the planning phase. (b) does the JSDoc provenance header survive being edited by a human? — yes, the field-extraction regex is whitespace-tolerant and the parser already handles human-edited v0.7 generated headers. (c) is the diff classifier coupling too tight? — the dependency is documented, not enforced; a row change in Decision #12 triggers a migration-compat doc PR, not a v0.X chain re-validation.

- **Round-3 corrections** ([PR #27](https://github.com/cmclicker/NekoStack/pull/27) round-2 re-audit feedback) — two plan-doc tightenings, no scope change:

  - **Migration planner contract widened to receive both registries + diff context.** Original `planMigration({ migrations, schemaId, fromVersion, toVersion })` couldn't honor Decision #10's severity → migration-requirement mapping — without the schema registry it couldn't compute the diff, so it had to either fail every missing migration (over-strict for `additive` / `cosmetic`) or accept every missing migration (under-strict for `breaking`). Corrected signature is `planMigration({ schemaRegistry, migrationRegistry, schemaId, fromVersion, toVersion })`. Locked behavior: resolve endpoints; compute `diffNodes` + `worstSeverity`; severity-gate the chain requirement (null/cosmetic → empty plan; additive → empty plan + note; breaking → required chain). `MigrationPlan` now carries `worstSeverity` and a `notes` array so consumers can see *why* the chain came out the way it did. `planMigrationHandler` and the CLI Step 21 wiring updated to match.
  - **`verifyMigrationProvenance` verdict list expanded to four values.** Original scope said `bound / drift / missing_endpoint`, but Decision #9 and the new ISSUE_CODES already named `cosmetic_drift` / `migration_cosmetic_drift`. Corrected the primitive's spec to enumerate all four (`bound` / `cosmetic_drift` / `drift` / `missing_endpoint`) with the same two-hash-matrix mapping the v0.7 freshness verdict uses. Exit-code mapping clarified: `drift` and `missing_endpoint` fail; `cosmetic_drift` is a warning (stderr; SUCCESS exit).

- **Round-2 corrections** ([PR #27](https://github.com/cmclicker/NekoStack/pull/27) audit feedback) — five plan-doc tightenings, no scope change:

  - **Root import contradiction resolved.** The migration-file example originally imported `Migration` from `@nekostack/schema`; that violated the v0.6/v0.7 root-non-leakage invariant. Corrected to `import type { Migration } from "@nekostack/schema/cli"`. `Migration` and every other v0.8 type stay under the `/cli` subpath — Decision #6 reaffirmed.
  - **"Silent skip" for anonymous migrations removed.** Original plan said malformed-provenance `.migration.ts` files are silently dropped at the schema layer; that mirrors v0.7 Decision #5 for anonymous *schemas*, but the analogy doesn't hold — a `.migration.ts` file exists specifically to declare a transition, so missing provenance is a broken declaration, not a permissible state. `buildMigrationRegistry` now returns `Result.failure` with `integrity_error` + `metadata.reason: "missing_migration_provenance"`. **Intentional departure from v0.7 Decision #5**, documented at the primitive's spec.
  - **"No apply" boundary tightened.** Original phrasing could be read as "no v0.8 code runs migration code." Sharpened to: "no v0.8 code path calls `migration.transform(input)`" — module top-level code DOES evaluate during tsx-backed discovery, and top-level evaluation failures classify as `runtime_error` load failures. Authoring guidance ([`docs/MIGRATIONS.md`](./MIGRATIONS.md)) requires migration files to keep top-level code declarative and side-effect-free.
  - **Version slug rule locked to v0.7's `slugify()`.** Original draft said "`.` → `-`"; that breaks on prerelease/build markers (`1.0.0-beta.1`, `2.0.0+build.5`). Decision #5 now reuses the exact `slugify()` from `src/registry/handlers/generate.ts` (lowercase → non-alphanumeric → "-" → trim) with worked examples. One slug rule across the whole package.
  - **Scope of "verification" pinned to provenance + chain integrity.** Added an explicit "verify does NOT prove transform correctness" clause on `verifyMigrationProvenance`. A migration whose `transform` is a stub or throws verifies as cleanly as a fully-authored one — the verifier is a `provenance-says-what-it-says` check, not a behavior check. Behavior is v0.9+.
