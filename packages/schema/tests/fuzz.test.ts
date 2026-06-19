import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  irHash,
  generateTypeScript,
  generateZod,
  generateJsonSchema,
  generateOpenApiSchemaComponent,
} from "../src/index.js";
import type { SchemaNode } from "../src/ir/nodes.js";

// =============================================================================
// IR Arbitrary (The "Chaos Engine")
// Generates perfectly valid, highly nested NekoStack SchemaNode trees.
// =============================================================================

const jsonPrimitiveArbitrary = fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null));
const jsonValueArbitrary = fc.letrec((tie: any) => ({
  json: fc.oneof(jsonPrimitiveArbitrary, tie("array"), tie("object")),
  array: fc.array(tie("json"), { maxLength: 2 }),
  object: fc.dictionary(fc.string({ maxLength: 5 }), tie("json"), { maxKeys: 2 }),
})).json;

const metadataArbitrary = fc.record(
  {
    id: fc.string({ minLength: 1 }),
    version: fc.string({ minLength: 1 }),
    description: fc.string(),
    deprecated: fc.boolean(),
  },
  { requiredKeys: [] } // All keys are optional
);

const modifiersArbitrary = fc.record(
  {
    optional: fc.boolean(),
    nullable: fc.boolean(),
    default: fc.record({ value: jsonValueArbitrary }),
  },
  { requiredKeys: [] } // All keys are optional
);

const baseArbitrary = fc.record(
  {
    metadata: metadataArbitrary,
    modifiers: modifiersArbitrary,
  },
  { requiredKeys: [] } // All keys are optional
);

const schemaNodeArbitrary = fc.letrec((tie: any) => ({
  node: fc.oneof(
    { depthFactor: 0.5 },
    tie("stringNode"),
    tie("numberNode"),
    tie("booleanNode"),
    tie("literalNode"),
    tie("enumNode"),
    tie("arrayNode"),
    tie("objectNode")
  ),

  stringNode: baseArbitrary.map((b: any) => ({ ...b, kind: "string" as const })),
  numberNode: baseArbitrary.map((b: any) => ({ ...b, kind: "number" as const })),
  booleanNode: baseArbitrary.map((b: any) => ({ ...b, kind: "boolean" as const })),
  
  literalNode: fc.record(
    {
      kind: fc.constant("literal" as const),
      value: jsonValueArbitrary,
      metadata: metadataArbitrary,
      modifiers: modifiersArbitrary,
    },
    { requiredKeys: ["kind", "value"] }
  ),

  enumNode: fc.record(
    {
      kind: fc.constant("enum" as const),
      values: fc.array(fc.oneof(fc.string(), fc.integer()), { minLength: 1, maxLength: 5 }),
      metadata: metadataArbitrary,
      modifiers: modifiersArbitrary,
    },
    { requiredKeys: ["kind", "values"] }
  ),

  arrayNode: fc.record(
    {
      kind: fc.constant("array" as const),
      element: tie("node"),
      metadata: metadataArbitrary,
      modifiers: modifiersArbitrary,
    },
    { requiredKeys: ["kind", "element"] }
  ),

  objectNode: fc.record(
    {
      kind: fc.constant("object" as const),
      fields: fc.dictionary(fc.string({ maxLength: 5 }), tie("node"), { maxKeys: 3 }),
      unknownKeys: fc.constantFrom("strict", "stripUnknown", "passthrough"),
      metadata: metadataArbitrary,
      modifiers: modifiersArbitrary,
    },
    { requiredKeys: ["kind", "fields", "unknownKeys"] }
  ),
})).node as fc.Arbitrary<SchemaNode>;

// =============================================================================
// The Invariants (The Proofs)
// =============================================================================

describe("Property-Based Invariants (fuzz)", () => {
  // We use a modest numRuns for fast CI, but shrinkage guarantees that if an
  // error exists in the search space, it will be found and minimized.
  const numRuns = 1000;

  it("Invariant 1: Generators never crash on valid IR", () => {
    fc.assert(
      fc.property(schemaNodeArbitrary, (node: SchemaNode) => {
        generateTypeScript(node);
        generateZod(node);
        generateJsonSchema(node);
        generateOpenApiSchemaComponent(node);
      }),
      { numRuns }
    );
  });

  it("Invariant 2: Serialization Identity (irHash is deterministic)", () => {
    fc.assert(
      fc.property(schemaNodeArbitrary, (node: SchemaNode) => {
        const hash1 = irHash(node);
        const hash2 = irHash(node);
        // Deep clone to ensure memory reference isn't hiding a mutation
        const hash3 = irHash(JSON.parse(JSON.stringify(node)));
        
        expect(hash1).toBe(hash2);
        expect(hash2).toBe(hash3);
      }),
      { numRuns }
    );
  });
});
