import { describe, expect, it } from "vitest";
import { s } from "../../src/index.js";
import { generateJsonSchema } from "../../src/generators/json-schema.js";
import { UnsupportedNodeKindError } from "../../src/generators/errors.js";

const snapshotPath = (name: string): string =>
  `./__snapshots__/json-schema/${name}.json.schema.json`;

describe("generateJsonSchema — leaves", () => {
  it("string", async () => {
    await expect(
      generateJsonSchema(s.string().id("com.x.S").version("1.0.0").node),
    ).toMatchFileSnapshot(snapshotPath("leaf-string"));
  });
  it("number with int + min + max", async () => {
    await expect(
      generateJsonSchema(
        s.number().int().min(0).max(100).id("com.x.N").version("1.0.0").node,
      ),
    ).toMatchFileSnapshot(snapshotPath("leaf-number-int-bounded"));
  });
  it("boolean", async () => {
    await expect(
      generateJsonSchema(s.boolean().id("com.x.B").version("1.0.0").node),
    ).toMatchFileSnapshot(snapshotPath("leaf-boolean"));
  });
  it("literal → const", async () => {
    await expect(
      generateJsonSchema(s.literal("admin").id("com.x.Role").version("1.0.0").node),
    ).toMatchFileSnapshot(snapshotPath("leaf-literal"));
  });
  it("string enum → enum", async () => {
    await expect(
      generateJsonSchema(
        s.enum(["red", "green", "blue"] as const).id("com.x.Color").version("1.0.0").node,
      ),
    ).toMatchFileSnapshot(snapshotPath("leaf-enum"));
  });
});

describe("generateJsonSchema — refinements", () => {
  it("string with min + max + email + regex (no flags)", async () => {
    const node = s
      .string()
      .min(3)
      .max(50)
      .email()
      .regex(/^NEKO_/)
      .id("com.x.Tag")
      .version("1.0.0").node;
    await expect(generateJsonSchema(node)).toMatchFileSnapshot(
      snapshotPath("string-refinements"),
    );
  });

  it("number with gt / lt / multipleOf", async () => {
    const node = s
      .number()
      .gt(0)
      .lt(100)
      .multipleOf(0.5)
      .id("com.x.N2")
      .version("1.0.0").node;
    await expect(generateJsonSchema(node)).toMatchFileSnapshot(
      snapshotPath("number-bounds"),
    );
  });

  it("array of string with minItems / maxItems", async () => {
    const node = s
      .array(s.string())
      .min(1)
      .max(10)
      .id("com.x.Tags")
      .version("1.0.0").node;
    await expect(generateJsonSchema(node)).toMatchFileSnapshot(
      snapshotPath("array-string-bounded"),
    );
  });
});

describe("generateJsonSchema — object policy (Decision #12)", () => {
  it("strict → additionalProperties: false", async () => {
    await expect(
      generateJsonSchema(
        s.object({ id: s.string() }).id("com.x.O1").version("1.0.0").node,
      ),
    ).toMatchFileSnapshot(snapshotPath("object-strict"));
  });

  it("passthrough → additionalProperties: true", async () => {
    await expect(
      generateJsonSchema(
        s.object({ id: s.string() }).passthrough().id("com.x.O2").version("1.0.0").node,
      ),
    ).toMatchFileSnapshot(snapshotPath("object-passthrough"));
  });

  it("stripUnknown → additionalProperties: TRUE + x-nekostack-strip: true", async () => {
    // The corrected mapping: stripUnknown means the runtime strips unknown
    // keys, so JSON Schema must ACCEPT them. Emitting `false` would model
    // strict semantics, rejecting inputs that stripUnknown is supposed to
    // accept and strip.
    const out = generateJsonSchema(
      s.object({ id: s.string() }).stripUnknown().id("com.x.O3").version("1.0.0").node,
    );
    await expect(out).toMatchFileSnapshot(snapshotPath("object-strip"));
    expect(out).toContain('"additionalProperties": true');
    expect(out).toContain('"x-nekostack-strip": true');
  });
});

describe("generateJsonSchema — absence semantics (Decisions #6-#9)", () => {
  it("audit User example: input-shape per the v0.1 contract", async () => {
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
      .describe("Authenticated user").node;

    const out = generateJsonSchema(User);
    await expect(out).toMatchFileSnapshot(snapshotPath("audit-user"));

    // The required array per Decisions #6-#9:
    // - name: required
    // - nickname (optional): NOT required
    // - bio (nullable): required
    // - handle (nullish): NOT required
    // - role (default): NOT required (default applied by runtime)
    const parsed = JSON.parse(out) as {
      required?: string[];
      properties: Record<string, { type?: string | string[]; default?: unknown }>;
    };
    expect(parsed.required?.sort()).toEqual(["bio", "name"]);
    expect(parsed.properties.bio?.type).toEqual(["string", "null"]);
    expect(parsed.properties.handle?.type).toEqual(["string", "null"]);
    expect(parsed.properties.role?.default).toBe("member");
  });
});

describe("generateJsonSchema — identity ($id) per Decision #2", () => {
  it("default → URN", () => {
    const out = generateJsonSchema(
      s.string().id("com.nekostack.auth.User").version("1.0.0").node,
    );
    const parsed = JSON.parse(out) as { $id?: string };
    expect(parsed.$id).toBe("urn:nekostack:schema:com.nekostack.auth.User:1.0.0");
  });

  it("idBase → URL", () => {
    const out = generateJsonSchema(
      s.string().id("com.nekostack.auth.User").version("1.0.0").node,
      { idBase: "https://schemas.example.com" },
    );
    const parsed = JSON.parse(out) as { $id?: string };
    expect(parsed.$id).toBe(
      "https://schemas.example.com/com.nekostack.auth.User/1.0.0",
    );
  });

  it("idBase strips trailing slash", () => {
    const out = generateJsonSchema(
      s.string().id("com.x.Y").version("1.0.0").node,
      { idBase: "https://example.com/" },
    );
    expect(JSON.parse(out).$id).toBe("https://example.com/com.x.Y/1.0.0");
  });

  it("anonymous schema → no $id (Decision #3)", () => {
    const out = generateJsonSchema(s.string().node);
    const parsed = JSON.parse(out) as Record<string, unknown>;
    expect(parsed.$id).toBeUndefined();
  });

  it("id present but no version → URN without trailing version segment", () => {
    const out = generateJsonSchema(s.string().id("com.x.Y").node);
    expect(JSON.parse(out).$id).toBe("urn:nekostack:schema:com.x.Y");
  });

  it("never emits $defs in v0.3 (Decision #4 — inline schemas only)", () => {
    const out = generateJsonSchema(
      s.object({ a: s.object({ b: s.string() }) }).id("com.x.Y").version("1.0.0").node,
    );
    expect(JSON.parse(out).$defs).toBeUndefined();
  });
});

describe("generateJsonSchema — root structure", () => {
  it("emits $schema = draft 2020-12 URL", () => {
    const out = generateJsonSchema(s.string().id("com.x.Y").version("1.0.0").node);
    expect(JSON.parse(out).$schema).toBe(
      "https://json-schema.org/draft/2020-12/schema",
    );
  });

  it("includes x-nekostack provenance with generator + version + irHash + schemaId + schemaVersion", () => {
    const out = generateJsonSchema(
      s.string().id("com.x.Y").version("1.0.0").node,
    );
    const parsed = JSON.parse(out) as {
      "x-nekostack": Record<string, unknown>;
    };
    const prov = parsed["x-nekostack"];
    expect(prov.generator).toBe("jsonSchema");
    expect(prov.generatorVersion).toMatch(/^@nekostack\/schema@/);
    expect(prov.irHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(prov.schemaId).toBe("com.x.Y");
    expect(prov.schemaVersion).toBe("1.0.0");
  });

  it("anonymous schema provenance: schemaId + schemaVersion null", () => {
    const out = generateJsonSchema(s.string().node);
    const prov = (JSON.parse(out) as { "x-nekostack": Record<string, unknown> })[
      "x-nekostack"
    ];
    expect(prov.schemaId).toBeNull();
    expect(prov.schemaVersion).toBeNull();
  });
});

describe("generateJsonSchema — determinism", () => {
  it("same IR + same options → byte-identical output", () => {
    const node = s.object({ a: s.string().min(1) }).id("com.x.Y").version("1.0.0").node;
    expect(generateJsonSchema(node)).toBe(generateJsonSchema(node));
  });

  it("output ends with exactly one newline", () => {
    const out = generateJsonSchema(s.string().id("com.x.Y").version("1.0.0").node);
    expect(out.endsWith("\n")).toBe(true);
    expect(out.endsWith("\n\n")).toBe(false);
  });
});

describe("generateJsonSchema — UnsupportedNodeKindError on unsupported IR", () => {
  it("date throws with code/kind/generator fields", () => {
    const node = { kind: "date", variant: "isoDateTime" } as unknown as Parameters<
      typeof generateJsonSchema
    >[0];
    try {
      generateJsonSchema(node);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(UnsupportedNodeKindError);
      const err = e as UnsupportedNodeKindError;
      expect(err.code).toBe("UNSUPPORTED_NODE_KIND");
      expect(err.kind).toBe("date");
      expect(err.generator).toBe("jsonSchema");
    }
  });

  it("union throws", () => {
    const node = { kind: "union", options: [] } as unknown as Parameters<
      typeof generateJsonSchema
    >[0];
    expect(() => generateJsonSchema(node)).toThrow(UnsupportedNodeKindError);
  });

  it("recursiveRef throws", () => {
    const node = {
      kind: "recursiveRef",
      targetId: "com.x.Y",
    } as unknown as Parameters<typeof generateJsonSchema>[0];
    expect(() => generateJsonSchema(node)).toThrow(UnsupportedNodeKindError);
  });

  it("transform throws", () => {
    const node = {
      kind: "transform",
      source: { kind: "string" },
      transformId: "t1",
    } as unknown as Parameters<typeof generateJsonSchema>[0];
    expect(() => generateJsonSchema(node)).toThrow(UnsupportedNodeKindError);
  });

  it("runtime refinement throws with kind 'runtimeRefinement' (Decision #11)", () => {
    const node = {
      kind: "string",
      refinements: [{ kind: "runtime", code: "invalid_tenant_slug" }],
    } as unknown as Parameters<typeof generateJsonSchema>[0];
    try {
      generateJsonSchema(node);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(UnsupportedNodeKindError);
      const err = e as UnsupportedNodeKindError;
      expect(err.code).toBe("UNSUPPORTED_NODE_KIND");
      expect(err.kind).toBe("runtimeRefinement");
      expect(err.generator).toBe("jsonSchema");
    }
  });

  it("regex with non-empty flags throws with kind 'regexFlags' (Decision #11a)", () => {
    // Use a builder-produced node so the IR shape is realistic.
    const node = s.string().regex(/^abc/i).node;
    try {
      generateJsonSchema(node);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(UnsupportedNodeKindError);
      const err = e as UnsupportedNodeKindError;
      expect(err.code).toBe("UNSUPPORTED_NODE_KIND");
      expect(err.kind).toBe("regexFlags");
      expect(err.generator).toBe("jsonSchema");
    }
  });

  it("regex without flags does NOT throw and emits pattern", () => {
    const out = generateJsonSchema(
      s.string().regex(/^abc$/).id("com.x.Y").version("1.0.0").node,
    );
    const parsed = JSON.parse(out) as { pattern?: string };
    expect(parsed.pattern).toBe("^abc$");
  });
});
