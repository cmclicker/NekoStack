/**
 * Step 13 — v0.6 public surface gate.
 *
 * Canonical place that asserts what `@nekostack/schema` exposes for
 * the v0.6 runtime API:
 *
 *   - `parse`, `safeParse`, `validate` are exported and functional
 *     when imported from the package root
 *   - `ParseError` is exported and catches a real failure
 *   - implementation helpers (compile cache, validate-variant
 *     transform, Zod source/value emitter, issue normalizer) are
 *     intentionally NOT exported — they are package-internal and
 *     may be reworked without a major version bump
 *
 * This file imports everything from `../src/index.js` to mirror what
 * an external consumer would write (`import { ... } from
 * "@nekostack/schema"`).
 */
import { describe, expect, it } from "vitest";
import * as publicApi from "../src/index.js";
import {
  s,
  parse,
  safeParse,
  validate,
  ParseError,
} from "../src/index.js";

describe("public surface — names present on the package root", () => {
  it("exports parse / safeParse / validate / ParseError", () => {
    expect("parse" in publicApi).toBe(true);
    expect("safeParse" in publicApi).toBe(true);
    expect("validate" in publicApi).toBe(true);
    expect("ParseError" in publicApi).toBe(true);
  });

  it("exports the DSL entry point `s` and the IR/result types remain present", () => {
    // The runtime exports are additive — they must not displace the
    // existing v0.1 / v0.5 surface.
    expect("s" in publicApi).toBe(true);
    expect("serializeIR" in publicApi).toBe(true);
    expect("irHash" in publicApi).toBe(true);
    expect("ISSUE_CODES" in publicApi).toBe(true);
  });
});

describe("public surface — implementation helpers stay internal", () => {
  // None of these should leak. Adding any of them to the public
  // surface is a breaking-by-policy change; this test is the gate.
  const internalNames = [
    "compile",
    "compileZodSchema",
    "irToZodSchema",
    "stripDefaultsForValidate",
    "normalizeIssues",
    "validateNodeCache",
    "emit",
    "ZodEmitter",
  ];
  for (const name of internalNames) {
    it(`does NOT export ${name}`, () => {
      expect(name in publicApi).toBe(false);
    });
  }
});

describe("public surface — exported entry points actually work", () => {
  it("parse fills defaults and returns the output shape", () => {
    const User = s.object({ name: s.string().default("anon") });
    const out = parse(User, {});
    expect(out).toEqual({ name: "anon" });
  });

  it("safeParse returns { success: true, data } on success", () => {
    const User = s.object({ id: s.string() });
    const r = safeParse(User, { id: "u_1" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ id: "u_1" });
  });

  it("safeParse returns { success: false, issues } on failure", () => {
    const User = s.object({ id: s.string() });
    const r = safeParse(User, { id: 42 });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues).toHaveLength(1);
      expect(r.issues[0]?.code).toBe("invalid_type");
      expect(r.issues[0]?.path).toEqual(["id"]);
    }
  });

  it("validate returns the input shape — defaults NOT filled", () => {
    const User = s.object({ name: s.string().default("anon") });
    const r = validate(User, {});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toEqual({});
      expect("name" in r.data).toBe(false);
    }
  });

  it("ParseError exported from the package root catches parse failures", () => {
    const User = s.object({ id: s.string() });
    try {
      parse(User, { id: 42 });
      throw new Error("expected ParseError");
    } catch (e) {
      expect(e).toBeInstanceOf(ParseError);
      if (e instanceof ParseError) {
        expect(e.code).toBe("parse_failed");
        expect(e.name).toBe("ParseError");
        expect(e.issues).toHaveLength(1);
        expect(e.issues[0]?.code).toBe("invalid_type");
      }
    }
  });

  it("ParseError from publicApi.* matches the directly-imported class", () => {
    // Sanity: the re-export is not a shim or duplicate constructor.
    const fromNamespace = (publicApi as unknown as {
      ParseError: typeof ParseError;
    }).ParseError;
    expect(fromNamespace).toBe(ParseError);
  });
});
