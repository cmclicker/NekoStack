/**
 * Step 1 — v0.8 migration types: type-level tests.
 *
 * Compile-time only (vitest `typecheck` mode). No runtime assertions
 * beyond the placeholder `expect` rows that hold each test row in
 * the suite.
 *
 * Locked invariants exercised here:
 *
 *   - `Migration<...>` has exactly five generic parameters and the
 *     four required value-level fields (`schemaId`, `from`, `to`,
 *     `transform`).
 *   - `Migration` has NO `down` / `reverse` field (forward-only).
 *   - `Migration` has NO `apply` field (v0.8 boundary — no
 *     execution from this type).
 *   - `AnyMigration` is the broadest `Migration` shape.
 *   - `MigrationRegistry` is a three-level `ReadonlyMap`.
 *   - `MigrationVerdict` is a discriminated union on `status`.
 *   - `PlanNote` is a discriminated union on `kind`.
 *   - Handler opts shapes carry the locked registry inputs:
 *     planner + verifier receive BOTH registries; list takes
 *     migration only; stub takes schema only.
 */
import { describe, expectTypeOf, it } from "vitest";
import type {
  AnyMigration,
  Migration,
  MigrationEntry,
  MigrationListOpts,
  MigrationListResult,
  MigrationPlan,
  MigrationPlanOpts,
  MigrationPlanResult,
  MigrationRegistry,
  MigrationSourceEntry,
  MigrationStub,
  MigrationStubOpts,
  MigrationStubResult,
  MigrationVerdict,
  MigrationVerifyOpts,
  MigrationVerifyResult,
  PlanNote,
  VerificationResult,
} from "../../src/migrations/types.js";
import type { DiffSeverity, Registry } from "../../src/registry/types.js";

// =============================================================================
// Migration<...>
// =============================================================================

describe("Migration<...>", () => {
  it("has the four required fields", () => {
    expectTypeOf<Migration>().toHaveProperty("schemaId");
    expectTypeOf<Migration>().toHaveProperty("from");
    expectTypeOf<Migration>().toHaveProperty("to");
    expectTypeOf<Migration>().toHaveProperty("transform");
  });

  it("forward-only: no `down` or `reverse` field", () => {
    expectTypeOf<Migration>().not.toHaveProperty("down");
    expectTypeOf<Migration>().not.toHaveProperty("reverse");
  });

  it("v0.8 boundary: no `apply` field on the type", () => {
    expectTypeOf<Migration>().not.toHaveProperty("apply");
  });

  it("narrows by literal string type parameters", () => {
    type M = Migration<"com.x.User", "1.0.0", "2.0.0">;
    expectTypeOf<M["schemaId"]>().toEqualTypeOf<"com.x.User">();
    expectTypeOf<M["from"]>().toEqualTypeOf<"1.0.0">();
    expectTypeOf<M["to"]>().toEqualTypeOf<"2.0.0">();
  });

  it("transform signature defaults to `(unknown) => unknown`", () => {
    expectTypeOf<Migration["transform"]>().toEqualTypeOf<
      (input: unknown) => unknown
    >();
  });

  it("transform signature narrows when Input/Output are supplied", () => {
    type In = { id: string };
    type Out = { id: string; email: string | null };
    type M = Migration<"com.x.User", "1.0.0", "2.0.0", In, Out>;
    expectTypeOf<M["transform"]>().toEqualTypeOf<(input: In) => Out>();
  });

  it("AnyMigration is assignment-compatible with any concrete Migration", () => {
    type Specific = Migration<"com.x.User", "1.0.0", "2.0.0">;
    expectTypeOf<Specific>().toMatchTypeOf<AnyMigration>();
  });
});

// =============================================================================
// MigrationSourceEntry — what the CLI hands to buildMigrationRegistry
// =============================================================================

describe("MigrationSourceEntry", () => {
  it("carries sourcePath, sourceText, and the loaded migration", () => {
    expectTypeOf<MigrationSourceEntry["sourcePath"]>().toEqualTypeOf<string>();
    expectTypeOf<MigrationSourceEntry["sourceText"]>().toEqualTypeOf<string>();
    expectTypeOf<MigrationSourceEntry["migration"]>().toEqualTypeOf<AnyMigration>();
  });
});

// =============================================================================
// MigrationEntry — indexed shape
// =============================================================================

describe("MigrationEntry", () => {
  it("carries the (schemaId, fromVersion, toVersion) triple", () => {
    expectTypeOf<MigrationEntry["schemaId"]>().toEqualTypeOf<string>();
    expectTypeOf<MigrationEntry["fromVersion"]>().toEqualTypeOf<string>();
    expectTypeOf<MigrationEntry["toVersion"]>().toEqualTypeOf<string>();
  });

  it("carries the four provenance-binding hashes as branded sha256 strings", () => {
    expectTypeOf<MigrationEntry["fromIrHash"]>().toEqualTypeOf<`sha256:${string}`>();
    expectTypeOf<MigrationEntry["toIrHash"]>().toEqualTypeOf<`sha256:${string}`>();
    expectTypeOf<MigrationEntry["fromSourceHash"]>().toEqualTypeOf<`sha256:${string}`>();
    expectTypeOf<MigrationEntry["toSourceHash"]>().toEqualTypeOf<`sha256:${string}`>();
  });
});

// =============================================================================
// MigrationRegistry — three-level map
// =============================================================================

describe("MigrationRegistry", () => {
  it("is a three-level ReadonlyMap<schemaId, fromVersion, toVersion, MigrationEntry>", () => {
    expectTypeOf<MigrationRegistry>().toEqualTypeOf<
      ReadonlyMap<
        string,
        ReadonlyMap<string, ReadonlyMap<string, MigrationEntry>>
      >
    >();
  });
});

// =============================================================================
// MigrationPlan + PlanNote
// =============================================================================

describe("MigrationPlan", () => {
  it("carries chain, versionPath, worstSeverity, notes", () => {
    expectTypeOf<MigrationPlan["chain"]>().toEqualTypeOf<
      readonly MigrationEntry[]
    >();
    expectTypeOf<MigrationPlan["versionPath"]>().toEqualTypeOf<
      readonly string[]
    >();
    expectTypeOf<MigrationPlan["worstSeverity"]>().toEqualTypeOf<
      DiffSeverity | null
    >();
    expectTypeOf<MigrationPlan["notes"]>().toEqualTypeOf<readonly PlanNote[]>();
  });
});

describe("PlanNote", () => {
  it("is a discriminated union on `kind`", () => {
    // Check the union at the type level (instance narrowing would
    // give us a single literal, not the full union).
    expectTypeOf<PlanNote["kind"]>().toEqualTypeOf<
      "over_specified" | "additive_no_migration"
    >();
  });

  it("the `over_specified` variant carries a `migration` field", () => {
    type OverSpec = Extract<PlanNote, { kind: "over_specified" }>;
    expectTypeOf<OverSpec["migration"]>().toEqualTypeOf<MigrationEntry>();
  });

  it("the `additive_no_migration` variant carries a `worstSeverity` field", () => {
    type AddNoMig = Extract<PlanNote, { kind: "additive_no_migration" }>;
    expectTypeOf<AddNoMig["worstSeverity"]>().toEqualTypeOf<DiffSeverity>();
  });
});

// =============================================================================
// MigrationVerdict + VerificationResult
// =============================================================================

describe("MigrationVerdict", () => {
  it("is a discriminated union with the four locked statuses", () => {
    expectTypeOf<MigrationVerdict["status"]>().toEqualTypeOf<
      "bound" | "cosmetic_drift" | "drift" | "missing_endpoint"
    >();
  });

  it("every variant carries sourcePath + triple", () => {
    expectTypeOf<MigrationVerdict["sourcePath"]>().toEqualTypeOf<string>();
    expectTypeOf<MigrationVerdict["schemaId"]>().toEqualTypeOf<string>();
    expectTypeOf<MigrationVerdict["fromVersion"]>().toEqualTypeOf<string>();
    expectTypeOf<MigrationVerdict["toVersion"]>().toEqualTypeOf<string>();
  });
});

describe("VerificationResult", () => {
  it("carries verdicts + per-status summary", () => {
    expectTypeOf<VerificationResult["verdicts"]>().toEqualTypeOf<
      readonly MigrationVerdict[]
    >();
    expectTypeOf<VerificationResult["summary"]>().toEqualTypeOf<{
      readonly bound: number;
      readonly cosmetic_drift: number;
      readonly drift: number;
      readonly missing_endpoint: number;
    }>();
  });
});

// =============================================================================
// MigrationStub
// =============================================================================

describe("MigrationStub", () => {
  it("carries triple + suggestedPath + content", () => {
    expectTypeOf<MigrationStub["schemaId"]>().toEqualTypeOf<string>();
    expectTypeOf<MigrationStub["fromVersion"]>().toEqualTypeOf<string>();
    expectTypeOf<MigrationStub["toVersion"]>().toEqualTypeOf<string>();
    expectTypeOf<MigrationStub["suggestedPath"]>().toEqualTypeOf<string>();
    expectTypeOf<MigrationStub["content"]>().toEqualTypeOf<string>();
  });
});

// =============================================================================
// Handler opts — the registry-input contract per Round-3
// =============================================================================

describe("handler opts — locked registry inputs per Round-3", () => {
  it("`MigrationListOpts` takes the migration registry only", () => {
    expectTypeOf<MigrationListOpts>().toEqualTypeOf<{
      readonly migrationRegistry: MigrationRegistry;
    }>();
  });

  it("`MigrationPlanOpts` takes BOTH registries plus the operand triple", () => {
    expectTypeOf<MigrationPlanOpts["schemaRegistry"]>().toEqualTypeOf<Registry>();
    expectTypeOf<MigrationPlanOpts["migrationRegistry"]>().toEqualTypeOf<MigrationRegistry>();
    expectTypeOf<MigrationPlanOpts["schemaId"]>().toEqualTypeOf<string>();
    expectTypeOf<MigrationPlanOpts["fromVersion"]>().toEqualTypeOf<string>();
    expectTypeOf<MigrationPlanOpts["toVersion"]>().toEqualTypeOf<string>();
  });

  it("`MigrationVerifyOpts` takes BOTH registries", () => {
    expectTypeOf<MigrationVerifyOpts>().toEqualTypeOf<{
      readonly schemaRegistry: Registry;
      readonly migrationRegistry: MigrationRegistry;
    }>();
  });

  it("`MigrationStubOpts` takes the schema registry only (no migration registry; the stub is brand new)", () => {
    expectTypeOf<MigrationStubOpts["schemaRegistry"]>().toEqualTypeOf<Registry>();
    expectTypeOf<MigrationStubOpts["schemaId"]>().toEqualTypeOf<string>();
    expectTypeOf<MigrationStubOpts["fromVersion"]>().toEqualTypeOf<string>();
    expectTypeOf<MigrationStubOpts["toVersion"]>().toEqualTypeOf<string>();
    expectTypeOf<MigrationStubOpts>().not.toHaveProperty("migrationRegistry");
  });
});

// =============================================================================
// Handler results — Result<T> envelopes
// =============================================================================

describe("handler result envelopes", () => {
  it("`MigrationListResult` wraps `{ entries: readonly MigrationEntry[] }`", () => {
    // Result<T> success branch shape — narrow by checking the `data` field
    // would require an instance; type-level narrowing is sufficient here.
    expectTypeOf<MigrationListResult>().toMatchTypeOf<
      | { success: true; data: { entries: readonly MigrationEntry[] } }
      | { success: false; issues: readonly unknown[] }
    >();
  });

  it("`MigrationPlanResult` wraps `MigrationPlan`", () => {
    expectTypeOf<MigrationPlanResult>().toMatchTypeOf<
      | { success: true; data: MigrationPlan }
      | { success: false; issues: readonly unknown[] }
    >();
  });

  it("`MigrationVerifyResult` wraps `VerificationResult`", () => {
    expectTypeOf<MigrationVerifyResult>().toMatchTypeOf<
      | { success: true; data: VerificationResult }
      | { success: false; issues: readonly unknown[] }
    >();
  });

  it("`MigrationStubResult` wraps `MigrationStub`", () => {
    expectTypeOf<MigrationStubResult>().toMatchTypeOf<
      | { success: true; data: MigrationStub }
      | { success: false; issues: readonly unknown[] }
    >();
  });
});
