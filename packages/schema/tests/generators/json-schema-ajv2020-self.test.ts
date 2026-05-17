import { describe, expect, it } from "vitest";
// IMPORTANT: import the draft-2020-12 class, not the default Ajv (which is
// draft-07 and is NOT backwards-compatible with 2020-12). Using `ajv` here
// would silently configure the wrong dialect.
import Ajv2020 from "ajv/dist/2020.js";
import { s } from "../../src/index.js";
import { generateJsonSchema } from "../../src/generators/json-schema.js";

/**
 * Self-conformance: every JSON Schema we generate must itself be a valid
 * draft-2020-12 document. Ajv2020.addSchema() validates the schema's own
 * structure against the meta-schema; if our output is malformed, this
 * catches it.
 */

function ajv(): Ajv2020 {
  return new Ajv2020({ strict: false });
}

describe("Ajv2020 self-conformance — generated JSON Schema is valid draft 2020-12", () => {
  it("primitive: string", () => {
    const schema = JSON.parse(generateJsonSchema(s.string().id("com.x.S").version("1").node));
    expect(() => ajv().compile(schema)).not.toThrow();
  });

  it("number with refinements", () => {
    const schema = JSON.parse(
      generateJsonSchema(s.number().int().min(0).max(100).id("com.x.N").version("1").node),
    );
    expect(() => ajv().compile(schema)).not.toThrow();
  });

  it("nested object with the full absence-semantics matrix", () => {
    const User = s
      .object({
        name: s.string(),
        nickname: s.string().optional(),
        bio: s.string().nullable(),
        handle: s.string().nullish(),
        role: s.string().default("member"),
      })
      .id("com.x.User")
      .version("1.0.0").node;
    const schema = JSON.parse(generateJsonSchema(User));
    expect(() => ajv().compile(schema)).not.toThrow();
  });

  it("object with strict / passthrough / stripUnknown policies", () => {
    const cases = [
      s.object({ id: s.string() }).id("com.x.A").version("1").node,
      s.object({ id: s.string() }).passthrough().id("com.x.B").version("1").node,
      s.object({ id: s.string() }).stripUnknown().id("com.x.C").version("1").node,
    ];
    for (const node of cases) {
      const schema = JSON.parse(generateJsonSchema(node));
      expect(() => ajv().compile(schema)).not.toThrow();
    }
  });

  it("array of objects", () => {
    const node = s
      .array(s.object({ id: s.string().uuid() }))
      .id("com.x.Items")
      .version("1").node;
    const schema = JSON.parse(generateJsonSchema(node));
    expect(() => ajv().compile(schema)).not.toThrow();
  });

  it("URL-shaped $id via idBase", () => {
    const out = generateJsonSchema(
      s.string().id("com.x.Y").version("1.0.0").node,
      { idBase: "https://schemas.example.com" },
    );
    const schema = JSON.parse(out);
    expect(() => ajv().compile(schema)).not.toThrow();
  });
});
