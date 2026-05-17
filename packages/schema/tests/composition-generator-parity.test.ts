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
 * it via the shared `emitSchemaFragment`. This file proves that — for every
 * composition operator, the composed schema emits **byte-identical output
 * to a hand-written equivalent** through every generator.
 *
 * If composition ever leaks into the IR in a way generators care about
 * (e.g., a future `metadata.derivedFrom` history), these tests fail and
 * the contract has to be re-justified.
 *
 * Test surface: 7 operators (extend, pick, omit, partial, required, merge,
 * override) plus two merge resolution variants (conflict:"left" + "right"),
 * each fanned out across 4 generators = 36 parity assertions. Plus four
 * default-strip end-to-end checks (one per generator) proving `partial`'s
 * IR-level default removal is visible in every output format.
 */

const generators = [
  ["TypeScript", generateTypeScript],
  ["Zod", generateZod],
  ["JSON Schema", generateJsonSchema],
  ["OpenAPI 3.1 component", generateOpenApiSchemaComponent],
] as const;

// ---------- Per-operator parity ----------

describe("extend parity (all 4 generators)", () => {
  const composed = s
    .object({ id: s.string(), name: s.string() })
    .extend({ email: s.string().email() });
  const handWritten = s.object({
    id: s.string(),
    name: s.string(),
    email: s.string().email(),
  });
  for (const [name, gen] of generators) {
    it(`${name} byte-identical`, () => {
      expect(gen(composed.node)).toBe(gen(handWritten.node));
    });
  }
});

describe("pick parity (all 4 generators)", () => {
  const Base = s.object({ id: s.string(), name: s.string(), age: s.number() });
  const composed = Base.pick({ id: true, name: true });
  const handWritten = s.object({ id: s.string(), name: s.string() });
  for (const [name, gen] of generators) {
    it(`${name} byte-identical`, () => {
      expect(gen(composed.node)).toBe(gen(handWritten.node));
    });
  }
});

describe("omit parity (all 4 generators)", () => {
  const Base = s.object({ id: s.string(), name: s.string(), age: s.number() });
  const composed = Base.omit({ age: true });
  const handWritten = s.object({ id: s.string(), name: s.string() });
  for (const [name, gen] of generators) {
    it(`${name} byte-identical`, () => {
      expect(gen(composed.node)).toBe(gen(handWritten.node));
    });
  }
});

describe("partial parity (all 4 generators)", () => {
  const Base = s.object({ id: s.string(), name: s.string() });
  const composed = Base.partial();
  // Hand-written: each field independently .optional()
  const handWritten = s.object({
    id: s.string().optional(),
    name: s.string().optional(),
  });
  for (const [name, gen] of generators) {
    it(`${name} byte-identical`, () => {
      expect(gen(composed.node)).toBe(gen(handWritten.node));
    });
  }
});

describe("required parity (all 4 generators)", () => {
  const Base = s.object({
    id: s.string().optional(),
    name: s.string().optional(),
  });
  const composed = Base.required();
  // Hand-written: each field without .optional()
  const handWritten = s.object({ id: s.string(), name: s.string() });
  for (const [name, gen] of generators) {
    it(`${name} byte-identical`, () => {
      expect(gen(composed.node)).toBe(gen(handWritten.node));
    });
  }
});

describe("merge parity — disjoint fields (all 4 generators)", () => {
  const A = s.object({ id: s.string() });
  const B = s.object({ name: s.string() });
  const composed = A.merge(B);
  const handWritten = s.object({ id: s.string(), name: s.string() });
  for (const [name, gen] of generators) {
    it(`${name} byte-identical`, () => {
      expect(gen(composed.node)).toBe(gen(handWritten.node));
    });
  }
});

describe("merge parity — conflict:'left' (all 4 generators)", () => {
  const A = s.object({ id: s.string(), shared: s.string() });
  const B = s.object({ name: s.string(), shared: s.number() });
  const composed = A.merge(B, { conflict: "left" });
  // Left wins on `shared` → string. Field iteration order: {...A, ...newKeysFromB}
  const handWritten = s.object({
    id: s.string(),
    shared: s.string(),
    name: s.string(),
  });
  for (const [name, gen] of generators) {
    it(`${name} byte-identical`, () => {
      expect(gen(composed.node)).toBe(gen(handWritten.node));
    });
  }
});

describe("merge parity — conflict:'right' (all 4 generators)", () => {
  const A = s.object({ id: s.string(), shared: s.string() });
  const B = s.object({ name: s.string(), shared: s.number() });
  const composed = A.merge(B, { conflict: "right" });
  // Right wins on `shared` → number. Field iteration order: {...A (with shared replaced), ...newKeysFromB}
  const handWritten = s.object({
    id: s.string(),
    shared: s.number(),
    name: s.string(),
  });
  for (const [name, gen] of generators) {
    it(`${name} byte-identical`, () => {
      expect(gen(composed.node)).toBe(gen(handWritten.node));
    });
  }
});

describe("override parity (all 4 generators)", () => {
  const Base = s.object({ id: s.string(), name: s.string() });
  const composed = Base.override({ id: s.number() });
  const handWritten = s.object({ id: s.number(), name: s.string() });
  for (const [name, gen] of generators) {
    it(`${name} byte-identical`, () => {
      expect(gen(composed.node)).toBe(gen(handWritten.node));
    });
  }
});

// ---------- Edge-case contracts that need explicit proof ----------

describe("partial strips defaults end-to-end (every generator's output reflects the strip)", () => {
  const Source = s.object({ role: s.string().default("member") });
  const Partial = Source.partial();
  const HandWritten = s.object({ role: s.string().optional() });

  it("TypeScript output matches the optional-form hand-written", () => {
    expect(generateTypeScript(Partial.node)).toBe(
      generateTypeScript(HandWritten.node),
    );
  });

  it("Zod output matches and contains no .default() in the chain", () => {
    const out = generateZod(Partial.node);
    expect(out).not.toContain(".default(");
    expect(out).toBe(generateZod(HandWritten.node));
  });

  it("JSON Schema output matches and contains no `default` key or x-nekostack-default-applied-by", () => {
    const out = generateJsonSchema(Partial.node);
    expect(out).not.toContain('"default"');
    expect(out).not.toContain("x-nekostack-default-applied-by");
    expect(out).toBe(generateJsonSchema(HandWritten.node));
  });

  it("OpenAPI 3.1 output matches and similarly has no default leakage", () => {
    const out = generateOpenApiSchemaComponent(Partial.node);
    expect(out).not.toContain('"default"');
    expect(out).not.toContain("x-nekostack-default-applied-by");
    expect(out).toBe(generateOpenApiSchemaComponent(HandWritten.node));
  });
});

