import { describe, expect, it } from "vitest";
import { s } from "../../src/index.js";
import { irHash } from "../../src/ir/hash.js";

describe("irHash — content-addressed hash of canonical IR", () => {
  it("emits a 64-char lowercase hex string (sha256)", () => {
    const h = irHash(s.string().node);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("identical IR → identical hash, regardless of construction order", () => {
    const a = s.object({ a: s.string(), b: s.number() }).node;
    const b = s.object({ b: s.number(), a: s.string() }).node;
    expect(irHash(a)).toBe(irHash(b));
  });

  it("metadata-only swaps that produce identical canonical IR collapse to the same hash", () => {
    const a = s.string().id("com.x.Y").describe("d").node;
    const b = s.string().describe("d").id("com.x.Y").node;
    expect(irHash(a)).toBe(irHash(b));
  });

  it("semantic change → different hash", () => {
    expect(irHash(s.string().node)).not.toBe(irHash(s.string().min(1).node));
    expect(irHash(s.string().node)).not.toBe(irHash(s.number().node));
    expect(irHash(s.string().min(1).node)).not.toBe(
      irHash(s.string().min(2).node),
    );
  });

  it("is stable across runs (same input → same output every call)", () => {
    const node = s
      .object({ id: s.string().uuid(), age: s.number().int().min(0) })
      .node;
    const first = irHash(node);
    const second = irHash(node);
    const third = irHash(node);
    expect(first).toBe(second);
    expect(second).toBe(third);
  });
});
