import { bench, describe } from "vitest";
import { z } from "zod";
import { s, parse, validate, generateTypeScript, generateZod, generateJsonSchema, generateOpenApiSchemaComponent } from "../src/index.js";

// =============================================================================
// The Setup: NekoStack vs Zod
// =============================================================================

// 1. Raw Zod implementation
const ZodUser = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(["admin", "member"]).default("member"),
  metadata: z.object({
    lastLogin: z.number().int().min(0),
    tags: z.array(z.string()).max(10).optional()
  }).strict()
}).strict();

// 2. NekoStack implementation
const NekoUser = s.object({
  id: s.string().uuid(),
  email: s.string().email(),
  role: s.enum(["admin", "member"]).default("member"),
  metadata: s.object({
    lastLogin: s.number().int().min(0),
    tags: s.array(s.string()).max(10).optional()
  })
}).id("com.nekostack.bench.User").version("1.0.0");

// The Payload
const validPayload = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  email: "test@example.com",
  // role is omitted to trigger the default-fill logic
  metadata: {
    lastLogin: 1680000000000,
    tags: ["premium", "active"]
  }
};

// =============================================================================
// The Benchmarks
// =============================================================================

describe("Runtime Validation Overhead", () => {
  bench("Zod (Raw) - z.parse()", () => {
    ZodUser.parse(validPayload);
  });

  bench("NekoStack - parse() [Cached Hot Path]", () => {
    // Under the hood, NekoStack uses a WeakMap to cache the compiled ZodTypeAny.
    // This measures the overhead of the WeakMap lookup + issue normalization.
    parse(NekoUser, validPayload);
  });

  bench("Zod (Raw) - z.safeParse()", () => {
    ZodUser.safeParse(validPayload);
  });

  bench("NekoStack - validate() [Structural Check]", () => {
    // validate() runs the stripped-defaults cache variant.
    validate(NekoUser, validPayload);
  });
});

describe("Generator Throughput", () => {
  bench("generateTypeScript", () => {
    generateTypeScript(NekoUser.node);
  });

  bench("generateZod", () => {
    generateZod(NekoUser.node);
  });

  bench("generateJsonSchema", () => {
    generateJsonSchema(NekoUser.node);
  });

  bench("generateOpenApiSchemaComponent", () => {
    generateOpenApiSchemaComponent(NekoUser.node);
  });
});
