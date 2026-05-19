/**
 * Step 15 — `@nekostack/schema/cli` integration-surface gate.
 *
 * Positive gate: imports through the package subpath
 * `@nekostack/schema/cli` (resolved via Step 14's `package.json`
 * `exports` map → Step 13's `cli-integration.ts` barrel) and verifies
 * the complete v0.7 integration surface is reachable.
 *
 * Why through the package path: the CLI (Steps 22-31) will import via
 * `@nekostack/schema/cli`, not via a relative source path. Testing the
 * resolution + the barrel together catches both kinds of regression:
 * a barrel that forgets to re-export something, and a manifest that
 * forgets to wire the subpath at all.
 *
 * Step 16 will add the complementary negative gate (root
 * `@nekostack/schema` does NOT export any v0.7 registry name).
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
