import { describe, expect, it } from "vitest";
import { UnsupportedNodeKindError } from "../../src/generators/errors.js";

describe("UnsupportedNodeKindError — stable machine-readable shape", () => {
  it("exposes code = 'UNSUPPORTED_NODE_KIND'", () => {
    const e = new UnsupportedNodeKindError({
      kind: "date",
      generator: "typescript",
    });
    expect(e.code).toBe("UNSUPPORTED_NODE_KIND");
  });

  it("exposes kind from the constructor args", () => {
    const e = new UnsupportedNodeKindError({
      kind: "union",
      generator: "zod",
    });
    expect(e.kind).toBe("union");
  });

  it("exposes generator from the constructor args", () => {
    const e = new UnsupportedNodeKindError({
      kind: "transform",
      generator: "zod",
    });
    expect(e.generator).toBe("zod");
  });

  it("is an instance of Error (preserves try/catch ergonomics)", () => {
    const e = new UnsupportedNodeKindError({
      kind: "date",
      generator: "typescript",
    });
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(UnsupportedNodeKindError);
    expect(e.name).toBe("UnsupportedNodeKindError");
  });

  it("contract is on fields, not on message text — tests deliberately do not assert message", () => {
    // This test exists to *document* the contract: consumers of this error
    // must read e.code, e.kind, e.generator. Message text may change without
    // a breaking-change bump; fields may not.
    const e = new UnsupportedNodeKindError({
      kind: "date",
      generator: "typescript",
    });
    expect(typeof e.message).toBe("string"); // exists, but its content is not the contract
  });
});
