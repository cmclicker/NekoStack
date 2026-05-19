/**
 * Step 3 type-level tests for the `ProvenanceOptions` slice.
 *
 * Verifies that every generator's options interface accepts a
 * `sha256:<hex>`-shaped `sourceHash`, rejects raw hex (no prefix) and
 * non-hash strings at the type level, and preserves its own existing
 * options (TypeScript `mode` / `typeName`; Zod `constName`; JSON Schema
 * `idBase`). The OpenAPI-specific "only accepts ProvenanceOptions"
 * contract is verified in `openapi.test.ts` alongside the runtime
 * options-contract test, so this file does not duplicate it.
 *
 * Test-level mechanics: vitest's `.test-d.ts` runs under `tsc` in the
 * project's `typecheck` mode; the `@ts-expect-error` directives REQUIRE
 * the next line to error. If `ProvenanceOptions` ever loosened to a
 * plain `string` (or tightened to disallow the `sourceHash` field
 * entirely), the corresponding assertion would fail at the type level
 * rather than at runtime.
 */
import { describe, it, expectTypeOf } from "vitest";
import type {
  ProvenanceOptions,
  TypeScriptGeneratorOptions,
  ZodGeneratorOptions,
  JsonSchemaGeneratorOptions,
  OpenApiGeneratorOptions,
} from "../../src/generators/types.js";

// Known-good sample digest (the well-known SHA-256("") vector). Typed as
// the prefixed template-literal so the type-level positive assertions
// below compile.
const SAMPLE_HASH =
  "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" as const;

describe("ProvenanceOptions — base slice", () => {
  it("`sourceHash` is optional", () => {
    // Both shapes type-check; the field is `readonly sourceHash?`.
    const a: ProvenanceOptions = {};
    const b: ProvenanceOptions = { sourceHash: SAMPLE_HASH };
    expectTypeOf(a).toMatchTypeOf<ProvenanceOptions>();
    expectTypeOf(b).toMatchTypeOf<ProvenanceOptions>();
  });

  it("`sourceHash` requires the `sha256:` prefix at the type level", () => {
    // `@ts-expect-error` applies to the next *statement* and TS reports
    // the type mismatch on the property line inside a multi-line literal,
    // so each negative case stays on a single line where the directive
    // and the error land together.
    // @ts-expect-error raw hex without the `sha256:` prefix is rejected
    const bad1: ProvenanceOptions = { sourceHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" };
    // @ts-expect-error arbitrary non-hash string is rejected
    const bad2: ProvenanceOptions = { sourceHash: "not-a-hash" };
    // @ts-expect-error empty string is rejected — no `sha256:` prefix
    const bad3: ProvenanceOptions = { sourceHash: "" };
    // @ts-expect-error wrong scheme prefix is rejected
    const bad4: ProvenanceOptions = { sourceHash: "md5:0123456789abcdef" };
    void bad1;
    void bad2;
    void bad3;
    void bad4;
  });
});

describe("TypeScriptGeneratorOptions extends ProvenanceOptions", () => {
  it("accepts `{ sourceHash }` alone", () => {
    const opts: TypeScriptGeneratorOptions = { sourceHash: SAMPLE_HASH };
    expectTypeOf(opts).toMatchTypeOf<TypeScriptGeneratorOptions>();
  });

  it("preserves existing `mode` option", () => {
    const opts: TypeScriptGeneratorOptions = { mode: "both" };
    expectTypeOf(opts).toMatchTypeOf<TypeScriptGeneratorOptions>();
  });

  it("preserves existing `typeName` option", () => {
    const opts: TypeScriptGeneratorOptions = { typeName: "MyType" };
    expectTypeOf(opts).toMatchTypeOf<TypeScriptGeneratorOptions>();
  });

  it("accepts `mode` + `sourceHash` together", () => {
    const opts: TypeScriptGeneratorOptions = {
      mode: "input",
      typeName: "X",
      sourceHash: SAMPLE_HASH,
    };
    expectTypeOf(opts).toMatchTypeOf<TypeScriptGeneratorOptions>();
  });

  it("rejects raw-hex sourceHash at the type level", () => {
    // @ts-expect-error TypeScriptGeneratorOptions inherits the prefix rule
    const bad: TypeScriptGeneratorOptions = { mode: "output", sourceHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" };
    void bad;
  });
});

describe("ZodGeneratorOptions extends ProvenanceOptions", () => {
  it("accepts `{ sourceHash }` alone", () => {
    const opts: ZodGeneratorOptions = { sourceHash: SAMPLE_HASH };
    expectTypeOf(opts).toMatchTypeOf<ZodGeneratorOptions>();
  });

  it("preserves existing `constName` option", () => {
    const opts: ZodGeneratorOptions = { constName: "schema" };
    expectTypeOf(opts).toMatchTypeOf<ZodGeneratorOptions>();
  });

  it("accepts `constName` + `sourceHash` together", () => {
    const opts: ZodGeneratorOptions = {
      constName: "Tenant",
      sourceHash: SAMPLE_HASH,
    };
    expectTypeOf(opts).toMatchTypeOf<ZodGeneratorOptions>();
  });

  it("rejects raw-hex sourceHash at the type level", () => {
    // @ts-expect-error ZodGeneratorOptions inherits the prefix rule
    const bad: ZodGeneratorOptions = { sourceHash: "deadbeef" };
    void bad;
  });
});

describe("JsonSchemaGeneratorOptions extends ProvenanceOptions", () => {
  it("accepts `{ sourceHash }` alone", () => {
    const opts: JsonSchemaGeneratorOptions = { sourceHash: SAMPLE_HASH };
    expectTypeOf(opts).toMatchTypeOf<JsonSchemaGeneratorOptions>();
  });

  it("preserves existing `idBase` option", () => {
    const opts: JsonSchemaGeneratorOptions = {
      idBase: "https://schemas.example.com",
    };
    expectTypeOf(opts).toMatchTypeOf<JsonSchemaGeneratorOptions>();
  });

  it("accepts `idBase` + `sourceHash` together", () => {
    const opts: JsonSchemaGeneratorOptions = {
      idBase: "https://schemas.example.com",
      sourceHash: SAMPLE_HASH,
    };
    expectTypeOf(opts).toMatchTypeOf<JsonSchemaGeneratorOptions>();
  });

  it("rejects raw-hex sourceHash at the type level", () => {
    // @ts-expect-error JsonSchemaGeneratorOptions inherits the prefix rule
    const bad: JsonSchemaGeneratorOptions = { idBase: "https://x", sourceHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" };
    void bad;
  });
});

describe("OpenApiGeneratorOptions extends ProvenanceOptions", () => {
  it("accepts `{ sourceHash }` alone", () => {
    const opts: OpenApiGeneratorOptions = { sourceHash: SAMPLE_HASH };
    expectTypeOf(opts).toMatchTypeOf<OpenApiGeneratorOptions>();
  });

  it("accepts the empty-options form (no `sourceHash`)", () => {
    const opts: OpenApiGeneratorOptions = {};
    expectTypeOf(opts).toMatchTypeOf<OpenApiGeneratorOptions>();
  });

  it("rejects raw-hex sourceHash at the type level", () => {
    // @ts-expect-error OpenApiGeneratorOptions inherits the prefix rule
    const bad: OpenApiGeneratorOptions = { sourceHash: "no-prefix-here" };
    void bad;
  });

  // Negative: OpenAPI rejects every other option. The full assertion lives
  // in `openapi.test.ts` (runtime + compile-time gate side-by-side); we
  // don't duplicate it here.
});
