/**
 * Step 6 tests for `buildRegistry` + `findSchema`.
 *
 * Hand-constructed `RegistrySourceEntry[]` only — the CLI's
 * filesystem walker (Step 23) is not in this commit. These tests
 * exercise the pure registry-construction surface in isolation.
 */
import { describe, expect, it } from "vitest";
import { s } from "../../src/index.js";
import { irHash } from "../../src/ir/hash.js";
import {
  buildRegistry,
  findSchema,
} from "../../src/registry/build-registry.js";
import { sourceHashFromText } from "../../src/registry/source-hash.js";
import type {
  RegistryEntry,
  RegistrySourceEntry,
} from "../../src/registry/types.js";

const TENANT = () =>
  s.object({ id: s.string().uuid() }).id("com.x.Tenant").version("1.0.0");

const TENANT_V2 = () =>
  s.object({ id: s.string().uuid(), name: s.string() })
    .id("com.x.Tenant")
    .version("2.0.0");

const AUDIT = () =>
  s.object({ id: s.string(), at: s.string() })
    .id("com.x.AuditEvent")
    .version("1.0.0");

const ANON = () => s.object({ id: s.string() });

const entry = (
  sourcePath: string,
  sourceText: string,
  schemas: readonly ReturnType<typeof TENANT>[],
): RegistrySourceEntry => ({
  sourcePath,
  sourceText,
  schemas,
});

// =============================================================================
// Indexing
// =============================================================================

describe("buildRegistry — indexing", () => {
  it("builds a registry from one entry with one schema", () => {
    const r = buildRegistry([entry("a.schema.ts", "// a", [TENANT()])]);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.size).toBe(1);
      const inner = r.data.get("com.x.Tenant");
      expect(inner).toBeDefined();
      expect(inner?.size).toBe(1);
      const found = inner?.get("1.0.0");
      expect(found?.schemaId).toBe("com.x.Tenant");
      expect(found?.schemaVersion).toBe("1.0.0");
      expect(found?.sourcePath).toBe("a.schema.ts");
    }
  });

  it("indexes multiple schemas from one file", () => {
    const r = buildRegistry([
      entry("multi.schema.ts", "// multi", [TENANT(), AUDIT()]),
    ]);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.size).toBe(2);
      expect(r.data.get("com.x.Tenant")?.size).toBe(1);
      expect(r.data.get("com.x.AuditEvent")?.size).toBe(1);
      // Both entries record the same sourcePath since they came from
      // the same RegistrySourceEntry.
      expect(r.data.get("com.x.Tenant")?.get("1.0.0")?.sourcePath).toBe(
        "multi.schema.ts",
      );
      expect(r.data.get("com.x.AuditEvent")?.get("1.0.0")?.sourcePath).toBe(
        "multi.schema.ts",
      );
    }
  });

  it("indexes schemas across multiple files", () => {
    const r = buildRegistry([
      entry("a.schema.ts", "// a", [TENANT()]),
      entry("b.schema.ts", "// b", [AUDIT()]),
    ]);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.get("com.x.Tenant")?.get("1.0.0")?.sourcePath).toBe(
        "a.schema.ts",
      );
      expect(r.data.get("com.x.AuditEvent")?.get("1.0.0")?.sourcePath).toBe(
        "b.schema.ts",
      );
    }
  });

  it("indexes the same id at different versions side-by-side", () => {
    const r = buildRegistry([
      entry("v1.schema.ts", "// v1", [TENANT()]),
      entry("v2.schema.ts", "// v2", [TENANT_V2()]),
    ]);
    expect(r.success).toBe(true);
    if (r.success) {
      const inner = r.data.get("com.x.Tenant");
      expect(inner?.size).toBe(2);
      expect(inner?.get("1.0.0")?.sourcePath).toBe("v1.schema.ts");
      expect(inner?.get("2.0.0")?.sourcePath).toBe("v2.schema.ts");
    }
  });
});

// =============================================================================
// Hashing
// =============================================================================

describe("buildRegistry — hashing", () => {
  it("computes sourceHash from sourceText (not the path)", () => {
    const text = "// example schema source\nexport const X = s.string();\n";
    const r = buildRegistry([entry("foo.schema.ts", text, [TENANT()])]);
    expect(r.success).toBe(true);
    if (r.success) {
      const found = r.data.get("com.x.Tenant")?.get("1.0.0");
      expect(found?.sourceHash).toBe(sourceHashFromText(text));
    }
  });

  it("schemas from the same source file share the same sourceHash", () => {
    const text = "// two schemas in one file\n";
    const r = buildRegistry([entry("multi.schema.ts", text, [TENANT(), AUDIT()])]);
    expect(r.success).toBe(true);
    if (r.success) {
      const a = r.data.get("com.x.Tenant")?.get("1.0.0");
      const b = r.data.get("com.x.AuditEvent")?.get("1.0.0");
      expect(a?.sourceHash).toBe(b?.sourceHash);
    }
  });

  it("computes irHash from schema.node (prefixed `sha256:` form)", () => {
    const t = TENANT();
    const r = buildRegistry([entry("a.schema.ts", "// a", [t])]);
    expect(r.success).toBe(true);
    if (r.success) {
      const found = r.data.get("com.x.Tenant")?.get("1.0.0");
      expect(found?.irHash).toBe(`sha256:${irHash(t.node)}`);
    }
  });
});

// =============================================================================
// Anonymous + unversioned
// =============================================================================

describe("buildRegistry — anonymous and unversioned schemas", () => {
  it("ignores anonymous schemas (no .id())", () => {
    const r = buildRegistry([
      entry("mixed.schema.ts", "// mixed", [TENANT(), ANON()]),
    ]);
    expect(r.success).toBe(true);
    if (r.success) {
      // Only the named schema is indexed; the anonymous one is silent
      // (the CLI warns, not this layer).
      expect(r.data.size).toBe(1);
      expect(r.data.get("com.x.Tenant")).toBeDefined();
    }
  });

  it("indexes an unversioned schema under the empty-string inner key", () => {
    const Unversioned = s.object({ id: s.string() }).id("com.x.NoVersion");
    const r = buildRegistry([
      entry("nover.schema.ts", "// no version", [Unversioned]),
    ]);
    expect(r.success).toBe(true);
    if (r.success) {
      const inner = r.data.get("com.x.NoVersion");
      expect(inner?.size).toBe(1);
      const found = inner?.get("");
      expect(found).toBeDefined();
      expect(found?.schemaVersion).toBeUndefined();
    }
  });

  it("an anonymous-only entry produces an empty registry, not a failure", () => {
    const r = buildRegistry([
      entry("anon.schema.ts", "// just anon", [ANON()]),
    ]);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.size).toBe(0);
    }
  });
});

// =============================================================================
// Duplicate detection
// =============================================================================

describe("buildRegistry — duplicate detection", () => {
  it("duplicate (schemaId, schemaVersion) across two files returns failure", () => {
    const r = buildRegistry([
      entry("a.schema.ts", "// a", [TENANT()]),
      entry("b.schema.ts", "// b", [TENANT()]),
    ]);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues).toHaveLength(1);
      expect(r.issues[0]?.code).toBe("duplicate_schema_id");
      expect(r.issues[0]?.severity).toBe("error");
      expect(r.issues[0]?.metadata).toMatchObject({
        schemaId: "com.x.Tenant",
        schemaVersion: "1.0.0",
        sourcePaths: ["a.schema.ts", "b.schema.ts"],
      });
    }
  });

  it("duplicate detection does not throw", () => {
    expect(() =>
      buildRegistry([
        entry("a.schema.ts", "// a", [TENANT()]),
        entry("b.schema.ts", "// b", [TENANT()]),
      ]),
    ).not.toThrow();
  });

  it("same schemaId at different versions is allowed (not a duplicate)", () => {
    const r = buildRegistry([
      entry("v1.schema.ts", "// v1", [TENANT()]),
      entry("v2.schema.ts", "// v2", [TENANT_V2()]),
    ]);
    expect(r.success).toBe(true);
  });

  it("duplicate unversioned schemas with the same id are also a duplicate", () => {
    const A = s.object({ id: s.string() }).id("com.x.NoVer");
    const B = s.object({ id: s.string() }).id("com.x.NoVer");
    const r = buildRegistry([
      entry("a.schema.ts", "// a", [A]),
      entry("b.schema.ts", "// b", [B]),
    ]);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues[0]?.code).toBe("duplicate_schema_id");
      expect(r.issues[0]?.metadata?.schemaVersion).toBe(null);
    }
  });

  it("multiple duplicates are reported in a single Result, not short-circuited", () => {
    const r = buildRegistry([
      entry("a.schema.ts", "// a", [TENANT(), AUDIT()]),
      entry("b.schema.ts", "// b", [TENANT(), AUDIT()]),
    ]);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues).toHaveLength(2);
      const ids = r.issues.map((i) => i.metadata?.schemaId).sort();
      expect(ids).toEqual(["com.x.AuditEvent", "com.x.Tenant"]);
    }
  });

  it("duplicate within a single file is also caught", () => {
    const r = buildRegistry([
      entry("dup.schema.ts", "// dup", [TENANT(), TENANT()]),
    ]);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues[0]?.code).toBe("duplicate_schema_id");
      expect(r.issues[0]?.metadata?.sourcePaths).toEqual([
        "dup.schema.ts",
        "dup.schema.ts",
      ]);
    }
  });
});

// =============================================================================
// findSchema
// =============================================================================

function unwrap<T>(r: { success: true; data: T } | { success: false }): T {
  if (!r.success) throw new Error("Expected success");
  return r.data;
}

describe("findSchema", () => {
  const buildFixture = () =>
    unwrap(
      buildRegistry([
        entry("t1.schema.ts", "// t1", [TENANT()]),
        entry("t2.schema.ts", "// t2", [TENANT_V2()]),
        entry("a.schema.ts", "// a", [AUDIT()]),
      ]),
    );

  it("exact id + version returns the matching entry", () => {
    const reg = buildFixture();
    const found = findSchema(reg, "com.x.Tenant", "1.0.0");
    expect(found?.schemaVersion).toBe("1.0.0");
    expect(found?.sourcePath).toBe("t1.schema.ts");
  });

  it("exact id + version returns undefined for non-matching version", () => {
    const reg = buildFixture();
    expect(findSchema(reg, "com.x.Tenant", "9.9.9")).toBeUndefined();
  });

  it("omitted version returns the highest semver entry", () => {
    const reg = buildFixture();
    const found = findSchema(reg, "com.x.Tenant");
    expect(found?.schemaVersion).toBe("2.0.0");
    expect(found?.sourcePath).toBe("t2.schema.ts");
  });

  it("omitted version is semver-aware, not lexicographic", () => {
    // Lexicographic compare would pick "9.0.0" over "10.0.0"; semver
    // compare correctly picks "10.0.0".
    const Lots = s.object({ id: s.string() }).id("com.x.Lots");
    const v9 = s.object({ id: s.string() }).id("com.x.Lots").version("9.0.0");
    const v10 = s.object({ id: s.string() }).id("com.x.Lots").version("10.0.0");
    void Lots;
    const reg = unwrap(
      buildRegistry([
        entry("a.schema.ts", "// a", [v9]),
        entry("b.schema.ts", "// b", [v10]),
      ]),
    );
    expect(findSchema(reg, "com.x.Lots")?.schemaVersion).toBe("10.0.0");
  });

  it("missing id returns undefined", () => {
    const reg = buildFixture();
    expect(findSchema(reg, "com.x.DoesNotExist")).toBeUndefined();
    expect(findSchema(reg, "com.x.DoesNotExist", "1.0.0")).toBeUndefined();
  });

  it("unversioned schema is addressable by exact empty-string version", () => {
    const Unver = s.object({ id: s.string() }).id("com.x.NoVer");
    const reg = unwrap(
      buildRegistry([entry("u.schema.ts", "// u", [Unver])]),
    );
    expect(findSchema(reg, "com.x.NoVer", "")?.schemaVersion).toBeUndefined();
  });

  it("unversioned-only id with no `version` arg returns the unversioned entry", () => {
    const Unver = s.object({ id: s.string() }).id("com.x.NoVer");
    const reg = unwrap(
      buildRegistry([entry("u.schema.ts", "// u", [Unver])]),
    );
    const found = findSchema(reg, "com.x.NoVer");
    expect(found?.schemaVersion).toBeUndefined();
    expect(found?.sourcePath).toBe("u.schema.ts");
  });

  it("versioned wins over unversioned when both exist for the same id", () => {
    // The contract: if any versioned entry exists, findSchema(id)
    // returns the highest semver, NOT the unversioned fallback.
    const Unver = s.object({ id: s.string() }).id("com.x.MixedVer");
    const V1 = s.object({ id: s.string() }).id("com.x.MixedVer").version("1.0.0");
    const reg = unwrap(
      buildRegistry([
        entry("u.schema.ts", "// u", [Unver]),
        entry("v.schema.ts", "// v", [V1]),
      ]),
    );
    const found = findSchema(reg, "com.x.MixedVer");
    expect(found?.schemaVersion).toBe("1.0.0");
    expect(found?.sourcePath).toBe("v.schema.ts");
  });
});

// =============================================================================
// Purity
// =============================================================================

describe("buildRegistry — purity", () => {
  it("buildRegistry function arity = 1 (no filesystem reachable from the input)", () => {
    expect(buildRegistry.length).toBe(1);
  });

  it("returned Registry is a Map snapshot — building twice produces independent maps", () => {
    const fixtureEntries = [
      entry("a.schema.ts", "// a", [TENANT()]),
    ];
    const a = buildRegistry(fixtureEntries);
    const b = buildRegistry(fixtureEntries);
    expect(a.success && b.success).toBe(true);
    if (a.success && b.success) {
      // Identity differs (separate Map instances).
      expect(a.data).not.toBe(b.data);
      // Content matches.
      const ea = a.data.get("com.x.Tenant")?.get("1.0.0") as RegistryEntry;
      const eb = b.data.get("com.x.Tenant")?.get("1.0.0") as RegistryEntry;
      expect(ea.irHash).toBe(eb.irHash);
      expect(ea.sourceHash).toBe(eb.sourceHash);
    }
  });
});
