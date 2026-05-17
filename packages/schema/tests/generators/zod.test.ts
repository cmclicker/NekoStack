import { describe, expect, it } from "vitest";
import { s } from "../../src/index.js";
import { generateZod } from "../../src/generators/zod.js";
import { UnsupportedNodeKindError } from "../../src/generators/errors.js";

const snapshotPath = (name: string): string =>
  `./__snapshots__/zod/${name}.ts.snap`;

describe("generateZod — leaves", () => {
  it("string", async () => {
    await expect(generateZod(s.string().id("com.x.S").node)).toMatchFileSnapshot(
      snapshotPath("leaf-string"),
    );
  });
  it("number with int + min + max", async () => {
    await expect(
      generateZod(s.number().int().min(0).max(100).id("com.x.N").node),
    ).toMatchFileSnapshot(snapshotPath("leaf-number-int-bounded"));
  });
  it("boolean", async () => {
    await expect(generateZod(s.boolean().id("com.x.B").node)).toMatchFileSnapshot(
      snapshotPath("leaf-boolean"),
    );
  });
  it("literal", async () => {
    await expect(
      generateZod(s.literal("admin").id("com.x.Role").node),
    ).toMatchFileSnapshot(snapshotPath("leaf-literal"));
  });
  it("string enum → z.enum", async () => {
    await expect(
      generateZod(s.enum(["red", "green", "blue"] as const).id("com.x.Color").node),
    ).toMatchFileSnapshot(snapshotPath("leaf-enum-string"));
  });
});

describe("generateZod — string refinements", () => {
  it("min + max + email + uuid + url + regex with flags", async () => {
    const node = s
      .string()
      .min(3)
      .max(50)
      .email()
      .regex(/^NEKO_/i)
      .id("com.x.Tag")
      .node;
    await expect(generateZod(node)).toMatchFileSnapshot(
      snapshotPath("string-refinements"),
    );
  });
});

describe("generateZod — composites", () => {
  it("array of string with min/max items", async () => {
    await expect(
      generateZod(s.array(s.string()).min(1).max(10).id("com.x.Tags").node),
    ).toMatchFileSnapshot(snapshotPath("array-string-bounded"));
  });

  it("object: strict by default emits .strict()", async () => {
    await expect(
      generateZod(
        s.object({ id: s.string(), age: s.number().int() }).id("com.x.User").node,
      ),
    ).toMatchFileSnapshot(snapshotPath("object-strict"));
  });

  it("object: stripUnknown emits .strip()", async () => {
    await expect(
      generateZod(
        s.object({ id: s.string() }).stripUnknown().id("com.x.U").node,
      ),
    ).toMatchFileSnapshot(snapshotPath("object-strip"));
  });

  it("object: passthrough emits .passthrough()", async () => {
    await expect(
      generateZod(s.object({ id: s.string() }).passthrough().id("com.x.U").node),
    ).toMatchFileSnapshot(snapshotPath("object-passthrough"));
  });

  it("nested object", async () => {
    const node = s
      .object({
        user: s.object({ id: s.string(), tags: s.array(s.string()) }),
        count: s.number().int(),
      })
      .id("com.x.Doc")
      .node;
    await expect(generateZod(node)).toMatchFileSnapshot(snapshotPath("nested"));
  });
});

describe("generateZod — metadata", () => {
  it("description → .describe()", async () => {
    await expect(
      generateZod(s.string().id("com.x.Name").describe("display name").node),
    ).toMatchFileSnapshot(snapshotPath("metadata-describe"));
  });
});

describe("generateZod — audit User example (proves end-to-end absence semantics in emitted chain)", () => {
  it("emits expected chain for the full User example", async () => {
    const User = s
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
    await expect(generateZod(User)).toMatchFileSnapshot(
      snapshotPath("audit-user"),
    );
  });
});

describe("generateZod — determinism", () => {
  it("same IR → byte-identical output", () => {
    const node = s.object({ a: s.string().min(1) }).id("com.x.Y").node;
    expect(generateZod(node)).toBe(generateZod(node));
  });
});

describe("generateZod — UnsupportedNodeKindError on unhandled IR kinds", () => {
  it("date throws with code/kind/generator fields", () => {
    const node = { kind: "date", variant: "isoDateTime" } as unknown as Parameters<
      typeof generateZod
    >[0];
    try {
      generateZod(node);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(UnsupportedNodeKindError);
      const err = e as UnsupportedNodeKindError;
      expect(err.code).toBe("UNSUPPORTED_NODE_KIND");
      expect(err.kind).toBe("date");
      expect(err.generator).toBe("zod");
    }
  });
  it("union throws", () => {
    const node = { kind: "union", options: [] } as unknown as Parameters<
      typeof generateZod
    >[0];
    expect(() => generateZod(node)).toThrow(UnsupportedNodeKindError);
  });
  it("recursiveRef throws", () => {
    const node = {
      kind: "recursiveRef",
      targetId: "com.x.Y",
    } as unknown as Parameters<typeof generateZod>[0];
    expect(() => generateZod(node)).toThrow(UnsupportedNodeKindError);
  });
  it("transform throws", () => {
    const node = {
      kind: "transform",
      source: { kind: "string" },
      transformId: "t1",
    } as unknown as Parameters<typeof generateZod>[0];
    expect(() => generateZod(node)).toThrow(UnsupportedNodeKindError);
  });
});
