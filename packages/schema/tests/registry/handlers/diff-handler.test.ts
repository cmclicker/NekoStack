/**
 * Step 9 tests for `diffHandler` — wraps Step 7's `diffNodes` and
 * computes `worstSeverity`. The change-list itself is exhaustively
 * tested in `tests/registry/diff-classifier.test.ts`; this file
 * focuses on the handler-level concerns: Result shape, worstSeverity
 * precedence, change-preservation, and unsupported-IR contract.
 */
import { describe, expect, it } from "vitest";
import { s } from "../../../src/index.js";
import { UnsupportedNodeKindError } from "../../../src/generators/errors.js";
import { diffHandler } from "../../../src/registry/handlers/diff.js";
import type { SchemaNode } from "../../../src/index.js";

// =============================================================================
// Result shape
// =============================================================================

describe("diffHandler — Result shape", () => {
  it("returns `{ success: true, data: { changes, worstSeverity } }`", () => {
    const r = diffHandler({
      before: s.string().node,
      after: s.string().node,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(Array.isArray(r.data.changes)).toBe(true);
      expect(["breaking", "additive", "cosmetic", null]).toContain(
        r.data.worstSeverity,
      );
    }
  });
});

// =============================================================================
// worstSeverity by category
// =============================================================================

describe("diffHandler — worstSeverity per locked precedence", () => {
  it("unchanged schemas → changes [], worstSeverity null", () => {
    const node = s.object({ id: s.string() }).id("com.x.X").version("1.0.0")
      .node;
    const r = diffHandler({ before: node, after: node });
    if (r.success) {
      expect(r.data.changes).toEqual([]);
      expect(r.data.worstSeverity).toBeNull();
    }
  });

  it("cosmetic-only change → worstSeverity 'cosmetic'", () => {
    const before = s.string().describe("v1").node;
    const after = s.string().describe("v2").node;
    const r = diffHandler({ before, after });
    if (r.success) {
      expect(r.data.changes.length).toBeGreaterThan(0);
      expect(r.data.changes.every((c) => c.severity === "cosmetic")).toBe(true);
      expect(r.data.worstSeverity).toBe("cosmetic");
    }
  });

  it("additive-only change → worstSeverity 'additive'", () => {
    const before = s.object({ id: s.string() }).node;
    const after = s.object({
      id: s.string(),
      name: s.string().optional(),
    }).node;
    const r = diffHandler({ before, after });
    if (r.success) {
      expect(r.data.changes.every((c) => c.severity === "additive")).toBe(
        true,
      );
      expect(r.data.worstSeverity).toBe("additive");
    }
  });

  it("breaking-only change → worstSeverity 'breaking'", () => {
    const before = s.object({ id: s.string(), name: s.string() }).node;
    const after = s.object({ id: s.string() }).node;
    const r = diffHandler({ before, after });
    if (r.success) {
      expect(r.data.changes.every((c) => c.severity === "breaking")).toBe(
        true,
      );
      expect(r.data.worstSeverity).toBe("breaking");
    }
  });
});

// =============================================================================
// worstSeverity for mixed-severity change lists (Decision #13 inheritance)
// =============================================================================

describe("diffHandler — worstSeverity is the max over mixed lists", () => {
  it("cosmetic + additive → worstSeverity 'additive'", () => {
    // Description change (cosmetic) + optional field added (additive).
    const before = s.object({ id: s.string() }).describe("v1").node;
    const after = s
      .object({ id: s.string(), name: s.string().optional() })
      .describe("v2").node;
    const r = diffHandler({ before, after });
    if (r.success) {
      const severities = r.data.changes.map((c) => c.severity);
      expect(severities).toContain("cosmetic");
      expect(severities).toContain("additive");
      expect(r.data.worstSeverity).toBe("additive");
    }
  });

  it("additive + breaking → worstSeverity 'breaking'", () => {
    // Optional field added (additive) + required field removed (breaking).
    const before = s.object({ id: s.string(), legacy: s.string() }).node;
    const after = s
      .object({ id: s.string(), name: s.string().optional() })
      .node;
    const r = diffHandler({ before, after });
    if (r.success) {
      const severities = r.data.changes.map((c) => c.severity);
      expect(severities).toContain("additive");
      expect(severities).toContain("breaking");
      expect(r.data.worstSeverity).toBe("breaking");
    }
  });

  it("cosmetic + breaking → worstSeverity 'breaking' (Decision #13 inheritance)", () => {
    // schemaVersion-only bump (cosmetic) + required field removed
    // (breaking). The Decision #13 rule says "schemaVersion change
    // paired with structural changes inherits the worst structural
    // severity" — realized here naturally because worstSeverity
    // computes the max over all changes.
    const before = s
      .object({ id: s.string(), legacy: s.string() })
      .version("1.0.0").node;
    const after = s.object({ id: s.string() }).version("2.0.0").node;
    const r = diffHandler({ before, after });
    if (r.success) {
      const severities = r.data.changes.map((c) => c.severity);
      expect(severities).toContain("cosmetic");
      expect(severities).toContain("breaking");
      expect(r.data.worstSeverity).toBe("breaking");
    }
  });

  it("cosmetic + additive + breaking → worstSeverity 'breaking'", () => {
    const before = s.object({ id: s.string(), drop: s.string() }).describe("v1")
      .node;
    const after = s
      .object({ id: s.string(), add: s.string().optional() })
      .describe("v2").node;
    const r = diffHandler({ before, after });
    if (r.success) {
      const severities = new Set(r.data.changes.map((c) => c.severity));
      expect(severities.has("cosmetic")).toBe(true);
      expect(severities.has("additive")).toBe(true);
      expect(severities.has("breaking")).toBe(true);
      expect(r.data.worstSeverity).toBe("breaking");
    }
  });
});

// =============================================================================
// Change-preservation
// =============================================================================

describe("diffHandler — change preservation", () => {
  it("preserves every DiffChange from diffNodes (identity-on-the-shape)", () => {
    const before = s.object({ id: s.string(), drop: s.string() }).node;
    const after = s
      .object({ id: s.string(), add: s.string().optional() })
      .node;
    const r = diffHandler({ before, after });
    if (r.success) {
      // Expect at least one field_added and one field_removed.
      const kinds = r.data.changes.map((c) => c.kind);
      expect(kinds).toContain("field_added");
      expect(kinds).toContain("field_removed");
    }
  });

  it("preserves paths exactly", () => {
    const before = s.object({ user: s.object({ name: s.string() }) }).node;
    const after = s.object({
      user: s.object({ name: s.string(), age: s.number() }),
    }).node;
    const r = diffHandler({ before, after });
    if (r.success) {
      const added = r.data.changes.find((c) => c.kind === "field_added");
      expect(added?.path).toEqual(["user", "age"]);
    }
  });

  it("preserves per-change `kind` + `severity` values", () => {
    const before = s.string().min(2).node;
    const after = s.string().min(5).node;
    const r = diffHandler({ before, after });
    if (r.success) {
      expect(r.data.changes).toHaveLength(1);
      expect(r.data.changes[0]?.kind).toBe("refinement_changed");
      expect(r.data.changes[0]?.severity).toBe("breaking");
    }
  });
});

// =============================================================================
// Unsupported IR contract
// =============================================================================

describe("diffHandler — unsupported IR kinds (Master plan Decision #14)", () => {
  // Per the source-level contract: diffHandler does NOT catch
  // `UnsupportedNodeKindError`. Decision #14 says "throw at the
  // boundary"; the boundary is the CLI dispatcher (Step 28+), not
  // the handler. The handler stays the uniform Result-shaped layer
  // for cases that diffNodes itself classifies; unsupported IR is
  // a separate fail-loud concern.
  it.each([
    ["date", { kind: "date", variant: "isoDateTime" }],
    ["union", { kind: "union", options: [] }],
    ["recursiveRef", { kind: "recursiveRef", targetId: "com.x.Y" }],
    ["transform", { kind: "transform", source: { kind: "string" }, transformId: "t1" }],
  ])("propagates `UnsupportedNodeKindError` from diffNodes for `%s`", (label, raw) => {
    const node = raw as unknown as SchemaNode;
    try {
      diffHandler({ before: node, after: s.string().node });
      throw new Error("expected UnsupportedNodeKindError");
    } catch (e) {
      expect(e).toBeInstanceOf(UnsupportedNodeKindError);
      const err = e as UnsupportedNodeKindError;
      expect(err.kind).toBe(label);
      expect(err.generator).toBe("diff");
    }
  });

  it("propagates for an unsupported `after` argument too", () => {
    const after = { kind: "union", options: [] } as unknown as SchemaNode;
    expect(() =>
      diffHandler({ before: s.string().node, after }),
    ).toThrow(UnsupportedNodeKindError);
  });
});

// =============================================================================
// Purity
// =============================================================================

describe("diffHandler — purity", () => {
  it("function arity = 1 (no filesystem reachable from the input)", () => {
    expect(diffHandler.length).toBe(1);
  });

  it("deterministic — repeated calls on the same inputs produce identical results", () => {
    const before = s.object({ id: s.string() }).node;
    const after = s.object({ id: s.string(), name: s.string() }).node;
    const a = diffHandler({ before, after });
    const b = diffHandler({ before, after });
    if (a.success && b.success) {
      expect(JSON.stringify(a.data)).toBe(JSON.stringify(b.data));
    }
  });
});
