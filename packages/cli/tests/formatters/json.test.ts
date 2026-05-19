/**
 * Step 27 — `formatJson` gate tests.
 *
 * Covers the locked contract:
 *   - one-line JSON for objects / arrays / scalars / null
 *   - exactly one trailing newline; no other whitespace inserted
 *   - no pretty-printing (no indentation, no inter-key newlines)
 *   - `JSON.stringify` errors propagate (cycles, BigInt)
 *   - source carries no `console.*`, `process.exit`, or stdio writes
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { formatJson } from "../../src/formatters/json.js";

// =============================================================================
// Single-line, trailing-newline contract
// =============================================================================

describe("formatJson — shape", () => {
  it("formats an object as one-line JSON with a trailing newline", () => {
    const out = formatJson({ a: 1, b: "x" });
    expect(out).toBe('{"a":1,"b":"x"}\n');
  });

  it("formats an array as one-line JSON with a trailing newline", () => {
    const out = formatJson([1, 2, "three", null, false]);
    expect(out).toBe('[1,2,"three",null,false]\n');
  });

  it.each([
    [42, "42\n"],
    [-3.14, "-3.14\n"],
    ["hello", '"hello"\n'],
    [true, "true\n"],
    [false, "false\n"],
    [null, "null\n"],
  ])("formats scalar `%s` as `%s`", (input, expected) => {
    expect(formatJson(input)).toBe(expected);
  });

  it("emits exactly one trailing newline", () => {
    const out = formatJson({ a: 1 });
    expect(out.endsWith("\n")).toBe(true);
    expect(out.endsWith("\n\n")).toBe(false);
  });

  it("does not pretty-print", () => {
    const out = formatJson({ nested: { array: [1, 2] }, list: ["a", "b"] });
    // No indentation, no newline between keys — only the trailing
    // newline. Strip it and assert the remainder has no \n.
    const body = out.slice(0, -1);
    expect(body).not.toMatch(/\n/);
    expect(body).not.toMatch(/^\s/);
    expect(body).not.toMatch(/:\s\S/); // no `key: value` spacing
  });

  it("preserves the exact key order of the input object", () => {
    // JSON.stringify is order-preserving on plain objects; the
    // formatter must not reorder. Schema-side handlers rely on the
    // CLI emitting JSON in the same order their `*Result` produces.
    const out = formatJson({ z: 1, a: 2, m: 3 });
    expect(out).toBe('{"z":1,"a":2,"m":3}\n');
  });
});

// =============================================================================
// Failure propagation
// =============================================================================

describe("formatJson — failure propagation", () => {
  it("throws on a cyclic input", () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(() => formatJson(cyclic)).toThrow();
  });

  it("throws on a BigInt input (JSON.stringify cannot serialize)", () => {
    expect(() => formatJson(BigInt(1))).toThrow();
  });
});

// =============================================================================
// Side-effect discipline (static-scan)
// =============================================================================

describe("formatJson — side-effect discipline (static-scan)", () => {
  const SRC = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "src",
      "formatters",
      "json.ts",
    ),
    "utf8",
  );

  const STRIPPED = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(
    /\/\/.*$/gm,
    "",
  );

  const FORBIDDEN: { name: string; pattern: RegExp }[] = [
    { name: "console.log", pattern: /\bconsole\s*\.\s*log\s*\(/ },
    { name: "console.error", pattern: /\bconsole\s*\.\s*error\s*\(/ },
    { name: "console.warn", pattern: /\bconsole\s*\.\s*warn\s*\(/ },
    { name: "console.info", pattern: /\bconsole\s*\.\s*info\s*\(/ },
    { name: "console.debug", pattern: /\bconsole\s*\.\s*debug\s*\(/ },
    { name: "process.exit", pattern: /\bprocess\s*\.\s*exit\s*\(/ },
    { name: "process.abort", pattern: /\bprocess\s*\.\s*abort\s*\(/ },
    {
      name: "process.stdout.write",
      pattern: /\bprocess\s*\.\s*stdout\s*\.\s*write\s*\(/,
    },
    {
      name: "process.stderr.write",
      pattern: /\bprocess\s*\.\s*stderr\s*\.\s*write\s*\(/,
    },
    { name: "fs.read", pattern: /\bfs\b.*read/ },
    { name: "fs.write", pattern: /\bfs\b.*write/ },
  ];

  it.each(FORBIDDEN)(
    "json formatter source does not call `$name`",
    ({ pattern }) => {
      expect(STRIPPED).not.toMatch(pattern);
    },
  );
});
