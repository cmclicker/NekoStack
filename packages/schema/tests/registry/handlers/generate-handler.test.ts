/**
 * Step 11 tests for `generateHandler`.
 *
 * The four generators themselves are exhaustively tested elsewhere
 * (`tests/generators/*`); these tests verify the *handler* contract:
 * pure dispatch, 4 artifacts per named schema, anonymous skipping,
 * path convention, hash plumbing, and parity with direct generator
 * invocation.
 */
import { describe, expect, it } from "vitest";
import { s } from "../../../src/index.js";
import { irHash } from "../../../src/ir/hash.js";
import { generateTypeScript } from "../../../src/generators/ts.js";
import { generateZod } from "../../../src/generators/zod.js";
import { generateJsonSchema } from "../../../src/generators/json-schema.js";
import { generateOpenApiSchemaComponent } from "../../../src/generators/openapi.js";
import { sourceHashFromText } from "../../../src/registry/source-hash.js";
import {
  generateHandler,
  suggestedPathFor,
} from "../../../src/registry/handlers/generate.js";
import type {
  RegistrySourceEntry,
  GeneratorKind,
} from "../../../src/registry/types.js";

// =============================================================================
// Fixture helpers
// =============================================================================

const TENANT = () =>
  s.object({ id: s.string() }).id("com.x.Tenant").version("1.0.0");

const AUDIT = () =>
  s.object({ id: s.string() }).id("com.x.AuditEvent").version("1.0.0");

const ANON = () => s.object({ id: s.string() });

function entry(
  sourcePath: string,
  sourceText: string,
  schemas: readonly ReturnType<typeof TENANT>[],
): RegistrySourceEntry {
  return { sourcePath, sourceText, schemas };
}

// =============================================================================
// Result shape + counts
// =============================================================================

describe("generateHandler — Result shape", () => {
  it("returns `{ success: true, data: { artifacts } }`", () => {
    const r = generateHandler({
      entries: [entry("a.schema.ts", "// a", [TENANT()])],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(Array.isArray(r.data.artifacts)).toBe(true);
    }
  });

  it("emits exactly 4 artifacts per named schema (all four kinds)", () => {
    const r = generateHandler({
      entries: [entry("a.schema.ts", "// a", [TENANT()])],
    });
    if (r.success) {
      expect(r.data.artifacts).toHaveLength(4);
      const kinds = r.data.artifacts.map((a) => a.kind).sort();
      expect(kinds).toEqual(["jsonSchema", "openApi", "typescript", "zod"]);
    }
  });

  it("emits the same 4 kinds for every named schema across multiple entries", () => {
    const r = generateHandler({
      entries: [
        entry("t.schema.ts", "// t", [TENANT()]),
        entry("a.schema.ts", "// a", [AUDIT()]),
      ],
    });
    if (r.success) {
      expect(r.data.artifacts).toHaveLength(8);
      const byId = new Map<string, string[]>();
      for (const a of r.data.artifacts) {
        if (!byId.has(a.schemaId)) byId.set(a.schemaId, []);
        byId.get(a.schemaId)!.push(a.kind);
      }
      for (const [, kinds] of byId) {
        expect(kinds.sort()).toEqual([
          "jsonSchema",
          "openApi",
          "typescript",
          "zod",
        ]);
      }
    }
  });

  it("empty entries → success with empty artifacts", () => {
    const r = generateHandler({ entries: [] });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.artifacts).toEqual([]);
  });
});

// =============================================================================
// Anonymous schemas
// =============================================================================

describe("generateHandler — anonymous schemas", () => {
  it("skips anonymous schemas silently (no artifacts emitted)", () => {
    const r = generateHandler({
      entries: [entry("mixed.schema.ts", "// mixed", [TENANT(), ANON()])],
    });
    if (r.success) {
      // 4 artifacts for the named schema; 0 for the anonymous one.
      expect(r.data.artifacts).toHaveLength(4);
      expect(r.data.artifacts.every((a) => a.schemaId === "com.x.Tenant")).toBe(
        true,
      );
    }
  });

  it("an anonymous-only entry produces zero artifacts (success)", () => {
    const r = generateHandler({
      entries: [entry("anon.schema.ts", "// anon", [ANON()])],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.artifacts).toEqual([]);
  });
});

// =============================================================================
// sourceHash plumbing
// =============================================================================

describe("generateHandler — sourceHash plumbing", () => {
  it("sourceHash on every artifact matches sourceHashFromText(sourceText)", () => {
    const text = "// canonical tenant source\n";
    const expected = sourceHashFromText(text);
    const r = generateHandler({
      entries: [entry("t.schema.ts", text, [TENANT()])],
    });
    if (r.success) {
      for (const a of r.data.artifacts) {
        expect(a.sourceHash).toBe(expected);
      }
    }
  });

  it("multiple schemas from one file share the same sourceHash", () => {
    const text = "// two schemas in one file\n";
    const expected = sourceHashFromText(text);
    const r = generateHandler({
      entries: [entry("multi.schema.ts", text, [TENANT(), AUDIT()])],
    });
    if (r.success) {
      for (const a of r.data.artifacts) {
        expect(a.sourceHash).toBe(expected);
      }
    }
  });

  it("different source files produce different sourceHash values", () => {
    const r = generateHandler({
      entries: [
        entry("a.schema.ts", "// a\n", [TENANT()]),
        entry("b.schema.ts", "// b\n", [AUDIT()]),
      ],
    });
    if (r.success) {
      const tenantHashes = r.data.artifacts
        .filter((a) => a.schemaId === "com.x.Tenant")
        .map((a) => a.sourceHash);
      const auditHashes = r.data.artifacts
        .filter((a) => a.schemaId === "com.x.AuditEvent")
        .map((a) => a.sourceHash);
      expect(tenantHashes[0]).toBe(sourceHashFromText("// a\n"));
      expect(auditHashes[0]).toBe(sourceHashFromText("// b\n"));
      expect(tenantHashes[0]).not.toBe(auditHashes[0]);
    }
  });

  it("sourceHash is propagated into emitted artifact provenance", () => {
    const text = "// for-provenance\n";
    const expected = sourceHashFromText(text);
    const r = generateHandler({
      entries: [entry("t.schema.ts", text, [TENANT()])],
    });
    if (r.success) {
      // TS/Zod: JSDoc header
      const ts = r.data.artifacts.find((a) => a.kind === "typescript");
      const zod = r.data.artifacts.find((a) => a.kind === "zod");
      expect(ts?.content).toContain(`sourceHash:       ${expected}`);
      expect(zod?.content).toContain(`sourceHash:       ${expected}`);
      // JSON Schema/OpenAPI: x-nekostack.sourceHash
      const json = JSON.parse(
        r.data.artifacts.find((a) => a.kind === "jsonSchema")!.content,
      );
      const oa = JSON.parse(
        r.data.artifacts.find((a) => a.kind === "openApi")!.content,
      );
      expect(json["x-nekostack"].sourceHash).toBe(expected);
      expect(oa["x-nekostack"].sourceHash).toBe(expected);
    }
  });
});

// =============================================================================
// irHash plumbing
// =============================================================================

describe("generateHandler — irHash plumbing", () => {
  it("irHash matches `sha256:${irHash(schema.node)}`", () => {
    const t = TENANT();
    const expected = `sha256:${irHash(t.node)}`;
    const r = generateHandler({
      entries: [entry("t.schema.ts", "// t", [t])],
    });
    if (r.success) {
      for (const a of r.data.artifacts) {
        expect(a.irHash).toBe(expected);
      }
    }
  });

  it("different schemas produce different irHash values", () => {
    const r = generateHandler({
      entries: [
        entry("t.schema.ts", "// t", [TENANT()]),
        entry("a.schema.ts", "// a", [AUDIT()]),
      ],
    });
    if (r.success) {
      const tenantHash = r.data.artifacts.find(
        (a) => a.schemaId === "com.x.Tenant",
      )?.irHash;
      const auditHash = r.data.artifacts.find(
        (a) => a.schemaId === "com.x.AuditEvent",
      )?.irHash;
      expect(tenantHash).toBeDefined();
      expect(auditHash).toBeDefined();
      expect(tenantHash).not.toBe(auditHash);
    }
  });
});

// =============================================================================
// Content parity with direct generator invocation
// =============================================================================

describe("generateHandler — content parity with direct generators", () => {
  it("`typescript` artifact matches direct generateTypeScript output (with sourceHash)", () => {
    const text = "// parity\n";
    const sourceHash = sourceHashFromText(text);
    const t = TENANT();
    const r = generateHandler({
      entries: [entry("t.schema.ts", text, [t])],
    });
    if (r.success) {
      const handlerOutput = r.data.artifacts.find(
        (a) => a.kind === "typescript",
      )?.content;
      const direct = generateTypeScript(t.node, { sourceHash });
      expect(handlerOutput).toBe(direct);
    }
  });

  it("`zod` artifact matches direct generateZod output", () => {
    const text = "// parity\n";
    const t = TENANT();
    const r = generateHandler({
      entries: [entry("t.schema.ts", text, [t])],
    });
    if (r.success) {
      const handlerOutput = r.data.artifacts.find((a) => a.kind === "zod")
        ?.content;
      const direct = generateZod(t.node, { sourceHash: sourceHashFromText(text) });
      expect(handlerOutput).toBe(direct);
    }
  });

  it("`jsonSchema` artifact matches direct generateJsonSchema output", () => {
    const text = "// parity\n";
    const t = TENANT();
    const r = generateHandler({
      entries: [entry("t.schema.ts", text, [t])],
    });
    if (r.success) {
      const handlerOutput = r.data.artifacts.find(
        (a) => a.kind === "jsonSchema",
      )?.content;
      const direct = generateJsonSchema(t.node, {
        sourceHash: sourceHashFromText(text),
      });
      expect(handlerOutput).toBe(direct);
    }
  });

  it("`openApi` artifact matches direct generateOpenApiSchemaComponent output", () => {
    const text = "// parity\n";
    const t = TENANT();
    const r = generateHandler({
      entries: [entry("t.schema.ts", text, [t])],
    });
    if (r.success) {
      const handlerOutput = r.data.artifacts.find((a) => a.kind === "openApi")
        ?.content;
      const direct = generateOpenApiSchemaComponent(t.node, {
        sourceHash: sourceHashFromText(text),
      });
      expect(handlerOutput).toBe(direct);
    }
  });
});

// =============================================================================
// suggestedPath convention
// =============================================================================

describe("generateHandler — suggestedPath convention", () => {
  // Locked: <schema-dir>/<basename>.schema.{ts,js}
  //         → <schema-dir>/generated/<basename>.<ext>
  it.each<[GeneratorKind, string]>([
    ["typescript", "packages/foo/schemas/generated/user.types.ts"],
    ["zod",        "packages/foo/schemas/generated/user.zod.ts"],
    ["jsonSchema", "packages/foo/schemas/generated/user.json.schema.json"],
    ["openApi",    "packages/foo/schemas/generated/user.openapi.json"],
  ])("kind `%s` → `%s`", (kind, expected) => {
    expect(suggestedPathFor("packages/foo/schemas/user.schema.ts", kind)).toBe(
      expected,
    );
  });

  it("handles a source file at the workspace root", () => {
    expect(suggestedPathFor("user.schema.ts", "typescript")).toBe(
      "generated/user.types.ts",
    );
  });

  it("handles `.schema.js`", () => {
    expect(suggestedPathFor("packages/x/user.schema.js", "zod")).toBe(
      "packages/x/generated/user.zod.ts",
    );
  });

  it("normalizes Windows separators to forward slashes", () => {
    expect(
      suggestedPathFor(
        "packages\\x\\schemas\\user.schema.ts",
        "typescript",
      ),
    ).toBe("packages/x/schemas/generated/user.types.ts");
  });

  it("handler emits suggestedPath per the locked convention", () => {
    const r = generateHandler({
      entries: [entry("packages/foo/schemas/user.schema.ts", "// u", [TENANT()])],
    });
    if (r.success) {
      const ts = r.data.artifacts.find((a) => a.kind === "typescript");
      expect(ts?.suggestedPath).toBe(
        "packages/foo/schemas/generated/user.types.ts",
      );
    }
  });
});

// =============================================================================
// Field preservation
// =============================================================================

describe("generateHandler — GeneratedArtifact field preservation", () => {
  it("every field is set on every artifact", () => {
    const r = generateHandler({
      entries: [entry("t.schema.ts", "// t", [TENANT()])],
    });
    if (r.success) {
      for (const a of r.data.artifacts) {
        expect(a.schemaId).toBe("com.x.Tenant");
        expect(["typescript", "zod", "jsonSchema", "openApi"]).toContain(a.kind);
        expect(typeof a.suggestedPath).toBe("string");
        expect(a.suggestedPath.length).toBeGreaterThan(0);
        expect(typeof a.content).toBe("string");
        expect(a.content.length).toBeGreaterThan(0);
        expect(a.irHash).toMatch(/^sha256:[0-9a-f]{64}$/);
        expect(a.sourceHash).toMatch(/^sha256:[0-9a-f]{64}$/);
      }
    }
  });
});

// =============================================================================
// Purity
// =============================================================================

describe("generateHandler — purity", () => {
  it("function arity = 1 (no filesystem reachable from the input)", () => {
    expect(generateHandler.length).toBe(1);
  });

  it("deterministic — repeated invocations produce identical results", () => {
    const e: RegistrySourceEntry = entry("t.schema.ts", "// t\n", [TENANT()]);
    const a = generateHandler({ entries: [e] });
    const b = generateHandler({ entries: [e] });
    if (a.success && b.success) {
      expect(JSON.stringify(a.data)).toBe(JSON.stringify(b.data));
    }
  });

  it("does not mutate the input entries array", () => {
    const e = entry("t.schema.ts", "// t", [TENANT()]);
    const list = [e];
    const beforeLen = list.length;
    const beforeSchemas = e.schemas.length;
    generateHandler({ entries: list });
    expect(list.length).toBe(beforeLen);
    expect(e.schemas.length).toBe(beforeSchemas);
  });
});
