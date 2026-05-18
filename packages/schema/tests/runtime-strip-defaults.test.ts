/**
 * Step 3 tests for the validate-only IR transform (v0.6 plan
 * Decision #8). Front-loaded from the step 7 broader runtime batch so
 * the transform contract is verified at the commit that introduces it.
 *
 * Scope intentionally narrow: behavior of `stripDefaultsForValidate`
 * on the IR. No parse / safeParse / validate wiring; no compile-cache
 * integration. Those land with their own steps.
 */
import { describe, expect, it } from "vitest";
import { s } from "../src/index.js";
import { stripDefaultsForValidate } from "../src/runtime/strip-defaults.js";
import type {
  ArrayNode,
  ObjectNode,
  SchemaNode,
  StringNode,
} from "../src/ir/nodes.js";

describe("stripDefaultsForValidate — default modifier handling", () => {
  it("drops modifiers.default from a default-bearing field", () => {
    const node = s.string().default("anon").node;
    expect(node.modifiers?.default).toEqual({ value: "anon" });
    const stripped = stripDefaultsForValidate(node);
    expect(stripped.modifiers?.default).toBeUndefined();
  });

  it("sets modifiers.optional = true on a default-bearing field", () => {
    // Hand-craft IR with a `default` but no `optional` — the builder
    // already sets both, so we synthesize the bare case to prove the
    // transform sets `optional` regardless of input state.
    const node = {
      kind: "string",
      modifiers: { default: { value: "x" } },
    } as unknown as StringNode;
    const stripped = stripDefaultsForValidate(node);
    expect(stripped.modifiers?.optional).toBe(true);
    expect(stripped.modifiers?.default).toBeUndefined();
  });

  it("does not mutate the original SchemaNode", () => {
    const node = s
      .object({ name: s.string().default("anon"), tags: s.array(s.string()) })
      .node;
    const before = JSON.stringify(node);
    stripDefaultsForValidate(node);
    expect(JSON.stringify(node)).toBe(before);
    // Sanity — the original still has the default.
    const fields = (node as ObjectNode).fields;
    expect(fields.name?.modifiers?.default).toEqual({ value: "anon" });
  });
});

describe("stripDefaultsForValidate — preservation", () => {
  it("preserves nullable on a default-bearing field", () => {
    const node = s.string().nullable().default("x").node;
    expect(node.modifiers?.nullable).toBe(true);
    const stripped = stripDefaultsForValidate(node);
    expect(stripped.modifiers?.nullable).toBe(true);
    expect(stripped.modifiers?.default).toBeUndefined();
    expect(stripped.modifiers?.optional).toBe(true);
  });

  it("preserves nullish on a non-default field (no transform applied)", () => {
    // `nullish` = optional + nullable. No default to strip; the
    // modifiers must come through unchanged.
    const node = s.string().nullish().node;
    const stripped = stripDefaultsForValidate(node);
    expect(stripped.modifiers?.optional).toBe(true);
    expect(stripped.modifiers?.nullable).toBe(true);
    expect(stripped.modifiers?.default).toBeUndefined();
  });

  it("preserves top-level schema metadata", () => {
    // Validate is a runtime compilation variant of the same schema,
    // not a composition operation — schemaId / schemaVersion /
    // description / deprecated must survive.
    const node = s
      .object({ name: s.string().default("anon") })
      .id("com.x.User")
      .version("1.0.0")
      .describe("user record")
      .deprecated(false).node;
    const stripped = stripDefaultsForValidate(node);
    expect(stripped.metadata).toEqual({
      id: "com.x.User",
      version: "1.0.0",
      description: "user record",
      deprecated: false,
    });
  });

  it("preserves refinements and the object's unknownKeys policy", () => {
    const node = s
      .object({ name: s.string().min(2).default("ab") })
      .passthrough().node as ObjectNode;
    const stripped = stripDefaultsForValidate(node) as ObjectNode;
    expect(stripped.unknownKeys).toBe("passthrough");
    const nameField = stripped.fields.name as StringNode;
    expect(nameField.refinements).toEqual([
      { kind: "portable", name: "minLength", params: { value: 2 } },
    ]);
    expect(nameField.modifiers?.default).toBeUndefined();
    expect(nameField.modifiers?.optional).toBe(true);
  });

  it("leaves non-default fields unchanged", () => {
    const node = s.object({
      a: s.string(),
      b: s.string().default("x"),
    }).node as ObjectNode;
    const stripped = stripDefaultsForValidate(node) as ObjectNode;
    // `a` has no default; modifiers stay undefined.
    expect(stripped.fields.a?.modifiers).toBeUndefined();
    // `b` was stripped.
    expect(stripped.fields.b?.modifiers?.default).toBeUndefined();
    expect(stripped.fields.b?.modifiers?.optional).toBe(true);
  });
});

describe("stripDefaultsForValidate — recursion", () => {
  it("transforms nested object fields recursively", () => {
    const node = s.object({
      inner: s.object({ name: s.string().default("anon") }),
    }).node as ObjectNode;
    const stripped = stripDefaultsForValidate(node) as ObjectNode;
    const inner = stripped.fields.inner as ObjectNode;
    const name = inner.fields.name as StringNode;
    expect(name.modifiers?.default).toBeUndefined();
    expect(name.modifiers?.optional).toBe(true);
  });

  it("transforms array element defaults recursively", () => {
    const node = s.array(s.string().default("x")).node as ArrayNode;
    const stripped = stripDefaultsForValidate(node) as ArrayNode;
    expect(stripped.element.modifiers?.default).toBeUndefined();
    expect(stripped.element.modifiers?.optional).toBe(true);
  });

  it("is idempotent — calling twice produces an equivalent tree", () => {
    const node = s.object({
      name: s.string().default("anon"),
      tags: s.array(s.string().default("t")),
    }).node;
    const once = stripDefaultsForValidate(node);
    const twice = stripDefaultsForValidate(once);
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
  });
});

describe("stripDefaultsForValidate — pass-through for unsupported kinds", () => {
  it("non-default leaf nodes return an equivalent shape", () => {
    // Unsupported composite kinds (`union`, `transform`,
    // `recursiveRef`, `date`) will throw at compile time; strip does
    // not gate them. Sanity-check the pass-through path with a
    // hand-crafted node that has no defaults anywhere.
    const node = {
      kind: "transform",
      source: { kind: "string" },
      transformId: "t1",
    } as unknown as SchemaNode;
    const stripped = stripDefaultsForValidate(node);
    expect(JSON.stringify(stripped)).toBe(JSON.stringify(node));
  });
});
