/**
 * Step 7 gap-fill — canonical validate() behavior tests.
 *
 * `validate` is the structural-check entry point: returns
 * `Result<s.input<S>>`, does NOT apply defaults or transforms, but
 * STILL runs portable refinements (min/max/regex/email/etc.).
 * That last clause is the one most easily missed — refinements
 * survive the strip-defaults transform because they live on the
 * IR's `refinements` array, not on `modifiers.default`.
 *
 * Companion to runtime-parse.test.ts (broad smoke) and
 * runtime-absence-semantics.test.ts (absence matrix); this file
 * owns the validate-specific contract surface.
 */
import { describe, expect, it } from "vitest";
import { s } from "../src/index.js";
import { validate } from "../src/runtime/parse.js";

describe("validate — input-shape data", () => {
  it("returns the input verbatim for a default-bearing field that is provided", () => {
    const Schema = s.object({ name: s.string().default("anon") });
    const r = validate(Schema, { name: "rin" });
    if (r.success) expect(r.data).toEqual({ name: "rin" });
  });

  it("returns an empty object for a default-bearing field that is absent (no fill)", () => {
    const Schema = s.object({ name: s.string().default("anon") });
    const r = validate(Schema, {});
    if (r.success) {
      expect(r.data).toEqual({});
      expect("name" in r.data).toBe(false);
    }
  });

  it("non-default field passes through unchanged", () => {
    const Schema = s.object({ id: s.string(), age: s.number().int() });
    const r = validate(Schema, { id: "u_1", age: 30 });
    if (r.success) expect(r.data).toEqual({ id: "u_1", age: 30 });
  });
});

describe("validate — runs portable refinements", () => {
  it("string min refinement still rejects too-short input", () => {
    const Schema = s.object({ name: s.string().min(3) });
    const r = validate(Schema, { name: "ab" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.issues[0]?.code).toBe("too_small");
  });

  it("string max refinement still rejects too-long input", () => {
    const Schema = s.object({ name: s.string().max(2) });
    const r = validate(Schema, { name: "abcd" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.issues[0]?.code).toBe("too_big");
  });

  it("regex refinement still rejects non-matching input", () => {
    const Schema = s.object({ name: s.string().regex(/^foo/) });
    const r = validate(Schema, { name: "bar" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.issues[0]?.code).toBe("invalid_format");
  });

  it("email refinement still rejects non-email input", () => {
    const Schema = s.object({ email: s.string().email() });
    const r = validate(Schema, { email: "not-an-email" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues[0]?.code).toBe("invalid_format");
      expect(r.issues[0]?.metadata).toEqual({ validation: "email" });
    }
  });

  it("number int + min/max all still run", () => {
    const Schema = s.object({ age: s.number().int().min(0).max(120) });
    expect(validate(Schema, { age: 30 }).success).toBe(true);
    expect(validate(Schema, { age: 30.5 }).success).toBe(false);
    expect(validate(Schema, { age: -1 }).success).toBe(false);
    expect(validate(Schema, { age: 121 }).success).toBe(false);
  });

  it("array minItems / maxItems still run", () => {
    const Schema = s.array(s.string()).min(2).max(4);
    expect(validate(Schema, ["a", "b"]).success).toBe(true);
    expect(validate(Schema, ["a"]).success).toBe(false);
    expect(validate(Schema, ["a", "b", "c", "d", "e"]).success).toBe(false);
  });

  it("refinements still run when the field also has a default", () => {
    // The default is stripped for validate, but the refinement stays.
    const Schema = s.object({ name: s.string().min(3).default("anon") });
    const r = validate(Schema, { name: "ab" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.issues[0]?.code).toBe("too_small");
  });
});

describe("validate — failure issues normalize correctly", () => {
  it("invalid_type for wrong primitive", () => {
    const Schema = s.object({ id: s.string() });
    const r = validate(Schema, { id: 42 });
    if (!r.success) {
      expect(r.issues[0]?.code).toBe("invalid_type");
      expect(r.issues[0]?.path).toEqual(["id"]);
      expect(r.issues[0]?.expected).toBe("string");
      expect(r.issues[0]?.received).toBe("number");
    }
  });

  it("missing_required for absent non-optional field", () => {
    const Schema = s.object({ id: s.string() });
    const r = validate(Schema, {});
    if (!r.success) {
      expect(r.issues[0]?.code).toBe("missing_required");
      expect(r.issues[0]?.path).toEqual(["id"]);
    }
  });

  it("all emitted issues are severity: \"error\"", () => {
    const Schema = s.object({ a: s.string(), b: s.number() });
    const r = validate(Schema, { a: 1, b: "wrong" });
    if (!r.success) {
      for (const i of r.issues) expect(i.severity).toBe("error");
    }
  });

  it("nested paths are preserved on issues", () => {
    const Schema = s.object({
      profile: s.object({ name: s.string() }),
    });
    const r = validate(Schema, { profile: { name: 42 } });
    if (!r.success) expect(r.issues[0]?.path).toEqual(["profile", "name"]);
  });
});

describe("validate — schema metadata propagation", () => {
  it("propagates schemaId / schemaVersion onto every issue", () => {
    const Schema = s
      .object({ id: s.string(), age: s.number().int() })
      .id("com.x.User")
      .version("1.0.0");
    const r = validate(Schema, { id: 42, age: "not a number" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues.length).toBeGreaterThan(0);
      for (const i of r.issues) {
        expect(i.schemaId).toBe("com.x.User");
        expect(i.schemaVersion).toBe("1.0.0");
      }
    }
  });

  it("omits schemaId / schemaVersion when the schema has no metadata", () => {
    const Schema = s.object({ id: s.string() });
    const r = validate(Schema, { id: 42 });
    if (!r.success) {
      expect(r.issues[0]?.schemaId).toBeUndefined();
      expect(r.issues[0]?.schemaVersion).toBeUndefined();
    }
  });

  it("uses the ORIGINAL schema's metadata, not the validate variant's", () => {
    // The validate variant is created via stripDefaultsForValidate
    // which preserves metadata; either way the propagated id /
    // version come from the consumer-authored schema, not from any
    // internal transform's intermediate node.
    const Schema = s
      .object({ name: s.string().default("anon") })
      .id("com.x.WithDefault")
      .version("2.0.0");
    const r = validate(Schema, { name: 42 });
    if (!r.success) {
      expect(r.issues[0]?.schemaId).toBe("com.x.WithDefault");
      expect(r.issues[0]?.schemaVersion).toBe("2.0.0");
    }
  });
});
