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
import { s } from "../src/index.js";
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
