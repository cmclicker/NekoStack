/**
 * Step 7 gap-fill — canonical unknown-key policy tests.
 *
 * Canonical place to verify each of the three policies (strict /
 * passthrough / stripUnknown) behaves consistently across all three
 * runtime entry points (parse / safeParse / validate), including
 * inside nested objects where the inner object carries its own
 * policy.
 *
 * Companion to runtime-parse.test.ts which has the broad smoke
 * cases; this file owns the full policy × entry-point matrix and
 * the nested case.
 */
import { describe, expect, it } from "vitest";
import { s } from "../src/index.js";
import { parse, safeParse, validate } from "../src/runtime/parse.js";
import { ParseError } from "../src/runtime/errors.js";

describe("strict (default policy) — rejects unknown keys", () => {
  const Schema = s.object({ id: s.string() });

  it("parse throws ParseError on unknown key", () => {
    expect(() => parse(Schema, { id: "x", extra: 1 })).toThrow(ParseError);
  });

  it("safeParse returns unknown_key issues (one per offending key)", () => {
    const r = safeParse(Schema, { id: "x", extra: 1, other: 2 });
    expect(r.success).toBe(false);
    if (!r.success) {
      // Zod batches; normalizeIssues splits.
      expect(r.issues).toHaveLength(2);
      expect(r.issues.every((i) => i.code === "unknown_key")).toBe(true);
      const paths = r.issues.map((i) => i.path);
      expect(paths).toContainEqual(["extra"]);
      expect(paths).toContainEqual(["other"]);
    }
  });

  it("validate returns unknown_key issues", () => {
    const r = validate(Schema, { id: "x", extra: 1 });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues[0]?.code).toBe("unknown_key");
      expect(r.issues[0]?.path).toEqual(["extra"]);
    }
  });

  it("known-only input passes all three", () => {
    expect(parse(Schema, { id: "x" })).toEqual({ id: "x" });
    expect(safeParse(Schema, { id: "x" }).success).toBe(true);
    expect(validate(Schema, { id: "x" }).success).toBe(true);
  });
});

describe("passthrough — preserves unknown keys", () => {
  const Schema = s.object({ id: s.string() }).passthrough();

  it("parse preserves unknown keys in the output", () => {
    expect(parse(Schema, { id: "x", extra: 1 })).toEqual({
      id: "x",
      extra: 1,
    });
  });

  it("safeParse preserves unknown keys in the output", () => {
    const r = safeParse(Schema, { id: "x", extra: 1 });
    if (r.success) expect(r.data).toEqual({ id: "x", extra: 1 });
  });

  it("validate preserves unknown keys in the output", () => {
    const r = validate(Schema, { id: "x", extra: 1 });
    if (r.success) expect(r.data).toEqual({ id: "x", extra: 1 });
  });
});

describe("stripUnknown — drops unknown keys", () => {
  const Schema = s.object({ id: s.string() }).stripUnknown();

  it("parse drops unknown keys from the output", () => {
    expect(parse(Schema, { id: "x", extra: 1 })).toEqual({ id: "x" });
  });

  it("safeParse drops unknown keys from the output", () => {
    const r = safeParse(Schema, { id: "x", extra: 1 });
    if (r.success) expect(r.data).toEqual({ id: "x" });
  });

  it("validate drops unknown keys from the output", () => {
    const r = validate(Schema, { id: "x", extra: 1 });
    if (r.success) expect(r.data).toEqual({ id: "x" });
  });
});

describe("nested object policies — each level enforces its own", () => {
  // Outer strict, inner passthrough — both policies must be in
  // effect at their own depth.
  const Schema = s.object({
    profile: s.object({ name: s.string() }).passthrough(),
  });

  it("outer strict rejects unknown top-level keys", () => {
    const r = safeParse(Schema, {
      profile: { name: "rin" },
      extra: 1,
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.issues[0]?.code).toBe("unknown_key");
  });

  it("inner passthrough preserves unknown nested keys", () => {
    const out = parse(Schema, {
      profile: { name: "rin", inner_extra: "kept" },
    });
    expect(out).toEqual({ profile: { name: "rin", inner_extra: "kept" } });
  });

  it("inner policy applies under validate too", () => {
    const r = validate(Schema, {
      profile: { name: "rin", inner_extra: "kept" },
    });
    if (r.success)
      expect(r.data).toEqual({
        profile: { name: "rin", inner_extra: "kept" },
      });
  });

  it("inner stripUnknown drops nested unknown keys but the outer policy still gates the top", () => {
    const S = s.object({
      profile: s.object({ name: s.string() }).stripUnknown(),
    });
    // Top-level strict still rejects an unknown sibling.
    expect(
      safeParse(S, { profile: { name: "rin" }, extra: 1 }).success,
    ).toBe(false);
    // Inner-level unknown is dropped silently.
    const r = safeParse(S, { profile: { name: "rin", inner_extra: 1 } });
    if (r.success) expect(r.data).toEqual({ profile: { name: "rin" } });
  });
});
