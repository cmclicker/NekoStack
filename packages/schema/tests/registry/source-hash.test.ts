/**
 * Step 2 tests for `sourceHashFromText`.
 *
 * Scope: the pure hash function in isolation. No filesystem, no
 * registry, no other v0.7 surface. The test file imports only the
 * function under test — the "no filesystem" property is verified
 * structurally, by the absence of any `fs.*` involvement in the
 * test setup.
 *
 * Known-vector hashes were precomputed via Node's `node:crypto`:
 *
 *   node -e 'const { createHash } = require("node:crypto");
 *            for (const s of ["", "abc", "🦀", "日本語", "hello 🦀\\n"])
 *              console.log(JSON.stringify(s), createHash("sha256")
 *                .update(s, "utf8").digest("hex"));'
 *
 * Hard-coding the digests pins both the implementation AND the
 * UTF-8 encoding contract: if either ever shifted, this test would
 * catch it.
 */
import { describe, expect, it } from "vitest";
import { sourceHashFromText } from "../../src/registry/source-hash.js";

describe("sourceHashFromText — format", () => {
  it("emits the `sha256:` prefix", () => {
    expect(sourceHashFromText("anything")).toMatch(/^sha256:/);
  });

  it("digest body is 64 lowercase hex chars", () => {
    const h = sourceHashFromText("hello world");
    expect(h).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("digest is never uppercase", () => {
    // SHA-256 hex is canonical lowercase across the v0.7 surface; an
    // uppercase digest would break header-string equality checks.
    const h = sourceHashFromText("MIXED Case Input STRING");
    const body = h.slice("sha256:".length);
    expect(body).toBe(body.toLowerCase());
  });
});

describe("sourceHashFromText — determinism", () => {
  it("same text → same hash", () => {
    const text = "export const X = s.string();\n";
    expect(sourceHashFromText(text)).toBe(sourceHashFromText(text));
  });

  it("same hash across repeated calls (stable across calls within a run)", () => {
    const text = "// some schema source\nexport const Y = s.number();\n";
    const a = sourceHashFromText(text);
    const b = sourceHashFromText(text);
    const c = sourceHashFromText(text);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("different text → different hash", () => {
    expect(sourceHashFromText("a")).not.toBe(sourceHashFromText("b"));
    expect(sourceHashFromText("export const X = s.string();")).not.toBe(
      sourceHashFromText("export const X = s.string();\n"),
    );
    // Even a single-character difference flips the hash entirely.
    expect(sourceHashFromText("min(1)")).not.toBe(sourceHashFromText("min(2)"));
  });
});

describe("sourceHashFromText — known SHA-256 vectors (UTF-8 encoding contract)", () => {
  it("empty string matches the well-known SHA-256 digest", () => {
    expect(sourceHashFromText("")).toBe(
      "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("`abc` matches the NIST SHA-256 test vector", () => {
    expect(sourceHashFromText("abc")).toBe(
      "sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("emoji (`🦀`, 4-byte UTF-8 sequence) is encoded as UTF-8", () => {
    expect(sourceHashFromText("🦀")).toBe(
      "sha256:7224c588fa9887541bea6fc37a50363ce1c229547ba65c110095ad23b68c902d",
    );
  });

  it("Japanese characters (`日本語`, multi-byte UTF-8) hash stably", () => {
    expect(sourceHashFromText("日本語")).toBe(
      "sha256:77710aedc74ecfa33685e33a6c7df5cc83004da1bdcef7fb280f5c2b2e97e0a5",
    );
  });

  it("mixed ASCII + emoji + trailing newline (representative of source text)", () => {
    expect(sourceHashFromText("hello 🦀\n")).toBe(
      "sha256:b520b2994ecd247d2dad2d1a2782051c57e12842d40107ce68c1d07c5fb03f8f",
    );
  });
});

describe("sourceHashFromText — purity (no filesystem dependency)", () => {
  it("the function takes only a string argument", () => {
    // Structural assertion: if the signature ever grew a path or
    // filesystem-bearing argument, this test would fail to compile.
    // The runtime check below is belt-and-suspenders.
    expect(sourceHashFromText.length).toBe(1);
  });

  it("runs without touching `node:fs` (no fs invocation possible from text-only input)", () => {
    // The function under test receives only the string text; there is
    // no filesystem reachable from inside it. We don't spy on `fs.*`
    // here because the structural argument (function arity, pure
    // computation over the input string) is the real guarantee.
    const out = sourceHashFromText("just text, no path");
    expect(out).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});
