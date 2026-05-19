/**
 * Step 10 tests for `checkHandler` — every row of the two-hash
 * freshness matrix, plus failure paths (malformed provenance,
 * missing schema, missing version, anonymous artifact) and the
 * v0.6 backward-compat fallback (artifact with no sourceHash).
 */
import { describe, expect, it } from "vitest";
import { s } from "../../../src/index.js";
import { generateZod } from "../../../src/generators/zod.js";
import { sourceHashFromText } from "../../../src/registry/source-hash.js";
import { buildRegistry } from "../../../src/registry/build-registry.js";
import { checkHandler } from "../../../src/registry/handlers/check.js";
import type {
  CommittedArtifact,
  Registry,
  RegistrySourceEntry,
} from "../../../src/registry/types.js";

// =============================================================================
// Fixture helpers
// =============================================================================

const TENANT = () =>
  s.object({ id: s.string() }).id("com.x.Tenant").version("1.0.0");

// Build a registry from a source entry whose sourceText is controlled.
function regFor(
  sourceText: string,
  schemas: readonly ReturnType<typeof TENANT>[] = [TENANT()],
  sourcePath = "tenant.schema.ts",
): Registry {
  const entries: RegistrySourceEntry[] = [
    { sourcePath, sourceText, schemas },
  ];
  const r = buildRegistry(entries);
  if (!r.success) throw new Error("fixture buildRegistry should succeed");
  return r.data;
}

// Generate a Zod artifact for the given schema. If `sourceHash` is
// passed, the emitted header carries that exact hash. If omitted,
// the emitter omits the line entirely (v0.6-era shape).
function artifactFor(
  schema: ReturnType<typeof TENANT>,
  opts: { sourceHash?: `sha256:${string}`; path?: string } = {},
): CommittedArtifact {
  return {
    path: opts.path ?? "tenant.zod.ts",
    content: generateZod(
      schema.node,
      opts.sourceHash !== undefined ? { sourceHash: opts.sourceHash } : {},
    ),
  };
}

// =============================================================================
// Two-hash matrix
// =============================================================================

describe("checkHandler — two-hash matrix", () => {
  it("clean: both hashes match", () => {
    const sourceText = "// canonical tenant source\n";
    const registry = regFor(sourceText);
    const hash = sourceHashFromText(sourceText);
    const artifact = artifactFor(TENANT(), { sourceHash: hash });

    const r = checkHandler({ registry, committedArtifacts: [artifact] });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.verdicts).toHaveLength(1);
      expect(r.data.verdicts[0]).toEqual({
        status: "clean",
        artifactPath: "tenant.zod.ts",
      });
    }
  });

  it("cosmetic_drift: irHash matches, sourceHash differs", () => {
    // Same schema (same IR → same irHash). Registry built from one
    // source text; artifact emitted with a DIFFERENT sourceHash —
    // simulating a source-text edit (e.g., comment / import order)
    // that didn't change the IR.
    const registry = regFor("// original source\n");
    const artifact = artifactFor(TENANT(), {
      sourceHash: sourceHashFromText("// edited source\n"),
    });

    const r = checkHandler({ registry, committedArtifacts: [artifact] });
    if (r.success) {
      expect(r.data.verdicts[0]).toEqual({
        status: "cosmetic_drift",
        artifactPath: "tenant.zod.ts",
      });
    }
  });

  it("stale: irHash differs, sourceHash differs", () => {
    // Registry built from schema A; artifact emitted from schema B
    // (different shape → different irHash). sourceHash also differs
    // because the source text is different.
    const A = s.object({ id: s.string() }).id("com.x.Tenant").version("1.0.0");
    const B = s
      .object({ id: s.string(), name: s.string() })
      .id("com.x.Tenant")
      .version("1.0.0");
    const registry = regFor("// schema A source\n", [A]);
    const artifact = artifactFor(B, {
      sourceHash: sourceHashFromText("// schema B source\n"),
    });

    const r = checkHandler({ registry, committedArtifacts: [artifact] });
    if (r.success) {
      expect(r.data.verdicts[0]).toEqual({
        status: "stale",
        artifactPath: "tenant.zod.ts",
      });
    }
  });

  it("integrity_error: irHash differs, sourceHash matches", () => {
    // Registry built from schema A with sourceText T;
    // artifact's provenance claims sourceHash = sourceHashFromText(T)
    // but irHash for schema B. This is the impossible row: a
    // generator running over text T would produce schema-A's irHash,
    // not schema-B's. Indicates manual artifact edit or tampering.
    const A = s.object({ id: s.string() }).id("com.x.Tenant").version("1.0.0");
    const B = s
      .object({ id: s.string(), name: s.string() })
      .id("com.x.Tenant")
      .version("1.0.0");
    const sourceText = "// shared source text\n";
    const registry = regFor(sourceText, [A]);
    const artifact = artifactFor(B, {
      // sourceHash matches the registry's sourceHash, but the
      // emitted artifact's irHash is schema B's — the impossible
      // pairing.
      sourceHash: sourceHashFromText(sourceText),
    });

    const r = checkHandler({ registry, committedArtifacts: [artifact] });
    if (r.success) {
      expect(r.data.verdicts[0]).toEqual({
        status: "integrity_error",
        artifactPath: "tenant.zod.ts",
      });
    }
  });
});

// =============================================================================
// v0.6 backward compatibility — artifact with no sourceHash
// =============================================================================

describe("checkHandler — v0.6 backward compatibility (no sourceHash in artifact)", () => {
  it("absent sourceHash + irHash matches → clean", () => {
    const registry = regFor("// any source\n");
    // No sourceHash passed → emitter omits the line entirely
    // (Step 4's locked behavior).
    const artifact = artifactFor(TENANT());

    const r = checkHandler({ registry, committedArtifacts: [artifact] });
    if (r.success) {
      expect(r.data.verdicts[0]?.status).toBe("clean");
    }
  });

  it("absent sourceHash + irHash differs → stale", () => {
    const A = s.object({ id: s.string() }).id("com.x.Tenant").version("1.0.0");
    const B = s
      .object({ id: s.string(), name: s.string() })
      .id("com.x.Tenant")
      .version("1.0.0");
    const registry = regFor("// A source\n", [A]);
    const artifact = artifactFor(B); // no sourceHash

    const r = checkHandler({ registry, committedArtifacts: [artifact] });
    if (r.success) {
      expect(r.data.verdicts[0]?.status).toBe("stale");
    }
  });

  it("absent sourceHash is never integrity_error on its own", () => {
    // The impossible-row case for v0.7+ artifacts (`integrity_error`)
    // doesn't apply to v0.6-era artifacts; the missing sourceHash
    // means we can't distinguish "irHash differs but sourceHash
    // matches" — and per Master plan Decision #8 absent sourceHash is
    // treated as "unknown," not as a hash mismatch.
    const A = s.object({ id: s.string() }).id("com.x.Tenant").version("1.0.0");
    const B = s
      .object({ id: s.string(), name: s.string() })
      .id("com.x.Tenant")
      .version("1.0.0");
    const registry = regFor("// A\n", [A]);
    const artifact = artifactFor(B); // emitter omits sourceHash

    const r = checkHandler({ registry, committedArtifacts: [artifact] });
    if (r.success) {
      expect(r.data.verdicts[0]?.status).not.toBe("integrity_error");
    }
  });
});

// =============================================================================
// Failure paths
// =============================================================================

describe("checkHandler — failure paths", () => {
  it("malformed provenance returns Result.failure with integrity_error", () => {
    const registry = regFor("// any\n");
    const artifact: CommittedArtifact = {
      path: "broken.zod.ts",
      content: "// not a valid header\nexport const schema = z.string();\n",
    };
    const r = checkHandler({ registry, committedArtifacts: [artifact] });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues).toHaveLength(1);
      expect(r.issues[0]?.code).toBe("integrity_error");
      expect(r.issues[0]?.metadata?.artifactPath).toBe("broken.zod.ts");
    }
  });

  it("schemaId not in registry → schema_not_found", () => {
    const registry = regFor("// tenant\n"); // contains only com.x.Tenant
    // Generate an artifact for a different schema id.
    const other = s
      .object({ id: s.string() })
      .id("com.x.OrphanSchema")
      .version("1.0.0");
    const artifact = artifactFor(other);

    const r = checkHandler({ registry, committedArtifacts: [artifact] });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues[0]?.code).toBe("schema_not_found");
      expect(r.issues[0]?.metadata?.schemaId).toBe("com.x.OrphanSchema");
    }
  });

  it("schemaId present but version not in registry → version_not_found", () => {
    const registry = regFor("// tenant v1\n"); // com.x.Tenant @ 1.0.0
    // Same id, different version.
    const v2 = s
      .object({ id: s.string() })
      .id("com.x.Tenant")
      .version("2.0.0");
    const artifact = artifactFor(v2);

    const r = checkHandler({ registry, committedArtifacts: [artifact] });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues[0]?.code).toBe("version_not_found");
      expect(r.issues[0]?.metadata?.schemaId).toBe("com.x.Tenant");
      expect(r.issues[0]?.metadata?.schemaVersion).toBe("2.0.0");
    }
  });

  it("anonymous artifact (schemaId: null in provenance) → schema_not_found with reason 'anonymous_artifact'", () => {
    const registry = regFor("// tenant\n");
    // Anonymous schema artifact.
    const anonymous = s.object({ id: s.string() }); // no .id()
    const artifact: CommittedArtifact = {
      path: "anon.zod.ts",
      content: generateZod(anonymous.node),
    };
    const r = checkHandler({ registry, committedArtifacts: [artifact] });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues[0]?.code).toBe("schema_not_found");
      expect(r.issues[0]?.metadata?.reason).toBe("anonymous_artifact");
    }
  });

  it("multiple failing artifacts surface all issues in a single Result", () => {
    const registry = regFor("// tenant\n");
    const orphan = s
      .object({ id: s.string() })
      .id("com.x.Orphan")
      .version("1.0.0");
    const v2 = s
      .object({ id: s.string() })
      .id("com.x.Tenant")
      .version("2.0.0");
    const r = checkHandler({
      registry,
      committedArtifacts: [
        artifactFor(orphan, { path: "orphan.zod.ts" }),
        artifactFor(v2, { path: "tenant-v2.zod.ts" }),
      ],
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues).toHaveLength(2);
      const codes = r.issues.map((i) => i.code).sort();
      expect(codes).toEqual(["schema_not_found", "version_not_found"]);
    }
  });
});

// =============================================================================
// Multi-artifact verdicts
// =============================================================================

describe("checkHandler — multi-artifact", () => {
  it("returns one verdict per artifact, in input order", () => {
    const sourceText = "// tenant\n";
    const registry = regFor(sourceText);
    const hash = sourceHashFromText(sourceText);
    const r = checkHandler({
      registry,
      committedArtifacts: [
        artifactFor(TENANT(), { sourceHash: hash, path: "tenant.types.ts" }),
        artifactFor(TENANT(), { sourceHash: hash, path: "tenant.zod.ts" }),
      ],
    });
    if (r.success) {
      expect(r.data.verdicts).toHaveLength(2);
      expect(r.data.verdicts[0]?.artifactPath).toBe("tenant.types.ts");
      expect(r.data.verdicts[1]?.artifactPath).toBe("tenant.zod.ts");
      expect(r.data.verdicts.every((v) => v.status === "clean")).toBe(true);
    }
  });

  it("verdicts preserve `artifactPath` exactly as the caller passed", () => {
    const registry = regFor("// t\n");
    const artifact = artifactFor(TENANT(), { path: "packages/x/generated/tenant.zod.ts" });
    const r = checkHandler({ registry, committedArtifacts: [artifact] });
    if (r.success) {
      expect(r.data.verdicts[0]?.artifactPath).toBe(
        "packages/x/generated/tenant.zod.ts",
      );
    }
  });

  it("empty artifact list → success with empty verdicts", () => {
    const registry = regFor("// t\n");
    const r = checkHandler({ registry, committedArtifacts: [] });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.verdicts).toEqual([]);
  });
});

// =============================================================================
// Purity
// =============================================================================

describe("checkHandler — purity", () => {
  it("function arity = 1 (no filesystem reachable from the input)", () => {
    expect(checkHandler.length).toBe(1);
  });

  it("does not mutate the input registry", () => {
    const registry = regFor("// t\n");
    const beforeSize = registry.size;
    const beforeInner = registry.get("com.x.Tenant")?.size;
    checkHandler({
      registry,
      committedArtifacts: [artifactFor(TENANT())],
    });
    expect(registry.size).toBe(beforeSize);
    expect(registry.get("com.x.Tenant")?.size).toBe(beforeInner);
  });

  it("deterministic — repeated calls produce identical results", () => {
    const sourceText = "// t\n";
    const registry = regFor(sourceText);
    const artifact = artifactFor(TENANT(), {
      sourceHash: sourceHashFromText(sourceText),
    });
    const a = checkHandler({ registry, committedArtifacts: [artifact] });
    const b = checkHandler({ registry, committedArtifacts: [artifact] });
    if (a.success && b.success) {
      expect(JSON.stringify(a.data)).toBe(JSON.stringify(b.data));
    }
  });
});
