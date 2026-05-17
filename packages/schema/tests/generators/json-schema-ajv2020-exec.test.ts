import { describe, expect, it } from "vitest";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { ValidateFunction } from "ajv";
import { s } from "../../src/index.js";
import { generateJsonSchema } from "../../src/generators/json-schema.js";
import type { SchemaNode } from "../../src/index.js";

/**
 * Execution: compile generated JSON Schema with Ajv2020 and run it against
 * fixtures from the v0.2 absence-semantics matrix. Proves the generated
 * schema accepts/rejects per the IR's intent (within JSON Schema's
 * expressive limits — defaults are NOT applied at validation time, per
 * Decision #9).
 *
 * NB: ajv-formats is needed for `format: "email"`, `"uuid"`, `"uri"` — Ajv
 * does not implement format keywords by default in strict mode.
 */

function compile(node: SchemaNode): ValidateFunction {
  const ajv = new Ajv2020({ strict: false });
  addFormats(ajv);
  const schema = JSON.parse(generateJsonSchema(node));
  return ajv.compile(schema);
}

describe("Ajv2020 exec — primitives + refinements", () => {
  it("string accepts strings, rejects numbers", () => {
    const v = compile(s.string().id("com.x.Y").version("1").node);
    expect(v("hello")).toBe(true);
    expect(v(42)).toBe(false);
  });

  it("string().min(3) enforces minimum length", () => {
    const v = compile(s.string().min(3).id("com.x.Y").version("1").node);
    expect(v("ab")).toBe(false);
    expect(v("abc")).toBe(true);
  });

  it("string().email() enforces format (via ajv-formats)", () => {
    const v = compile(s.string().email().id("com.x.Y").version("1").node);
    expect(v("not-email")).toBe(false);
    expect(v("a@b.co")).toBe(true);
  });

  it("number().int().min(0).max(100)", () => {
    const v = compile(s.number().int().min(0).max(100).id("com.x.Y").version("1").node);
    expect(v(50)).toBe(true);
    expect(v(50.5)).toBe(false);
    expect(v(-1)).toBe(false);
    expect(v(101)).toBe(false);
  });

  it("regex without flags emits pattern", () => {
    const v = compile(s.string().regex(/^abc$/).id("com.x.Y").version("1").node);
    expect(v("abc")).toBe(true);
    expect(v("ABC")).toBe(false); // no case-insensitivity since no flags
  });
});

describe("Ajv2020 exec — absence semantics parity with v0.1", () => {
  const node = s
    .object({
      name: s.string(),
      nickname: s.string().optional(),
      bio: s.string().nullable(),
      handle: s.string().nullish(),
      role: s.string().default("member"),
    })
    .id("com.x.User")
    .version("1.0.0").node;
  const v = compile(node);

  it("missing required field → reject", () => {
    expect(v({ bio: null })).toBe(false); // missing 'name'
  });

  it("optional field can be missing", () => {
    expect(v({ name: "a", bio: null })).toBe(true);
  });

  it("nullable field requires presence — null OK, missing rejected", () => {
    expect(v({ name: "a" })).toBe(false); // bio missing
    expect(v({ name: "a", bio: null })).toBe(true);
  });

  it("nullish field accepts missing OR null", () => {
    expect(v({ name: "a", bio: null })).toBe(true);
    expect(v({ name: "a", bio: null, handle: null })).toBe(true);
    expect(v({ name: "a", bio: null, handle: "h" })).toBe(true);
  });

  it("default field: missing input accepted (JSON Schema treats default as annotation)", () => {
    expect(v({ name: "a", bio: null })).toBe(true);
  });

  it("default field: explicit value accepted", () => {
    expect(v({ name: "a", bio: null, role: "admin" })).toBe(true);
  });

  it("strict object: unknown key rejected", () => {
    expect(v({ name: "a", bio: null, surprise: 42 })).toBe(false);
  });
});

describe("Ajv2020 exec — object policy", () => {
  it("strict rejects unknown keys", () => {
    const v = compile(
      s.object({ id: s.string() }).id("com.x.Y").version("1").node,
    );
    expect(v({ id: "x" })).toBe(true);
    expect(v({ id: "x", extra: 1 })).toBe(false);
  });

  it("passthrough accepts unknown keys", () => {
    const v = compile(
      s.object({ id: s.string() }).passthrough().id("com.x.Y").version("1").node,
    );
    expect(v({ id: "x", extra: 1 })).toBe(true);
  });

  it("stripUnknown ACCEPTS unknown keys (corrected mapping — Decision #12)", () => {
    // The schema accepts them; the NekoStack runtime is responsible for
    // actually stripping. JSON Schema can't express mutation.
    const v = compile(
      s.object({ id: s.string() }).stripUnknown().id("com.x.Y").version("1").node,
    );
    expect(v({ id: "x", extra: 1 })).toBe(true);
  });
});

describe("Ajv2020 exec — enum", () => {
  it("string enum accepts listed values, rejects others", () => {
    const v = compile(
      s.enum(["red", "green", "blue"] as const).id("com.x.Y").version("1").node,
    );
    expect(v("red")).toBe(true);
    expect(v("yellow")).toBe(false);
  });
});

describe("Ajv2020 exec — literal", () => {
  it("literal accepts only the literal value", () => {
    const v = compile(s.literal("admin").id("com.x.Y").version("1").node);
    expect(v("admin")).toBe(true);
    expect(v("user")).toBe(false);
  });
});
