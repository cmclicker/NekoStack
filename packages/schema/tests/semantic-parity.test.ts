/**
 * Step 8 — Decision #19 runtime semantic-parity matrix.
 *
 * Four independent validators are run over the same fixture inputs;
 * all four must agree on accept/reject for every input. Disagreement
 * means a load-bearing engine has drifted from the others — most
 * likely the v0.2 source generator and the v0.6 runtime compiler
 * silently diverging after the Decision #6 shared-mapping extraction.
 *
 * Oracles:
 *   1. **NekoStack runtime** — `safeParse(schema, input).success`.
 *   2. **Generated-Zod execution** — emit source via
 *      `generateZod(schema.node)`, load + execute the emitted const
 *      expression with a real Zod runtime, call `.safeParse(input)`
 *      on the resulting schema.
 *      Explicitly NOT `compileZodSchema(...)` — the point is to
 *      cross-check the source generator and the runtime compiler.
 *   3. **Ajv 2020** — `ajv.compile(generateJsonSchema(schema.node))`
 *      then run the validator. The JSON Schema path is independent
 *      of Zod entirely.
 *   4. **Small IR-walker oracle** — a direct interpreter over the
 *      `SchemaNode` for the v0.6 supported subset. Walks the IR with
 *      its own logic; no Zod, no JSON Schema. Acts as the
 *      "from-scratch" truth source.
 *
 * Compare-only contract: accept/reject. Issue shapes are NOT
 * compared across engines (Ajv emits different codes than Zod;
 * Decision #12 normalization is tested in `runtime-issue-normalize`).
 *
 * Excluded by the v0.6 supported subset (these would throw or
 * underspecify in at least one engine): `date`, `union`,
 * `recursiveRef`, `transform`, and runtime refinements. Regex with
 * flags is also excluded because JSON Schema's `pattern` cannot
 * carry flags (Decision: throw at generate time).
 *
 * Redocly / OpenAPI spec-validity is the separate Step 8a — not in
 * this file.
 */
import { describe, expect, it } from "vitest";
import { z, type ZodTypeAny } from "zod";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { ValidateFunction } from "ajv";

import { s, type AnySchema, type SchemaNode } from "../src/index.js";
import type {
  ArrayNode,
  EnumNode,
  JsonValue,
  LiteralNode,
  ObjectNode,
  PortableRefinement,
} from "../src/ir/nodes.js";
import { generateZod } from "../src/generators/zod.js";
import { generateJsonSchema } from "../src/generators/json-schema.js";
import { safeParse } from "../src/runtime/parse.js";

// =============================================================================
// Oracle 2 — generated-Zod execution
// =============================================================================

/**
 * Load the code produced by `generateZod` into a real Zod runtime
 * and return the resulting `ZodTypeAny`. Mirrors the helper in
 * `tests/generators/zod-execution.test.ts`. The point: the source
 * generator and the runtime compiler must agree on every input even
 * though they share only the Decision #6 mapping interface.
 *
 * `new Function` is acceptable in test code (the no-eval invariant
 * is about production runtime); this is what proves the emitted
 * source is *executable*, not just byte-compatible with a snapshot.
 */
function executeZod(node: SchemaNode): ZodTypeAny {
  const code = generateZod(node);
  const match = code.match(/export const \w+ = ([\s\S]*?);\s*$/);
  if (!match) throw new Error("Generated code missing const declaration");
  const expr = match[1]!.replace(/\s+as\s+const\b/g, "");
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const fn = new Function("z", `return (${expr});`) as (
    z: typeof import("zod").z,
  ) => ZodTypeAny;
  return fn(z);
}

// =============================================================================
// Oracle 3 — Ajv 2020 over generated JSON Schema
// =============================================================================

function compileAjv(node: SchemaNode): ValidateFunction {
  // `strict: false` matches the existing tests' configuration and
  // accommodates `x-nekostack-strip` (an unknown vocabulary keyword
  // emitted for the stripUnknown policy).
  const ajv = new Ajv2020({ strict: false });
  addFormats(ajv);
  const schema = JSON.parse(generateJsonSchema(node));
  return ajv.compile(schema);
}

// =============================================================================
// Oracle 4 — small IR-walker oracle
// =============================================================================

/**
 * Independent direct interpreter over `SchemaNode` for the v0.6
 * supported subset. Knows nothing about Zod or JSON Schema. Returns
 * `true` for accept, `false` for reject.
 *
 * Scope: kinds (`string` / `number` / `boolean` / `literal` / `enum`
 * / `array` / `object`), portable refinements declared in v0.1, and
 * modifiers `optional` / `nullable` / `default`. Anything outside
 * this subset throws — the surrounding test fixtures stay inside the
 * subset by construction.
 */
function oracle(node: SchemaNode, input: unknown): boolean {
  // Absence semantics first: a `default` modifier implies
  // `optional: true` (builder invariant), so the default branch is
  // covered by the optional check.
  if (input === undefined) {
    return node.modifiers?.optional === true;
  }
  if (input === null) {
    return node.modifiers?.nullable === true;
  }
  if (!baseAccepts(node, input)) return false;
  return refinementsAccept(node, input);
}

function baseAccepts(node: SchemaNode, input: unknown): boolean {
  switch (node.kind) {
    case "string":
      return typeof input === "string";
    case "number":
      return typeof input === "number" && !Number.isNaN(input);
    case "boolean":
      return typeof input === "boolean";
    case "literal":
      return Object.is(input, (node as LiteralNode).value);
    case "enum":
      return (node as EnumNode).values.includes(input as never);
    case "array": {
      if (!Array.isArray(input)) return false;
      const arr = node as ArrayNode;
      return input.every((el) => oracle(arr.element, el));
    }
    case "object": {
      if (typeof input !== "object" || Array.isArray(input)) return false;
      const obj = node as ObjectNode;
      const inputObj = input as Record<string, unknown>;
      // Unknown-key policy: only `strict` rejects accept/reject-wise;
      // passthrough and stripUnknown both ACCEPT (the strip is an
      // output transform, not a validation behavior).
      if (obj.unknownKeys === "strict") {
        for (const key of Object.keys(inputObj)) {
          if (!(key in obj.fields)) return false;
        }
      }
      for (const [key, child] of Object.entries(obj.fields)) {
        if (!oracle(child, inputObj[key])) return false;
      }
      return true;
    }
    default:
      throw new Error(
        `Oracle does not support node kind: ${(node as { kind: string }).kind}`,
      );
  }
}

function refinementsAccept(node: SchemaNode, input: unknown): boolean {
  const refinements = node.refinements ?? [];
  for (const r of refinements) {
    if (r.kind === "runtime") {
      throw new Error("Oracle does not support runtime refinements");
    }
    if (r.kind !== "portable") continue;
    if (!refinementAccepts(r as PortableRefinement, input)) return false;
  }
  return true;
}

function refinementAccepts(r: PortableRefinement, input: unknown): boolean {
  const params = r.params ?? {};
  const num = (): number => params.value as number;
  switch (r.name) {
    case "minLength":
      return typeof input === "string" && input.length >= num();
    case "maxLength":
      return typeof input === "string" && input.length <= num();
    case "length":
      return typeof input === "string" && input.length === num();
    case "regex":
      return (
        typeof input === "string" &&
        new RegExp(String(params.source ?? ""), String(params.flags ?? "")).test(
          input,
        )
      );
    case "email":
      // Approximate but stricter than the email examples used below
      // demand. Fixture-side discipline keeps every input either
      // clearly valid or clearly invalid for all four oracles.
      return (
        typeof input === "string" &&
        /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input)
      );
    case "uuid":
      return (
        typeof input === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          input,
        )
      );
    case "url":
      if (typeof input !== "string") return false;
      try {
        new URL(input);
        return true;
      } catch {
        return false;
      }
    case "int":
      return typeof input === "number" && Number.isInteger(input);
    case "min":
      return typeof input === "number" && input >= num();
    case "max":
      return typeof input === "number" && input <= num();
    case "gt":
      return typeof input === "number" && input > num();
    case "lt":
      return typeof input === "number" && input < num();
    case "multipleOf":
      return typeof input === "number" && input % num() === 0;
    case "minItems":
      return Array.isArray(input) && input.length >= num();
    case "maxItems":
      return Array.isArray(input) && input.length <= num();
  }
}

// =============================================================================
// Harness
// =============================================================================

interface Oracles {
  runtime: (input: unknown) => boolean;
  generatedZod: (input: unknown) => boolean;
  ajv: (input: unknown) => boolean;
  walker: (input: unknown) => boolean;
}

function fourOracles(schema: AnySchema): Oracles {
  const compiledZod = executeZod(schema.node);
  const compiledAjv = compileAjv(schema.node);
  return {
    runtime: (input) => safeParse(schema, input).success,
    generatedZod: (input) => compiledZod.safeParse(input).success,
    ajv: (input) => Boolean(compiledAjv(input)),
    walker: (input) => oracle(schema.node, input),
  };
}

function expectAllAgree(
  o: Oracles,
  input: unknown,
  expected: boolean,
  label: string,
): void {
  const results = {
    runtime: o.runtime(input),
    generatedZod: o.generatedZod(input),
    ajv: o.ajv(input),
    walker: o.walker(input),
  };
  const disagreement = Object.entries(results).filter(
    ([, v]) => v !== expected,
  );
  if (disagreement.length > 0) {
    throw new Error(
      `Oracle disagreement for ${label} on input ${safeStringify(input)} ` +
        `(expected ${expected}): ${JSON.stringify(results)}`,
    );
  }
  expect(results).toEqual({
    runtime: expected,
    generatedZod: expected,
    ajv: expected,
    walker: expected,
  });
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

// =============================================================================
// Fixtures — every input chosen to be UNAMBIGUOUS for all four oracles.
// Inputs that sit on a known difference (e.g., loose email regexes) are
// intentionally avoided; the goal here is detecting drift, not testing the
// engines' individual edge cases.
// =============================================================================

describe("semantic-parity — primitive types", () => {
  it("string: accept strings, reject everything else", () => {
    const o = fourOracles(s.string());
    expectAllAgree(o, "hello", true, "string accept");
    expectAllAgree(o, "", true, "string accept empty");
    expectAllAgree(o, 42, false, "string reject number");
    expectAllAgree(o, true, false, "string reject boolean");
    expectAllAgree(o, [], false, "string reject array");
    expectAllAgree(o, {}, false, "string reject object");
  });

  it("number: accept numbers, reject everything else", () => {
    const o = fourOracles(s.number());
    expectAllAgree(o, 42, true, "number accept int");
    expectAllAgree(o, 3.14, true, "number accept float");
    expectAllAgree(o, 0, true, "number accept zero");
    expectAllAgree(o, "42", false, "number reject string");
    expectAllAgree(o, true, false, "number reject boolean");
  });

  it("boolean: accept booleans only", () => {
    const o = fourOracles(s.boolean());
    expectAllAgree(o, true, true, "boolean accept true");
    expectAllAgree(o, false, true, "boolean accept false");
    expectAllAgree(o, 1, false, "boolean reject 1");
    expectAllAgree(o, "true", false, "boolean reject string");
  });
});

describe("semantic-parity — literal + enum", () => {
  it("literal: only the exact value", () => {
    const o = fourOracles(s.literal("ok"));
    expectAllAgree(o, "ok", true, "literal accept");
    expectAllAgree(o, "nope", false, "literal reject other string");
    expectAllAgree(o, 42, false, "literal reject number");
  });

  it("string enum: accept listed values", () => {
    const o = fourOracles(s.enum(["red", "green", "blue"]));
    expectAllAgree(o, "red", true, "enum accept red");
    expectAllAgree(o, "green", true, "enum accept green");
    expectAllAgree(o, "yellow", false, "enum reject yellow");
    expectAllAgree(o, 1, false, "enum reject number");
  });

  it("numeric enum: accept listed values", () => {
    const o = fourOracles(s.enum([1, 2, 3]));
    expectAllAgree(o, 1, true, "numeric enum accept");
    expectAllAgree(o, 4, false, "numeric enum reject");
    expectAllAgree(o, "1", false, "numeric enum reject string");
  });
});

describe("semantic-parity — arrays", () => {
  it("array of strings: element type enforced", () => {
    const o = fourOracles(s.array(s.string()));
    expectAllAgree(o, [], true, "empty array accept");
    expectAllAgree(o, ["a", "b"], true, "string array accept");
    expectAllAgree(o, ["a", 1], false, "mixed reject");
    expectAllAgree(o, "not array", false, "non-array reject");
  });

  it("array minItems/maxItems", () => {
    const o = fourOracles(s.array(s.string()).min(2).max(4));
    expectAllAgree(o, ["a", "b"], true, "min satisfied");
    expectAllAgree(o, ["a", "b", "c", "d"], true, "max satisfied");
    expectAllAgree(o, ["a"], false, "too few");
    expectAllAgree(o, ["a", "b", "c", "d", "e"], false, "too many");
  });
});

describe("semantic-parity — object required fields", () => {
  it("required field must be present and correct type", () => {
    const o = fourOracles(s.object({ id: s.string(), age: s.number().int() }));
    expectAllAgree(o, { id: "u_1", age: 30 }, true, "complete accept");
    expectAllAgree(o, { id: "u_1" }, false, "missing age");
    expectAllAgree(o, { id: 42, age: 30 }, false, "wrong id type");
    expectAllAgree(o, { id: "u_1", age: 30.5 }, false, "int rejected");
  });

  it("nested object", () => {
    const o = fourOracles(
      s.object({
        profile: s.object({ name: s.string(), tags: s.array(s.string()) }),
      }),
    );
    expectAllAgree(
      o,
      { profile: { name: "rin", tags: ["a"] } },
      true,
      "nested accept",
    );
    expectAllAgree(
      o,
      { profile: { name: "rin", tags: [1] } },
      false,
      "nested element wrong type",
    );
    expectAllAgree(o, { profile: { name: "rin" } }, false, "missing tags");
  });
});

describe("semantic-parity — object policies (strict / passthrough / stripUnknown)", () => {
  it("strict: unknown keys rejected", () => {
    const o = fourOracles(s.object({ id: s.string() }));
    expectAllAgree(o, { id: "x" }, true, "no unknown");
    expectAllAgree(o, { id: "x", extra: 1 }, false, "unknown key");
  });

  it("passthrough: unknown keys accepted", () => {
    const o = fourOracles(s.object({ id: s.string() }).passthrough());
    expectAllAgree(o, { id: "x" }, true, "no unknown");
    expectAllAgree(o, { id: "x", extra: 1 }, true, "unknown accepted");
  });

  it("stripUnknown: unknown keys accepted (stripped in output, not in validity)", () => {
    const o = fourOracles(s.object({ id: s.string() }).stripUnknown());
    expectAllAgree(o, { id: "x" }, true, "no unknown");
    expectAllAgree(o, { id: "x", extra: 1 }, true, "unknown accepted");
  });
});

describe("semantic-parity — absence semantics inside objects", () => {
  it("optional: absent and undefined ok; null rejected", () => {
    const o = fourOracles(s.object({ name: s.string().optional() }));
    expectAllAgree(o, {}, true, "optional absent");
    expectAllAgree(o, { name: "rin" }, true, "optional present");
    expectAllAgree(o, { name: null }, false, "null not optional");
  });

  it("nullable: null ok; absent rejected", () => {
    const o = fourOracles(s.object({ name: s.string().nullable() }));
    expectAllAgree(o, { name: null }, true, "null accepted");
    expectAllAgree(o, { name: "rin" }, true, "value accepted");
    expectAllAgree(o, {}, false, "absent rejected");
  });

  it("nullish: absent and null both ok", () => {
    const o = fourOracles(s.object({ name: s.string().nullish() }));
    expectAllAgree(o, {}, true, "absent ok");
    expectAllAgree(o, { name: null }, true, "null ok");
    expectAllAgree(o, { name: "rin" }, true, "value ok");
  });

  it("default: absent accepted; null rejected", () => {
    const o = fourOracles(s.object({ name: s.string().default("anon") }));
    expectAllAgree(o, {}, true, "default-bearing absent");
    expectAllAgree(o, { name: "rin" }, true, "value provided");
    expectAllAgree(o, { name: null }, false, "default != nullable");
  });

  it("default + nullable: both absent and null accepted", () => {
    const o = fourOracles(
      s.object({ name: s.string().nullable().default("anon") }),
    );
    expectAllAgree(o, {}, true, "absent");
    expectAllAgree(o, { name: null }, true, "null");
    expectAllAgree(o, { name: "rin" }, true, "value");
  });
});

describe("semantic-parity — string portable refinements", () => {
  it("min / max / length", () => {
    const min = fourOracles(s.string().min(3));
    expectAllAgree(min, "abc", true, "min met");
    expectAllAgree(min, "ab", false, "min violated");

    const max = fourOracles(s.string().max(3));
    expectAllAgree(max, "abc", true, "max met");
    expectAllAgree(max, "abcd", false, "max violated");

    const len = fourOracles(s.string().length(3));
    expectAllAgree(len, "abc", true, "len match");
    expectAllAgree(len, "ab", false, "len short");
    expectAllAgree(len, "abcd", false, "len long");
  });

  it("regex (no flags)", () => {
    const o = fourOracles(s.string().regex(/^foo/));
    expectAllAgree(o, "foobar", true, "regex match");
    expectAllAgree(o, "bar", false, "regex no match");
  });

  it("email", () => {
    const o = fourOracles(s.string().email());
    expectAllAgree(o, "alice@example.com", true, "email accept");
    expectAllAgree(o, "not-an-email", false, "email reject");
  });

  it("uuid", () => {
    const o = fourOracles(s.string().uuid());
    expectAllAgree(
      o,
      "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      true,
      "uuid accept",
    );
    expectAllAgree(o, "not-a-uuid", false, "uuid reject");
  });

  it("url", () => {
    const o = fourOracles(s.string().url());
    expectAllAgree(o, "https://example.com", true, "url accept");
    expectAllAgree(o, "not a url", false, "url reject");
  });
});

describe("semantic-parity — number portable refinements", () => {
  it("int", () => {
    const o = fourOracles(s.number().int());
    expectAllAgree(o, 42, true, "int accept");
    expectAllAgree(o, 0, true, "int zero");
    expectAllAgree(o, 3.14, false, "int reject float");
  });

  it("min / max", () => {
    const min = fourOracles(s.number().min(0));
    expectAllAgree(min, 0, true, "min inclusive");
    expectAllAgree(min, -1, false, "min violated");

    const max = fourOracles(s.number().max(10));
    expectAllAgree(max, 10, true, "max inclusive");
    expectAllAgree(max, 11, false, "max violated");
  });

  it("gt / lt (strict)", () => {
    const gt = fourOracles(s.number().gt(0));
    expectAllAgree(gt, 1, true, "gt accept");
    expectAllAgree(gt, 0, false, "gt boundary rejected");

    const lt = fourOracles(s.number().lt(10));
    expectAllAgree(lt, 9, true, "lt accept");
    expectAllAgree(lt, 10, false, "lt boundary rejected");
  });

  it("multipleOf", () => {
    const o = fourOracles(s.number().multipleOf(5));
    expectAllAgree(o, 0, true, "multipleOf zero");
    expectAllAgree(o, 15, true, "multipleOf 15");
    expectAllAgree(o, 7, false, "multipleOf reject");
  });
});

describe("semantic-parity — composed refinements", () => {
  it("string min + max chained", () => {
    const o = fourOracles(s.string().min(2).max(4));
    expectAllAgree(o, "ab", true, "min boundary");
    expectAllAgree(o, "abcd", true, "max boundary");
    expectAllAgree(o, "a", false, "below min");
    expectAllAgree(o, "abcde", false, "above max");
  });

  it("number int + min + max chained", () => {
    const o = fourOracles(s.number().int().min(0).max(100));
    expectAllAgree(o, 50, true, "midrange int");
    expectAllAgree(o, 50.5, false, "float rejected by int");
    expectAllAgree(o, -1, false, "below min");
    expectAllAgree(o, 101, false, "above max");
  });
});
