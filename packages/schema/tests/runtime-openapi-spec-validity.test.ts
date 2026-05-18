/**
 * Step 8a — Decision #19a OpenAPI spec-validity carry-forward.
 *
 * For every fixture shape exercised by the v0.6 runtime parity
 * matrix (Step 8 `semantic-parity.test.ts`), prove that the same
 * `SchemaNode` still emits OpenAPI 3.1 components that compose into
 * a synthetic OpenAPI document and pass `@redocly/openapi-core`
 * structural validation.
 *
 * **Scope-only**: spec validity. **Not** a runtime data oracle.
 * Redocly was explicitly excluded from the four-oracle matrix in
 * Step 8 because it's not a runtime input validator — it validates
 * OpenAPI documents, not user data. This file is the separate
 * carry-forward that keeps spec validity tested without conflating
 * it with runtime parity.
 *
 * Sibling to `tests/generators/openapi-redocly.test.ts`, which tested
 * the v0.4 generator's output shape. This file's fixtures track the
 * v0.6 runtime supported subset (Step 8) so a generator change that
 * silently breaks OpenAPI for any runtime-valid schema is caught here.
 *
 * Each fixture builds a `SchemaNode`, emits the component via
 * `generateOpenApiSchemaComponent`, composes a minimal valid 3.1
 * document, runs Redocly, and asserts zero `error`-severity
 * problems.
 */
import { describe, expect, it } from "vitest";
import { bundleFromString, createConfig } from "@redocly/openapi-core";
import { s } from "../src/index.js";
import { generateOpenApiSchemaComponent } from "../src/generators/openapi.js";
import type { SchemaNode } from "../src/index.js";

interface BundleProblem {
  severity?: string;
  message?: string;
}

/**
 * Compose a minimal valid OpenAPI 3.1 document containing the emitted
 * component. `jsonSchemaDialect` is set to draft 2020-12 to match
 * the OpenAPI generator's documented contract.
 */
function syntheticDoc(componentJson: string, name = "Subject"): string {
  const component = JSON.parse(componentJson) as Record<string, unknown>;
  return JSON.stringify({
    openapi: "3.1.0",
    jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema",
    info: { title: "NekoStack v0.6 runtime spec-validity", version: "0.0.0" },
    paths: {},
    components: { schemas: { [name]: component } },
  });
}

async function validate(
  node: SchemaNode,
  name = "Subject",
): Promise<BundleProblem[]> {
  const docSource = syntheticDoc(generateOpenApiSchemaComponent(node), name);
  const config = await createConfig({});
  const result = await bundleFromString({
    source: docSource,
    config,
    base: null,
  });
  const problems = (result.problems ?? []) as BundleProblem[];
  return problems.filter((p) => p.severity === "error");
}

// Helper to stamp the obligatory id + version on every fixture so the
// generated component has stable provenance. The OpenAPI generator
// emits anonymous components without these, but the per-fixture
// noise of including them inline obscures the parity-with-Step-8
// shape. One stamper, applied at the .node-extraction step.
function withId<T extends { id(s: string): T; version(v: string): T }>(
  schema: T,
  id: string,
): T {
  return schema.id(id).version("1.0.0");
}

describe("runtime spec-validity — primitives", () => {
  it("string", async () => {
    const errs = await validate(withId(s.string(), "com.x.Str").node, "Str");
    expect(errs).toEqual([]);
  });

  it("number", async () => {
    const errs = await validate(withId(s.number(), "com.x.Num").node, "Num");
    expect(errs).toEqual([]);
  });

  it("boolean", async () => {
    const errs = await validate(withId(s.boolean(), "com.x.Bool").node, "Bool");
    expect(errs).toEqual([]);
  });
});

describe("runtime spec-validity — literal + enum", () => {
  it("string literal", async () => {
    const errs = await validate(
      withId(s.literal("ok"), "com.x.Lit").node,
      "Lit",
    );
    expect(errs).toEqual([]);
  });

  it("string enum", async () => {
    const errs = await validate(
      withId(s.enum(["red", "green", "blue"]), "com.x.Color").node,
      "Color",
    );
    expect(errs).toEqual([]);
  });

  it("numeric enum", async () => {
    const errs = await validate(
      withId(s.enum([1, 2, 3]), "com.x.NumEnum").node,
      "NumEnum",
    );
    expect(errs).toEqual([]);
  });
});

describe("runtime spec-validity — arrays", () => {
  it("array of strings", async () => {
    const errs = await validate(
      withId(s.array(s.string()), "com.x.StrArr").node,
      "StrArr",
    );
    expect(errs).toEqual([]);
  });

  it("array with minItems/maxItems", async () => {
    const errs = await validate(
      withId(s.array(s.string()).min(2).max(4), "com.x.SizedArr").node,
      "SizedArr",
    );
    expect(errs).toEqual([]);
  });

  it("array of objects", async () => {
    const errs = await validate(
      withId(s.array(s.object({ id: s.string() })), "com.x.ObjArr").node,
      "ObjArr",
    );
    expect(errs).toEqual([]);
  });
});

describe("runtime spec-validity — objects + required fields", () => {
  it("object with required fields", async () => {
    const errs = await validate(
      withId(
        s.object({ id: s.string(), age: s.number().int() }),
        "com.x.User",
      ).node,
      "User",
    );
    expect(errs).toEqual([]);
  });

  it("nested object", async () => {
    const errs = await validate(
      withId(
        s.object({
          profile: s.object({ name: s.string(), tags: s.array(s.string()) }),
        }),
        "com.x.Nested",
      ).node,
      "Nested",
    );
    expect(errs).toEqual([]);
  });
});

describe("runtime spec-validity — object unknown-key policies", () => {
  it("strict (default)", async () => {
    const errs = await validate(
      withId(s.object({ id: s.string() }), "com.x.Strict").node,
      "Strict",
    );
    expect(errs).toEqual([]);
  });

  it("passthrough", async () => {
    const errs = await validate(
      withId(
        s.object({ id: s.string() }).passthrough(),
        "com.x.Pass",
      ).node,
      "Pass",
    );
    expect(errs).toEqual([]);
  });

  it("stripUnknown (emits x-nekostack-strip)", async () => {
    const errs = await validate(
      withId(
        s.object({ id: s.string() }).stripUnknown(),
        "com.x.Strip",
      ).node,
      "Strip",
    );
    expect(errs).toEqual([]);
  });
});

describe("runtime spec-validity — absence semantics in object fields", () => {
  it("optional field", async () => {
    const errs = await validate(
      withId(
        s.object({ name: s.string().optional() }),
        "com.x.Opt",
      ).node,
      "Opt",
    );
    expect(errs).toEqual([]);
  });

  it("nullable field", async () => {
    const errs = await validate(
      withId(
        s.object({ name: s.string().nullable() }),
        "com.x.Nul",
      ).node,
      "Nul",
    );
    expect(errs).toEqual([]);
  });

  it("nullish field", async () => {
    const errs = await validate(
      withId(
        s.object({ name: s.string().nullish() }),
        "com.x.Nsh",
      ).node,
      "Nsh",
    );
    expect(errs).toEqual([]);
  });

  it("default-bearing field", async () => {
    const errs = await validate(
      withId(
        s.object({ name: s.string().default("anon") }),
        "com.x.Def",
      ).node,
      "Def",
    );
    expect(errs).toEqual([]);
  });

  it("default + nullable", async () => {
    const errs = await validate(
      withId(
        s.object({ name: s.string().nullable().default("anon") }),
        "com.x.DefNul",
      ).node,
      "DefNul",
    );
    expect(errs).toEqual([]);
  });

  it("full absence-semantics matrix in one object", async () => {
    // Same shape as `openapi-redocly.test.ts`'s User fixture, kept
    // here so the v0.6 runtime carry-forward is self-contained.
    const errs = await validate(
      withId(
        s.object({
          name: s.string(),
          nickname: s.string().optional(),
          bio: s.string().nullable(),
          handle: s.string().nullish(),
          role: s.string().default("member"),
        }),
        "com.x.Matrix",
      ).node,
      "Matrix",
    );
    expect(errs).toEqual([]);
  });
});

describe("runtime spec-validity — string portable refinements", () => {
  it("min / max / length", async () => {
    expect(
      await validate(
        withId(s.string().min(3), "com.x.SMin").node,
        "SMin",
      ),
    ).toEqual([]);
    expect(
      await validate(
        withId(s.string().max(10), "com.x.SMax").node,
        "SMax",
      ),
    ).toEqual([]);
    expect(
      await validate(
        withId(s.string().length(8), "com.x.SLen").node,
        "SLen",
      ),
    ).toEqual([]);
  });

  it("regex without flags", async () => {
    const errs = await validate(
      withId(s.string().regex(/^foo/), "com.x.SRx").node,
      "SRx",
    );
    expect(errs).toEqual([]);
  });

  it("email / uuid / url formats", async () => {
    expect(
      await validate(
        withId(s.string().email(), "com.x.SEmail").node,
        "SEmail",
      ),
    ).toEqual([]);
    expect(
      await validate(
        withId(s.string().uuid(), "com.x.SUuid").node,
        "SUuid",
      ),
    ).toEqual([]);
    expect(
      await validate(
        withId(s.string().url(), "com.x.SUrl").node,
        "SUrl",
      ),
    ).toEqual([]);
  });
});

describe("runtime spec-validity — number portable refinements", () => {
  it("int", async () => {
    const errs = await validate(
      withId(s.number().int(), "com.x.NInt").node,
      "NInt",
    );
    expect(errs).toEqual([]);
  });

  it("min / max", async () => {
    expect(
      await validate(
        withId(s.number().min(0), "com.x.NMin").node,
        "NMin",
      ),
    ).toEqual([]);
    expect(
      await validate(
        withId(s.number().max(100), "com.x.NMax").node,
        "NMax",
      ),
    ).toEqual([]);
  });

  it("gt / lt (exclusive bounds)", async () => {
    expect(
      await validate(
        withId(s.number().gt(0), "com.x.NGt").node,
        "NGt",
      ),
    ).toEqual([]);
    expect(
      await validate(
        withId(s.number().lt(100), "com.x.NLt").node,
        "NLt",
      ),
    ).toEqual([]);
  });

  it("multipleOf", async () => {
    const errs = await validate(
      withId(s.number().multipleOf(5), "com.x.NMul").node,
      "NMul",
    );
    expect(errs).toEqual([]);
  });
});

describe("runtime spec-validity — composed refinements", () => {
  it("string min + max chained", async () => {
    const errs = await validate(
      withId(s.string().min(2).max(4), "com.x.SMM").node,
      "SMM",
    );
    expect(errs).toEqual([]);
  });

  it("number int + min + max chained", async () => {
    const errs = await validate(
      withId(s.number().int().min(0).max(100), "com.x.NIMM").node,
      "NIMM",
    );
    expect(errs).toEqual([]);
  });
});
