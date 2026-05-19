import { describe, expect, it } from "vitest";
import { s } from "../../src/index.js";
import { generateOpenApiSchemaComponent } from "../../src/generators/openapi.js";
import { UnsupportedNodeKindError } from "../../src/generators/errors.js";

const snapshotPath = (name: string): string =>
  `./__snapshots__/openapi/${name}.openapi.json`;

describe("generateOpenApiSchemaComponent — leaves", () => {
  it("string", async () => {
    await expect(
      generateOpenApiSchemaComponent(s.string().id("com.x.S").version("1.0.0").node),
    ).toMatchFileSnapshot(snapshotPath("leaf-string"));
  });
  it("number with int + min + max", async () => {
    await expect(
      generateOpenApiSchemaComponent(
        s.number().int().min(0).max(100).id("com.x.N").version("1.0.0").node,
      ),
    ).toMatchFileSnapshot(snapshotPath("leaf-number-int-bounded"));
  });
  it("boolean", async () => {
    await expect(
      generateOpenApiSchemaComponent(s.boolean().id("com.x.B").version("1.0.0").node),
    ).toMatchFileSnapshot(snapshotPath("leaf-boolean"));
  });
  it("literal → const", async () => {
    await expect(
      generateOpenApiSchemaComponent(
        s.literal("admin").id("com.x.Role").version("1.0.0").node,
      ),
    ).toMatchFileSnapshot(snapshotPath("leaf-literal"));
  });
  it("string enum", async () => {
    await expect(
      generateOpenApiSchemaComponent(
        s.enum(["red", "green", "blue"] as const).id("com.x.Color").version("1.0.0").node,
      ),
    ).toMatchFileSnapshot(snapshotPath("leaf-enum"));
  });
});

describe("generateOpenApiSchemaComponent — composites + absence semantics", () => {
  it("audit User example: input-shape per the shared contract", async () => {
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

    const out = generateOpenApiSchemaComponent(User);
    await expect(out).toMatchFileSnapshot(snapshotPath("audit-user"));

    // Same absence-semantics rules as v0.3 JSON Schema (shared fragment).
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

describe("generateOpenApiSchemaComponent — object policy (shared with v0.3)", () => {
  it("stripUnknown → additionalProperties: true + x-nekostack-strip: true", () => {
    const out = generateOpenApiSchemaComponent(
      s.object({ id: s.string() }).stripUnknown().id("com.x.O").version("1.0.0").node,
    );
    expect(out).toContain('"additionalProperties": true');
    expect(out).toContain('"x-nekostack-strip": true');
  });
});

describe("generateOpenApiSchemaComponent — component-position rules (Decision #5)", () => {
  it("does NOT emit $schema (OpenAPI declares dialect at document root)", () => {
    const out = generateOpenApiSchemaComponent(
      s.string().id("com.x.Y").version("1.0.0").node,
    );
    const parsed = JSON.parse(out) as Record<string, unknown>;
    expect(parsed.$schema).toBeUndefined();
  });

  it("does NOT emit $id (component identity is the position in the document)", () => {
    const out = generateOpenApiSchemaComponent(
      s.string().id("com.x.Y").version("1.0.0").node,
    );
    const parsed = JSON.parse(out) as Record<string, unknown>;
    expect(parsed.$id).toBeUndefined();
  });

  it("anonymous schema → still no $id; provenance schemaId: null", () => {
    const out = generateOpenApiSchemaComponent(s.string().node);
    const parsed = JSON.parse(out) as Record<string, unknown> & {
      "x-nekostack": Record<string, unknown>;
    };
    expect(parsed.$id).toBeUndefined();
    expect(parsed["x-nekostack"].schemaId).toBeNull();
  });

  it("never emits $defs in v0.4 (Decision #7 — inline only, same as v0.3)", () => {
    const out = generateOpenApiSchemaComponent(
      s
        .object({ a: s.object({ b: s.string() }) })
        .id("com.x.Y")
        .version("1.0.0").node,
    );
    const parsed = JSON.parse(out) as Record<string, unknown>;
    expect(parsed.$defs).toBeUndefined();
  });
});

describe("generateOpenApiSchemaComponent — provenance", () => {
  it("emits x-nekostack with generator: 'openApi'", () => {
    const out = generateOpenApiSchemaComponent(
      s.string().id("com.x.Y").version("1.0.0").node,
    );
    const prov = (JSON.parse(out) as { "x-nekostack": Record<string, unknown> })[
      "x-nekostack"
    ];
    expect(prov.generator).toBe("openApi");
    expect(prov.generatorVersion).toMatch(/^@nekostack\/schema@/);
    expect(prov.irHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(prov.schemaId).toBe("com.x.Y");
    expect(prov.schemaVersion).toBe("1.0.0");
  });

  it("irHash equals the JSON Schema generator's irHash for the same node (proof of shared IR)", async () => {
    const { generateJsonSchema } = await import("../../src/generators/json-schema.js");
    const node = s
      .object({ id: s.string().uuid() })
      .id("com.x.Y")
      .version("1.0.0").node;
    const oai = JSON.parse(generateOpenApiSchemaComponent(node)) as {
      "x-nekostack": { irHash: string };
    };
    const js = JSON.parse(generateJsonSchema(node)) as {
      "x-nekostack": { irHash: string };
    };
    expect(oai["x-nekostack"].irHash).toBe(js["x-nekostack"].irHash);
  });
});

describe("generateOpenApiSchemaComponent — determinism", () => {
  it("same IR → byte-identical output", () => {
    const node = s.object({ a: s.string().min(1) }).id("com.x.Y").version("1.0.0").node;
    expect(generateOpenApiSchemaComponent(node)).toBe(
      generateOpenApiSchemaComponent(node),
    );
  });

  it("output ends with exactly one newline", () => {
    const out = generateOpenApiSchemaComponent(s.string().id("com.x.Y").version("1").node);
    expect(out.endsWith("\n")).toBe(true);
    expect(out.endsWith("\n\n")).toBe(false);
  });
});

describe("generateOpenApiSchemaComponent — options contract (v0.7)", () => {
  // v0.4: OpenApiGeneratorOptions was `Record<string, never>` (no options).
  // v0.7: narrowed to exactly the ProvenanceOptions slice — `sourceHash` is
  // now accepted; every other field (idBase, discriminator, etc.) continues
  // to fail at compile time because the interface declares no own members.
  // The `@ts-expect-error` directives REQUIRE the next line to error, so
  // these assertions catch the regression both ways: if `sourceHash` were
  // accidentally removed from the surface, the positive test below would
  // fail at compile time; if the interface widened to accept arbitrary
  // fields, the @ts-expect-error lines would themselves fail.
  it("accepts sourceHash; rejects every other option at compile time", () => {
    const node = s.string().id("com.x.Y").version("1.0.0").node;

    // Positive: sourceHash is allowed (v0.7).
    generateOpenApiSchemaComponent(node, {
      sourceHash:
        "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    });

    // Negative: every unrelated option still rejected.
    // @ts-expect-error discriminator is not on OpenApiGeneratorOptions
    generateOpenApiSchemaComponent(node, { discriminator: true });
    // @ts-expect-error idBase is JSON-Schema-only, not on OpenAPI options
    generateOpenApiSchemaComponent(node, { idBase: "https://x" });

    // The empty-options + no-options calls remain valid.
    expect(() => generateOpenApiSchemaComponent(node)).not.toThrow();
    expect(() => generateOpenApiSchemaComponent(node, {})).not.toThrow();
  });
});

describe("generateOpenApiSchemaComponent — UnsupportedNodeKindError reports 'openApi'", () => {
  it("date throws with generator: 'openApi'", () => {
    const node = { kind: "date", variant: "isoDateTime" } as unknown as Parameters<
      typeof generateOpenApiSchemaComponent
    >[0];
    try {
      generateOpenApiSchemaComponent(node);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(UnsupportedNodeKindError);
      const err = e as UnsupportedNodeKindError;
      expect(err.code).toBe("UNSUPPORTED_NODE_KIND");
      expect(err.kind).toBe("date");
      expect(err.generator).toBe("openApi");
    }
  });

  it("union throws with generator: 'openApi'", () => {
    const node = { kind: "union", options: [] } as unknown as Parameters<
      typeof generateOpenApiSchemaComponent
    >[0];
    expect(() => generateOpenApiSchemaComponent(node)).toThrow(
      UnsupportedNodeKindError,
    );
  });

  it("runtime refinement throws with kind 'runtimeRefinement', generator 'openApi'", () => {
    const node = {
      kind: "string",
      refinements: [{ kind: "runtime", code: "invalid_tenant_slug" }],
    } as unknown as Parameters<typeof generateOpenApiSchemaComponent>[0];
    try {
      generateOpenApiSchemaComponent(node);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(UnsupportedNodeKindError);
      const err = e as UnsupportedNodeKindError;
      expect(err.kind).toBe("runtimeRefinement");
      expect(err.generator).toBe("openApi");
    }
  });

  it("regex with non-empty flags throws with kind 'regexFlags', generator 'openApi'", () => {
    const node = s.string().regex(/^abc/i).node;
    try {
      generateOpenApiSchemaComponent(node);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(UnsupportedNodeKindError);
      const err = e as UnsupportedNodeKindError;
      expect(err.kind).toBe("regexFlags");
      expect(err.generator).toBe("openApi");
    }
  });
});
