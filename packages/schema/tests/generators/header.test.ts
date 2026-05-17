import { describe, expect, it } from "vitest";
import { s } from "../../src/index.js";
import { buildHeader } from "../../src/generators/header.js";
import { GENERATOR_VERSION } from "../../src/generators/version.js";

describe("buildHeader — deterministic generated-file preamble", () => {
  it("starts with /** and ends with */ and DO NOT EDIT line", () => {
    const h = buildHeader(s.string().id("com.x.Y").version("1.0.0").node, {
      generator: "typescript",
    });
    expect(h.startsWith("/**")).toBe(true);
    expect(h.trimEnd().endsWith("*/")).toBe(true);
    expect(h).toContain("DO NOT EDIT MANUALLY.");
  });

  it("includes schemaId, schemaVersion, irHash, generator, generatorVersion fields", () => {
    const h = buildHeader(s.string().id("com.x.Y").version("1.0.0").node, {
      generator: "zod",
    });
    expect(h).toContain("schemaId:");
    expect(h).toContain("schemaVersion:");
    expect(h).toMatch(/irHash:\s+sha256:[0-9a-f]{64}/);
    expect(h).toContain("generator:        zod");
    expect(h).toContain(`generatorVersion: ${GENERATOR_VERSION}`);
  });

  it("anonymous schema (no .id()) → schemaId: null + visible // anonymous schema comment", () => {
    const h = buildHeader(s.string().node, { generator: "typescript" });
    expect(h).toContain("schemaId:         null");
    expect(h).toContain("// anonymous schema");
  });

  it("unversioned schema → schemaVersion: null", () => {
    const h = buildHeader(s.string().id("com.x.Y").node, {
      generator: "typescript",
    });
    expect(h).toContain("schemaVersion:    null");
  });

  it("schemaVersion option supplies a fallback when metadata has none", () => {
    const h = buildHeader(s.string().id("com.x.Y").node, {
      generator: "typescript",
      schemaVersion: "0.0.0",
    });
    expect(h).toContain("schemaVersion:    0.0.0");
  });

  it("is deterministic: same IR + same options → byte-identical output", () => {
    const node = s.object({ a: s.string() }).id("com.x.Y").version("1").node;
    expect(buildHeader(node, { generator: "zod" })).toBe(
      buildHeader(node, { generator: "zod" }),
    );
  });

  it("different generator → different header (the field flips)", () => {
    const node = s.string().id("com.x.Y").node;
    expect(buildHeader(node, { generator: "zod" })).not.toBe(
      buildHeader(node, { generator: "typescript" }),
    );
  });

  it("different IR → different irHash in header (proof generators can't share output)", () => {
    const a = buildHeader(s.string().id("com.x.Y").node, {
      generator: "typescript",
    });
    const b = buildHeader(s.string().min(1).id("com.x.Y").node, {
      generator: "typescript",
    });
    expect(a).not.toBe(b);
  });
});
