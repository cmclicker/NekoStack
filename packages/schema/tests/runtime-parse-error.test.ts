/**
 * Step 5 tests for `ParseError` (v0.6 plan).
 *
 * Scope intentionally narrow: the error class in isolation. No
 * parse / safeParse / validate wiring (step 6). No public exports
 * (step 13). Tests assert on `code` / `name` / `issues` / `instanceof`,
 * never on the human-readable `message`, so the message can evolve
 * without breaking consumers.
 */
import { describe, expect, it } from "vitest";
import * as publicApi from "../src/index.js";
import { ParseError } from "../src/runtime/errors.js";
import type { Issue } from "../src/errors/issue.js";

const sampleIssue = (path: ReadonlyArray<string | number> = ["id"]): Issue => ({
  code: "invalid_type",
  path,
  message: "Expected string, received number",
  severity: "error",
});

describe("ParseError", () => {
  it("is an instance of Error", () => {
    const err = new ParseError([sampleIssue()]);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ParseError);
  });

  it("has name 'ParseError'", () => {
    const err = new ParseError([sampleIssue()]);
    expect(err.name).toBe("ParseError");
  });

  it("has code 'parse_failed' as a stable literal", () => {
    const err = new ParseError([sampleIssue()]);
    expect(err.code).toBe("parse_failed");
  });

  it("exposes the issues passed to it", () => {
    const issues = [sampleIssue(["a"]), sampleIssue(["b"])];
    const err = new ParseError(issues);
    expect(err.issues).toHaveLength(2);
    expect(err.issues[0]?.path).toEqual(["a"]);
    expect(err.issues[1]?.path).toEqual(["b"]);
  });

  it("defensively copies the issues array — later mutation does not leak in", () => {
    // The contract says the thrown error must not be a window into
    // the caller's working array. A `safeParse` implementation that
    // builds issues in-place would otherwise leak that mutability
    // into a thrown ParseError.
    const working: Issue[] = [sampleIssue(["a"])];
    const err = new ParseError(working);
    working.push(sampleIssue(["b"]));
    working[0] = sampleIssue(["mutated"]);
    expect(err.issues).toHaveLength(1);
    expect(err.issues[0]?.path).toEqual(["a"]);
  });

  it("is throwable and catchable as ParseError", () => {
    let caught: unknown;
    try {
      throw new ParseError([sampleIssue()]);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ParseError);
    if (caught instanceof ParseError) {
      expect(caught.code).toBe("parse_failed");
      expect(caught.issues).toHaveLength(1);
    }
  });

  it("is exported from the public src/index.ts surface (v0.6)", () => {
    // Step 13 wired ParseError onto the public surface alongside
    // parse / safeParse / validate. The full public-surface contract
    // is verified in tests/public-surface.test.ts.
    expect("ParseError" in publicApi).toBe(true);
  });
});
