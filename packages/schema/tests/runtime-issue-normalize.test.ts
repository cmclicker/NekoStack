/**
 * Step 4 tests for Decision #12 issue normalization (v0.6 plan).
 *
 * Each row of the locked mapping table gets a focused fixture. Where
 * a row can be exercised by a real Zod schema (the common path), it
 * is; where the row exists only as a defensive guard against future
 * Zod codes (intersection types, not_multiple_of, function-schema
 * issues), the test hand-constructs a `ZodError` so the mapping is
 * proven without depending on Zod surface area v0.6 does not use.
 *
 * Scope intentionally narrow: the normalizer in isolation. No
 * parse / safeParse / validate. No public exports yet.
 */
import { describe, expect, it } from "vitest";
import { z, ZodError, type ZodIssue } from "zod";
import { s } from "../src/index.js";
import { normalizeIssues } from "../src/runtime/normalize-issues.js";
import type { SchemaNode } from "../src/ir/nodes.js";

/** Build a ZodError from hand-crafted issues, for rows that the
 *  v0.6 builder surface can't trigger directly. */
const errorFrom = (issues: ZodIssue[]): ZodError => new ZodError(issues);

/** A bare string schema node used as the `schema` arg when no
 *  schema-metadata propagation is being tested. */
const bareNode = (): SchemaNode => s.string().node;

describe("normalizeIssues — Decision #12 mapping table", () => {
  it("invalid_type with received=undefined → missing_required", () => {
    const z3 = z.object({ id: z.string() });
    const r = z3.safeParse({});
    expect(r.success).toBe(false);
    if (r.success) return;
    const issues = normalizeIssues(r.error, bareNode());
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe("missing_required");
    expect(issues[0]?.path).toEqual(["id"]);
    expect(issues[0]?.expected).toBe("string");
    expect(issues[0]?.received).toBe("undefined");
  });

  it("invalid_type (other) → invalid_type", () => {
    const r = z.string().safeParse(42);
    expect(r.success).toBe(false);
    if (r.success) return;
    const issues = normalizeIssues(r.error, bareNode());
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe("invalid_type");
    expect(issues[0]?.expected).toBe("string");
    expect(issues[0]?.received).toBe("number");
  });

  it("unrecognized_keys → one unknown_key per offending key", () => {
    const z3 = z.object({ a: z.string() }).strict();
    const r = z3.safeParse({ a: "x", b: 1, c: 2 });
    expect(r.success).toBe(false);
    if (r.success) return;
    // Zod batches both keys on one issue; the normalizer splits.
    expect(r.error.issues).toHaveLength(1);
    const issues = normalizeIssues(r.error, bareNode());
    expect(issues).toHaveLength(2);
    expect(issues.every((i) => i.code === "unknown_key")).toBe(true);
    // Each emitted issue extends the original path with the key.
    expect(issues[0]?.path).toEqual(["b"]);
    expect(issues[0]?.received).toBe("b");
    expect(issues[1]?.path).toEqual(["c"]);
    expect(issues[1]?.received).toBe("c");
  });

  it("invalid_literal → invalid_literal (expected/received preserved)", () => {
    const r = z.literal("ok").safeParse("nope");
    expect(r.success).toBe(false);
    if (r.success) return;
    const issues = normalizeIssues(r.error, bareNode());
    expect(issues[0]?.code).toBe("invalid_literal");
    expect(issues[0]?.expected).toBe("ok");
    expect(issues[0]?.received).toBe("nope");
  });

  it("invalid_enum_value → invalid_enum", () => {
    const r = z.enum(["a", "b"]).safeParse("c");
    expect(r.success).toBe(false);
    if (r.success) return;
    const issues = normalizeIssues(r.error, bareNode());
    expect(issues[0]?.code).toBe("invalid_enum");
    expect(issues[0]?.received).toBe("c");
    expect(issues[0]?.expected).toEqual(["a", "b"]);
  });

  it("invalid_union → invalid_union", () => {
    const r = z
      .union([z.literal(1), z.literal(2)])
      .safeParse(3);
    expect(r.success).toBe(false);
    if (r.success) return;
    const issues = normalizeIssues(r.error, bareNode());
    expect(issues[0]?.code).toBe("invalid_union");
  });

  it("invalid_union_discriminator (hand-crafted) → invalid_union", () => {
    // No v0.6 public discriminated-union surface, so synthesize the
    // ZodIssue directly to prove the folded mapping.
    const err = errorFrom([
      {
        code: "invalid_union_discriminator",
        path: ["kind"],
        message: "Invalid discriminator value. Expected 'a' | 'b'",
        options: ["a", "b"],
      },
    ]);
    const issues = normalizeIssues(err, bareNode());
    expect(issues[0]?.code).toBe("invalid_union");
  });

  it("invalid_string (email/url/uuid/regex) → invalid_format (validation kept on metadata)", () => {
    const r = z.string().email().safeParse("not-an-email");
    expect(r.success).toBe(false);
    if (r.success) return;
    const issues = normalizeIssues(r.error, bareNode());
    expect(issues[0]?.code).toBe("invalid_format");
    expect(issues[0]?.metadata).toEqual({ validation: "email" });
  });

  it("too_small → too_small (constraint metadata preserved)", () => {
    const r = z.string().min(5).safeParse("ab");
    expect(r.success).toBe(false);
    if (r.success) return;
    const issues = normalizeIssues(r.error, bareNode());
    expect(issues[0]?.code).toBe("too_small");
    expect(issues[0]?.metadata).toMatchObject({
      minimum: 5,
      inclusive: true,
      type: "string",
    });
  });

  it("too_big → too_big (constraint metadata preserved)", () => {
    const r = z.string().max(2).safeParse("abcdef");
    expect(r.success).toBe(false);
    if (r.success) return;
    const issues = normalizeIssues(r.error, bareNode());
    expect(issues[0]?.code).toBe("too_big");
    expect(issues[0]?.metadata).toMatchObject({
      maximum: 2,
      inclusive: true,
      type: "string",
    });
  });

  it("custom → custom_refinement_failed", () => {
    const r = z
      .string()
      .refine(() => false, { message: "always fails" })
      .safeParse("anything");
    expect(r.success).toBe(false);
    if (r.success) return;
    const issues = normalizeIssues(r.error, bareNode());
    expect(issues[0]?.code).toBe("custom_refinement_failed");
    expect(issues[0]?.message).toBe("always fails");
  });

  it("invalid_date (hand-crafted) → invalid_type", () => {
    // DateNode has no v0.6 builder — synthesize the ZodIssue.
    const err = errorFrom([
      {
        code: "invalid_date",
        path: ["dob"],
        message: "Invalid date",
      },
    ]);
    const issues = normalizeIssues(err, bareNode());
    expect(issues[0]?.code).toBe("invalid_type");
    expect(issues[0]?.path).toEqual(["dob"]);
  });

  it("invalid_arguments / invalid_return_type → invalid_type with metadata", () => {
    // Function schemas are out of v0.6 scope; the normalizer surfaces
    // both as invalid_type while preserving the original code on
    // metadata for triage.
    const err = errorFrom([
      {
        code: "invalid_arguments",
        path: [],
        message: "Invalid function arguments",
        argumentsError: new ZodError([]),
      } as unknown as ZodIssue,
      {
        code: "invalid_return_type",
        path: [],
        message: "Invalid function return type",
        returnTypeError: new ZodError([]),
      } as unknown as ZodIssue,
    ]);
    const issues = normalizeIssues(err, bareNode());
    expect(issues).toHaveLength(2);
    expect(issues[0]?.code).toBe("invalid_type");
    expect(issues[0]?.metadata).toEqual({
      source: "zod",
      zodCode: "invalid_arguments",
    });
    expect(issues[1]?.code).toBe("invalid_type");
    expect(issues[1]?.metadata).toEqual({
      source: "zod",
      zodCode: "invalid_return_type",
    });
  });
});

describe("normalizeIssues — fallback for unmapped codes (Decision #12 round-2)", () => {
  it("unmapped code → custom_refinement_failed + metadata.source=\"zod\" + metadata.zodCode", () => {
    // `not_multiple_of` and `invalid_intersection_types` exist in Zod
    // but have no row in the locked table. The fallback row requires
    // the original code to survive on `metadata.zodCode` so triage
    // never loses traceability.
    const err = errorFrom([
      {
        code: "not_multiple_of",
        path: ["price"],
        message: "Not a multiple of 0.01",
        multipleOf: 0.01,
      } as unknown as ZodIssue,
      {
        code: "invalid_intersection_types",
        path: [],
        message: "Could not merge intersection types",
      } as unknown as ZodIssue,
    ]);
    const issues = normalizeIssues(err, bareNode());
    expect(issues).toHaveLength(2);
    expect(issues[0]?.code).toBe("custom_refinement_failed");
    expect(issues[0]?.metadata).toEqual({
      source: "zod",
      zodCode: "not_multiple_of",
    });
    expect(issues[1]?.code).toBe("custom_refinement_failed");
    expect(issues[1]?.metadata).toEqual({
      source: "zod",
      zodCode: "invalid_intersection_types",
    });
  });

  it("guards against a future unknown code without crashing", () => {
    const err = errorFrom([
      {
        code: "this_code_does_not_exist_in_zod_3_or_4",
        path: [],
        message: "Hypothetical future Zod code",
      } as unknown as ZodIssue,
    ]);
    const issues = normalizeIssues(err, bareNode());
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe("custom_refinement_failed");
    expect(issues[0]?.metadata).toMatchObject({
      source: "zod",
      zodCode: "this_code_does_not_exist_in_zod_3_or_4",
    });
  });
});

describe("normalizeIssues — schema metadata propagation", () => {
  it("copies schemaId / schemaVersion from schema.metadata when present", () => {
    const node = s
      .object({ id: s.string() })
      .id("com.x.User")
      .version("1.0.0").node;
    // Re-use Zod's invalid_type path to get a real error.
    const r = z.object({ id: z.string() }).safeParse({});
    if (r.success) throw new Error("expected failure");
    const issues = normalizeIssues(r.error, node);
    expect(issues[0]?.schemaId).toBe("com.x.User");
    expect(issues[0]?.schemaVersion).toBe("1.0.0");
  });

  it("omits schemaId / schemaVersion when the schema has no metadata", () => {
    const r = z.object({ id: z.string() }).safeParse({});
    if (r.success) throw new Error("expected failure");
    const issues = normalizeIssues(r.error, bareNode());
    expect(issues[0]?.schemaId).toBeUndefined();
    expect(issues[0]?.schemaVersion).toBeUndefined();
  });
});

describe("normalizeIssues — invariants", () => {
  it("every emitted issue has severity: \"error\"", () => {
    const r = z
      .object({ a: z.string(), b: z.number() })
      .strict()
      .safeParse({ b: "wrong", c: 1, d: 2 });
    if (r.success) throw new Error("expected failure");
    const issues = normalizeIssues(r.error, bareNode());
    expect(issues.length).toBeGreaterThan(0);
    for (const i of issues) {
      expect(i.severity).toBe("error");
    }
  });

  it("preserves Zod path and message verbatim", () => {
    const r = z
      .object({ nested: z.object({ deep: z.string() }) })
      .safeParse({ nested: { deep: 42 } });
    if (r.success) throw new Error("expected failure");
    const issues = normalizeIssues(r.error, bareNode());
    expect(issues[0]?.path).toEqual(["nested", "deep"]);
    expect(typeof issues[0]?.message).toBe("string");
    expect(issues[0]?.message.length).toBeGreaterThan(0);
  });
});
