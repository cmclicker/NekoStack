/**
 * Step 8 tests for `listHandler` — the simplest handler. Drives the
 * `Result<T>` discriminated-union contract that the next three
 * handlers (`diff`, `check`, `generate`) inherit.
 */
import { describe, expect, it } from "vitest";
import { s } from "../../../src/index.js";
import { irHash } from "../../../src/ir/hash.js";
import { buildRegistry } from "../../../src/registry/build-registry.js";
import { sourceHashFromText } from "../../../src/registry/source-hash.js";
import { listHandler } from "../../../src/registry/handlers/list.js";
import type {
  Registry,
  RegistrySourceEntry,
} from "../../../src/registry/types.js";

// Helper: build a Registry from inline schemas. The Step 6 builder
// already has comprehensive tests; here we just need a quick way to
// produce realistic Registry values for handler input.
function makeRegistry(entries: readonly RegistrySourceEntry[]): Registry {
  const r = buildRegistry(entries);
  if (!r.success) throw new Error("buildRegistry fixture should succeed");
  return r.data;
}

const tenant1 = () =>
  s.object({ id: s.string() }).id("com.x.Tenant").version("1.0.0");
const tenant2 = () =>
  s.object({ id: s.string(), name: s.string() })
    .id("com.x.Tenant")
    .version("2.0.0");
const tenant10 = () =>
  s.object({ id: s.string() }).id("com.x.Tenant").version("10.0.0");
const audit = () =>
  s.object({ id: s.string() }).id("com.x.AuditEvent").version("1.0.0");
const unversioned = (id: string) => s.object({ id: s.string() }).id(id);

// =============================================================================
// Result shape
// =============================================================================

describe("listHandler — Result shape", () => {
  it("returns `{ success: true, data: { entries } }`", () => {
    const reg = makeRegistry([
      { sourcePath: "a.schema.ts", sourceText: "// a", schemas: [tenant1()] },
    ]);
    const r = listHandler({ registry: reg });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(Array.isArray(r.data.entries)).toBe(true);
    }
  });

  it("empty registry → success with empty entries", () => {
    const empty = new Map() as Registry;
    const r = listHandler({ registry: empty });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.entries).toEqual([]);
  });
});

// =============================================================================
// Flattening
// =============================================================================

describe("listHandler — flattening", () => {
  it("flattens one entry", () => {
    const reg = makeRegistry([
      { sourcePath: "a.schema.ts", sourceText: "// a", schemas: [tenant1()] },
    ]);
    const r = listHandler({ registry: reg });
    if (r.success) {
      expect(r.data.entries).toHaveLength(1);
      expect(r.data.entries[0]?.schemaId).toBe("com.x.Tenant");
      expect(r.data.entries[0]?.schemaVersion).toBe("1.0.0");
    }
  });

  it("flattens multiple schema ids", () => {
    const reg = makeRegistry([
      { sourcePath: "t.schema.ts", sourceText: "// t", schemas: [tenant1()] },
      { sourcePath: "a.schema.ts", sourceText: "// a", schemas: [audit()] },
    ]);
    const r = listHandler({ registry: reg });
    if (r.success) {
      expect(r.data.entries).toHaveLength(2);
      const ids = r.data.entries.map((e) => e.schemaId);
      expect(ids.sort()).toEqual(["com.x.AuditEvent", "com.x.Tenant"]);
    }
  });

  it("flattens multiple versions under one id", () => {
    const reg = makeRegistry([
      { sourcePath: "t1.schema.ts", sourceText: "// 1", schemas: [tenant1()] },
      { sourcePath: "t2.schema.ts", sourceText: "// 2", schemas: [tenant2()] },
    ]);
    const r = listHandler({ registry: reg });
    if (r.success) {
      expect(r.data.entries).toHaveLength(2);
      expect(r.data.entries.every((e) => e.schemaId === "com.x.Tenant")).toBe(
        true,
      );
      const versions = r.data.entries.map((e) => e.schemaVersion);
      expect(versions).toEqual(["1.0.0", "2.0.0"]);
    }
  });
});

// =============================================================================
// Field preservation
// =============================================================================

describe("listHandler — field preservation", () => {
  it("preserves every RegistryEntry field", () => {
    const t = tenant1();
    const reg = makeRegistry([
      {
        sourcePath: "packages/x/tenant.schema.ts",
        sourceText: "// tenant source\n",
        schemas: [t],
      },
    ]);
    const r = listHandler({ registry: reg });
    if (r.success) {
      const e = r.data.entries[0];
      expect(e).toBeDefined();
      expect(e?.schemaId).toBe("com.x.Tenant");
      expect(e?.schemaVersion).toBe("1.0.0");
      expect(e?.sourcePath).toBe("packages/x/tenant.schema.ts");
      expect(e?.sourceHash).toBe(sourceHashFromText("// tenant source\n"));
      expect(e?.irHash).toBe(`sha256:${irHash(t.node)}`);
      // The `schema` field is the AnySchema instance; identity-check
      // against the original so consumers can call `.node` / methods
      // through the registry entry without re-walking.
      expect(e?.schema).toBe(t);
    }
  });

  it("preserves an unversioned entry's `schemaVersion` as `undefined`", () => {
    const u = unversioned("com.x.NoVer");
    const reg = makeRegistry([
      { sourcePath: "u.schema.ts", sourceText: "// u", schemas: [u] },
    ]);
    const r = listHandler({ registry: reg });
    if (r.success) {
      expect(r.data.entries[0]?.schemaVersion).toBeUndefined();
    }
  });
});

// =============================================================================
// Ordering
// =============================================================================

describe("listHandler — deterministic ordering", () => {
  it("schemaIds sort ascending across the outer map", () => {
    const reg = makeRegistry([
      { sourcePath: "t.schema.ts", sourceText: "// t", schemas: [tenant1()] },
      { sourcePath: "a.schema.ts", sourceText: "// a", schemas: [audit()] },
    ]);
    const r = listHandler({ registry: reg });
    if (r.success) {
      const ids = r.data.entries.map((e) => e.schemaId);
      // com.x.AuditEvent < com.x.Tenant
      expect(ids).toEqual(["com.x.AuditEvent", "com.x.Tenant"]);
    }
  });

  it("versions sort by semver ascending (numeric, not lexicographic)", () => {
    const reg = makeRegistry([
      { sourcePath: "t2.schema.ts", sourceText: "// 2", schemas: [tenant2()] },
      { sourcePath: "t10.schema.ts", sourceText: "// 10", schemas: [tenant10()] },
      { sourcePath: "t1.schema.ts", sourceText: "// 1", schemas: [tenant1()] },
    ]);
    const r = listHandler({ registry: reg });
    if (r.success) {
      const versions = r.data.entries.map((e) => e.schemaVersion);
      // Numeric semver: 1.0.0 < 2.0.0 < 10.0.0. Lexicographic would
      // wrongly place "10.0.0" between "1.0.0" and "2.0.0".
      expect(versions).toEqual(["1.0.0", "2.0.0", "10.0.0"]);
    }
  });

  it("unversioned entries come LAST within a schemaId", () => {
    const reg = makeRegistry([
      { sourcePath: "u.schema.ts", sourceText: "// u", schemas: [unversioned("com.x.Mixed")] },
      {
        sourcePath: "v1.schema.ts",
        sourceText: "// v1",
        schemas: [s.object({ id: s.string() }).id("com.x.Mixed").version("1.0.0")],
      },
      {
        sourcePath: "v2.schema.ts",
        sourceText: "// v2",
        schemas: [s.object({ id: s.string() }).id("com.x.Mixed").version("2.0.0")],
      },
    ]);
    const r = listHandler({ registry: reg });
    if (r.success) {
      const versions = r.data.entries.map((e) => e.schemaVersion);
      // Versioned ascending first, then unversioned (undefined) last.
      expect(versions).toEqual(["1.0.0", "2.0.0", undefined]);
    }
  });

  it("cross-id + cross-version ordering is fully deterministic", () => {
    // Compose all the rules: two ids, multiple versions each, one id
    // with an unversioned entry too.
    const reg = makeRegistry([
      { sourcePath: "a1.schema.ts", sourceText: "// a1", schemas: [audit()] },
      {
        sourcePath: "a2.schema.ts",
        sourceText: "// a2",
        schemas: [
          s.object({ id: s.string() }).id("com.x.AuditEvent").version("2.0.0"),
        ],
      },
      { sourcePath: "t1.schema.ts", sourceText: "// t1", schemas: [tenant1()] },
      { sourcePath: "t10.schema.ts", sourceText: "// 10", schemas: [tenant10()] },
      {
        sourcePath: "tu.schema.ts",
        sourceText: "// tu",
        schemas: [unversioned("com.x.Tenant")],
      },
    ]);
    const r = listHandler({ registry: reg });
    if (r.success) {
      const summary = r.data.entries.map(
        (e) => `${e.schemaId}@${e.schemaVersion ?? "(unversioned)"}`,
      );
      expect(summary).toEqual([
        "com.x.AuditEvent@1.0.0",
        "com.x.AuditEvent@2.0.0",
        "com.x.Tenant@1.0.0",
        "com.x.Tenant@10.0.0",
        "com.x.Tenant@(unversioned)",
      ]);
    }
  });

  it("repeated invocations on the same registry produce identical entry order", () => {
    const reg = makeRegistry([
      { sourcePath: "t.schema.ts", sourceText: "// t", schemas: [tenant1(), tenant2()] },
      { sourcePath: "a.schema.ts", sourceText: "// a", schemas: [audit()] },
    ]);
    const a = listHandler({ registry: reg });
    const b = listHandler({ registry: reg });
    if (a.success && b.success) {
      expect(JSON.stringify(a.data.entries.map((e) => e.sourcePath))).toBe(
        JSON.stringify(b.data.entries.map((e) => e.sourcePath)),
      );
    }
  });
});

// =============================================================================
// Purity
// =============================================================================

describe("listHandler — purity", () => {
  it("function arity = 1 (no filesystem reachable from the input)", () => {
    expect(listHandler.length).toBe(1);
  });

  it("does not mutate the input registry", () => {
    const reg = makeRegistry([
      { sourcePath: "t.schema.ts", sourceText: "// t", schemas: [tenant1()] },
    ]);
    const beforeSize = reg.size;
    const beforeInnerSize = reg.get("com.x.Tenant")?.size;
    listHandler({ registry: reg });
    expect(reg.size).toBe(beforeSize);
    expect(reg.get("com.x.Tenant")?.size).toBe(beforeInnerSize);
  });
});
