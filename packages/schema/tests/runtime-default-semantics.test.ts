/**
 * Step 7 gap-fill — canonical default-semantics tests.
 *
 * The load-bearing v0.6 split: parse/safeParse fill defaults;
 * validate accepts the absence but does NOT fill. This file is the
 * canonical place to verify that contract holds across the matrix
 * of "missing default-bearing field" and "explicitly provided
 * default-bearing field."
 *
 * Absence-semantics aside (covered in runtime-absence-semantics.test.ts):
 * here we focus on the fill / no-fill divergence specifically.
 */
import { describe, expect, it } from "vitest";
import { s } from "../src/index.js";
import { parse, safeParse, validate } from "../src/runtime/parse.js";

const Schema = s.object({ name: s.string().default("anon") });

describe("parse / safeParse fill defaults", () => {
  it("parse fills the default for a missing default-bearing field", () => {
    expect(parse(Schema, {})).toEqual({ name: "anon" });
  });

  it("safeParse fills the default on success", () => {
    const r = safeParse(Schema, {});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ name: "anon" });
  });

  it("parse leaves an explicitly provided value untouched", () => {
    expect(parse(Schema, { name: "rin" })).toEqual({ name: "rin" });
  });

  it("safeParse leaves an explicitly provided value untouched", () => {
    const r = safeParse(Schema, { name: "rin" });
    if (r.success) expect(r.data).toEqual({ name: "rin" });
  });
});

describe("validate accepts missing defaults but does NOT fill", () => {
  it("validate accepts the absence of a default-bearing field", () => {
    const r = validate(Schema, {});
    expect(r.success).toBe(true);
  });

  it("validate returns the input shape unchanged — no fill", () => {
    const r = validate(Schema, {});
    if (r.success) {
      expect(r.data).toEqual({});
      expect("name" in r.data).toBe(false);
    }
  });

  it("validate preserves an explicitly provided default-bearing value", () => {
    const r = validate(Schema, { name: "rin" });
    if (r.success) expect(r.data).toEqual({ name: "rin" });
  });

  it("validate preserves an explicitly provided value even if it matches the default", () => {
    // No special-casing of "value equals default" — validate is a
    // structural check, not a diff against the default.
    const r = validate(Schema, { name: "anon" });
    if (r.success) expect(r.data).toEqual({ name: "anon" });
  });
});

describe("divergence — same schema, same input, different contracts", () => {
  it("parse fills, validate does not, on the identical empty input", () => {
    const parsed = parse(Schema, {});
    const validated = validate(Schema, {});
    expect(parsed).toEqual({ name: "anon" });
    if (validated.success) {
      expect(validated.data).toEqual({});
      expect(validated.data).not.toEqual(parsed);
    }
  });

  it("parse + validate agree when an explicit value is provided", () => {
    const parsed = parse(Schema, { name: "rin" });
    const validated = validate(Schema, { name: "rin" });
    if (validated.success) {
      expect(parsed).toEqual({ name: "rin" });
      expect(validated.data).toEqual({ name: "rin" });
    }
  });
});

describe("default-fill plays well with other modifiers", () => {
  it("default + nullable: parse fills missing, validate does not; both accept null", () => {
    const S = s.object({ name: s.string().nullable().default("anon") });
    expect(parse(S, {})).toEqual({ name: "anon" });
    const v = validate(S, {});
    if (v.success) expect(v.data).toEqual({});
    expect(parse(S, { name: null })).toEqual({ name: null });
    const vn = validate(S, { name: null });
    if (vn.success) expect(vn.data).toEqual({ name: null });
  });

  it("multiple default-bearing fields fill independently", () => {
    const S = s.object({
      a: s.string().default("A"),
      b: s.string().default("B"),
    });
    expect(parse(S, {})).toEqual({ a: "A", b: "B" });
    expect(parse(S, { a: "x" })).toEqual({ a: "x", b: "B" });
    const v = validate(S, {});
    if (v.success) expect(v.data).toEqual({});
    const v2 = validate(S, { a: "x" });
    if (v2.success) expect(v2.data).toEqual({ a: "x" });
  });
});
