import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { ZodTypeAny } from "zod";
import { s } from "../../src/index.js";
import { generateZod } from "../../src/generators/zod.js";
import type { SchemaNode } from "../../src/index.js";

/**
 * Load the code produced by `generateZod` into a real Zod runtime and return
 * the resulting `ZodTypeAny`. Proves that what we emit is not just text but
 * actually executes and validates per the v0.1 absence-semantics contract.
 *
 * Approach: strip the import + extract the const expression, then evaluate
 * it via `new Function("z", "return <expr>;")` with our imported `z` in
 * scope. No tmp files, no dynamic-import gymnastics.
 */
function executeZod(node: SchemaNode): ZodTypeAny {
  const code = generateZod(node);
  const match = code.match(/export const \w+ = ([\s\S]*?);\s*$/);
  if (!match) throw new Error("Generated code missing const declaration");
  // Strip TS-only `as const` so the expression is valid plain JS for
  // `new Function`. The generator emits it for the published .ts file's
  // type-inference precision; runtime Zod is happy without it.
  const expr = match[1]!.replace(/\s+as\s+const\b/g, "");
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const fn = new Function("z", `return (${expr});`) as (
    z: typeof import("zod").z,
  ) => ZodTypeAny;
  return fn(z);
}

describe("Zod execution — primitives + refinements", () => {
  it("string accepts strings, rejects numbers", () => {
    const zSchema = executeZod(s.string().node);
    expect(zSchema.safeParse("hello").success).toBe(true);
    expect(zSchema.safeParse(42).success).toBe(false);
  });

  it("string().min(3) enforces minimum length", () => {
    const zSchema = executeZod(s.string().min(3).node);
    expect(zSchema.safeParse("ab").success).toBe(false);
    expect(zSchema.safeParse("abc").success).toBe(true);
  });

  it("string().email() enforces format", () => {
    const zSchema = executeZod(s.string().email().node);
    expect(zSchema.safeParse("not-email").success).toBe(false);
    expect(zSchema.safeParse("a@b.co").success).toBe(true);
  });

  it("number().int().min(0).max(100) enforces all three", () => {
    const zSchema = executeZod(s.number().int().min(0).max(100).node);
    expect(zSchema.safeParse(50).success).toBe(true);
    expect(zSchema.safeParse(50.5).success).toBe(false);
    expect(zSchema.safeParse(-1).success).toBe(false);
    expect(zSchema.safeParse(101).success).toBe(false);
  });

  it("string regex with flags", () => {
    const zSchema = executeZod(s.string().regex(/^NEKO_/i).node);
    expect(zSchema.safeParse("neko_x").success).toBe(true);
    expect(zSchema.safeParse("NEKO_X").success).toBe(true);
    expect(zSchema.safeParse("other").success).toBe(false);
  });
});

describe("Zod execution — absence semantics parity with v0.1", () => {
  const User = s.object({
    name: s.string(),
    nickname: s.string().optional(),
    bio: s.string().nullable(),
    handle: s.string().nullish(),
    role: s.string().default("member"),
  }).id("com.x.User").node;

  const zUser = executeZod(User);

  it("missing required field → fail", () => {
    expect(
      zUser.safeParse({ bio: null }).success,
    ).toBe(false); // missing 'name'
  });

  it("optional field can be missing or undefined", () => {
    expect(
      zUser.safeParse({
        name: "a",
        bio: null,
        role: "x",
        // nickname missing
      }).success,
    ).toBe(true);
    expect(
      zUser.safeParse({ name: "a", bio: null, role: "x", nickname: undefined })
        .success,
    ).toBe(true);
  });

  it("nullable field requires presence — null OK, missing rejected", () => {
    // bio missing
    expect(zUser.safeParse({ name: "a", role: "x" }).success).toBe(false);
    // bio null
    expect(zUser.safeParse({ name: "a", role: "x", bio: null }).success).toBe(
      true,
    );
  });

  it("nullish field accepts missing, undefined, and null", () => {
    const base = { name: "a", bio: null, role: "x" };
    expect(zUser.safeParse({ ...base }).success).toBe(true); // missing
    expect(zUser.safeParse({ ...base, handle: undefined }).success).toBe(true);
    expect(zUser.safeParse({ ...base, handle: null }).success).toBe(true);
    expect(zUser.safeParse({ ...base, handle: "h" }).success).toBe(true);
  });

  it("default field accepts missing input and fills output", () => {
    const parsed = zUser.parse({ name: "a", bio: null });
    expect(parsed.role).toBe("member"); // default applied
  });

  it("default field also accepts an explicit value", () => {
    const parsed = zUser.parse({ name: "a", bio: null, role: "admin" });
    expect(parsed.role).toBe("admin");
  });

  it("strict object: unknown key → reject (matches v0.1 IR default)", () => {
    expect(
      zUser.safeParse({ name: "a", bio: null, role: "x", surprise: 42 })
        .success,
    ).toBe(false);
  });
});

describe("Zod execution — object policy", () => {
  it("stripUnknown strips extras", () => {
    const zSchema = executeZod(
      s.object({ id: s.string() }).stripUnknown().node,
    );
    const result = zSchema.parse({ id: "x", extra: "y" }) as Record<
      string,
      unknown
    >;
    expect(result.id).toBe("x");
    expect(result.extra).toBeUndefined();
  });

  it("passthrough keeps extras", () => {
    const zSchema = executeZod(
      s.object({ id: s.string() }).passthrough().node,
    );
    const result = zSchema.parse({ id: "x", extra: "y" }) as Record<
      string,
      unknown
    >;
    expect(result.id).toBe("x");
    expect(result.extra).toBe("y");
  });
});

describe("Zod execution — enum", () => {
  it("string enum accepts listed values, rejects others", () => {
    const zSchema = executeZod(s.enum(["red", "green", "blue"] as const).node);
    expect(zSchema.safeParse("red").success).toBe(true);
    expect(zSchema.safeParse("yellow").success).toBe(false);
  });
});

describe("Zod execution — modifier-composition matrix from Decision #8", () => {
  it("optional alone", () => {
    const z1 = executeZod(s.string().optional().node);
    expect(z1.safeParse(undefined).success).toBe(true);
    expect(z1.safeParse("x").success).toBe(true);
    expect(z1.safeParse(null).success).toBe(false);
  });

  it("nullable alone", () => {
    const z1 = executeZod(s.string().nullable().node);
    expect(z1.safeParse(null).success).toBe(true);
    expect(z1.safeParse("x").success).toBe(true);
    expect(z1.safeParse(undefined).success).toBe(false);
  });

  it("nullish alone", () => {
    const z1 = executeZod(s.string().nullish().node);
    expect(z1.safeParse(null).success).toBe(true);
    expect(z1.safeParse(undefined).success).toBe(true);
    expect(z1.safeParse("x").success).toBe(true);
  });

  it("default alone — undefined input → default applied", () => {
    const z1 = executeZod(s.string().default("x").node);
    expect(z1.parse(undefined)).toBe("x");
    expect(z1.parse("y")).toBe("y");
  });

  it("optional + default → undefined → default; explicit value preserved", () => {
    // Same shape as default alone (v0.1 default already sets optional)
    const z1 = executeZod(s.string().optional().default("x").node);
    expect(z1.parse(undefined)).toBe("x");
    expect(z1.parse("y")).toBe("y");
  });

  it("nullable + default → null preserved; undefined → default", () => {
    const z1 = executeZod(s.string().nullable().default("x").node);
    expect(z1.parse(undefined)).toBe("x");
    expect(z1.parse(null)).toBeNull();
    expect(z1.parse("y")).toBe("y");
  });

  it("nullish + default → both null and undefined accepted; undefined → default", () => {
    const z1 = executeZod(s.string().nullish().default("x").node);
    expect(z1.parse(undefined)).toBe("x");
    expect(z1.parse(null)).toBeNull();
    expect(z1.parse("y")).toBe("y");
  });
});
