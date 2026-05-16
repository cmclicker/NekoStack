import { describe, expect, it } from "vitest";
import { s, serializeIR } from "../src/index.js";

describe("serializeIR", () => {
  it("produces JSON-parseable output", () => {
    const schema = s.object({
      id: s.string().uuid(),
      count: s.number().int().min(0),
    });
    const json = serializeIR(schema.node);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("is canonical: identical IR ⇒ byte-identical output regardless of key order", () => {
    const a = s
      .object({ a: s.string(), b: s.number() })
      .id("com.nekostack.test.A")
      .describe("desc");
    const b = s
      .object({ a: s.string(), b: s.number() })
      .describe("desc")
      .id("com.nekostack.test.A");
    expect(serializeIR(a.node)).toBe(serializeIR(b.node));
  });

  it("strips undefined keys", () => {
    const json = serializeIR(s.string().node);
    expect(json).toBe('{"kind":"string"}');
  });

  it("different IR shapes produce different output (determinism only matters if it discriminates)", () => {
    const a = s.string().min(3);
    const b = s.string().min(4);
    expect(serializeIR(a.node)).not.toBe(serializeIR(b.node));
  });

  it("field-key sort applies recursively (object fields swap to same output)", () => {
    const a = serializeIR(s.object({ b: s.string(), a: s.number() }).node);
    const b = serializeIR(s.object({ a: s.number(), b: s.string() }).node);
    expect(a).toBe(b);
  });

  it("array element + refinements canonicalize", () => {
    const a = serializeIR(s.array(s.string().min(1).email()).node);
    const b = serializeIR(s.array(s.string().min(1).email()).node);
    expect(a).toBe(b);
  });
});
