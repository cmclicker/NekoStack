# Migrations Contract (v0.8)

> The v0.8 schema-data migration surface — authoring shape, registry semantics, planner + verifier + stub contracts, the schema/CLI ownership boundary, and the explicit non-goals (no `apply`, no transform execution). Pairs with [`PHASE_PLAN_v0.8.md`](./PHASE_PLAN_v0.8.md); the plan locks decisions, this file documents the contract that resulted.

## Hard-locked boundary

v0.8 ships **migration planning + verification + stub generation only**. v0.8 does **NOT** ship:

- a `neko schema migrate apply` verb,
- any code path that calls `migration.transform(input)`,
- any other route by which v0.8 mutates data.

Migration execution is deferred to **v0.9+** behind its own plan and explicit safety review.

**Module top-level evaluation ≠ transform execution.** Migration files are loaded through `tsx` during discovery (Step 19), and any top-level code inside a `*.migration.ts` file evaluates at load time. Top-level evaluation failures are classified as `runtime_error` load failures by the existing tsx-loader contract. The authoring guidance (below) requires migration files to keep top-level code declarative and side-effect-free.

---

## Authored migration file shape

The locked shape of a `*.migration.ts` file:

```ts
/**
 * @migration by @nekostack/schema
 * schemaId:         com.x.User
 * fromVersion:      1.0.0
 * toVersion:        2.0.0
 * fromIrHash:       sha256:<64-hex>
 * toIrHash:         sha256:<64-hex>
 * fromSourceHash:   sha256:<64-hex>
 * toSourceHash:     sha256:<64-hex>
 * generator:        neko-schema-migrate-stub
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
    // Author fills this in. v0.8 NEVER invokes this function.
    throw new Error("Not yet implemented");
  },
};

export default migration;
```

### `Migration<...>` type

Defined in [`src/migrations/types.ts`](../src/migrations/types.ts):

```ts
interface Migration<
  SchemaId extends string = string,
  FromVersion extends string = string,
  ToVersion extends string = string,
  Input = unknown,
  Output = unknown,
> {
  readonly schemaId: SchemaId;
  readonly from: FromVersion;
  readonly to: ToVersion;
  readonly transform: (input: Input) => Output;
}
```

**No `down` / `reverse` field** — forward-only migrations are v0.8 (Decision #2). Bidirectional migrations are a separate authorship surface and not a v0.8 concern.

**One `schemaId` per migration** — cross-schema migrations are out of scope (Decision #4). Splitting `User → User + Profile` is two unrelated plans the consumer composes.

### `Migration` import — `/cli` subpath only

The `Migration` type is imported from `@nekostack/schema/cli`, **not** from root `@nekostack/schema`. Decision #6: the v0.8 surface is package-internal; engine-swap-safety lives at the root, not at this subpath. The negative root-leakage gate in [`tests/public-surface.test.ts`](../tests/public-surface.test.ts) asserts root carries none of the 28 v0.8 names (10 runtime + 18 types).

### Top-level code rule

The header is the contract; the body is the author's. The body MUST keep its top-level code:

- declarative — no `if`/`switch`/`for` outside the `transform` function,
- side-effect-free — no `console.log`, no `fs`, no `process.exit`, no `import()` calls.

The eventual `transform` body is the only place where data work happens, and **v0.8 never invokes it**.

---

## Provenance header

The header carries 9 fields. All are required — v0.8 has no backward-compatibility window for missing fields (Decision #7).

| Field              | Source                                                                  |
|--------------------|-------------------------------------------------------------------------|
| `@migration by`    | Always `@nekostack/schema`                                              |
| `schemaId`         | reverse-DNS id of the schema this migration targets                     |
| `fromVersion`      | source semver-shaped string                                             |
| `toVersion`        | destination semver-shaped string                                        |
| `fromIrHash`       | `sha256:<hex>` of canonical IR of the from-version schema               |
| `toIrHash`         | `sha256:<hex>` of canonical IR of the to-version schema                 |
| `fromSourceHash`   | `sha256:<hex>` of raw UTF-8 source bytes of the from-version schema     |
| `toSourceHash`     | `sha256:<hex>` of raw UTF-8 source bytes of the to-version schema       |
| `generator`        | Always `neko-schema-migrate-stub`                                       |
| `generatorVersion` | `@nekostack/schema@<package-version>`                                   |

[`parseMigrationProvenanceFromText(content)`](../src/migrations/parse-provenance.ts) reads the header. The carrier is **JSDoc-only** — migration files are TypeScript modules, not data documents.

### Fail-loud, never silent

A `.migration.ts` file exists specifically to declare a `(schemaId, fromVersion, toVersion)` transition. Missing or malformed provenance is treated as an **invalid declaration**, not a silent skip — silent skip would let a broken migration mask itself as "no migration found." `buildMigrationRegistry` returns `Result.failure` with an `integrity_error` Issue carrying `metadata.reason`:

| `metadata.reason`                | When                                                       |
|----------------------------------|------------------------------------------------------------|
| `unknown_format`                 | File doesn't start with `/**` JSDoc                        |
| `missing_migration_provenance`   | No JSDoc block at all                                      |
| `missing_field`                  | A required field is missing                                |
| `malformed_hash`                 | A hash field doesn't match `sha256:<64-hex>`               |
| `malformed_field`                | A field's value is empty                                   |

This is an **intentional departure from v0.7 Decision #5** (which tolerates anonymous *schemas* because a schema file may legitimately export both indexed schemas and helper schemas). A migration file has no analogous "helper migration" use case.

---

## Migration registry — identity and indexing

`buildMigrationRegistry(entries: readonly MigrationSourceEntry[]): Result<MigrationRegistry>` ([`src/migrations/build-migration-registry.ts`](../src/migrations/build-migration-registry.ts)) constructs the three-level lookup:

```text
MigrationRegistry = ReadonlyMap<
  schemaId,
  ReadonlyMap<
    fromVersion,
    ReadonlyMap<toVersion, MigrationEntry>
  >
>
```

### Identity

A migration's identity is the `(schemaId, fromVersion, toVersion)` triple (Decision #8). Storage keys all three levels by this triple; provenance hashes are **binding** information, not identity (they let the verifier detect when the migration was authored against a schema state that has since changed).

### Duplicate detection

Two migration files claiming the same triple surface as `Result.failure` with a `duplicate_migration` Issue:

```ts
{
  code: "duplicate_migration",
  path: [],
  message: "Duplicate migration for `com.x.User` 1.0.0 → 2.0.0 found in: a.migration.ts, b.migration.ts",
  severity: "error",
  metadata: {
    schemaId: "com.x.User",
    fromVersion: "1.0.0",
    toVersion: "2.0.0",
    sourcePaths: ["a.migration.ts", "b.migration.ts"],
  },
}
```

**First-seen wins** on a duplicate — the partial map isn't torn. Same rule as `buildRegistry`'s duplicate handling for v0.7's `duplicate_schema_id`.

### Multi-failure aggregation

The builder **never short-circuits** — duplicate-id Issues + malformed-provenance Issues are collected together in one `Result.failure`. The CLI dispatcher (Step 21+) renders a single human-readable report.

---

## Planner — `planMigration`

[`src/migrations/plan-migration.ts`](../src/migrations/plan-migration.ts). The Round-3 locked signature consumes both registries plus the operand triple:

```ts
planMigration({
  schemaRegistry,
  migrationRegistry,
  schemaId,
  fromVersion,
  toVersion,
}): Result<MigrationPlan>
```

### Behavior

1. **Resolve endpoints** in `schemaRegistry` via `findSchema`. Either missing → `Result.failure` with `migration_missing_endpoint`. No diff is computed when an endpoint is missing.
2. **Compute the diff** via the v0.7 classifier `diffNodes(from.node, to.node)` (see [`DIFF_CLASSIFICATION.md`](./DIFF_CLASSIFICATION.md)). `worstSeverity` aggregation uses the same precedence `breaking > additive > cosmetic`, `null` when empty.
3. **Look up the exact migration** for the triple (if any).
4. **Severity-gate the chain requirement** per Decision #10:

| `worstSeverity` | Chain                                  | Notes / Failure                                                                                       |
|-----------------|----------------------------------------|-------------------------------------------------------------------------------------------------------|
| `null`          | empty                                  | If an exact migration exists for the pair, attach an `over_specified` `PlanNote`.                     |
| `"cosmetic"`    | empty                                  | Same `over_specified` rule.                                                                           |
| `"additive"`    | empty (no migration) OR `[exact]`      | If an exact migration is registered, include it. Otherwise empty + `additive_no_migration` `PlanNote`.|
| `"breaking"`    | **required** — DFS over adjacency map  | 0 chains → `migration_not_found` (no migrations for schemaId) / `migration_chain_broken` (some exist but no path). 1 chain → success. 2+ chains → `migration_ambiguous_chain` (planner refuses to pick).|

### `MigrationPlan` shape

```ts
interface MigrationPlan {
  readonly schemaId: string;
  readonly chain: readonly MigrationEntry[];
  readonly versionPath: readonly string[]; // [from, ...intermediates, to]
  readonly worstSeverity: DiffSeverity | null;
  readonly notes: readonly PlanNote[];
}
```

`versionPath` always carries both endpoints. For an empty chain it's `[fromVersion, toVersion]`. For a non-empty chain it's derived from the chain entries' `toVersion`s.

### `PlanNote` kinds

```ts
type PlanNote =
  | { kind: "over_specified";        migration: MigrationEntry }
  | { kind: "additive_no_migration"; worstSeverity: DiffSeverity };
```

Notes record *why* the plan came out the way it did when the chain decision is non-obvious.

### Failure codes (planner)

| Code                            | Condition                                                                  |
|---------------------------------|----------------------------------------------------------------------------|
| `migration_missing_endpoint`    | Either `fromVersion` or `toVersion` is absent from the schema registry.    |
| `migration_not_found`           | `worstSeverity` is `breaking` and no migrations are registered for the id. |
| `migration_chain_broken`        | `worstSeverity` is `breaking`, migrations exist but no path bridges.       |
| `migration_ambiguous_chain`     | `worstSeverity` is `breaking` and two or more chains both reach the target.|

### `transform` is never called

Chain resolution is **structural**. The planner walks `(schemaId, fromVersion) → Map<toVersion, MigrationEntry>` adjacency and emits an ordered chain of entries. It does not — and cannot — call `migration.transform`. The static-scan purity gate ([`tests/migrations/handler-purity.test.ts`](../tests/migrations/handler-purity.test.ts)) deny-lists `.transform(` over the planner's full reach.

### `UnsupportedNodeKindError` propagates

If `diffNodes` is given an IR with an unsupported kind (`date` / `union` / `recursiveRef` / `transform`), the planner does **not** catch the throw — it propagates to the CLI dispatcher, which maps it to a non-zero exit code at the CLI boundary. Same fail-loud discipline as v0.3 / v0.6 generators.

---

## Verifier — `verifyMigrationProvenance`

[`src/migrations/verify-provenance.ts`](../src/migrations/verify-provenance.ts):

```ts
verifyMigrationProvenance({ schemaRegistry, migrationRegistry }): Result<VerificationResult>
```

### Verdict matrix

For every `MigrationEntry`, compare recorded provenance against current schema registry endpoints. Mirrors the v0.7 two-hash freshness matrix one row at a time:

| irHash (both endpoints) | sourceHash (both endpoints) | Verdict             |
|-------------------------|------------------------------|---------------------|
| match                   | match                        | `bound`             |
| match                   | at least one differs         | `cosmetic_drift`    |
| at least one differs    | (any)                        | `drift`             |
| endpoint absent         | n/a                          | `missing_endpoint`  |

Per-verdict shape (discriminated union, `status` field):

```ts
{ status: "bound" | "cosmetic_drift" | "drift" | "missing_endpoint",
  sourcePath, schemaId, fromVersion, toVersion }
```

### Result envelope

- `Result.success` when every verdict is `bound` or `cosmetic_drift`. **`cosmetic_drift` does not fail the run** — CLI warns on stderr; exit stays `SUCCESS`.
- `Result.failure` with one `Issue` per `drift` / `missing_endpoint` otherwise. CLI maps to `LOGICAL_FAILURE`.

### Scope of "verification"

**Provenance + chain integrity only.** The verifier does NOT prove transform correctness. A migration whose `transform` is `throw new Error("Not yet implemented")` verifies just as cleanly as a fully-authored one, as long as the provenance hashes bind. The verifier is a `provenance-says-what-it-says` check, not a behavior check. Transform behavior is v0.9+.

### Failure codes (verifier)

| Code                         | Condition                                                                              |
|------------------------------|----------------------------------------------------------------------------------------|
| `migration_drift`            | irHash mismatch at at least one endpoint.                                              |
| `migration_missing_endpoint` | A migration references a schema version not in the registry. Same code as the planner. |

`cosmetic_drift` does not surface as an Issue — it lives on the success branch's `verdicts[]` and `summary.cosmetic_drift` only.

---

## Stub — `stubMigration`

[`src/migrations/stub.ts`](../src/migrations/stub.ts):

```ts
stubMigration({ schemaRegistry, schemaId, fromVersion, toVersion }): Result<MigrationStub>
```

Pure file-*content* generator. The CLI does the filesystem write (Step 23).

### Suggested path

```text
<schema-dir>/migrations/<basename>.<from-slug>-to-<to-slug>.migration.ts
```

- `<basename>` strips `.schema.{ts,js,mts,cts}` from the from-version schema's filename.
- `<from-slug>` / `<to-slug>` use the **v0.7-compatible slug rule** from `src/registry/handlers/generate.ts` (Round-2 lock):
  ```text
  lowercase  →  non-alphanumeric runs collapse to "-"  →  trim leading/trailing "-"
  ```
- Handles prerelease/build markers cleanly: `1.0.0-beta.1` → `1-0-0-beta-1`, `2.0.0+build.5` → `2-0-0-build-5`.

### Generated content

- Full 9-field JSDoc provenance header padded for visual alignment (matches the v0.2/v0.3 generator-header style).
- `import type { Migration } from "@nekostack/schema/cli"` — NOT root.
- Typed `Migration<schemaId, fromVersion, toVersion>` declaration.
- `transform(input)` body that throws `"Not yet implemented"`. Authors edit the body; v0.8 never invokes it.
- `export default migration`.

The stub generator is pure — it does not write the file. The CLI's `stub` verb (Step 23) does `mkdir -p` + `writeFile` and **refuses to overwrite** an existing file at the suggested path (unlike `generate`'s overwrite-by-default behavior; `generate` overwrites generated artifacts, but `stub` would overwrite hand-authored code).

### Failure

| Code                         | Condition                                                                |
|------------------------------|---------------------------------------------------------------------------|
| `migration_missing_endpoint` | Either `fromVersion` or `toVersion` is absent from the schema registry.   |

---

## Schema/CLI ownership boundary

Master plan Decision #1 (continued from v0.6 / v0.7):

| Concern                                          | Owner                  |
|--------------------------------------------------|------------------------|
| Pure registry construction, planning, verification, stub-content generation | `@nekostack/schema` (v0.8 surface) |
| Filesystem reads (`*.schema.ts`, `*.migration.ts`, generated artifacts)     | `@nekostack/cli`  |
| Schema/migration module loading via `tsx`         | `@nekostack/cli`  |
| Filesystem writes (stub files)                    | `@nekostack/cli`  |
| stdout / stderr formatting                        | `@nekostack/cli`  |
| Process exit codes                                | `@nekostack/cli`  |
| `migration.transform` execution                   | **v0.9+**, no owner in v0.8 |

The schema package is **data-in / data-out**. No `fs.*`, no dynamic `import()`, no `process.*`, no `console.*`. The static + runtime purity gate in [`tests/migrations/handler-purity.test.ts`](../tests/migrations/handler-purity.test.ts) covers all four migration handlers and their immediate reach (9 modules total) plus `.transform(` as a forbidden call pattern.

---

## Surface boundary

| Path                            | What it exposes                                                                                |
|---------------------------------|------------------------------------------------------------------------------------------------|
| `@nekostack/schema`             | v0.6 public consumer API. **No v0.7 / v0.8 surface names appear here.**                        |
| `@nekostack/schema/cli`         | Package-internal integration surface for `@nekostack/cli`. Exposes v0.7 + v0.8 surfaces.       |

The boundary is gated by two complementary test files:

- [`tests/registry-surface.test.ts`](../tests/registry-surface.test.ts) — positive gate. Asserts every v0.7 + v0.8 runtime name and type is reachable through `@nekostack/schema/cli`.
- [`tests/public-surface.test.ts`](../tests/public-surface.test.ts) — negative gate. Asserts every v0.7 + v0.8 name is **absent** from `@nekostack/schema`. Type-level coverage uses `@ts-expect-error` directives — any future leakage makes a directive unused, which is itself a typecheck error.

Wiring: `package.json` `exports` map declares both `"."` (root) and `"./cli"`; the `/cli` path resolves to [`src/cli-integration.ts`](../src/cli-integration.ts) which re-exports the v0.7 + v0.8 surfaces.

---

## Explicit non-goals

The following are **out of scope** for v0.8. They live either in a later schema phase, in a sibling package, or — for the highest-risk items — behind v0.9+'s own plan and safety review:

| Out-of-scope item                                  | Why deferred                                                                                                                              |
|----------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------|
| **Migration execution (`apply`)**                  | The whole hard-locked boundary. v0.9+ revisits behind a separate plan with pre/post validation, audit log emission, rollback semantics, dry-run/apply split, online/offline. |
| **Reversible / down migrations**                   | Bidirectional migrations are a separate authorship surface. Every `down` needs its own authorship + test + verification.                  |
| **Cross-schema migrations**                        | One `schemaId` per migration. Splitting `User → User + Profile` is two unrelated plans the consumer composes.                              |
| **Database DDL migrations (`ALTER TABLE`)**        | Owned by [`@nekostack/migrate`](../../migrate) per `BOUNDARIES.md` §25. v0.8's planner produces plans that `@nekostack/migrate` could consume, but DDL execution belongs there. |
| **Online migrations**                              | Even when v0.9+ adds `apply`, the apply phase's plan decides offline-vs-online. v0.8 does not pre-decide.                                  |
| **Branching migrations / version trees**           | Linear version chains only. `migration_ambiguous_chain` is fail-loud, not auto-resolved.                                                   |
| **Multi-hop skip migrations**                      | Forced through intermediate versions; the planner enumerates simple paths, not skip-edges.                                                 |
| **Transform correctness proof**                    | The verifier checks provenance + chain integrity. v0.8 cannot inspect a function body to know whether it correctly maps `s.output<v1>` to `s.output<v2>`. Authors write their own unit tests. |
| **Migration scheduling / orchestration**           | v1.0+.                                                                                                                                     |
| **Distributed migration coordination**             | Single-process planner. No locks, leases, cluster awareness.                                                                               |
| **Authoring idioms / helper-library conventions**  | v0.8 locks the file shape, path convention, provenance carrier, and type signature. Author idioms (helper libraries, snapshot strategies) land separately if the community converges on a pattern. |

---

## Reference

### Implementation files

| Surface                                        | File                                                                                  |
|------------------------------------------------|----------------------------------------------------------------------------------------|
| Types                                          | [`../src/migrations/types.ts`](../src/migrations/types.ts)                            |
| Provenance parser                              | [`../src/migrations/parse-provenance.ts`](../src/migrations/parse-provenance.ts)      |
| Registry builder                               | [`../src/migrations/build-migration-registry.ts`](../src/migrations/build-migration-registry.ts) |
| Planner                                        | [`../src/migrations/plan-migration.ts`](../src/migrations/plan-migration.ts)          |
| Verifier                                       | [`../src/migrations/verify-provenance.ts`](../src/migrations/verify-provenance.ts)    |
| Stub generator                                 | [`../src/migrations/stub.ts`](../src/migrations/stub.ts)                              |
| Handlers — `list`, `plan`, `verify`, `stub`    | [`../src/migrations/handlers/`](../src/migrations/handlers/)                          |
| Diff classifier (shared with v0.7)             | [`../src/registry/diff.ts`](../src/registry/diff.ts)                                  |
| Integration barrel                             | [`../src/cli-integration.ts`](../src/cli-integration.ts)                              |

### Phase + contract docs

| Doc                                           | Subject                                                  |
|-----------------------------------------------|----------------------------------------------------------|
| [`./PHASE_PLAN_v0.8.md`](./PHASE_PLAN_v0.8.md) | Locked decisions, sequencing, validation gates           |
| [`./DIFF_CLASSIFICATION.md`](./DIFF_CLASSIFICATION.md) | The classifier the planner consumes                       |
| [`./REGISTRY.md`](./REGISTRY.md)              | v0.7 registry / freshness / generation contract           |
| [`./HEADER_FORMAT.md`](./HEADER_FORMAT.md)    | The JSDoc provenance-header carrier (v0.2-era origin)     |
