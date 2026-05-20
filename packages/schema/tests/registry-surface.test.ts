/**
 * `@nekostack/schema/cli` integration-surface positive gate.
 *
 * Imports through the package subpath `@nekostack/schema/cli`
 * (resolved via the `package.json` `exports` map → the
 * `cli-integration.ts` barrel) and verifies the complete
 * integration surface is reachable. Covers both:
 *
 *   - v0.7 registry / freshness / generation surface
 *   - v0.8 migration planning / verification / stub surface
 *     (Step 13 extension)
 *
 * Why through the package path: the CLI imports via
 * `@nekostack/schema/cli`, not via a relative source path. Testing
 * the resolution + the barrel together catches both kinds of
 * regression: a barrel that forgets to re-export something, and a
 * manifest that forgets to wire the subpath at all.
 *
 * The complementary negative gate (root `@nekostack/schema` does
 * NOT export any v0.7 or v0.8 registry/migration name) lives in
 * `public-surface.test.ts`.
 */
import { describe, expect, it } from "vitest";
import * as schemaCli from "@nekostack/schema/cli";

// =============================================================================
// Runtime presence — every required export resolves to a value
// =============================================================================

const REQUIRED_FUNCTION_EXPORTS = [
  "sourceHashFromText",
  "parseProvenanceFromText",
  "buildRegistry",
  "findSchema",
  "diffNodes",
  "listHandler",
  "diffHandler",
  "checkHandler",
  "generateHandler",
  "suggestedPathFor",
] as const;

const REQUIRED_CONSTANT_EXPORTS = ["GENERATOR_KINDS"] as const;

describe("@nekostack/schema/cli — runtime surface", () => {
  it.each(REQUIRED_FUNCTION_EXPORTS)("exports `%s` as a function", (name) => {
    const surface = schemaCli as unknown as Record<string, unknown>;
    expect(name in surface).toBe(true);
    expect(typeof surface[name]).toBe("function");
  });

  it.each(REQUIRED_CONSTANT_EXPORTS)(
    "exports `%s` as a non-function value",
    (name) => {
      const surface = schemaCli as unknown as Record<string, unknown>;
      expect(name in surface).toBe(true);
      expect(surface[name]).toBeDefined();
    },
  );
});

// =============================================================================
// Smoke behavior — the surface is wired to the real implementations
// =============================================================================

describe("@nekostack/schema/cli — smoke behavior", () => {
  it("`sourceHashFromText` returns a `sha256:`-prefixed digest", () => {
    const hash = schemaCli.sourceHashFromText("x");
    expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("`GENERATOR_KINDS` contains exactly the four locked kinds", () => {
    expect([...schemaCli.GENERATOR_KINDS].sort()).toEqual([
      "jsonSchema",
      "openApi",
      "typescript",
      "zod",
    ]);
  });

  it("`suggestedPathFor` returns the locked single-schema convention", () => {
    expect(
      schemaCli.suggestedPathFor("schemas/user.schema.ts", "typescript"),
    ).toBe("schemas/generated/user.types.ts");
    expect(schemaCli.suggestedPathFor("schemas/user.schema.ts", "zod")).toBe(
      "schemas/generated/user.zod.ts",
    );
    expect(
      schemaCli.suggestedPathFor("schemas/user.schema.ts", "jsonSchema"),
    ).toBe("schemas/generated/user.json.schema.json");
    expect(
      schemaCli.suggestedPathFor("schemas/user.schema.ts", "openApi"),
    ).toBe("schemas/generated/user.openapi.json");
  });
});

// =============================================================================
// Type-level presence — each registry/handler type is reachable
// =============================================================================
//
// Type imports are themselves the assertion: if any of these is not
// exported from `@nekostack/schema/cli`, this file fails to compile.
// The `type _X = X` aliases give each import a use-site so `tsc`'s
// `noUnusedLocals` doesn't drop the imports during dead-code elim.

import type {
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
} from "@nekostack/schema/cli";

type _RegistrySourceEntry = RegistrySourceEntry;
type _RegistryEntry = RegistryEntry;
type _Registry = Registry;
type _DiffSeverity = DiffSeverity;
type _DiffKind = DiffKind;
type _DiffChange = DiffChange;
type _FreshnessVerdict = FreshnessVerdict;
type _GeneratorKind = GeneratorKind;
type _GeneratedArtifact = GeneratedArtifact;
type _CommittedArtifact = CommittedArtifact;
type _GenerateOpts = GenerateOpts;
type _GenerateResult = GenerateResult;
type _CheckOpts = CheckOpts;
type _CheckResult = CheckResult;
type _DiffOpts = DiffOpts;
type _DiffResult = DiffResult;
type _ListOpts = ListOpts;
type _ListResult = ListResult;

// Single runtime assertion that the type-level imports compiled. If
// any type above failed to resolve from `@nekostack/schema/cli`, the
// `tsc` step in vitest's typecheck would have already reported the
// error before this runtime block ever runs.
describe("@nekostack/schema/cli — type surface", () => {
  it("all 18 registry/handler types are reachable via the subpath (typecheck-gated)", () => {
    // The `type _X = X` aliases above are the actual assertion; this
    // runtime expect is just a placeholder so the suite has a green
    // test row even when types are the only thing being verified.
    const _placeholder: _GeneratorKind = "typescript";
    expect(_placeholder).toBe("typescript");
    // Use every alias once at the type level to keep them load-bearing
    // even under aggressive dead-code elimination.
    type _Used =
      | _RegistrySourceEntry
      | _RegistryEntry
      | _Registry
      | _DiffSeverity
      | _DiffKind
      | _DiffChange
      | _FreshnessVerdict
      | _GeneratedArtifact
      | _CommittedArtifact
      | _GenerateOpts
      | _GenerateResult
      | _CheckOpts
      | _CheckResult
      | _DiffOpts
      | _DiffResult
      | _ListOpts
      | _ListResult;
    const _u: _Used | undefined = undefined;
    expect(_u).toBeUndefined();
  });
});

// =============================================================================
// v0.8 — migration surface (Step 13 extension)
// =============================================================================

const MIGRATION_FUNCTION_EXPORTS = [
  "parseMigrationProvenanceFromText",
  "buildMigrationRegistry",
  "planMigration",
  "verifyMigrationProvenance",
  "stubMigration",
  "suggestedMigrationPathFor",
  "listMigrationsHandler",
  "planMigrationHandler",
  "verifyMigrationsHandler",
  "stubMigrationHandler",
] as const;

describe("@nekostack/schema/cli — v0.8 migration runtime surface", () => {
  it.each(MIGRATION_FUNCTION_EXPORTS)(
    "exports `%s` as a function",
    (name) => {
      const surface = schemaCli as unknown as Record<string, unknown>;
      expect(name in surface).toBe(true);
      expect(typeof surface[name]).toBe("function");
    },
  );
});

describe("@nekostack/schema/cli — v0.8 migration smoke behavior", () => {
  it("`suggestedMigrationPathFor` returns the locked migration-path shape", () => {
    // Locked path convention (Decision #5): `<schema-dir>/migrations/<basename>.<from-slug>-to-<to-slug>.migration.ts`.
    expect(
      schemaCli.suggestedMigrationPathFor(
        "schemas/user.schema.ts",
        "1.0.0",
        "2.0.0",
      ),
    ).toBe("schemas/migrations/user.1-0-0-to-2-0-0.migration.ts");
  });

  it("`suggestedMigrationPathFor` handles prerelease versions via the v0.7-compatible slug rule", () => {
    expect(
      schemaCli.suggestedMigrationPathFor(
        "schemas/user.schema.ts",
        "1.0.0-beta.1",
        "2.0.0+build.5",
      ),
    ).toBe(
      "schemas/migrations/user.1-0-0-beta-1-to-2-0-0-build-5.migration.ts",
    );
  });
});

// Type-only imports for the v0.8 migration surface. Same pattern as
// the v0.7 type block above — `type _X = X` aliases give every
// import a use-site so `tsc`'s `noUnusedLocals` doesn't drop them.

import type {
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
} from "@nekostack/schema/cli";

type _Migration = Migration<string, string, string>;
type _AnyMigration = AnyMigration;
type _MigrationSourceEntry = MigrationSourceEntry;
type _MigrationEntry = MigrationEntry;
type _MigrationRegistry = MigrationRegistry;
type _MigrationPlan = MigrationPlan;
type _PlanNote = PlanNote;
type _MigrationVerdict = MigrationVerdict;
type _VerificationResult = VerificationResult;
type _MigrationStub = MigrationStub;
type _MigrationListOpts = MigrationListOpts;
type _MigrationListResult = MigrationListResult;
type _MigrationPlanOpts = MigrationPlanOpts;
type _MigrationPlanResult = MigrationPlanResult;
type _MigrationVerifyOpts = MigrationVerifyOpts;
type _MigrationVerifyResult = MigrationVerifyResult;
type _MigrationStubOpts = MigrationStubOpts;
type _MigrationStubResult = MigrationStubResult;

describe("@nekostack/schema/cli — v0.8 migration type surface", () => {
  it("all 18 migration types are reachable via the subpath (typecheck-gated)", () => {
    // `type _X = X` aliases above are the actual assertion. This
    // runtime expect is a green-row placeholder.
    const _v: _MigrationVerdict["status"] = "bound";
    expect(_v).toBe("bound");
    // Use every alias once at the type level to keep them
    // load-bearing under aggressive dead-code elimination.
    type _Used =
      | _Migration
      | _AnyMigration
      | _MigrationSourceEntry
      | _MigrationEntry
      | _MigrationRegistry
      | _MigrationPlan
      | _PlanNote
      | _MigrationVerdict
      | _VerificationResult
      | _MigrationStub
      | _MigrationListOpts
      | _MigrationListResult
      | _MigrationPlanOpts
      | _MigrationPlanResult
      | _MigrationVerifyOpts
      | _MigrationVerifyResult
      | _MigrationStubOpts
      | _MigrationStubResult;
    const _u: _Used | undefined = undefined;
    expect(_u).toBeUndefined();
  });
});
