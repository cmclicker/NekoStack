/**
 * Step 7 tests for `diffNodes` — one fixture pair per Master plan
 * Decision #12 table row, plus combined-change and structural cases.
 *
 * Test shape: each `it` constructs two SchemaNodes via `s.*`,
 * computes `diffNodes(before, after)`, and asserts on the emitted
 * `DiffChange[]` — at minimum the count, the kind, and the severity.
 * Path / message / before / after assertions only appear where they
 * matter for the row's contract.
 */
import { describe, expect, it } from "vitest";
import { s } from "../../src/index.js";
import { UnsupportedNodeKindError } from "../../src/generators/errors.js";
import { diffNodes } from "../../src/registry/diff.js";
import type { SchemaNode } from "../../src/index.js";

// Helper: get the change of a given kind from a result, if any.
function findKind(
  changes: ReadonlyArray<ReturnType<typeof diffNodes>[number]>,
  kind: string,
) {
  return changes.find((c) => c.kind === kind);
}

// =============================================================================
// Decision #12 row-by-row
// =============================================================================

describe("diffNodes — field add/remove", () => {
  it("add required field → breaking", () => {
    const before = s.object({ id: s.string() });
    const after = s.object({ id: s.string(), name: s.string() });
    const r = diffNodes(before.node, after.node);
    expect(r).toHaveLength(1);
    expect(r[0]?.kind).toBe("field_added");
    expect(r[0]?.severity).toBe("breaking");
    expect(r[0]?.path).toEqual(["name"]);
  });

  it("add nullable-only field → breaking (nullable does not imply optional)", () => {
    const before = s.object({ id: s.string() });
    const after = s.object({ id: s.string(), name: s.string().nullable() });
    const r = diffNodes(before.node, after.node);
    expect(r).toHaveLength(1);
    expect(r[0]?.kind).toBe("field_added");
    expect(r[0]?.severity).toBe("breaking");
  });

  it("add optional field → additive", () => {
    const before = s.object({ id: s.string() });
    const after = s.object({ id: s.string(), name: s.string().optional() });
    const r = diffNodes(before.node, after.node);
    expect(r).toHaveLength(1);
    expect(r[0]?.kind).toBe("field_added");
    expect(r[0]?.severity).toBe("additive");
  });

  it("add nullish field → additive", () => {
    const before = s.object({ id: s.string() });
    const after = s.object({ id: s.string(), name: s.string().nullish() });
    const r = diffNodes(before.node, after.node);
    expect(r).toHaveLength(1);
    expect(r[0]?.kind).toBe("field_added");
    expect(r[0]?.severity).toBe("additive");
  });

  it("add default-bearing field → additive", () => {
    const before = s.object({ id: s.string() });
    const after = s.object({ id: s.string(), name: s.string().default("anon") });
    const r = diffNodes(before.node, after.node);
    expect(r).toHaveLength(1);
    expect(r[0]?.kind).toBe("field_added");
    expect(r[0]?.severity).toBe("additive");
  });

  it("remove field → breaking", () => {
    const before = s.object({ id: s.string(), name: s.string() });
    const after = s.object({ id: s.string() });
    const r = diffNodes(before.node, after.node);
    expect(r).toHaveLength(1);
    expect(r[0]?.kind).toBe("field_removed");
    expect(r[0]?.severity).toBe("breaking");
    expect(r[0]?.path).toEqual(["name"]);
  });
});

describe("diffNodes — refinements", () => {
  it("tighten refinement (min raised) → breaking", () => {
    const before = s.string().min(2);
    const after = s.string().min(5);
    const r = diffNodes(before.node, after.node);
    expect(r).toHaveLength(1);
    expect(r[0]?.kind).toBe("refinement_changed");
    expect(r[0]?.severity).toBe("breaking");
  });

  it("loosen refinement (min lowered) → additive", () => {
    const before = s.string().min(5);
    const after = s.string().min(2);
    const r = diffNodes(before.node, after.node);
    expect(r).toHaveLength(1);
    expect(r[0]?.kind).toBe("refinement_changed");
    expect(r[0]?.severity).toBe("additive");
  });

  it("add new refinement → breaking (tightened)", () => {
    const before = s.string();
    const after = s.string().email();
    const r = diffNodes(before.node, after.node);
    expect(r).toHaveLength(1);
    expect(r[0]?.kind).toBe("refinement_changed");
    expect(r[0]?.severity).toBe("breaking");
  });

  it("remove a refinement → additive (loosened)", () => {
    const before = s.string().email();
    const after = s.string();
    const r = diffNodes(before.node, after.node);
    expect(r).toHaveLength(1);
    expect(r[0]?.kind).toBe("refinement_changed");
    expect(r[0]?.severity).toBe("additive");
  });

  it("refinement reorder (same set, different order) → cosmetic", () => {
    // Hand-build IR to control order; the builder appends refinements
    // in call order so calling .min(2).max(10) vs .max(10).min(2)
    // produces different IR orders with the same set of refinements.
    const a = s.string().min(2).max(10);
    const b = s.string().max(10).min(2);
    const r = diffNodes(a.node, b.node);
    expect(r).toHaveLength(1);
    expect(r[0]?.kind).toBe("refinements_reordered");
    expect(r[0]?.severity).toBe("cosmetic");
  });
});

describe("diffNodes — unknown-keys policy", () => {
  it("tighten unknownKeys (passthrough → strict) → breaking", () => {
    const before = s.object({ id: s.string() }).passthrough();
    const after = s.object({ id: s.string() }); // default strict
    const r = diffNodes(before.node, after.node);
    expect(r).toHaveLength(1);
    expect(r[0]?.kind).toBe("unknown_keys_changed");
    expect(r[0]?.severity).toBe("breaking");
  });

  it("loosen unknownKeys (strict → passthrough) → additive", () => {
    const before = s.object({ id: s.string() }); // default strict
    const after = s.object({ id: s.string() }).passthrough();
    const r = diffNodes(before.node, after.node);
    expect(r).toHaveLength(1);
    expect(r[0]?.kind).toBe("unknown_keys_changed");
    expect(r[0]?.severity).toBe("additive");
  });

  it("passthrough ↔ stripUnknown → cosmetic (input acceptance unchanged)", () => {
    const before = s.object({ id: s.string() }).passthrough();
    const after = s.object({ id: s.string() }).stripUnknown();
    const r = diffNodes(before.node, after.node);
    expect(r).toHaveLength(1);
    expect(r[0]?.kind).toBe("unknown_keys_changed");
    expect(r[0]?.severity).toBe("cosmetic");
  });
});

describe("diffNodes — enums", () => {
  it("add enum value → additive", () => {
    const before = s.enum(["a", "b"] as const);
    const after = s.enum(["a", "b", "c"] as const);
    const r = diffNodes(before.node, after.node);
    expect(r).toHaveLength(1);
    expect(r[0]?.kind).toBe("enum_value_added");
    expect(r[0]?.severity).toBe("additive");
  });

  it("remove enum value → breaking", () => {
    const before = s.enum(["a", "b", "c"] as const);
    const after = s.enum(["a", "b"] as const);
    const r = diffNodes(before.node, after.node);
    expect(r).toHaveLength(1);
    expect(r[0]?.kind).toBe("enum_value_removed");
    expect(r[0]?.severity).toBe("breaking");
  });
});

describe("diffNodes — literals", () => {
  it("literal value change → breaking", () => {
    const before = s.literal("ok");
    const after = s.literal("nope");
    const r = diffNodes(before.node, after.node);
    expect(r).toHaveLength(1);
    expect(r[0]?.kind).toBe("literal_changed");
    expect(r[0]?.severity).toBe("breaking");
  });
});

describe("diffNodes — defaults", () => {
  it("add default to existing required field → additive (default_added; no spurious absence change)", () => {
    const before = s.object({ name: s.string() });
    const after = s.object({ name: s.string().default("anon") });
    const r = diffNodes(before.node, after.node);
    expect(r).toHaveLength(1);
    expect(r[0]?.kind).toBe("default_added");
    expect(r[0]?.severity).toBe("additive");
    // The implicit `optional: true` set by the builder must not
    // surface as a second `absence_modifier_changed` entry.
    expect(findKind(r, "absence_modifier_changed")).toBeUndefined();
  });

  it("remove default → breaking", () => {
    const before = s.object({ name: s.string().default("anon") });
    const after = s.object({ name: s.string() });
    const r = diffNodes(before.node, after.node);
    expect(r).toHaveLength(1);
    expect(r[0]?.kind).toBe("default_removed");
    expect(r[0]?.severity).toBe("breaking");
  });

  it("change default value → breaking", () => {
    const before = s.object({ name: s.string().default("anon") });
    const after = s.object({ name: s.string().default("guest") });
    const r = diffNodes(before.node, after.node);
    expect(r).toHaveLength(1);
    expect(r[0]?.kind).toBe("default_value_changed");
    expect(r[0]?.severity).toBe("breaking");
  });
});

describe("diffNodes — absence-modifier transitions", () => {
  it("optional → nullable → breaking", () => {
    const before = s.object({ x: s.string().optional() });
    const after = s.object({ x: s.string().nullable() });
    const r = diffNodes(before.node, after.node);
    const change = findKind(r, "absence_modifier_changed");
    expect(change).toBeDefined();
    expect(change?.severity).toBe("breaking");
  });

  it("nullable → optional → breaking", () => {
    const before = s.object({ x: s.string().nullable() });
    const after = s.object({ x: s.string().optional() });
    const r = diffNodes(before.node, after.node);
    const change = findKind(r, "absence_modifier_changed");
    expect(change?.severity).toBe("breaking");
  });

  it("optional → nullish → additive", () => {
    const before = s.object({ x: s.string().optional() });
    const after = s.object({ x: s.string().nullish() });
    const r = diffNodes(before.node, after.node);
    const change = findKind(r, "absence_modifier_changed");
    expect(change?.severity).toBe("additive");
  });

  it("nullable → nullish → additive", () => {
    const before = s.object({ x: s.string().nullable() });
    const after = s.object({ x: s.string().nullish() });
    const r = diffNodes(before.node, after.node);
    const change = findKind(r, "absence_modifier_changed");
    expect(change?.severity).toBe("additive");
  });

  it("nullish → optional → breaking (loses null permission)", () => {
    const before = s.object({ x: s.string().nullish() });
    const after = s.object({ x: s.string().optional() });
    const r = diffNodes(before.node, after.node);
    const change = findKind(r, "absence_modifier_changed");
    expect(change?.severity).toBe("breaking");
  });

  it("nullish → nullable → breaking (loses missing permission)", () => {
    const before = s.object({ x: s.string().nullish() });
    const after = s.object({ x: s.string().nullable() });
    const r = diffNodes(before.node, after.node);
    const change = findKind(r, "absence_modifier_changed");
    expect(change?.severity).toBe("breaking");
  });
});

describe("diffNodes — metadata-only edits (cosmetic)", () => {
  it("description change → cosmetic", () => {
    const before = s.string().describe("v1");
    const after = s.string().describe("v2");
    const r = diffNodes(before.node, after.node);
    expect(r).toHaveLength(1);
    expect(r[0]?.kind).toBe("metadata_changed");
    expect(r[0]?.severity).toBe("cosmetic");
  });

  it("schemaVersion-only edit → cosmetic", () => {
    const before = s.object({ id: s.string() }).id("com.x.User").version("1.0.0");
    const after = s.object({ id: s.string() }).id("com.x.User").version("2.0.0");
    const r = diffNodes(before.node, after.node);
    expect(r).toHaveLength(1);
    expect(r[0]?.kind).toBe("schema_version_changed");
    expect(r[0]?.severity).toBe("cosmetic");
  });

  it("deprecated flag change → cosmetic", () => {
    const before = s.string();
    const after = s.string().deprecated(true);
    const r = diffNodes(before.node, after.node);
    expect(r).toHaveLength(1);
    expect(r[0]?.kind).toBe("metadata_changed");
    expect(r[0]?.severity).toBe("cosmetic");
  });
});

// =============================================================================
// Combined-change behavior
// =============================================================================

describe("diffNodes — combined changes", () => {
  it("schemaVersion bump + structural breaking → both changes visible", () => {
    const before = s.object({ id: s.string() }).version("1.0.0");
    const after = s.object({ id: s.string(), age: s.number() }).version("2.0.0");
    const r = diffNodes(before.node, after.node);
    expect(r.length).toBeGreaterThan(1);
    const versionChange = findKind(r, "schema_version_changed");
    const addedField = findKind(r, "field_added");
    expect(versionChange?.severity).toBe("cosmetic");
    expect(addedField?.severity).toBe("breaking");
    // The worstSeverity aggregation happens in diffHandler (Step 9);
    // diffNodes preserves each individual change's severity.
  });

  it("multiple changes preserve each DiffChange separately", () => {
    const before = s.object({ a: s.string(), b: s.number() });
    const after = s.object({ a: s.string().optional(), c: s.string() });
    const r = diffNodes(before.node, after.node);
    // a: required → optional (additive, absence_modifier_changed)
    // b: removed (breaking)
    // c: added (breaking)
    expect(r.length).toBeGreaterThanOrEqual(3);
    expect(findKind(r, "absence_modifier_changed")?.severity).toBe("additive");
    expect(findKind(r, "field_removed")?.severity).toBe("breaking");
    expect(findKind(r, "field_added")?.severity).toBe("breaking");
  });

  it("unchanged schemas return []", () => {
    const node = s.object({ id: s.string(), age: s.number() }).id("com.x.X").version("1.0.0").node;
    const r = diffNodes(node, node);
    expect(r).toEqual([]);
  });

  it("structurally-identical-but-distinct schema instances return []", () => {
    const a = s.object({ id: s.string() }).id("com.x.X").version("1.0.0").node;
    const b = s.object({ id: s.string() }).id("com.x.X").version("1.0.0").node;
    expect(diffNodes(a, b)).toEqual([]);
  });
});

// =============================================================================
// Structural integrity / path / fail-loud
// =============================================================================

describe("diffNodes — path correctness", () => {
  it("nested object field paths are reported correctly", () => {
    const before = s.object({ user: s.object({ name: s.string() }) });
    const after = s.object({ user: s.object({ name: s.string(), age: s.number() }) });
    const r = diffNodes(before.node, after.node);
    const added = findKind(r, "field_added");
    expect(added?.path).toEqual(["user", "age"]);
  });

  it("array element changes use `[]` path segment", () => {
    const before = s.array(s.string());
    const after = s.array(s.string().min(3));
    const r = diffNodes(before.node, after.node);
    expect(r).toHaveLength(1);
    expect(r[0]?.kind).toBe("refinement_changed");
    expect(r[0]?.path).toEqual(["[]"]);
  });
});

describe("diffNodes — fail-loud on unsupported IR kinds (Master plan Decision #14)", () => {
  it.each([
    ["date", { kind: "date", variant: "isoDateTime" }],
    ["union", { kind: "union", options: [] }],
    ["recursiveRef", { kind: "recursiveRef", targetId: "com.x.Y" }],
    ["transform", { kind: "transform", source: { kind: "string" }, transformId: "t1" }],
  ])("unsupported kind `%s` on the before side throws UnsupportedNodeKindError", (label, raw) => {
    const node = raw as unknown as SchemaNode;
    try {
      diffNodes(node, s.string().node);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(UnsupportedNodeKindError);
      const err = e as UnsupportedNodeKindError;
      expect(err.code).toBe("UNSUPPORTED_NODE_KIND");
      expect(err.kind).toBe(label);
      expect(err.generator).toBe("diff");
    }
  });

  it("unsupported kind on the after side throws too", () => {
    const after = { kind: "union", options: [] } as unknown as SchemaNode;
    expect(() => diffNodes(s.string().node, after)).toThrow(
      UnsupportedNodeKindError,
    );
  });
});

describe("diffNodes — top-level kind mismatch (not a Decision #12 row)", () => {
  it("string → number → breaking via `type_changed`", () => {
    const r = diffNodes(s.string().node, s.number().node);
    expect(r).toHaveLength(1);
    expect(r[0]?.kind).toBe("type_changed");
    expect(r[0]?.severity).toBe("breaking");
    expect(r[0]?.before).toBe("string");
    expect(r[0]?.after).toBe("number");
  });

  it("object → array → breaking via `type_changed`; no recursion past the mismatch", () => {
    const r = diffNodes(s.object({ x: s.string() }).node, s.array(s.string()).node);
    expect(r).toHaveLength(1);
    expect(r[0]?.kind).toBe("type_changed");
    expect(r[0]?.severity).toBe("breaking");
  });
});

describe("diffNodes — purity", () => {
  it("function arity = 2; no filesystem reachable", () => {
    expect(diffNodes.length).toBe(2);
  });

  it("repeated calls on the same inputs produce identical results (deterministic)", () => {
    const before = s.object({ id: s.string() });
    const after = s.object({ id: s.string(), age: s.number() });
    const a = diffNodes(before.node, after.node);
    const b = diffNodes(before.node, after.node);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
