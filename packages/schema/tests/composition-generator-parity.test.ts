import { describe, expect, it } from "vitest";
import { s } from "../src/index.js";
import {
  generateJsonSchema,
  generateOpenApiSchemaComponent,
  generateTypeScript,
  generateZod,
} from "../src/index.js";

/**
 * Decision #16: composition produces a plain ObjectNode; generators handle
 * it via the shared `emitSchemaFragment`. These tests prove that — for each
 * composition operator, an equivalent hand-written `s.object({...})` would
 * produce byte-identical output through every generator.
 *
 * If composition ever leaks into the IR in a way generators care about
 * (e.g., a future `metadata.derivedFrom` history), these tests fail and
 * the contract has to be re-justified.
 */

const Composed = s
  .object({ id: s.string(), name: s.string() })
  .extend({ email: s.string().email() });

const HandWritten = s.object({
  id: s.string(),
  name: s.string(),
  email: s.string().email(),
});

describe("composition parity: hand-written ≡ composed for each generator", () => {
  it("TypeScript output", () => {
    expect(generateTypeScript(Composed.node)).toBe(
      generateTypeScript(HandWritten.node),
    );
  });

  it("Zod output", () => {
    expect(generateZod(Composed.node)).toBe(generateZod(HandWritten.node));
  });

  it("JSON Schema output", () => {
    expect(generateJsonSchema(Composed.node)).toBe(
      generateJsonSchema(HandWritten.node),
    );
  });

  it("OpenAPI 3.1 component output", () => {
    expect(generateOpenApiSchemaComponent(Composed.node)).toBe(
      generateOpenApiSchemaComponent(HandWritten.node),
    );
  });
});

describe("composition parity: merge with left conflict resolution", () => {
  const A = s.object({ id: s.string(), shared: s.string() });
  const B = s.object({ name: s.string(), shared: s.number() });
  const Merged = A.merge(B, { conflict: "left" });
  // Equivalent hand-written shape — left's `shared` wins.
  const HandWrittenLeft = s.object({
    id: s.string(),
    shared: s.string(),
    name: s.string(),
  });

  it("Zod output matches hand-written", () => {
    expect(generateZod(Merged.node)).toBe(generateZod(HandWrittenLeft.node));
  });

  it("JSON Schema output matches hand-written", () => {
    expect(generateJsonSchema(Merged.node)).toBe(
      generateJsonSchema(HandWrittenLeft.node),
    );
  });
});

describe("composition parity: partial strips defaults end-to-end", () => {
  const Source = s.object({ role: s.string().default("member") });
  const Partial = Source.partial();
  // After partial: role is optional, default stripped.
  const HandWritten = s.object({ role: s.string().optional() });

  it("Zod output matches hand-written (no .default() in chain)", () => {
    const out = generateZod(Partial.node);
    expect(out).not.toContain(".default(");
    expect(out).toBe(generateZod(HandWritten.node));
  });

  it("JSON Schema output matches hand-written (no `default` key, no extension)", () => {
    const out = generateJsonSchema(Partial.node);
    expect(out).not.toContain('"default"');
    expect(out).not.toContain("x-nekostack-default-applied-by");
    expect(out).toBe(generateJsonSchema(HandWritten.node));
  });
});
