/**
 * Step 4 — conditional `sourceHash` emission across all four generators.
 *
 * Tests the omit-when-absent / emit-when-provided contract end-to-end
 * for the generator output text/JSON. The byte-identity gate for
 * existing snapshots is enforced by the rest of the test suite
 * (those tests never pass `sourceHash`); these tests add the
 * positive cases.
 *
 * Locked emission shape (Master plan Decision #8):
 * - TS / Zod: a `sourceHash:       sha256:<hex>` line in the JSDoc
 *   header, between `irHash:` and `generator:`. Field-name column
 *   width matches the existing fields (value aligned at column 18).
 * - JSON Schema / OpenAPI: a `sourceHash` field inside the
 *   `x-nekostack` provenance object. `canonicalize` sorts keys
 *   alphabetically, so the field's position in the emitted JSON
 *   is between `schemaId` and `schemaVersion`.
 * - When omitted, the line / field is absent entirely (NOT `null`).
 */
import { describe, expect, it } from "vitest";
import { s } from "../../src/index.js";
import { generateTypeScript } from "../../src/generators/ts.js";
import { generateZod } from "../../src/generators/zod.js";
import { generateJsonSchema } from "../../src/generators/json-schema.js";
import { generateOpenApiSchemaComponent } from "../../src/generators/openapi.js";

const SAMPLE_HASH =
  "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" as const;

// A small, stable fixture used across all four generators.
const fixture = () =>
  s.object({ id: s.string(), age: s.number().int() })
    .id("com.x.Fixture")
    .version("1.0.0").node;

// ---------------------------------------------------------------------------
// TypeScript
// ---------------------------------------------------------------------------

describe("generateTypeScript — sourceHash emission", () => {
  it("emits the `sourceHash:` JSDoc line when provided", () => {
    const out = generateTypeScript(fixture(), { sourceHash: SAMPLE_HASH });
    expect(out).toContain(` * sourceHash:       ${SAMPLE_HASH}`);
  });

  it("places the sourceHash line between `irHash:` and `generator:`", () => {
    const out = generateTypeScript(fixture(), { sourceHash: SAMPLE_HASH });
    const irHashIdx = out.indexOf("irHash:");
    const sourceHashIdx = out.indexOf("sourceHash:");
    const generatorIdx = out.indexOf("generator:");
    expect(irHashIdx).toBeGreaterThan(0);
    expect(sourceHashIdx).toBeGreaterThan(irHashIdx);
    expect(generatorIdx).toBeGreaterThan(sourceHashIdx);
  });

  it("omits the `sourceHash:` line when not provided", () => {
    const out = generateTypeScript(fixture());
    expect(out).not.toContain("sourceHash:");
  });

  it("omitting sourceHash never emits `null` for the field", () => {
    const out = generateTypeScript(fixture());
    // No `null` value of any kind — neither sourceHash: null nor the bare
    // literal text appears in the header.
    expect(out).not.toMatch(/sourceHash/);
  });
});

// ---------------------------------------------------------------------------
// Zod
// ---------------------------------------------------------------------------

describe("generateZod — sourceHash emission", () => {
  it("emits the `sourceHash:` JSDoc line when provided", () => {
    const out = generateZod(fixture(), { sourceHash: SAMPLE_HASH });
    expect(out).toContain(` * sourceHash:       ${SAMPLE_HASH}`);
  });

  it("places the sourceHash line between `irHash:` and `generator:`", () => {
    const out = generateZod(fixture(), { sourceHash: SAMPLE_HASH });
    const irHashIdx = out.indexOf("irHash:");
    const sourceHashIdx = out.indexOf("sourceHash:");
    const generatorIdx = out.indexOf("generator:");
    expect(irHashIdx).toBeGreaterThan(0);
    expect(sourceHashIdx).toBeGreaterThan(irHashIdx);
    expect(generatorIdx).toBeGreaterThan(sourceHashIdx);
  });

  it("omits the `sourceHash:` line when not provided", () => {
    const out = generateZod(fixture());
    expect(out).not.toContain("sourceHash:");
  });
});

// ---------------------------------------------------------------------------
// JSON Schema
// ---------------------------------------------------------------------------

describe("generateJsonSchema — sourceHash emission", () => {
  it("emits `x-nekostack.sourceHash` when provided", () => {
    const out = JSON.parse(
      generateJsonSchema(fixture(), { sourceHash: SAMPLE_HASH }),
    );
    expect(out["x-nekostack"].sourceHash).toBe(SAMPLE_HASH);
  });

  it("omits the `sourceHash` field entirely when not provided", () => {
    const out = JSON.parse(generateJsonSchema(fixture()));
    expect(out["x-nekostack"]).toBeDefined();
    expect("sourceHash" in out["x-nekostack"]).toBe(false);
  });

  it("omitting sourceHash never emits `null` for the field", () => {
    const text = generateJsonSchema(fixture());
    // The raw JSON text must not contain a `"sourceHash"` key at all.
    expect(text).not.toMatch(/"sourceHash"/);
  });

  it("preserves the other v0.3 `x-nekostack` fields when sourceHash is provided", () => {
    const out = JSON.parse(
      generateJsonSchema(fixture(), { sourceHash: SAMPLE_HASH }),
    );
    const prov = out["x-nekostack"];
    expect(prov.generator).toBe("jsonSchema");
    expect(typeof prov.generatorVersion).toBe("string");
    expect(prov.irHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(prov.schemaId).toBe("com.x.Fixture");
    expect(prov.schemaVersion).toBe("1.0.0");
  });
});

// ---------------------------------------------------------------------------
// OpenAPI
// ---------------------------------------------------------------------------

describe("generateOpenApiSchemaComponent — sourceHash emission", () => {
  it("emits `x-nekostack.sourceHash` when provided", () => {
    const out = JSON.parse(
      generateOpenApiSchemaComponent(fixture(), { sourceHash: SAMPLE_HASH }),
    );
    expect(out["x-nekostack"].sourceHash).toBe(SAMPLE_HASH);
  });

  it("omits the `sourceHash` field entirely when not provided", () => {
    const out = JSON.parse(generateOpenApiSchemaComponent(fixture()));
    expect(out["x-nekostack"]).toBeDefined();
    expect("sourceHash" in out["x-nekostack"]).toBe(false);
  });

  it("omitting sourceHash never emits `null` for the field", () => {
    const text = generateOpenApiSchemaComponent(fixture());
    expect(text).not.toMatch(/"sourceHash"/);
  });

  it("preserves the other v0.4 `x-nekostack` fields when sourceHash is provided", () => {
    const out = JSON.parse(
      generateOpenApiSchemaComponent(fixture(), { sourceHash: SAMPLE_HASH }),
    );
    const prov = out["x-nekostack"];
    expect(prov.generator).toBe("openApi");
    expect(typeof prov.generatorVersion).toBe("string");
    expect(prov.irHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(prov.schemaId).toBe("com.x.Fixture");
    expect(prov.schemaVersion).toBe("1.0.0");
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting: byte-identity for unprovenanced calls
// ---------------------------------------------------------------------------

describe("sourceHash emission — byte-identity for callers that omit it", () => {
  // The full v0.2–v0.6 snapshot suite is the load-bearing byte-identity gate.
  // This test acts as a smoke check that the omit-path produces the same
  // bytes as a pre-v0.7 implementation would have — by comparing two
  // independent invocations and ensuring nothing in the output mentions
  // `sourceHash`.
  it("TS / Zod / JSON Schema / OpenAPI all produce sourceHash-free output by default", () => {
    expect(generateTypeScript(fixture())).not.toMatch(/sourceHash/);
    expect(generateZod(fixture())).not.toMatch(/sourceHash/);
    expect(generateJsonSchema(fixture())).not.toMatch(/sourceHash/);
    expect(generateOpenApiSchemaComponent(fixture())).not.toMatch(/sourceHash/);
  });

  it("repeated calls without sourceHash are byte-identical (deterministic)", () => {
    const a = generateJsonSchema(fixture());
    const b = generateJsonSchema(fixture());
    expect(a).toBe(b);
  });
});
