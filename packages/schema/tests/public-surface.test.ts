/**
 * Step 13 — v0.6 public surface gate.
 * Step 16 — v0.7 registry-surface leakage gate (negative complement
 *           to Step 15's `tests/registry-surface.test.ts`).
 *
 * Canonical place that asserts what `@nekostack/schema` exposes for
 * the v0.6 runtime API:
 *
 *   - `parse`, `safeParse`, `validate` are exported and functional
 *     when imported from the package root
 *   - `ParseError` is exported and catches a real failure
 *   - implementation helpers (compile cache, validate-variant
 *     transform, Zod source/value emitter, issue normalizer) are
 *     intentionally NOT exported — they are package-internal and
 *     may be reworked without a major version bump
 *
 * Step 16 adds a second namespace import — this time through the
 * package path `@nekostack/schema` — and asserts the v0.7 registry /
 * CLI-integration surface does NOT bleed through the root. The
 * positive subpath gate (Step 15) lives in `registry-surface.test.ts`
 * and uses `@nekostack/schema/cli`; this file is the negative twin.
 *
 * Why both: Step 15 proves the integration surface IS reachable via
 * `/cli`; Step 16 proves it is NOT reachable via the root. Together
 * they lock the product boundary set in Master plan Decision #10:
 *
 *   `@nekostack/schema`       = public consumer API (v0.6 contract)
 *   `@nekostack/schema/cli`   = package-internal CLI integration API
 *
 * The original block below imports from `../src/index.js` to keep
 * the v0.6 assertions identical to what shipped in v0.6. The Step 16
 * additions import through the package path so the manifest's
 * `exports.["."]` is what's gated, not the source layout.
 */
import { describe, expect, it } from "vitest";
import * as publicApi from "../src/index.js";
import * as schemaRoot from "@nekostack/schema";
import {
  s,
  parse,
  safeParse,
  validate,
  ParseError,
} from "../src/index.js";

describe("public surface — names present on the package root", () => {
  it("exports parse / safeParse / validate / ParseError", () => {
    expect("parse" in publicApi).toBe(true);
    expect("safeParse" in publicApi).toBe(true);
    expect("validate" in publicApi).toBe(true);
    expect("ParseError" in publicApi).toBe(true);
  });

  it("exports the DSL entry point `s` and the IR/result types remain present", () => {
    // The runtime exports are additive — they must not displace the
    // existing v0.1 / v0.5 surface.
    expect("s" in publicApi).toBe(true);
    expect("serializeIR" in publicApi).toBe(true);
    expect("irHash" in publicApi).toBe(true);
    expect("ISSUE_CODES" in publicApi).toBe(true);
  });
});

describe("public surface — implementation helpers stay internal", () => {
  // None of these should leak. Adding any of them to the public
  // surface is a breaking-by-policy change; this test is the gate.
  const internalNames = [
    "compile",
    "compileZodSchema",
    "irToZodSchema",
    "stripDefaultsForValidate",
    "normalizeIssues",
    "validateNodeCache",
    "emit",
    "ZodEmitter",
  ];
  for (const name of internalNames) {
    it(`does NOT export ${name}`, () => {
      expect(name in publicApi).toBe(false);
    });
  }
});

describe("public surface — exported entry points actually work", () => {
  it("parse fills defaults and returns the output shape", () => {
    const User = s.object({ name: s.string().default("anon") });
    const out = parse(User, {});
    expect(out).toEqual({ name: "anon" });
  });

  it("safeParse returns { success: true, data } on success", () => {
    const User = s.object({ id: s.string() });
    const r = safeParse(User, { id: "u_1" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ id: "u_1" });
  });

  it("safeParse returns { success: false, issues } on failure", () => {
    const User = s.object({ id: s.string() });
    const r = safeParse(User, { id: 42 });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues).toHaveLength(1);
      expect(r.issues[0]?.code).toBe("invalid_type");
      expect(r.issues[0]?.path).toEqual(["id"]);
    }
  });

  it("validate returns the input shape — defaults NOT filled", () => {
    const User = s.object({ name: s.string().default("anon") });
    const r = validate(User, {});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toEqual({});
      expect("name" in r.data).toBe(false);
    }
  });

  it("ParseError exported from the package root catches parse failures", () => {
    const User = s.object({ id: s.string() });
    try {
      parse(User, { id: 42 });
      throw new Error("expected ParseError");
    } catch (e) {
      expect(e).toBeInstanceOf(ParseError);
      if (e instanceof ParseError) {
        expect(e.code).toBe("parse_failed");
        expect(e.name).toBe("ParseError");
        expect(e.issues).toHaveLength(1);
        expect(e.issues[0]?.code).toBe("invalid_type");
      }
    }
  });

  it("ParseError from publicApi.* matches the directly-imported class", () => {
    // Sanity: the re-export is not a shim or duplicate constructor.
    const fromNamespace = (publicApi as unknown as {
      ParseError: typeof ParseError;
    }).ParseError;
    expect(fromNamespace).toBe(ParseError);
  });
});

// =============================================================================
// Step 16 — root `@nekostack/schema` MUST NOT export v0.7 registry surface
// =============================================================================
//
// The v0.7 integration surface lives at `@nekostack/schema/cli`
// (Steps 13/14 wire the barrel + the `exports."./cli"` manifest
// entry). The root path remains the v0.6 contract. If any of these
// names leaks through the root, downstream consumers would silently
// couple to package-internal types — and engine-swap safety at the
// root would break. This block is the gate.
//
// Coverage matches the positive Step 15 gate exactly so the two
// suites can be diffed at a glance.

const V07_FORBIDDEN_RUNTIME_NAMES = [
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
  "GENERATOR_KINDS",
] as const;

describe("public surface — v0.7 registry names stay off the root", () => {
  it.each(V07_FORBIDDEN_RUNTIME_NAMES)(
    "does NOT export `%s` through @nekostack/schema",
    (name) => {
      const surface = schemaRoot as unknown as Record<string, unknown>;
      expect(name in surface).toBe(false);
      expect(surface[name]).toBeUndefined();
    },
  );

  it("the namespace import still works (sanity: gate is meaningful)", () => {
    // If the import itself failed, `it.each` above would have errored
    // out before reaching the assertions. This guard exists so a
    // future refactor that accidentally turns the namespace into an
    // empty object still fails loudly here rather than passing the
    // "does NOT export X" rows by virtue of being empty.
    expect("parse" in schemaRoot).toBe(true);
    expect("s" in schemaRoot).toBe(true);
  });
});

// =============================================================================
// Step 16 — type-level negative gate
// =============================================================================
//
// Each `@ts-expect-error` below is itself the assertion: the line
// MUST fail typecheck. If a v0.7 type ever starts being exported by
// the root, the directive becomes unused and `tsc` reports an
// "Unused '@ts-expect-error' directive" error — which is exactly the
// signal we want.

// @ts-expect-error root must not export Registry
import type { Registry as _Reg } from "@nekostack/schema";
// @ts-expect-error root must not export RegistryEntry
import type { RegistryEntry as _RegEntry } from "@nekostack/schema";
// @ts-expect-error root must not export RegistrySourceEntry
import type { RegistrySourceEntry as _RegSrc } from "@nekostack/schema";
// @ts-expect-error root must not export DiffSeverity
import type { DiffSeverity as _DSev } from "@nekostack/schema";
// @ts-expect-error root must not export DiffKind
import type { DiffKind as _DKind } from "@nekostack/schema";
// @ts-expect-error root must not export DiffChange
import type { DiffChange as _DChange } from "@nekostack/schema";
// @ts-expect-error root must not export FreshnessVerdict
import type { FreshnessVerdict as _FV } from "@nekostack/schema";
// @ts-expect-error root must not export GeneratorKind
import type { GeneratorKind as _GK } from "@nekostack/schema";
// @ts-expect-error root must not export GeneratedArtifact
import type { GeneratedArtifact as _GA } from "@nekostack/schema";
// @ts-expect-error root must not export CommittedArtifact
import type { CommittedArtifact as _CA } from "@nekostack/schema";
// @ts-expect-error root must not export GenerateOpts
import type { GenerateOpts as _GO } from "@nekostack/schema";
// @ts-expect-error root must not export GenerateResult
import type { GenerateResult as _GR } from "@nekostack/schema";
// @ts-expect-error root must not export CheckOpts
import type { CheckOpts as _CO } from "@nekostack/schema";
// @ts-expect-error root must not export CheckResult
import type { CheckResult as _CR } from "@nekostack/schema";
// @ts-expect-error root must not export DiffOpts
import type { DiffOpts as _DO } from "@nekostack/schema";
// @ts-expect-error root must not export DiffResult
import type { DiffResult as _DR } from "@nekostack/schema";
// @ts-expect-error root must not export ListOpts
import type { ListOpts as _LO } from "@nekostack/schema";
// @ts-expect-error root must not export ListResult
import type { ListResult as _LR } from "@nekostack/schema";

// Keep the names load-bearing under aggressive dead-code elim — if
// the directives above pass (i.e. the type *was* exported), these
// `type _Used = ...` aliases ensure the imports are still referenced
// somewhere so `noUnusedLocals` doesn't erase them and mask the
// regression. (When the imports legitimately fail to resolve, the
// aliases resolve to `any` and the union compiles fine.)
type _Used =
  | _Reg
  | _RegEntry
  | _RegSrc
  | _DSev
  | _DKind
  | _DChange
  | _FV
  | _GK
  | _GA
  | _CA
  | _GO
  | _GR
  | _CO
  | _CR
  | _DO
  | _DR
  | _LO
  | _LR;
const _u: _Used | undefined = undefined;

describe("public surface — v0.7 registry types stay off the root", () => {
  it("typecheck-gated: every @ts-expect-error above must still apply", () => {
    // The 18 `@ts-expect-error` directives above are the assertion.
    // If any one of them stops applying (because the type became
    // exported), `tsc` reports an unused-directive error and the
    // typecheck step fails before this runtime block ever runs.
    expect(_u).toBeUndefined();
  });
});

// =============================================================================
// v0.8 — root `@nekostack/schema` MUST NOT export migration surface
// =============================================================================
//
// Same boundary rule as the v0.7 block above, extended to the v0.8
// migration planning / verification / stub-generation surface. The
// v0.8 names live behind `@nekostack/schema/cli`; root
// `@nekostack/schema` continues to expose only the v0.6 contract.
//
// Coverage mirrors the positive `tests/registry-surface.test.ts`
// gate exactly so the two suites can be diffed at a glance.

const V08_FORBIDDEN_RUNTIME_NAMES = [
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

describe("public surface — v0.8 migration names stay off the root", () => {
  it.each(V08_FORBIDDEN_RUNTIME_NAMES)(
    "does NOT export `%s` through @nekostack/schema",
    (name) => {
      const surface = schemaRoot as unknown as Record<string, unknown>;
      expect(name in surface).toBe(false);
      expect(surface[name]).toBeUndefined();
    },
  );
});

// =============================================================================
// v0.8 — type-level negative gate (mirrors the v0.7 block above)
// =============================================================================
//
// Each `@ts-expect-error` below is itself the assertion — the line
// MUST fail typecheck. If a v0.8 type ever starts being exported by
// the root, the directive becomes unused and `tsc` reports an
// "Unused '@ts-expect-error' directive" error.

// @ts-expect-error root must not export Migration
import type { Migration as _M } from "@nekostack/schema";
// @ts-expect-error root must not export AnyMigration
import type { AnyMigration as _AM } from "@nekostack/schema";
// @ts-expect-error root must not export MigrationSourceEntry
import type { MigrationSourceEntry as _MSE } from "@nekostack/schema";
// @ts-expect-error root must not export MigrationEntry
import type { MigrationEntry as _ME } from "@nekostack/schema";
// @ts-expect-error root must not export MigrationRegistry
import type { MigrationRegistry as _MReg } from "@nekostack/schema";
// @ts-expect-error root must not export MigrationPlan
import type { MigrationPlan as _MP } from "@nekostack/schema";
// @ts-expect-error root must not export PlanNote
import type { PlanNote as _PN } from "@nekostack/schema";
// @ts-expect-error root must not export MigrationVerdict
import type { MigrationVerdict as _MV } from "@nekostack/schema";
// @ts-expect-error root must not export VerificationResult
import type { VerificationResult as _VR } from "@nekostack/schema";
// @ts-expect-error root must not export MigrationStub
import type { MigrationStub as _MS } from "@nekostack/schema";
// @ts-expect-error root must not export MigrationListOpts
import type { MigrationListOpts as _MLO } from "@nekostack/schema";
// @ts-expect-error root must not export MigrationListResult
import type { MigrationListResult as _MLR } from "@nekostack/schema";
// @ts-expect-error root must not export MigrationPlanOpts
import type { MigrationPlanOpts as _MPO } from "@nekostack/schema";
// @ts-expect-error root must not export MigrationPlanResult
import type { MigrationPlanResult as _MPR } from "@nekostack/schema";
// @ts-expect-error root must not export MigrationVerifyOpts
import type { MigrationVerifyOpts as _MVO } from "@nekostack/schema";
// @ts-expect-error root must not export MigrationVerifyResult
import type { MigrationVerifyResult as _MVR } from "@nekostack/schema";
// @ts-expect-error root must not export MigrationStubOpts
import type { MigrationStubOpts as _MSO } from "@nekostack/schema";
// @ts-expect-error root must not export MigrationStubResult
import type { MigrationStubResult as _MSR } from "@nekostack/schema";

// Keep the imports load-bearing under aggressive dead-code elim —
// same trick as the v0.7 block above. When the imports legitimately
// fail to resolve, each alias is `any` and this union compiles fine.
type _UsedV08 =
  | _M
  | _AM
  | _MSE
  | _ME
  | _MReg
  | _MP
  | _PN
  | _MV
  | _VR
  | _MS
  | _MLO
  | _MLR
  | _MPO
  | _MPR
  | _MVO
  | _MVR
  | _MSO
  | _MSR;
const _u08: _UsedV08 | undefined = undefined;

describe("public surface — v0.8 migration types stay off the root", () => {
  it("typecheck-gated: every @ts-expect-error above must still apply", () => {
    // The 18 `@ts-expect-error` directives above are the assertion.
    // If any one of them stops applying (because the type became
    // exported through the root), `tsc` reports an unused-directive
    // error and the typecheck step fails before this runtime block
    // ever runs.
    expect(_u08).toBeUndefined();
  });
});
