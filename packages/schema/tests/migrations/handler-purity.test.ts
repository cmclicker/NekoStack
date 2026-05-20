/**
 * Step 11 — cross-handler purity gate for the v0.8 migration surface.
 *
 * Mirrors the v0.7 `tests/registry/handler-purity.test.ts` approach:
 * **static file-level import scan** over every module on the
 * migration handlers' immediate reach. Sentinel tests at the bottom
 * prove the scanner catches what it claims.
 *
 * Scope:
 *
 *   - the four handlers (`list`, `plan`, `verify`, `stub`)
 *   - their direct dependencies on the schema side:
 *     `plan-migration`, `verify-provenance`, `stub`,
 *     `build-migration-registry`, `parse-provenance`
 *
 * Forbidden:
 *
 *   - `node:fs` / `"fs"` / `"node:fs/promises"` imports
 *   - dynamic `import(...)`
 *   - `console.log / error / warn / info / debug`
 *   - `process.exit / abort`
 *   - `process.stdout.write` / `process.stderr.write`
 *   - `.transform(` (any call to a migration's transform function)
 *
 * **`.transform(` nuance for `stub.ts`**: the stub generator emits
 * the literal substring `transform(input) {` inside a generated
 * content template string. That is `transform(` *without* a leading
 * dot, so the `/\.transform\s*\(/` pattern does NOT match it. No
 * false positive on `stub.ts`.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// =============================================================================
// Modules under purity gate
// =============================================================================

const MIGRATIONS_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "src",
  "migrations",
);

const MODULES = [
  "handlers/list.ts",
  "handlers/plan.ts",
  "handlers/verify.ts",
  "handlers/stub.ts",
  "plan-migration.ts",
  "verify-provenance.ts",
  "stub.ts",
  "build-migration-registry.ts",
  "parse-provenance.ts",
] as const;

// =============================================================================
// Forbidden patterns
// =============================================================================

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
  // `from "fs"` / `from "fs/promises"` / `from "node:fs"` / `from "node:fs/promises"`.
  { name: "fs import", pattern: /\bfrom\s+["'](?:node:)?fs(?:\/|["'])/ },
  // Dynamic `import(...)` — distinct from `import type X from "..."`.
  { name: "dynamic import()", pattern: /(?<!import\s+type\s.*)\bimport\s*\(/ },
  // Calling a migration's `transform(...)`. Note the LEADING DOT —
  // matches `migration.transform(`, `entry.transform(`, etc. The
  // stub generator emits the bare-method-name form
  // `transform(input)` (no leading dot) inside a generated content
  // template literal; the leading-dot anchor keeps that as legal.
  { name: ".transform(", pattern: /\.transform\s*\(/ },
];

// =============================================================================
// Comment-stripping
// =============================================================================

/**
 * Remove block comments and line comments from `src`. JSDoc blocks
 * routinely contain words like "console" / "transform" / "process"
 * in prose ("never calls console.log", "the transform field is...");
 * the scanner must not false-positive on those. Same approach as
 * the v0.7 purity gate.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

// =============================================================================
// Per-module scan
// =============================================================================

describe("v0.8 migration surface — cross-handler purity gate (static scan)", () => {
  for (const relPath of MODULES) {
    describe(`module: \`src/migrations/${relPath}\``, () => {
      const SRC = readFileSync(join(MIGRATIONS_ROOT, relPath), "utf8");
      const STRIPPED = stripComments(SRC);

      it.each(FORBIDDEN)(
        "does not contain forbidden pattern `$name`",
        ({ pattern }) => {
          expect(STRIPPED).not.toMatch(pattern);
        },
      );
    });
  }
});

// =============================================================================
// Sentinel tests — prove the scanner catches what it claims
// =============================================================================

describe("v0.8 migration purity gate — sentinel coverage", () => {
  it("catches a real `fs` import", () => {
    const src = `import { readFile } from "node:fs/promises";\nexport const x = 1;`;
    const stripped = stripComments(src);
    expect(stripped).toMatch(
      FORBIDDEN.find((f) => f.name === "fs import")!.pattern,
    );
  });

  it("catches a bare-string `fs` import", () => {
    const src = `import * as fs from "fs";\n`;
    const stripped = stripComments(src);
    expect(stripped).toMatch(
      FORBIDDEN.find((f) => f.name === "fs import")!.pattern,
    );
  });

  it("catches dynamic `import(...)`", () => {
    const src = `async function load() {\n  await import("./x.js");\n}`;
    const stripped = stripComments(src);
    expect(stripped).toMatch(
      FORBIDDEN.find((f) => f.name === "dynamic import()")!.pattern,
    );
  });

  it("catches `console.log`", () => {
    const src = `console.log("hi");`;
    const stripped = stripComments(src);
    expect(stripped).toMatch(
      FORBIDDEN.find((f) => f.name === "console.log")!.pattern,
    );
  });

  it("catches `console.error`", () => {
    const src = `console.error("oops");`;
    const stripped = stripComments(src);
    expect(stripped).toMatch(
      FORBIDDEN.find((f) => f.name === "console.error")!.pattern,
    );
  });

  it("catches `process.exit`", () => {
    const src = `process.exit(1);`;
    const stripped = stripComments(src);
    expect(stripped).toMatch(
      FORBIDDEN.find((f) => f.name === "process.exit")!.pattern,
    );
  });

  it("catches `process.stdout.write`", () => {
    const src = `process.stdout.write("x");`;
    const stripped = stripComments(src);
    expect(stripped).toMatch(
      FORBIDDEN.find((f) => f.name === "process.stdout.write")!.pattern,
    );
  });

  it("catches `process.stderr.write`", () => {
    const src = `process.stderr.write("e");`;
    const stripped = stripComments(src);
    expect(stripped).toMatch(
      FORBIDDEN.find((f) => f.name === "process.stderr.write")!.pattern,
    );
  });

  it("catches `.transform(` calls", () => {
    const src = `const x = migration.transform(input);`;
    const stripped = stripComments(src);
    expect(stripped).toMatch(
      FORBIDDEN.find((f) => f.name === ".transform(")!.pattern,
    );
  });

  it("does NOT flag `transform(input)` without leading dot (stub-generator content)", () => {
    // The stub emits a template literal containing `transform(input)`.
    // The leading-dot anchor on the `.transform(` pattern keeps that
    // as legal — this sentinel proves the asymmetry holds.
    const src = "const stub = `transform(input) { ... }`;";
    const stripped = stripComments(src);
    expect(stripped).not.toMatch(
      FORBIDDEN.find((f) => f.name === ".transform(")!.pattern,
    );
  });

  it("strips block comments before scanning (JSDoc with `console` in prose)", () => {
    // JSDoc routinely contains phrases like "never calls
    // console.log" — that's not a violation. The scanner must
    // strip block comments first.
    const src = `/**\n * never calls console.log\n */\nexport const x = 1;`;
    const stripped = stripComments(src);
    expect(stripped).not.toMatch(
      FORBIDDEN.find((f) => f.name === "console.log")!.pattern,
    );
  });

  it("strips line comments before scanning", () => {
    const src = `export const x = 1; // mentions process.exit but it's a comment`;
    const stripped = stripComments(src);
    expect(stripped).not.toMatch(
      FORBIDDEN.find((f) => f.name === "process.exit")!.pattern,
    );
  });

  it("clean source passes every forbidden pattern", () => {
    const src = `
      import type { X } from "./y.js";
      export function compute(value: number): number {
        return value + 1;
      }
    `;
    const stripped = stripComments(src);
    for (const { pattern } of FORBIDDEN) {
      expect(stripped).not.toMatch(pattern);
    }
  });

  it("`import type` does not trigger the dynamic-import pattern", () => {
    // `import type { X } from "..."` is a static type-only import;
    // not the dynamic `import(...)` expression. The scanner must
    // NOT false-positive on it.
    const src = `import type { Foo } from "./x.js";\n`;
    const stripped = stripComments(src);
    expect(stripped).not.toMatch(
      FORBIDDEN.find((f) => f.name === "dynamic import()")!.pattern,
    );
  });

  it("an `@nekostack/schema/cli` import does not trigger the fs-import pattern", () => {
    const src = `import type { Migration } from "@nekostack/schema/cli";\n`;
    const stripped = stripComments(src);
    expect(stripped).not.toMatch(
      FORBIDDEN.find((f) => f.name === "fs import")!.pattern,
    );
  });
});
