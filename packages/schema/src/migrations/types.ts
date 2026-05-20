/**
 * Type definitions for the v0.8 schema-side migration surface.
 *
 * This module is **types only** — no functions, no constants beyond
 * what TypeScript requires for the type definitions themselves. All
 * runtime behavior (migration registry construction, chain planning,
 * provenance verification, stub generation) lives in the sibling
 * modules that import these types.
 *
 * Boundary recap (Master plan Decision #1, continued from v0.6 / v0.7):
 * - `@nekostack/schema` is **pure** — no `fs.*`, no `import()`, no
 *   `process.*`, no `console.*`. Takes data, returns data.
 * - `@nekostack/cli` is the **filesystem shell** — walks
 *   `*.migration.ts` files, loads them via `tsx`, reads source bytes,
 *   writes stub files, owns stdout / stderr / exit codes.
 *
 * Re-exported from the package-internal integration subpath
 * `@nekostack/schema/cli` (Master plan Decision #10) in a later
 * sequencing step. Root `@nekostack/schema` does NOT expose these
 * names.
 *
 * **Hard-locked v0.8 boundary**: nothing in this file mentions
 * `apply`. Migration execution is deferred to v0.9+. The `transform`
 * function on `Migration<...>` exists so the file shape is stable
 * for the eventual apply phase, but v0.8 never invokes it.
 */

import type { Result } from "../errors/issue.js";
import type { DiffSeverity } from "../registry/types.js";
import type { Registry } from "../registry/types.js";

// =============================================================================
// Migration — the author-written shape
// =============================================================================

/**
 * The default export of a `*.migration.ts` file.
 *
 * The five type parameters cascade from coarsest to finest:
 *
 * - `SchemaId`     — string literal of the schema this migration
 *                    targets (e.g. `"com.x.User"`).
 * - `FromVersion`  — string literal of the source version
 *                    (e.g. `"1.0.0"`).
 * - `ToVersion`    — string literal of the destination version.
 * - `Input`        — the static type of `s.output<FromSchema>`.
 *                    Defaults to `unknown` so loosely-typed
 *                    migrations still compile; consumers who want
 *                    static safety pass the inferred type here.
 * - `Output`       — the static type of `s.output<ToSchema>`.
 *                    Defaults to `unknown`.
 *
 * v0.8 NEVER calls `transform`. The function signature exists so
 * authors write a v0.9+-ready migration file in v0.8, but the
 * planner / verifier / stub primitives only inspect provenance,
 * not behavior.
 */
export interface Migration<
  SchemaId extends string = string,
  FromVersion extends string = string,
  ToVersion extends string = string,
  Input = unknown,
  Output = unknown,
> {
  readonly schemaId: SchemaId;
  readonly from: FromVersion;
  readonly to: ToVersion;
  /**
   * The data transformation. **NEVER invoked by v0.8.** Authors
   * write the body; v0.9+ runtime apply will execute it.
   */
  readonly transform: (input: Input) => Output;
}

/**
 * Widest legal `Migration`. Useful as a registry value type and as
 * the loaded-export shape of `MigrationSourceEntry.migration`.
 */
export type AnyMigration = Migration<string, string, string, unknown, unknown>;

// =============================================================================
// Migration input — what the CLI hands to `buildMigrationRegistry`
// =============================================================================

/**
 * One discovered `*.migration.ts` source file, after the CLI has
 * read its bytes and dynamic-imported the module via `tsx`.
 *
 * `migration` is the module's default export. The CLI is responsible
 * for asserting the export shape (`{ schemaId, from, to, transform }`)
 * before constructing this entry; the schema-side primitives assume
 * the field is a valid `AnyMigration`.
 *
 * Mirrors the v0.7 `RegistrySourceEntry` shape so the walker
 * pipeline composes cleanly.
 */
export interface MigrationSourceEntry {
  readonly sourcePath: string;
  readonly sourceText: string;
  readonly migration: AnyMigration;
}

// =============================================================================
// Migration output — the indexed shape in `MigrationRegistry`
// =============================================================================

/**
 * One indexed migration. Identity is the `(schemaId, fromVersion,
 * toVersion)` triple per Decision #8. The four hash fields are
 * **provenance binding**, not identity — they let the verifier
 * detect when the migration was authored against a schema state
 * that has since changed.
 *
 * `fromIrHash` / `toIrHash` come from the v0.2-format provenance
 * header on the migration source file; `fromSourceHash` /
 * `toSourceHash` come from the same header (v0.8 always emits them
 * via the stub generator).
 */
export interface MigrationEntry {
  readonly schemaId: string;
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly fromIrHash: `sha256:${string}`;
  readonly toIrHash: `sha256:${string}`;
  readonly fromSourceHash: `sha256:${string}`;
  readonly toSourceHash: `sha256:${string}`;
  readonly sourcePath: string;
  readonly migration: AnyMigration;
}

/**
 * Three-level map: outer key is `schemaId`, middle key is the
 * `fromVersion`, inner key is the `toVersion`. The shape supports
 * two access patterns the planner needs:
 *
 * - **Exact lookup** by triple — `reg.get(id)?.get(from)?.get(to)`.
 * - **All outgoing edges from a fromVersion** — `reg.get(id)?.get(from)`
 *   yields the full `Map<toVersion, MigrationEntry>`, which is the
 *   set of edges BFS needs to expand a node.
 *
 * `buildMigrationRegistry` is the only legitimate producer.
 */
export type MigrationRegistry = ReadonlyMap<
  string,
  ReadonlyMap<string, ReadonlyMap<string, MigrationEntry>>
>;

// =============================================================================
// Migration plan — the planner output
// =============================================================================

/**
 * Free-form annotation on a `MigrationPlan`. Documents *why* the
 * chain came out the way it did when the result isn't a simple
 * "found the chain":
 *
 * - `over_specified` — the diff classifier said no migration is
 *   required (`worstSeverity` is `null` or `cosmetic`), but a
 *   migration is registered for the pair anyway. The plan still
 *   succeeds with an empty chain; this note records the
 *   discrepancy for the CLI to surface.
 * - `additive_no_migration` — `worstSeverity` is `additive` and no
 *   migration is registered. The plan succeeds with an empty chain;
 *   this note records that a consumer review may be desired.
 */
export type PlanNote =
  | {
      readonly kind: "over_specified";
      readonly migration: MigrationEntry;
    }
  | {
      readonly kind: "additive_no_migration";
      readonly worstSeverity: DiffSeverity;
    };

/**
 * The output of `planMigration`. Always carries the resolved
 * `versionPath` and `worstSeverity` so consumers can see the diff
 * that drove the decision, even when the chain is empty.
 *
 * Decision #10 maps `worstSeverity` to the chain requirement:
 *
 * - `null` / `"cosmetic"` — chain is empty.
 * - `"additive"`           — chain is empty unless a migration is
 *                            registered for the pair.
 * - `"breaking"`           — chain is required; failure paths emit
 *                            `migration_not_found` /
 *                            `migration_chain_broken` /
 *                            `migration_ambiguous_chain` on the
 *                            `Result.failure` branch.
 *
 * `versionPath` always includes both endpoints. For an empty chain
 * the array is `[fromVersion, toVersion]`.
 */
export interface MigrationPlan {
  readonly schemaId: string;
  readonly chain: readonly MigrationEntry[];
  readonly versionPath: readonly string[];
  readonly worstSeverity: DiffSeverity | null;
  readonly notes: readonly PlanNote[];
}

// =============================================================================
// Migration verification — per-migration verdict + cumulative result
// =============================================================================

/**
 * Per-migration outcome of the two-hash provenance check, mirroring
 * the v0.7 `FreshnessVerdict` shape for artifacts. The four-value
 * mapping is Decision #9 of the v0.8 plan:
 *
 * - `bound`            — both `irHash` and `sourceHash` match at
 *                        both endpoints. Migration is current.
 * - `cosmetic_drift`   — `irHash` matches at both endpoints, but at
 *                        least one `sourceHash` differs. Source was
 *                        edited without semantic effect. CLI warns
 *                        on stderr; exit code stays `SUCCESS`.
 * - `drift`            — at least one endpoint's `irHash` differs
 *                        from the schema registry. The migration
 *                        was authored against a schema state that
 *                        has since changed semantically. CLI exits
 *                        `LOGICAL_FAILURE`.
 * - `missing_endpoint` — one or both versions are not in the schema
 *                        registry. Indicates a stale migration or a
 *                        deleted schema version. CLI exits
 *                        `LOGICAL_FAILURE`.
 *
 * The discriminated-union shape mirrors v0.7's `FreshnessVerdict`
 * so downstream tooling can pattern-match on `status` uniformly.
 */
export type MigrationVerdict =
  | {
      readonly status: "bound";
      readonly sourcePath: string;
      readonly schemaId: string;
      readonly fromVersion: string;
      readonly toVersion: string;
    }
  | {
      readonly status: "cosmetic_drift";
      readonly sourcePath: string;
      readonly schemaId: string;
      readonly fromVersion: string;
      readonly toVersion: string;
    }
  | {
      readonly status: "drift";
      readonly sourcePath: string;
      readonly schemaId: string;
      readonly fromVersion: string;
      readonly toVersion: string;
    }
  | {
      readonly status: "missing_endpoint";
      readonly sourcePath: string;
      readonly schemaId: string;
      readonly fromVersion: string;
      readonly toVersion: string;
    };

/**
 * Cumulative output of `verifyMigrationProvenance`. `verdicts` is
 * one entry per registered migration in input order. `summary`
 * is the per-status tally for header rendering.
 */
export interface VerificationResult {
  readonly verdicts: readonly MigrationVerdict[];
  readonly summary: {
    readonly bound: number;
    readonly cosmetic_drift: number;
    readonly drift: number;
    readonly missing_endpoint: number;
  };
}

// =============================================================================
// Migration stub — the stub-generator output
// =============================================================================

/**
 * `stubMigration` produces a file *content* string and a
 * `suggestedPath`. The CLI is responsible for the filesystem write;
 * this primitive is pure.
 *
 * Mirrors `GeneratedArtifact` from v0.7 — same separation between
 * planner output and CLI write step.
 */
export interface MigrationStub {
  readonly schemaId: string;
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly suggestedPath: string;
  readonly content: string;
}

// =============================================================================
// Handler opts + results
// =============================================================================

/**
 * `listMigrationsHandler({ migrationRegistry })` — enumerate every
 * `MigrationEntry`. Deterministic ordering is the handler's
 * responsibility (sort by schemaId, then by fromVersion, then by
 * toVersion).
 */
export interface MigrationListOpts {
  readonly migrationRegistry: MigrationRegistry;
}
export type MigrationListResult = Result<{
  readonly entries: readonly MigrationEntry[];
}>;

/**
 * `planMigrationHandler({ schemaRegistry, migrationRegistry, ... })`
 * — the diff-aware planner (Round-3 amendment). Receives BOTH
 * registries plus the operand triple. Resolves endpoints in
 * `schemaRegistry`, computes `worstSeverity` via `diffNodes`,
 * severity-gates the chain requirement.
 */
export interface MigrationPlanOpts {
  readonly schemaRegistry: Registry;
  readonly migrationRegistry: MigrationRegistry;
  readonly schemaId: string;
  readonly fromVersion: string;
  readonly toVersion: string;
}
export type MigrationPlanResult = Result<MigrationPlan>;

/**
 * `verifyMigrationsHandler({ schemaRegistry, migrationRegistry })`
 * — provenance verification for every registered migration. Receives
 * BOTH registries so `findSchema(schemaRegistry, ...)` can supply the
 * current `irHash` / `sourceHash` for comparison against each
 * migration's recorded values.
 */
export interface MigrationVerifyOpts {
  readonly schemaRegistry: Registry;
  readonly migrationRegistry: MigrationRegistry;
}
export type MigrationVerifyResult = Result<VerificationResult>;

/**
 * `stubMigrationHandler({ schemaRegistry, schemaId, fromVersion,
 * toVersion })` — generate stub content. Does NOT consume a
 * migration registry; the stub is brand new. Endpoint hashes come
 * from `schemaRegistry` via `findSchema`.
 */
export interface MigrationStubOpts {
  readonly schemaRegistry: Registry;
  readonly schemaId: string;
  readonly fromVersion: string;
  readonly toVersion: string;
}
export type MigrationStubResult = Result<MigrationStub>;
