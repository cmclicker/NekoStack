import { describe, expect, it } from "vitest";
import { s } from "../src/index.js";
import type {
  ArrayNode,
  EnumNode,
  LiteralNode,
  NumberNode,
  ObjectNode,
  StringNode,
} from "../src/index.js";

describe("primitive builders produce IR", () => {
  it("string()", () => {
    const node = s.string().node as StringNode;
    expect(node.kind).toBe("string");
    expect(node.refinements).toBeUndefined();
  });

  it("number()", () => {
    expect((s.number().node as NumberNode).kind).toBe("number");
  });

  it("boolean()", () => {
    expect(s.boolean().node.kind).toBe("boolean");
  });

  it("literal()", () => {
    const node = s.literal("hello").node as LiteralNode;
    expect(node).toMatchObject({ kind: "literal", value: "hello" });
  });

  it("enum()", () => {
    const node = s.enum(["red", "green", "blue"] as const).node as EnumNode;
    expect(node.kind).toBe("enum");
    expect(node.values).toEqual(["red", "green", "blue"]);
  });

  it("enum() rejects empty", () => {
    expect(() =>
      s.enum([] as unknown as readonly [string, ...string[]]),
    ).toThrow(/at least one value/);
  });
});

describe("string refinements append to IR", () => {
  it("collects min/max/email in order", () => {
    const node = s.string().min(3).max(50).email().node as StringNode;
    expect(node.refinements).toEqual([
      { kind: "portable", name: "minLength", params: { value: 3 } },
      { kind: "portable", name: "maxLength", params: { value: 50 } },
      { kind: "portable", name: "email" },
    ]);
  });

  it("regex stores source + flags as JSON-safe params", () => {
    const node = s.string().regex(/^NEKO_/i).node as StringNode;
    expect(node.refinements?.[0]).toEqual({
      kind: "portable",
      name: "regex",
      params: { source: "^NEKO_", flags: "i" },
    });
  });
});

describe("number refinements", () => {
  it("int + min + max", () => {
    const node = s.number().int().min(0).max(100).node as NumberNode;
    expect(node.refinements).toEqual([
      { kind: "portable", name: "int" },
      { kind: "portable", name: "min", params: { value: 0 } },
      { kind: "portable", name: "max", params: { value: 100 } },
    ]);
  });
});

describe("absence modifiers", () => {
  it("optional() sets modifiers.optional", () => {
    const node = s.string().optional().node;
    expect(node.modifiers?.optional).toBe(true);
    expect(node.modifiers?.nullable).toBeUndefined();
  });

  it("nullable() sets modifiers.nullable but not optional", () => {
    const node = s.string().nullable().node;
    expect(node.modifiers?.nullable).toBe(true);
    expect(node.modifiers?.optional).toBeUndefined();
  });

  it("nullish() sets both", () => {
    const node = s.string().nullish().node;
    expect(node.modifiers).toMatchObject({ optional: true, nullable: true });
  });

  it("default() sets default + optional", () => {
    const node = s.string().default("x").node;
    expect(node.modifiers).toMatchObject({
      optional: true,
      default: { value: "x" },
    });
  });
});

describe("metadata", () => {
  it("id/version/describe/deprecated stored under metadata", () => {
    const node = s
      .string()
      .id("com.nekostack.test.Slug")
      .version("1.0.0")
      .describe("A slug")
      .deprecated()
      .node;
    expect(node.metadata).toEqual({
      id: "com.nekostack.test.Slug",
      version: "1.0.0",
      description: "A slug",
      deprecated: true,
    });
  });
});

describe("array builder", () => {
  it("wraps element IR", () => {
    const node = s.array(s.number().int()).node as ArrayNode;
    expect(node.kind).toBe("array");
    expect(node.element.kind).toBe("number");
    expect(node.element.refinements).toEqual([
      { kind: "portable", name: "int" },
    ]);
  });

  it("min/max items", () => {
    const node = s.array(s.string()).min(1).max(10).node as ArrayNode;
    expect(node.refinements).toEqual([
      { kind: "portable", name: "minItems", params: { value: 1 } },
      { kind: "portable", name: "maxItems", params: { value: 10 } },
    ]);
  });
});

describe("object builder", () => {
  const User = s.object({
    id: s.string().uuid(),
    email: s.string().email(),
    nickname: s.string().optional(),
    age: s.number().int().min(0).default(0),
  });

  it("emits ObjectNode with strict unknown-key policy by default", () => {
    const node = User.node as ObjectNode;
    expect(node.kind).toBe("object");
    expect(node.unknownKeys).toBe("strict");
  });

  it("includes every field's IR", () => {
    const node = User.node as ObjectNode;
    expect(Object.keys(node.fields).sort()).toEqual([
      "age",
      "email",
      "id",
      "nickname",
    ]);
    expect(node.fields.nickname?.modifiers?.optional).toBe(true);
  });

  it("strict() / stripUnknown() / passthrough() switch policy", () => {
    expect((User.stripUnknown().node as ObjectNode).unknownKeys).toBe(
      "stripUnknown",
    );
    expect((User.passthrough().node as ObjectNode).unknownKeys).toBe(
      "passthrough",
    );
    expect((User.passthrough().strict().node as ObjectNode).unknownKeys).toBe(
      "strict",
    );
  });
});

describe("immutability", () => {
  it("returned IR is frozen", () => {
    const node = s.string().min(3).node;
    expect(Object.isFrozen(node)).toBe(true);
    expect(Object.isFrozen(node.refinements)).toBe(true);
  });

  it("chaining does not mutate prior schemas", () => {
    const base = s.string();
    const withMin = base.min(3);
    expect(base.node.refinements).toBeUndefined();
    expect(withMin.node.refinements).toHaveLength(1);
  });

  it("mutation attempts throw in strict mode", () => {
    const node = s.string().node as { kind: string };
    expect(() => {
      node.kind = "number";
    }).toThrow(TypeError);
  });

  it("nested IR (object fields, array element) is also frozen", () => {
    const user = s.object({ id: s.string(), tags: s.array(s.string()) }).node;
    expect(Object.isFrozen(user)).toBe(true);
    const obj = user as ObjectNode;
    expect(Object.isFrozen(obj.fields)).toBe(true);
    expect(Object.isFrozen(obj.fields.id)).toBe(true);
    const arr = obj.fields.tags as ArrayNode;
    expect(Object.isFrozen(arr.element)).toBe(true);
  });
});
