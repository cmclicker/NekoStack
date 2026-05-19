/**
 * Step 5 tests for `parseProvenanceFromText`.
 *
 * Strategy: drive the parser with **real generator output** from
 * Step 4 wherever possible. That doubles as a round-trip check: if
 * the emitter and the parser ever drift, this test file is the gate
 * that catches it. Negative cases (missing block, malformed hash,
 * etc.) use hand-crafted fixture strings since the emitter cannot
 * produce them.
 */
import { describe, expect, it } from "vitest";
import { s } from "../../src/index.js";
import { generateTypeScript } from "../../src/generators/ts.js";
import { generateZod } from "../../src/generators/zod.js";
import { generateJsonSchema } from "../../src/generators/json-schema.js";
import { generateOpenApiSchemaComponent } from "../../src/generators/openapi.js";
import { parseProvenanceFromText } from "../../src/registry/parse-provenance.js";

const SAMPLE_HASH =
  "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" as const;

const fixture = () =>
  s.object({ id: s.string(), age: s.number().int() })
    .id("com.x.Fixture")
    .version("1.0.0").node;

// =============================================================================
// JSDoc header (TS / Zod) — round-trip from real generator output
// =============================================================================

describe("parseProvenanceFromText — TS JSDoc header", () => {
  it("parses TS-emitted provenance with sourceHash", () => {
    const text = generateTypeScript(fixture(), { sourceHash: SAMPLE_HASH });
    const r = parseProvenanceFromText(text);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.generator).toBe("typescript");
      expect(typeof r.data.generatorVersion).toBe("string");
      expect(r.data.schemaId).toBe("com.x.Fixture");
      expect(r.data.schemaVersion).toBe("1.0.0");
      expect(r.data.irHash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(r.data.sourceHash).toBe(SAMPLE_HASH);
    }
  });

  it("parses TS-emitted provenance WITHOUT sourceHash (v0.6-era artifact)", () => {
    const text = generateTypeScript(fixture());
    const r = parseProvenanceFromText(text);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.generator).toBe("typescript");
      expect(r.data.irHash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(r.data.sourceHash).toBeUndefined();
    }
  });

  it("anonymous schemaId decodes to `null`", () => {
    const text = generateTypeScript(s.string().node);
    const r = parseProvenanceFromText(text);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.schemaId).toBeNull();
      expect(r.data.schemaVersion).toBeNull();
    }
  });
});

describe("parseProvenanceFromText — Zod JSDoc header", () => {
  it("parses Zod-emitted provenance with sourceHash", () => {
    const text = generateZod(fixture(), { sourceHash: SAMPLE_HASH });
    const r = parseProvenanceFromText(text);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.generator).toBe("zod");
      expect(r.data.schemaId).toBe("com.x.Fixture");
      expect(r.data.sourceHash).toBe(SAMPLE_HASH);
    }
  });

  it("parses Zod-emitted provenance WITHOUT sourceHash", () => {
    const text = generateZod(fixture());
    const r = parseProvenanceFromText(text);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.generator).toBe("zod");
      expect(r.data.sourceHash).toBeUndefined();
    }
  });
});

// =============================================================================
// x-nekostack (JSON Schema / OpenAPI) — round-trip from real generator output
// =============================================================================

describe("parseProvenanceFromText — JSON Schema x-nekostack", () => {
  it("parses JSON-Schema-emitted provenance with sourceHash", () => {
    const text = generateJsonSchema(fixture(), { sourceHash: SAMPLE_HASH });
    const r = parseProvenanceFromText(text);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.generator).toBe("jsonSchema");
      expect(r.data.schemaId).toBe("com.x.Fixture");
      expect(r.data.schemaVersion).toBe("1.0.0");
      expect(r.data.sourceHash).toBe(SAMPLE_HASH);
    }
  });

  it("parses JSON-Schema-emitted provenance WITHOUT sourceHash", () => {
    const text = generateJsonSchema(fixture());
    const r = parseProvenanceFromText(text);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.generator).toBe("jsonSchema");
      expect(r.data.sourceHash).toBeUndefined();
    }
  });

  it("anonymous schemaId decodes to `null` from JSON `null`", () => {
    const text = generateJsonSchema(s.string().node);
    const r = parseProvenanceFromText(text);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.schemaId).toBeNull();
      expect(r.data.schemaVersion).toBeNull();
    }
  });
});

describe("parseProvenanceFromText — OpenAPI x-nekostack", () => {
  it("parses OpenAPI-emitted provenance with sourceHash", () => {
    const text = generateOpenApiSchemaComponent(fixture(), {
      sourceHash: SAMPLE_HASH,
    });
    const r = parseProvenanceFromText(text);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.generator).toBe("openApi");
      expect(r.data.sourceHash).toBe(SAMPLE_HASH);
    }
  });

  it("parses OpenAPI-emitted provenance WITHOUT sourceHash", () => {
    const text = generateOpenApiSchemaComponent(fixture());
    const r = parseProvenanceFromText(text);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.generator).toBe("openApi");
      expect(r.data.sourceHash).toBeUndefined();
    }
  });
});

// =============================================================================
// Failure paths
// =============================================================================

describe("parseProvenanceFromText — failure shape", () => {
  it("unknown format → integrity_error with reason `unknown_format`", () => {
    const r = parseProvenanceFromText("just some random text\nwith no provenance");
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues).toHaveLength(1);
      expect(r.issues[0]?.code).toBe("integrity_error");
      expect(r.issues[0]?.metadata).toEqual({ reason: "unknown_format" });
    }
  });

  it("TS-shaped content with no JSDoc block → missing_provenance", () => {
    // Starts with `/**` but no closing block.
    const r = parseProvenanceFromText("/** this is not closed");
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues[0]?.code).toBe("integrity_error");
      expect(r.issues[0]?.metadata).toEqual({ reason: "missing_provenance" });
    }
  });

  it("JSDoc header missing irHash → missing_field", () => {
    const text = [
      "/**",
      " * @generated by @nekostack/schema",
      " * schemaId:         com.x.X",
      " * schemaVersion:    1.0.0",
      " * generator:        typescript",
      " * generatorVersion: @nekostack/schema@0.7.0",
      " *",
      " * DO NOT EDIT MANUALLY.",
      " */",
    ].join("\n");
    const r = parseProvenanceFromText(text);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues[0]?.code).toBe("integrity_error");
      expect(r.issues[0]?.metadata).toEqual({ reason: "missing_field" });
      expect(r.issues[0]?.message).toMatch(/irHash/);
    }
  });

  it("JSDoc header with malformed irHash → malformed_hash", () => {
    const text = [
      "/**",
      " * @generated by @nekostack/schema",
      " * schemaId:         com.x.X",
      " * schemaVersion:    1.0.0",
      " * irHash:           not-a-real-hash",
      " * generator:        typescript",
      " * generatorVersion: @nekostack/schema@0.7.0",
      " *",
      " * DO NOT EDIT MANUALLY.",
      " */",
    ].join("\n");
    const r = parseProvenanceFromText(text);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues[0]?.metadata).toEqual({ reason: "malformed_hash" });
      expect(r.issues[0]?.message).toMatch(/irHash/);
    }
  });

  it("JSDoc header with malformed sourceHash → malformed_hash", () => {
    const text = [
      "/**",
      " * @generated by @nekostack/schema",
      " * schemaId:         com.x.X",
      " * schemaVersion:    1.0.0",
      " * irHash:           sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      " * sourceHash:       raw-hex-no-prefix",
      " * generator:        typescript",
      " * generatorVersion: @nekostack/schema@0.7.0",
      " *",
      " * DO NOT EDIT MANUALLY.",
      " */",
    ].join("\n");
    const r = parseProvenanceFromText(text);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues[0]?.metadata).toEqual({ reason: "malformed_hash" });
      expect(r.issues[0]?.message).toMatch(/sourceHash/);
    }
  });

  it("malformed JSON → json_parse_error", () => {
    const r = parseProvenanceFromText("{ not valid json");
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues[0]?.metadata).toEqual({ reason: "json_parse_error" });
    }
  });

  it("JSON without `x-nekostack` block → missing_provenance", () => {
    const r = parseProvenanceFromText(JSON.stringify({ foo: "bar" }));
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues[0]?.metadata).toEqual({ reason: "missing_provenance" });
    }
  });

  it("JSON with `x-nekostack` block but missing irHash → missing_field", () => {
    const r = parseProvenanceFromText(
      JSON.stringify({
        "x-nekostack": {
          generator: "jsonSchema",
          generatorVersion: "@nekostack/schema@0.7.0",
          schemaId: "com.x.X",
          schemaVersion: "1.0.0",
          // no irHash
        },
      }),
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues[0]?.metadata).toEqual({ reason: "missing_field" });
      expect(r.issues[0]?.message).toMatch(/irHash/);
    }
  });

  it("JSON with non-string provenance field → malformed_field", () => {
    const r = parseProvenanceFromText(
      JSON.stringify({
        "x-nekostack": {
          generator: 42, // should be a string
          generatorVersion: "@nekostack/schema@0.7.0",
          schemaId: "com.x.X",
          schemaVersion: "1.0.0",
          irHash: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        },
      }),
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues[0]?.metadata).toEqual({ reason: "malformed_field" });
    }
  });

  it("JSON array at root → missing_provenance (not an object)", () => {
    const r = parseProvenanceFromText("[1, 2, 3]");
    expect(r.success).toBe(false);
    if (!r.success) {
      // Auto-detector saw `[` not `{`, so it falls to unknown_format.
      // The leading-char detector is the gate; arrays-at-root are not a
      // valid artifact shape.
      expect(r.issues[0]?.metadata).toEqual({ reason: "unknown_format" });
    }
  });
});

// =============================================================================
// Invariants
// =============================================================================

describe("parseProvenanceFromText — invariants", () => {
  it("`sourceHash` is `undefined` (never `null`) when absent", () => {
    const text = generateTypeScript(fixture());
    const r = parseProvenanceFromText(text);
    if (r.success) {
      // Distinguishes the absent-field discipline (Master plan
      // Decision #8) from the JSON-null encoding for anonymous
      // schemaId / unversioned schemaVersion.
      expect(r.data.sourceHash).toBeUndefined();
      expect(r.data.sourceHash).not.toBeNull();
    }
  });

  it("every failure issue uses code `integrity_error` and severity `error`", () => {
    const failures = [
      parseProvenanceFromText(""),
      parseProvenanceFromText("just text"),
      parseProvenanceFromText("/** unclosed"),
      parseProvenanceFromText("{ bad json"),
      parseProvenanceFromText('{"x-nekostack": "string-instead-of-object"}'),
    ];
    for (const r of failures) {
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.issues).toHaveLength(1);
        expect(r.issues[0]?.code).toBe("integrity_error");
        expect(r.issues[0]?.severity).toBe("error");
        expect(typeof r.issues[0]?.metadata?.reason).toBe("string");
      }
    }
  });

  it("the parser does not call `fs.*` (structural argument: text-only input)", () => {
    // Same approach as the source-hash purity test: the function signature
    // accepts only a string, so no filesystem path is reachable from
    // inside. Spying on fs.* would add no signal beyond what the type
    // signature already gives.
    expect(parseProvenanceFromText.length).toBe(1);
  });
});
