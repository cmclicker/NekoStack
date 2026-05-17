import { describe, expect, it } from "vitest";
import { s } from "../../src/index.js";
import { generateZod } from "../../src/generators/zod.js";

/**
 * Modifier-ordering contract test matrix from Decision #8.
 *
 * Each test asserts on a fragment of the emitted Zod chain — *not* on the
 * full header / wrapper — to lock the ordering without coupling to the
 * surrounding boilerplate. Execution-level absence-semantics parity is
 * proved in `zod-execution.test.ts`.
 */

/** Strip the header + imports to look at just the chain expression. */
function extractChain(output: string): string {
  const match = output.match(/export const \w+ = ([\s\S]*?);\s*$/);
  if (!match) throw new Error(`No const found in:\n${output}`);
  return match[1]!.replace(/\s+/g, "");
}

describe("Zod modifier ordering — single modifier", () => {
  it("optional alone → .optional()", () => {
    const chain = extractChain(generateZod(s.string().optional().node));
    expect(chain).toBe("z.string().optional()");
  });

  it("nullable alone → .nullable()", () => {
    const chain = extractChain(generateZod(s.string().nullable().node));
    expect(chain).toBe("z.string().nullable()");
  });

  it("nullish alone → .nullish() (NOT .optional().nullable())", () => {
    const chain = extractChain(generateZod(s.string().nullish().node));
    expect(chain).toBe("z.string().nullish()");
  });

  it("default alone → .default(value), and IR encodes optional:true", () => {
    const node = s.string().default("x").node;
    expect(node.modifiers?.optional).toBe(true); // v0.1 contract: default sets optional
    const chain = extractChain(generateZod(node));
    // Default-only schemas: optional in IR → .optional() THEN .default()
    expect(chain).toBe('z.string().optional().default("x")');
  });
});

describe("Zod modifier ordering — refinements come BEFORE absence modifiers", () => {
  it("string with min + email + optional → refinements first, optional after", () => {
    const chain = extractChain(
      generateZod(s.string().min(3).email().optional().node),
    );
    expect(chain).toBe("z.string().min(3).email().optional()");
  });

  it("number with int + min + nullable", () => {
    const chain = extractChain(
      generateZod(s.number().int().min(0).nullable().node),
    );
    expect(chain).toBe("z.number().int().min(0).nullable()");
  });
});

describe("Zod modifier ordering — default LAST in every combination", () => {
  it("nullable + default collapses to .nullish().default() — same Zod behavior", () => {
    // v0.1's .default() sets modifiers.optional = true. Combined with the
    // explicit .nullable(), the IR has BOTH flags → generator emits
    // .nullish() (Zod's idiom for optional + nullable). Behaviorally
    // identical to .nullable().default() at the runtime level.
    const chain = extractChain(
      generateZod(s.string().nullable().default("x").node),
    );
    expect(chain).toMatch(/\.nullish\(\)\.default\("x"\)$/);
  });

  it("nullish + default → .nullish().default(value)", () => {
    const chain = extractChain(
      generateZod(s.string().nullish().default("x").node),
    );
    expect(chain).toMatch(/\.nullish\(\)\.default\("x"\)$/);
  });

  it("refinements + nullable + default → refinements → nullish → default", () => {
    const chain = extractChain(
      generateZod(s.string().min(1).nullable().default("x").node),
    );
    expect(chain).toBe('z.string().min(1).nullish().default("x")');
  });
});

describe("Zod modifier ordering — object-field requiredness mirrors v0.1 absence semantics", () => {
  it("emits the audit User example with the expected per-field chains", () => {
    const out = generateZod(
      s
        .object({
          name: s.string(),
          nickname: s.string().optional(),
          bio: s.string().nullable(),
          handle: s.string().nullish(),
          role: s.string().default("member"),
        })
        .id("com.x.User").node,
    );
    expect(out).toContain("name: z.string()");
    expect(out).toContain("nickname: z.string().optional()");
    expect(out).toContain("bio: z.string().nullable()");
    expect(out).toContain("handle: z.string().nullish()");
    expect(out).toContain('role: z.string().optional().default("member")');
  });
});

describe("Zod modifier ordering — describe between refinements and absence", () => {
  it("describe comes after refinements but before optional()", () => {
    const chain = extractChain(
      generateZod(s.string().min(3).describe("a tag").optional().node),
    );
    expect(chain).toBe('z.string().min(3).describe("atag").optional()');
  });
});
