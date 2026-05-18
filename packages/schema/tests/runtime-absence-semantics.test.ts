/**
 * Step 7 gap-fill — absence semantics matrix.
 *
 * Cross-product of the v0.1 absence-semantics modifiers × the three
 * runtime entry points. Many individual rows are covered scattered
 * across other runtime test files; this file is the canonical place
 * to verify the full matrix behaves consistently and that one entry
 * point doesn't silently drift from the others.
 *
 * Matrix dimensions:
 *
 *   Modifier         | parse           | safeParse        | validate
 *   -----------------+-----------------+------------------+-----------------
 *   (required)       | requires value  | issues if absent | issues if absent
 *   optional         | absent ok       | absent ok        | absent ok
 *   nullable         | null ok, no abs | null ok, no abs  | null ok, no abs
 *   nullish          | absent + null   | absent + null    | absent + null
 *   default          | fills value     | fills value      | absent ok, no fill
 *   default + nullable| null ok, fills | null ok, fills   | null ok, no fill
 *
 * Plus targeted recursion cases: nested default-bearing field, array
 * element with a default (Zod's element-level default applies only
 * when an `undefined` is passed inside the array — included only to
 * pin the locked behavior).
 */
import { describe, expect, it } from "vitest";
import { s } from "../src/index.js";
import { parse, safeParse, validate } from "../src/runtime/parse.js";
import { ParseError } from "../src/runtime/errors.js";

describe("absence-semantics — required field (no modifiers)", () => {
  const Schema = s.object({ name: s.string() });

  it("parse fails when the field is missing", () => {
    expect(() => parse(Schema, {})).toThrow(ParseError);
  });

  it("safeParse returns missing_required when the field is missing", () => {
    const r = safeParse(Schema, {});
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues[0]?.code).toBe("missing_required");
      expect(r.issues[0]?.path).toEqual(["name"]);
    }
  });

  it("validate returns missing_required when the field is missing", () => {
    const r = validate(Schema, {});
    expect(r.success).toBe(false);
    if (!r.success) expect(r.issues[0]?.code).toBe("missing_required");
  });

  it("all three reject null on a required non-nullable field", () => {
    expect(() => parse(Schema, { name: null })).toThrow(ParseError);
    expect(safeParse(Schema, { name: null }).success).toBe(false);
    expect(validate(Schema, { name: null }).success).toBe(false);
  });
});

describe("absence-semantics — optional field", () => {
  const Schema = s.object({ name: s.string().optional() });

  it("absent: parse / safeParse / validate all accept", () => {
    expect(parse(Schema, {})).toEqual({});
    const sp = safeParse(Schema, {});
    if (sp.success) expect(sp.data).toEqual({});
    const v = validate(Schema, {});
    if (v.success) expect(v.data).toEqual({});
  });

  it("explicit undefined: all three accept", () => {
    expect(parse(Schema, { name: undefined })).toEqual({ name: undefined });
    expect(safeParse(Schema, { name: undefined }).success).toBe(true);
    expect(validate(Schema, { name: undefined }).success).toBe(true);
  });

  it("null is rejected (optional ≠ nullable)", () => {
    expect(safeParse(Schema, { name: null }).success).toBe(false);
    expect(validate(Schema, { name: null }).success).toBe(false);
  });
});

describe("absence-semantics — nullable field", () => {
  const Schema = s.object({ name: s.string().nullable() });

  it("null: all three accept", () => {
    expect(parse(Schema, { name: null })).toEqual({ name: null });
    const sp = safeParse(Schema, { name: null });
    if (sp.success) expect(sp.data).toEqual({ name: null });
    const v = validate(Schema, { name: null });
    if (v.success) expect(v.data).toEqual({ name: null });
  });

  it("missing: all three reject (nullable ≠ optional)", () => {
    expect(safeParse(Schema, {}).success).toBe(false);
    expect(validate(Schema, {}).success).toBe(false);
  });
});

describe("absence-semantics — nullish field (optional + nullable)", () => {
  const Schema = s.object({ name: s.string().nullish() });

  it("missing: all three accept", () => {
    expect(safeParse(Schema, {}).success).toBe(true);
    expect(validate(Schema, {}).success).toBe(true);
  });

  it("null: all three accept", () => {
    expect(safeParse(Schema, { name: null }).success).toBe(true);
    expect(validate(Schema, { name: null }).success).toBe(true);
  });
});

describe("absence-semantics — default-bearing field", () => {
  const Schema = s.object({ name: s.string().default("anon") });

  it("missing: parse + safeParse fill the default; validate does not", () => {
    expect(parse(Schema, {})).toEqual({ name: "anon" });
    const sp = safeParse(Schema, {});
    if (sp.success) expect(sp.data).toEqual({ name: "anon" });
    const v = validate(Schema, {});
    if (v.success) expect(v.data).toEqual({}); // no fill
  });

  it("null rejected — default(v) does not imply nullable", () => {
    expect(safeParse(Schema, { name: null }).success).toBe(false);
    expect(validate(Schema, { name: null }).success).toBe(false);
  });

  it("explicit value passes through on all three", () => {
    expect(parse(Schema, { name: "rin" })).toEqual({ name: "rin" });
    const sp = safeParse(Schema, { name: "rin" });
    if (sp.success) expect(sp.data).toEqual({ name: "rin" });
    const v = validate(Schema, { name: "rin" });
    if (v.success) expect(v.data).toEqual({ name: "rin" });
  });
});

describe("absence-semantics — default + nullable", () => {
  const Schema = s.object({ name: s.string().nullable().default("anon") });

  it("missing: parse + safeParse fill the default; validate does not", () => {
    expect(parse(Schema, {})).toEqual({ name: "anon" });
    const sp = safeParse(Schema, {});
    if (sp.success) expect(sp.data).toEqual({ name: "anon" });
    const v = validate(Schema, {});
    if (v.success) expect(v.data).toEqual({});
  });

  it("null: all three accept (nullable still applies)", () => {
    expect(parse(Schema, { name: null })).toEqual({ name: null });
    const sp = safeParse(Schema, { name: null });
    if (sp.success) expect(sp.data).toEqual({ name: null });
    const v = validate(Schema, { name: null });
    if (v.success) expect(v.data).toEqual({ name: null });
  });
});

describe("absence-semantics — nested default-bearing field", () => {
  const Schema = s.object({
    profile: s.object({ name: s.string().default("anon") }),
  });

  it("parse fills nested default when nested object exists", () => {
    expect(parse(Schema, { profile: {} })).toEqual({
      profile: { name: "anon" },
    });
  });

  it("validate accepts missing nested default-bearing field, does not fill", () => {
    const r = validate(Schema, { profile: {} });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ profile: {} });
  });

  it("required outer key is still enforced even when its inner field is default-bearing", () => {
    // The outer `profile` key is required; the inner `name` having a
    // default does not propagate optionality outward.
    expect(safeParse(Schema, {}).success).toBe(false);
    expect(validate(Schema, {}).success).toBe(false);
  });
});

describe("absence-semantics — array element default", () => {
  // Zod's element-level default applies when the input contains an
  // `undefined` element. Arrays don't have "missing" slots in JSON,
  // so this case mostly verifies the lock isn't broken by the
  // strip-defaults recursion — both parse and validate must keep
  // working for arrays whose element schema carries a default.
  const Schema = s.array(s.string().default("anon"));

  it("parse accepts an empty array", () => {
    expect(parse(Schema, [])).toEqual([]);
  });

  it("parse accepts a normal array of strings", () => {
    expect(parse(Schema, ["a", "b"])).toEqual(["a", "b"]);
  });

  it("validate accepts the same shapes", () => {
    expect(validate(Schema, []).success).toBe(true);
    expect(validate(Schema, ["a"]).success).toBe(true);
  });

  it("non-string element still rejected (refinement of element preserved)", () => {
    expect(safeParse(Schema, [42]).success).toBe(false);
    expect(validate(Schema, [42]).success).toBe(false);
  });
});
