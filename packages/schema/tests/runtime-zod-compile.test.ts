/**
 * Smoke tests for the runtime Zod compiler (v0.6 Decision #6).
 *
 * Proves that `compileZodSchema(node)` produces a working Zod schema —
 * the value consumer of the shared semantic mapping in
 * `src/generators/zod-mapping.ts`. Lives separately from the source
 * generator's snapshot tests so each consumer is independently
 * validated.
 *
 * Scope is intentionally narrow: one assertion per IR construct that
 * the value consumer can build something Zod actually accepts/rejects
 * correctly. The full runtime API (`parse` / `safeParse` / `validate`)
 * and the semantic-parity matrix land in later commits.
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { s, UnsupportedNodeKindError, type SchemaNode } from "../src/index.js";
import {
  compileZodSchema,
  irToZodSchema,
} from "../src/runtime/zod-compile.js";

describe("compileZodSchema — base producers", () => {
  it("string accepts strings, rejects non-strings", () => {
    const schema = compileZodSchema(s.string().node);
    expect(schema.safeParse("hello").success).toBe(true);
    expect(schema.safeParse(42).success).toBe(false);
  });

  it("number accepts numbers, rejects strings", () => {
    const schema = compileZodSchema(s.number().node);
    expect(schema.safeParse(1).success).toBe(true);
    expect(schema.safeParse("1").success).toBe(false);
  });

  it("boolean accepts booleans only", () => {
    const schema = compileZodSchema(s.boolean().node);
    expect(schema.safeParse(true).success).toBe(true);
    expect(schema.safeParse(1).success).toBe(false);
  });

  it("literal accepts only the literal value", () => {
    const schema = compileZodSchema(s.literal("ok").node);
    expect(schema.safeParse("ok").success).toBe(true);
    expect(schema.safeParse("nope").success).toBe(false);
  });

  it("string enum accepts member, rejects non-member", () => {
    const schema = compileZodSchema(s.enum(["a", "b", "c"]).node);
    expect(schema.safeParse("a").success).toBe(true);
    expect(schema.safeParse("z").success).toBe(false);
  });

  it("array of strings validates element type", () => {
    const schema = compileZodSchema(s.array(s.string()).node);
    expect(schema.safeParse(["x", "y"]).success).toBe(true);
    expect(schema.safeParse(["x", 1]).success).toBe(false);
  });
});

describe("compileZodSchema — portable refinements", () => {
  it("string min/max", () => {
    const schema = compileZodSchema(s.string().min(2).max(4).node);
    expect(schema.safeParse("ab").success).toBe(true);
    expect(schema.safeParse("a").success).toBe(false);
    expect(schema.safeParse("abcde").success).toBe(false);
  });

  it("number int + min/max", () => {
    const schema = compileZodSchema(s.number().int().min(0).max(10).node);
    expect(schema.safeParse(5).success).toBe(true);
    expect(schema.safeParse(5.5).success).toBe(false);
    expect(schema.safeParse(-1).success).toBe(false);
    expect(schema.safeParse(11).success).toBe(false);
  });

  it("string regex", () => {
    const schema = compileZodSchema(s.string().regex(/^foo/).node);
    expect(schema.safeParse("foobar").success).toBe(true);
    expect(schema.safeParse("bar").success).toBe(false);
  });

  it("email", () => {
    const schema = compileZodSchema(s.string().email().node);
    expect(schema.safeParse("a@b.co").success).toBe(true);
    expect(schema.safeParse("nope").success).toBe(false);
  });
});

describe("compileZodSchema — modifier ordering", () => {
  it("optional permits absence inside an object", () => {
    const schema = compileZodSchema(
      s.object({ name: s.string().optional() }).node,
    );
    expect(schema.safeParse({}).success).toBe(true);
    expect(schema.safeParse({ name: "x" }).success).toBe(true);
    expect(schema.safeParse({ name: 1 }).success).toBe(false);
  });

  it("nullable permits null", () => {
    const schema = compileZodSchema(s.string().nullable().node);
    expect(schema.safeParse(null).success).toBe(true);
    expect(schema.safeParse("x").success).toBe(true);
    expect(schema.safeParse(undefined).success).toBe(false);
  });

  it("nullish permits null AND absence", () => {
    const schema = compileZodSchema(
      s.object({ name: s.string().nullish() }).node,
    );
    expect(schema.safeParse({ name: null }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(true);
  });

  it("default fills missing input", () => {
    const schema = compileZodSchema(
      s.object({ name: s.string().default("anon") }).node,
    );
    const r = schema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ name: "anon" });
  });
});

describe("compileZodSchema — object policies", () => {
  it("strict rejects unknown keys", () => {
    const schema = compileZodSchema(s.object({ id: s.string() }).node);
    expect(schema.safeParse({ id: "x" }).success).toBe(true);
    expect(schema.safeParse({ id: "x", extra: 1 }).success).toBe(false);
  });

  it("passthrough preserves unknown keys", () => {
    const schema = compileZodSchema(
      s.object({ id: s.string() }).passthrough().node,
    );
    const r = schema.safeParse({ id: "x", extra: 1 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ id: "x", extra: 1 });
  });

  it("stripUnknown drops unknown keys", () => {
    const schema = compileZodSchema(
      s.object({ id: s.string() }).stripUnknown().node,
    );
    const r = schema.safeParse({ id: "x", extra: 1 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ id: "x" });
  });
});

describe("compileZodSchema — nested + composed schemas", () => {
  it("nested object", () => {
    const schema = compileZodSchema(
      s.object({
        user: s.object({ id: s.string(), tags: s.array(s.string()) }),
        count: s.number().int(),
      }).node,
    );
    expect(
      schema.safeParse({ user: { id: "u1", tags: ["t"] }, count: 3 }).success,
    ).toBe(true);
    expect(schema.safeParse({ user: { id: "u1", tags: [1] }, count: 3 }).success).toBe(
      false,
    );
  });

  it("composed via extend produces an equivalent validator", () => {
    const Base = s.object({ id: s.string() });
    const Extended = Base.extend({ name: s.string() });
    const schema = compileZodSchema(Extended.node);
    expect(schema.safeParse({ id: "x", name: "n" }).success).toBe(true);
    expect(schema.safeParse({ id: "x" }).success).toBe(false);
  });
});

describe("compileZodSchema — portable refinements (hardening)", () => {
  it("string length matches exact length only", () => {
    const schema = compileZodSchema(s.string().length(3).node);
    expect(schema.safeParse("abc").success).toBe(true);
    expect(schema.safeParse("ab").success).toBe(false);
    expect(schema.safeParse("abcd").success).toBe(false);
  });

  it("string uuid accepts a v4 uuid, rejects non-uuids", () => {
    const schema = compileZodSchema(s.string().uuid().node);
    expect(schema.safeParse("11111111-2222-4333-8444-555555555555").success).toBe(true);
    expect(schema.safeParse("not-a-uuid").success).toBe(false);
  });

  it("string url accepts a valid URL, rejects bare strings", () => {
    const schema = compileZodSchema(s.string().url().node);
    expect(schema.safeParse("https://example.com").success).toBe(true);
    expect(schema.safeParse("example").success).toBe(false);
  });

  it("number gt is strict — boundary is rejected", () => {
    const schema = compileZodSchema(s.number().gt(0).node);
    expect(schema.safeParse(1).success).toBe(true);
    expect(schema.safeParse(0).success).toBe(false);
    expect(schema.safeParse(-1).success).toBe(false);
  });

  it("number lt is strict — boundary is rejected", () => {
    const schema = compileZodSchema(s.number().lt(10).node);
    expect(schema.safeParse(9).success).toBe(true);
    expect(schema.safeParse(10).success).toBe(false);
    expect(schema.safeParse(11).success).toBe(false);
  });

  it("number multipleOf accepts multiples, rejects non-multiples", () => {
    const schema = compileZodSchema(s.number().multipleOf(5).node);
    expect(schema.safeParse(0).success).toBe(true);
    expect(schema.safeParse(15).success).toBe(true);
    expect(schema.safeParse(7).success).toBe(false);
  });

  it("array min/max enforce item counts", () => {
    const schema = compileZodSchema(s.array(s.string()).min(2).max(4).node);
    expect(schema.safeParse(["a", "b"]).success).toBe(true);
    expect(schema.safeParse(["a", "b", "c", "d"]).success).toBe(true);
    expect(schema.safeParse(["a"]).success).toBe(false);
    expect(schema.safeParse(["a", "b", "c", "d", "e"]).success).toBe(false);
  });
});

describe("compileZodSchema — enum edge cases", () => {
  it("single non-string enum collapses to z.literal", () => {
    // Length === 1, non-string — the shared traversal routes through
    // enumSingleLiteralBase, since z.union requires >= 2 options.
    const schema = compileZodSchema(s.enum([42]).node);
    expect(schema.safeParse(42).success).toBe(true);
    expect(schema.safeParse(43).success).toBe(false);
    expect(schema.safeParse("42").success).toBe(false);
  });

  it("numeric enum (>= 2 values) becomes a union of literals", () => {
    const schema = compileZodSchema(s.enum([1, 2, 3]).node);
    expect(schema.safeParse(1).success).toBe(true);
    expect(schema.safeParse(2).success).toBe(true);
    expect(schema.safeParse(4).success).toBe(false);
    expect(schema.safeParse("1").success).toBe(false);
  });

  it("mixed string/numeric enum (hand-crafted IR) becomes a union", () => {
    // The builder type signature forbids mixed enums, but the IR allows
    // them — emitEnum routes mixed (not-all-strings, len >= 2) through
    // enumUnionBase.
    const node = {
      kind: "enum",
      values: ["a", 1, "b"],
    } as unknown as SchemaNode;
    const schema = compileZodSchema(node);
    expect(schema.safeParse("a").success).toBe(true);
    expect(schema.safeParse(1).success).toBe(true);
    expect(schema.safeParse("b").success).toBe(true);
    expect(schema.safeParse("c").success).toBe(false);
    expect(schema.safeParse(2).success).toBe(false);
  });
});

describe("compileZodSchema — metadata", () => {
  it("describe survives as the compiled Zod schema's description", () => {
    const schema = compileZodSchema(s.string().describe("a user id").node);
    expect(schema.description).toBe("a user id");
    // Behavior is unaffected by metadata.
    expect(schema.safeParse("x").success).toBe(true);
  });
});

describe("compileZodSchema — fail-loud throws (Invariant 7)", () => {
  it("runtime refinement throws UnsupportedNodeKindError", () => {
    // Builders don't produce runtime refinements yet, but the IR allows
    // them. The value consumer must fail loudly — silently dropping one
    // would compile a validator that accepts inputs the IR intends to
    // reject.
    const node = {
      kind: "string",
      refinements: [{ kind: "runtime", code: "invalid_tenant_slug" }],
    } as unknown as SchemaNode;
    try {
      compileZodSchema(node);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(UnsupportedNodeKindError);
      const err = e as UnsupportedNodeKindError;
      expect(err.code).toBe("UNSUPPORTED_NODE_KIND");
      expect(err.kind).toBe("runtimeRefinement");
      expect(err.generator).toBe("zod");
    }
  });

  it.each([
    ["date", { kind: "date", variant: "isoDateTime" }],
    ["union", { kind: "union", options: [] }],
    ["recursiveRef", { kind: "recursiveRef", targetId: "com.x.Y" }],
    ["transform", { kind: "transform", source: { kind: "string" }, transformId: "t1" }],
  ])("future IR kind '%s' throws UnsupportedNodeKindError", (kind, raw) => {
    const node = raw as unknown as SchemaNode;
    try {
      compileZodSchema(node);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(UnsupportedNodeKindError);
      const err = e as UnsupportedNodeKindError;
      expect(err.code).toBe("UNSUPPORTED_NODE_KIND");
      expect(err.kind).toBe(kind);
      expect(err.generator).toBe("zod");
    }
  });
});

describe("compileZodSchema — invariants", () => {
  it("returns a Zod schema instance (zod 3.x ZodType)", () => {
    const schema = compileZodSchema(s.string().node);
    expect(schema).toBeInstanceOf(z.ZodType);
  });

  it("irToZodSchema is an alias for compileZodSchema", () => {
    expect(irToZodSchema).toBe(compileZodSchema);
  });

  it("does not mutate the input IR", () => {
    const node = s.object({ id: s.string() }).node;
    const beforeJson = JSON.stringify(node);
    compileZodSchema(node);
    expect(JSON.stringify(node)).toBe(beforeJson);
  });
});
