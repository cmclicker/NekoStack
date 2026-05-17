import { describe, expect, it } from "vitest";
import { s } from "../../src/index.js";
import { generateTypeScript } from "../../src/generators/ts.js";
import { UnsupportedNodeKindError } from "../../src/generators/errors.js";

const snapshotPath = (name: string): string =>
  `./__snapshots__/ts/${name}.ts.snap`;

describe("generateTypeScript — leaves (output mode)", () => {
  it("string", async () => {
    const out = generateTypeScript(s.string().id("com.x.S").node);
    await expect(out).toMatchFileSnapshot(snapshotPath("leaf-string"));
  });

  it("number", async () => {
    const out = generateTypeScript(s.number().id("com.x.N").node);
    await expect(out).toMatchFileSnapshot(snapshotPath("leaf-number"));
  });

  it("boolean", async () => {
    const out = generateTypeScript(s.boolean().id("com.x.B").node);
    await expect(out).toMatchFileSnapshot(snapshotPath("leaf-boolean"));
  });

  it("literal", async () => {
    const out = generateTypeScript(s.literal("admin").id("com.x.Role").node);
    await expect(out).toMatchFileSnapshot(snapshotPath("leaf-literal"));
  });

  it("enum", async () => {
    const out = generateTypeScript(
      s.enum(["red", "green", "blue"] as const).id("com.x.Color").node,
    );
    await expect(out).toMatchFileSnapshot(snapshotPath("leaf-enum"));
  });
});

describe("generateTypeScript — composites + modifiers + metadata (output mode)", () => {
  it("array of string", async () => {
    const out = generateTypeScript(s.array(s.string()).id("com.x.Tags").node);
    await expect(out).toMatchFileSnapshot(snapshotPath("array-string"));
  });

  it("array of optional string (element-level modifier parenthesizes)", async () => {
    const out = generateTypeScript(
      s.array(s.string().optional()).id("com.x.MaybeTags").node,
    );
    await expect(out).toMatchFileSnapshot(snapshotPath("array-optional-element"));
  });

  it("object with all absence modifiers", async () => {
    const node = s
      .object({
        name: s.string(),
        nickname: s.string().optional(),
        bio: s.string().nullable(),
        handle: s.string().nullish(),
        role: s.string().default("member"),
      })
      .id("com.x.User")
      .version("1.0.0")
      .describe("Authenticated user")
      .node;
    const out = generateTypeScript(node);
    await expect(out).toMatchFileSnapshot(snapshotPath("object-user-output"));
  });

  it("deprecated metadata emits @deprecated tag", async () => {
    const out = generateTypeScript(
      s.string().id("com.x.OldField").deprecated().node,
    );
    await expect(out).toMatchFileSnapshot(snapshotPath("deprecated"));
  });

  it("anonymous schema → header schemaId: null + default name 'Schema'", async () => {
    const out = generateTypeScript(s.object({ id: s.string() }).node);
    await expect(out).toMatchFileSnapshot(snapshotPath("anonymous"));
  });

  it("nested object", async () => {
    const node = s
      .object({
        user: s.object({ id: s.string(), tags: s.array(s.string()) }),
        count: s.number().int(),
      })
      .id("com.x.Doc")
      .node;
    const out = generateTypeScript(node);
    await expect(out).toMatchFileSnapshot(snapshotPath("nested-object"));
  });
});

describe("generateTypeScript — input mode + both mode + absence-semantics parity", () => {
  const User = s
    .object({
      name: s.string(),
      nickname: s.string().optional(),
      bio: s.string().nullable(),
      handle: s.string().nullish(),
      role: s.string().default("member"),
    })
    .id("com.x.User")
    .node;

  it("input mode: default field becomes optional in INPUT", async () => {
    const out = generateTypeScript(User, { mode: "input" });
    await expect(out).toMatchFileSnapshot(snapshotPath("object-user-input"));
  });

  it("both mode: emits UserInput and UserOutput, no bare User", async () => {
    const out = generateTypeScript(User, { mode: "both" });
    await expect(out).toMatchFileSnapshot(snapshotPath("object-user-both"));
  });

  it("absence-semantics parity: input mode marks role as optional (key with ?)", () => {
    const out = generateTypeScript(User, { mode: "input" });
    // Input: role?: string (optional because default makes input optional)
    expect(out).toMatch(/role\?:\s*string;/);
  });

  it("absence-semantics parity: output mode marks role as required (no ?)", () => {
    const out = generateTypeScript(User, { mode: "output" });
    expect(out).toMatch(/\brole:\s*string;/);
    expect(out).not.toMatch(/role\?:/);
  });

  it("absence-semantics parity: nullable stays required in both modes", () => {
    const inp = generateTypeScript(User, { mode: "input" });
    const out = generateTypeScript(User, { mode: "output" });
    expect(inp).toMatch(/bio:\s*string \| null;/);
    expect(out).toMatch(/bio:\s*string \| null;/);
  });

  it("absence-semantics parity: nullish is optional in both modes (no input/output asymmetry)", () => {
    const inp = generateTypeScript(User, { mode: "input" });
    const out = generateTypeScript(User, { mode: "output" });
    expect(inp).toMatch(/handle\?:\s*string \| null;/);
    expect(out).toMatch(/handle\?:\s*string \| null;/);
  });
});

describe("generateTypeScript — determinism", () => {
  it("same IR + same options → byte-identical output across calls", () => {
    const node = s.object({ a: s.string().min(1), b: s.number().int() }).node;
    const a = generateTypeScript(node, { mode: "both" });
    const b = generateTypeScript(node, { mode: "both" });
    expect(a).toBe(b);
  });
});

describe("generateTypeScript — UnsupportedNodeKindError on unhandled IR kinds", () => {
  it("date node throws with code/kind/generator fields", () => {
    const node = { kind: "date", variant: "isoDateTime" } as unknown as Parameters<
      typeof generateTypeScript
    >[0];
    try {
      generateTypeScript(node);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(UnsupportedNodeKindError);
      const err = e as UnsupportedNodeKindError;
      expect(err.code).toBe("UNSUPPORTED_NODE_KIND");
      expect(err.kind).toBe("date");
      expect(err.generator).toBe("typescript");
    }
  });

  it("union node throws", () => {
    const node = { kind: "union", options: [] } as unknown as Parameters<
      typeof generateTypeScript
    >[0];
    expect(() => generateTypeScript(node)).toThrow(UnsupportedNodeKindError);
  });

  it("recursiveRef node throws", () => {
    const node = {
      kind: "recursiveRef",
      targetId: "com.x.Y",
    } as unknown as Parameters<typeof generateTypeScript>[0];
    expect(() => generateTypeScript(node)).toThrow(UnsupportedNodeKindError);
  });

  it("transform node throws", () => {
    const node = {
      kind: "transform",
      source: { kind: "string" },
      transformId: "t1",
    } as unknown as Parameters<typeof generateTypeScript>[0];
    expect(() => generateTypeScript(node)).toThrow(UnsupportedNodeKindError);
  });

  it("runtime refinement throws (fail loudly, not silent skip)", () => {
    // Same contract as the Zod generator: runtime refinements are
    // unsupported in v0.2 and must throw, not silently emit the bare type.
    const node = {
      kind: "string",
      refinements: [
        { kind: "runtime", code: "invalid_tenant_slug" },
      ],
    } as unknown as Parameters<typeof generateTypeScript>[0];
    try {
      generateTypeScript(node);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(UnsupportedNodeKindError);
      const err = e as UnsupportedNodeKindError;
      expect(err.code).toBe("UNSUPPORTED_NODE_KIND");
      expect(err.kind).toBe("runtimeRefinement");
      expect(err.generator).toBe("typescript");
    }
  });
});

describe("generateTypeScript — nested object indentation grows per depth", () => {
  // The PR #7 dogfood pass surfaced this: nested object bodies were emitted
  // with the same indent as the outer body, producing readable-but-poor
  // generated TS. Threading `depth` through the emit chain fixes it.

  it("two levels deep — inner fields indent at 4 spaces, inner brace at 2", () => {
    const node = s
      .object({
        outer: s.object({ inner: s.string() }),
      })
      .id("com.x.D2").node;
    const out = generateTypeScript(node);
    // Expect inner field indented one level deeper than outer field.
    expect(out).toMatch(/^  outer: \{$/m); // outer field at 2
    expect(out).toMatch(/^    inner: string;$/m); // inner field at 4
    expect(out).toMatch(/^  \};$/m); // inner brace closes at 2 (aligned with outer field)
  });

  it("three levels deep — each level indents +2 spaces", () => {
    const node = s
      .object({
        a: s.object({
          b: s.object({ c: s.string() }),
        }),
      })
      .id("com.x.D3").node;
    const out = generateTypeScript(node);
    expect(out).toMatch(/^  a: \{$/m);
    expect(out).toMatch(/^    b: \{$/m);
    expect(out).toMatch(/^      c: string;$/m);
    expect(out).toMatch(/^    \};$/m);
    expect(out).toMatch(/^  \};$/m);
  });

  it("array of objects: object body is indented relative to the field", () => {
    const node = s
      .object({
        items: s.array(s.object({ id: s.string() })),
      })
      .id("com.x.AoO").node;
    const out = generateTypeScript(node);
    // Field at depth 1; the object body inside the array is also at depth 1
    // (the array is structurally transparent for indent purposes).
    expect(out).toMatch(/^  items: \{$/m);
    expect(out).toMatch(/^    id: string;$/m);
    expect(out).toMatch(/^  \}\[\];$/m);
  });

  it("per-field JSDoc indents with the field", () => {
    const node = s
      .object({
        outer: s.object({
          inner: s.string().describe("the inner field"),
        }),
      })
      .id("com.x.Doc").node;
    const out = generateTypeScript(node);
    // The JSDoc line `   * the inner field` lives at 4-space + " * " = 5-space leader
    expect(out).toMatch(/^    \/\*\*$/m);
    expect(out).toMatch(/^     \* the inner field$/m);
    expect(out).toMatch(/^     \*\/$/m);
  });
});

describe("generateTypeScript — unsafe object keys are JSON-quoted", () => {
  // Object keys can be arbitrary strings; the IR doesn't restrict them.
  // The generator must quote anything that isn't a TS identifier.
  it("hyphenated key", async () => {
    const node = s
      .object({ "user-id": s.string() })
      .id("com.x.HyphenKey").node;
    await expect(generateTypeScript(node)).toMatchFileSnapshot(
      snapshotPath("unsafe-key-hyphen"),
    );
  });

  it("key with space", async () => {
    const node = s
      .object({ "first name": s.string() })
      .id("com.x.SpaceKey").node;
    await expect(generateTypeScript(node)).toMatchFileSnapshot(
      snapshotPath("unsafe-key-space"),
    );
  });

  it("numeric-leading key", async () => {
    const node = s.object({ "123": s.string() }).id("com.x.NumKey").node;
    await expect(generateTypeScript(node)).toMatchFileSnapshot(
      snapshotPath("unsafe-key-numeric"),
    );
  });

  it("identifier-safe keys remain bare (no quotes)", () => {
    const out = generateTypeScript(
      s.object({ id: s.string(), userName: s.string() }).id("com.x.Safe").node,
    );
    expect(out).toMatch(/^\s+id:\s+string;/m);
    expect(out).toMatch(/^\s+userName:\s+string;/m);
    expect(out).not.toMatch(/"id":/);
    expect(out).not.toMatch(/"userName":/);
  });
});
