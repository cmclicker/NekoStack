import { describe, expect, it } from "vitest";
import { bundleFromString, createConfig } from "@redocly/openapi-core";
import { s } from "../../src/index.js";
import { generateOpenApiSchemaComponent } from "../../src/generators/openapi.js";
import type { SchemaNode } from "../../src/index.js";

/**
 * Redocly round-trip: compose the emitted component schema into a synthetic
 * OpenAPI 3.1 document and validate via @redocly/openapi-core. Catches
 * spec violations that mere JSON validity wouldn't.
 *
 * The OpenAPI Specification is authoritative; Redocly is an actively
 * maintained validation tool we delegate to. Per the v0.4 plan's fallback
 * clause, if @redocly/openapi-core's programmatic API proves impractical,
 * tests may switch to spawning the Redocly CLI — the validation
 * requirement is unchanged.
 */

interface BundleProblem {
  severity?: string;
  message?: string;
}

/** Compose a minimal valid OpenAPI 3.1 document containing the emitted component. */
function syntheticDoc(componentJson: string, name = "Subject"): string {
  const component = JSON.parse(componentJson) as Record<string, unknown>;
  const doc = {
    openapi: "3.1.0",
    info: { title: "NekoStack schema-fixture", version: "0.0.0" },
    paths: {},
    components: {
      schemas: {
        [name]: component,
      },
    },
  };
  return JSON.stringify(doc);
}

/**
 * Bundle the synthetic doc through Redocly and return any blocking
 * problems. Redocly's lint API surfaces a `problems` array; severity
 * `error` (and below `warn` if we choose to be strict) is what would
 * cause a CLI run to exit non-zero.
 */
async function validate(node: SchemaNode, name = "Subject"): Promise<BundleProblem[]> {
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

describe("OpenAPI Redocly round-trip — synthetic 3.1 document validates clean", () => {
  it("string", async () => {
    const errs = await validate(s.string().id("com.x.S").version("1.0.0").node);
    expect(errs).toEqual([]);
  });

  it("number with int + bounds", async () => {
    const errs = await validate(
      s.number().int().min(0).max(100).id("com.x.N").version("1.0.0").node,
    );
    expect(errs).toEqual([]);
  });

  it("audit User example (full absence-semantics matrix)", async () => {
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
    const errs = await validate(User, "User");
    expect(errs).toEqual([]);
  });

  it("array of objects", async () => {
    const errs = await validate(
      s
        .array(s.object({ id: s.string().uuid() }))
        .id("com.x.Items")
        .version("1.0.0").node,
      "Items",
    );
    expect(errs).toEqual([]);
  });

  it("stripUnknown object (additionalProperties: true + x-nekostack-strip)", async () => {
    const errs = await validate(
      s.object({ id: s.string() }).stripUnknown().id("com.x.O").version("1.0.0").node,
      "O",
    );
    expect(errs).toEqual([]);
  });

  it("default-bearing field (annotation + x-nekostack-default-applied-by)", async () => {
    const errs = await validate(
      s
        .object({ role: s.string().default("member") })
        .id("com.x.D")
        .version("1.0.0").node,
      "D",
    );
    expect(errs).toEqual([]);
  });
});
