/**
 * `@nekostack/schema/cli` integration barrel (Master plan Decision #10).
 *
 * This module is the **package-internal integration surface** for
 * `@nekostack/cli` to import schema primitives that are not part of
 * the public consumer API:
 *
 *   - v0.7 — registry / freshness / generation primitives
 *   - v0.8 — schema-data migration planning / verification /
 *     stub-generation primitives (this commit extends the barrel)
 *
 * **External consumers should NOT import from this path.** The root
 * `@nekostack/schema` import surface remains the v0.6 contract
 * (`s`, `parse`, `safeParse`, `validate`, `ParseError`, IR types,
 * generators). The names re-exported here are subject to internal
 * change; engine-swap-safety lives at the root index, not at this
 * subpath. The negative-leakage gate in
 * `tests/public-surface.test.ts` enforces that the root never
 * exposes a v0.7 or v0.8 surface name.
 *
 * Re-exports only. No new functions, no new types, no behavior
 * changes.
 */

// ---- Pure registry primitives ----------------------------------------------

export { sourceHashFromText } from "./registry/source-hash.js";
export { parseProvenanceFromText } from "./registry/parse-provenance.js";
export { buildRegistry, findSchema } from "./registry/build-registry.js";
export { diffNodes } from "./registry/diff.js";

// ---- Handlers --------------------------------------------------------------

export { listHandler } from "./registry/handlers/list.js";
export { diffHandler } from "./registry/handlers/diff.js";
export { checkHandler } from "./registry/handlers/check.js";
export {
  generateHandler,
  suggestedPathFor,
  GENERATOR_KINDS,
} from "./registry/handlers/generate.js";

// ---- Type surface (all registry / handler public types) --------------------

export type {
  RegistrySourceEntry,
  RegistryEntry,
  Registry,
  DiffSeverity,
  DiffKind,
  DiffChange,
  FreshnessVerdict,
  GeneratorKind,
  GeneratedArtifact,
  CommittedArtifact,
  GenerateOpts,
  GenerateResult,
  CheckOpts,
  CheckResult,
  DiffOpts,
  DiffResult,
  ListOpts,
  ListResult,
} from "./registry/types.js";

// =============================================================================
// v0.8 migration surface
// =============================================================================

// ---- Pure migration primitives ---------------------------------------------

export { parseMigrationProvenanceFromText } from "./migrations/parse-provenance.js";
export { buildMigrationRegistry } from "./migrations/build-migration-registry.js";
export { planMigration } from "./migrations/plan-migration.js";
export { verifyMigrationProvenance } from "./migrations/verify-provenance.js";
export {
  stubMigration,
  suggestedMigrationPathFor,
} from "./migrations/stub.js";

// ---- Migration handlers ----------------------------------------------------

export { listMigrationsHandler } from "./migrations/handlers/list.js";
export { planMigrationHandler } from "./migrations/handlers/plan.js";
export { verifyMigrationsHandler } from "./migrations/handlers/verify.js";
export { stubMigrationHandler } from "./migrations/handlers/stub.js";

// ---- Migration type surface ------------------------------------------------

export type {
  Migration,
  AnyMigration,
  MigrationSourceEntry,
  MigrationEntry,
  MigrationRegistry,
  MigrationPlan,
  PlanNote,
  MigrationVerdict,
  VerificationResult,
  MigrationStub,
  MigrationListOpts,
  MigrationListResult,
  MigrationPlanOpts,
  MigrationPlanResult,
  MigrationVerifyOpts,
  MigrationVerifyResult,
  MigrationStubOpts,
  MigrationStubResult,
} from "./migrations/types.js";
