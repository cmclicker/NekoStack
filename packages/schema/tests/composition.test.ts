import { describe, expect, it } from "vitest";
import { s } from "../src/index.js";
import type { ObjectNode } from "../src/index.js";

describe("ObjectSchema.extend — adds fields, throws on collision", () => {
  it("adds new fields", () => {
    const A = s.object({ id: s.string() });
    const B = A.extend({ name: s.string() });
    const fields = (B.node as ObjectNode).fields;
    expect(Object.keys(fields).sort()).toEqual(["id", "name"]);
  });

  it("throws on key collision (Decision #1)", () => {
    const A = s.object({ id: s.string() });
    expect(() => A.extend({ id: s.number() })).toThrow(/already exists/);
  });

  it("preserves the base's unknownKeys policy", () => {
    const A = s.object({ id: s.string() }).passthrough();
    const B = A.extend({ name: s.string() });
    expect((B.node as ObjectNode).unknownKeys).toBe("passthrough");
  });

  it("drops top-level metadata (Decision #11)", () => {
    const A = s.object({ id: s.string() }).id("com.x.A").version("1.0.0").describe("A");
    const B = A.extend({ name: s.string() });
    expect(B.node.metadata).toBeUndefined();
  });

  it("does NOT mutate the receiver", () => {
    const A = s.object({ id: s.string() });
    A.extend({ name: s.string() });
    expect(Object.keys((A.node as ObjectNode).fields)).toEqual(["id"]);
  });
});

describe("ObjectSchema.pick — keeps named keys, throws on unknown", () => {
  const Base = s.object({ id: s.string(), name: s.string(), age: s.number() });

  it("keeps named keys, drops others", () => {
    const Subset = Base.pick({ id: true, name: true });
    const fields = (Subset.node as ObjectNode).fields;
    expect(Object.keys(fields).sort()).toEqual(["id", "name"]);
  });

  it("throws on key not in base (Decision #5)", () => {
    // @ts-expect-error 'missing' is not a key of Base
    expect(() => Base.pick({ missing: true })).toThrow(/does not exist/);
  });

  it("preserves field-level metadata (Decision #12)", () => {
    const Base2 = s.object({
      id: s.string().describe("the id"),
      name: s.string(),
    });
    const P = Base2.pick({ id: true });
    expect((P.node as ObjectNode).fields.id?.metadata?.description).toBe("the id");
  });
});

describe("ObjectSchema.omit — drops named keys, throws on unknown", () => {
  const Base = s.object({ id: s.string(), name: s.string(), age: s.number() });

  it("drops named keys, keeps others", () => {
    const O = Base.omit({ age: true });
    const fields = (O.node as ObjectNode).fields;
    expect(Object.keys(fields).sort()).toEqual(["id", "name"]);
  });

  it("throws on key not in base", () => {
    // @ts-expect-error 'missing' is not a key of Base
    expect(() => Base.omit({ missing: true })).toThrow(/does not exist/);
  });
});

describe("ObjectSchema.partial — sets optional + strips default (Decision #6/#9)", () => {
  it("affected fields become optional", () => {
    const A = s.object({ id: s.string(), name: s.string() });
    const P = A.partial();
    const fields = (P.node as ObjectNode).fields;
    expect(fields.id?.modifiers?.optional).toBe(true);
    expect(fields.name?.modifiers?.optional).toBe(true);
  });

  it("strips default from affected fields (the symmetric rule)", () => {
    const A = s.object({ role: s.string().default("member") });
    const P = A.partial();
    const role = (P.node as ObjectNode).fields.role;
    expect(role?.modifiers?.optional).toBe(true);
    expect(role?.modifiers?.default).toBeUndefined();
  });

  it("granular form: { key: true } only touches named keys", () => {
    const A = s.object({ id: s.string(), name: s.string() });
    const P = A.partial({ id: true });
    const fields = (P.node as ObjectNode).fields;
    expect(fields.id?.modifiers?.optional).toBe(true);
    expect(fields.name?.modifiers?.optional).toBeUndefined();
  });

  it("does NOT touch nullable / nullish (Decision #10)", () => {
    const A = s.object({ x: s.string().nullable() });
    const P = A.partial();
    const x = (P.node as ObjectNode).fields.x;
    expect(x?.modifiers?.nullable).toBe(true);
    expect(x?.modifiers?.optional).toBe(true);
  });
});

describe("ObjectSchema.required — sets required + strips default (Decision #8/#9)", () => {
  it("affected fields become required", () => {
    const A = s.object({ id: s.string().optional(), name: s.string().optional() });
    const R = A.required();
    const fields = (R.node as ObjectNode).fields;
    expect(fields.id?.modifiers?.optional).toBeUndefined();
    expect(fields.name?.modifiers?.optional).toBeUndefined();
  });

  it("strips default from affected fields", () => {
    const A = s.object({ role: s.string().default("member") });
    const R = A.required();
    const role = (R.node as ObjectNode).fields.role;
    expect(role?.modifiers?.optional).toBeUndefined();
    expect(role?.modifiers?.default).toBeUndefined();
  });

  it("granular form only touches named keys", () => {
    const A = s.object({
      id: s.string().optional(),
      name: s.string().optional(),
    });
    const R = A.required({ id: true });
    const fields = (R.node as ObjectNode).fields;
    expect(fields.id?.modifiers?.optional).toBeUndefined();
    expect(fields.name?.modifiers?.optional).toBe(true);
  });

  it("preserves nullable", () => {
    const A = s.object({ x: s.string().nullable().optional() });
    const R = A.required();
    const x = (R.node as ObjectNode).fields.x;
    expect(x?.modifiers?.nullable).toBe(true);
    expect(x?.modifiers?.optional).toBeUndefined();
  });
});

describe("ObjectSchema.merge — combines, with explicit conflict + unknownKeys", () => {
  const A = s.object({ id: s.string(), shared: s.string() });
  const B = s.object({ name: s.string(), shared: s.number() });

  it("disjoint fields merge without options", () => {
    const A1 = s.object({ id: s.string() });
    const B1 = s.object({ name: s.string() });
    const M = A1.merge(B1);
    expect(Object.keys((M.node as ObjectNode).fields).sort()).toEqual(["id", "name"]);
  });

  it("throws on field conflict by default (Decision #3)", () => {
    expect(() => A.merge(B)).toThrow(/exists? in both operands/);
  });

  it("conflict: 'left' → left wins", () => {
    const M = A.merge(B, { conflict: "left" });
    const shared = (M.node as ObjectNode).fields.shared;
    expect(shared?.kind).toBe("string"); // A's type
  });

  it("conflict: 'right' → right wins", () => {
    const M = A.merge(B, { conflict: "right" });
    const shared = (M.node as ObjectNode).fields.shared;
    expect(shared?.kind).toBe("number"); // B's type
  });

  it("same unknownKeys policy on both sides: no option needed", () => {
    const A1 = s.object({ id: s.string() }).passthrough();
    const B1 = s.object({ name: s.string() }).passthrough();
    const M = A1.merge(B1);
    expect((M.node as ObjectNode).unknownKeys).toBe("passthrough");
  });

  it("throws on unknownKeys mismatch by default (Decision #13)", () => {
    const A1 = s.object({ id: s.string() }); // strict
    const B1 = s.object({ name: s.string() }).passthrough();
    expect(() => A1.merge(B1)).toThrow(/unknownKeys policies differ/);
  });

  it("unknownKeys: 'left' resolves a mismatch", () => {
    const A1 = s.object({ id: s.string() }); // strict
    const B1 = s.object({ name: s.string() }).passthrough();
    const M = A1.merge(B1, { unknownKeys: "left" });
    expect((M.node as ObjectNode).unknownKeys).toBe("strict");
  });

  it("unknownKeys: 'right' resolves a mismatch (no conflict knob needed)", () => {
    const A1 = s.object({ id: s.string() });
    const B1 = s.object({ name: s.string() }).passthrough();
    const M = A1.merge(B1, { unknownKeys: "right" });
    expect((M.node as ObjectNode).unknownKeys).toBe("passthrough");
  });

  it("conflict + unknownKeys can both be set", () => {
    const M = A.merge(B, { conflict: "right", unknownKeys: "left" });
    expect((M.node as ObjectNode).fields.shared?.kind).toBe("number");
  });

  it("drops top-level metadata", () => {
    const A1 = s.object({ id: s.string() }).id("com.x.A").version("1");
    const B1 = s.object({ name: s.string() }).id("com.x.B").version("2");
    const M = A1.merge(B1);
    expect(M.node.metadata).toBeUndefined();
  });
});

describe("ObjectSchema.override — replaces existing keys, throws on missing", () => {
  const Base = s.object({ id: s.string(), name: s.string() });

  it("replaces a field with a different schema type", () => {
    const O = Base.override({ id: s.number() });
    expect((O.node as ObjectNode).fields.id?.kind).toBe("number");
    expect((O.node as ObjectNode).fields.name?.kind).toBe("string");
  });

  it("throws on key not in base (Decision #2)", () => {
    // @ts-expect-error 'missing' is not a key of Base
    expect(() => Base.override({ missing: s.string() })).toThrow(/does not exist/);
  });

  it("preserves base unknownKeys policy", () => {
    const Base2 = Base.passthrough();
    const O = Base2.override({ id: s.number() });
    expect((O.node as ObjectNode).unknownKeys).toBe("passthrough");
  });
});
