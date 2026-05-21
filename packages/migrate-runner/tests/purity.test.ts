/**
 * Step 9 — package-wide purity gates.
 *
 * This file is the **canonical cross-cutting source-boundary
 * authority** for `@nekostack/migrate-runner`. Per-file static
 * scans (in `pre-flight.test.ts`, `runner.test.ts`,
 * `per-record-pipeline.test.ts`, `audit.test.ts`, the three
 * adapter tests) stay as fail-fast locality, but the package-wide
 * truth lives here.
 *
 * Locked boundary rules:
 *
 *   1. **File inventory sentinel** — the exact set of `.ts` files
 *      under `src/`. Adding / removing a source file requires
 *      updating the sentinel; the rules below depend on it.
 *
 *   2. **Transform execution boundary** — `.transform(` exists in
 *      exactly ONE file: `src/per-record-pipeline.ts`. Every other
 *      source file is transform-free.
 *
 *   3. **Filesystem boundary** — `fs` / `node:fs[/...]` imports
 *      exist ONLY under `src/adapters/`. Every non-adapter source
 *      file has no fs imports.
 *
 *   4. **Console / process / stdio boundary** — NO source file
 *      contains `console.*`, `process.exit/abort`, or direct
 *      `process.std{out,err}.write` calls. Writers are always
 *      injected (the orchestrator does not log).
 *
 *   5. **CLI-import boundary** — no source file imports from
 *      `@nekostack/cli`. The runner is architecturally a peer to
 *      the CLI, not a dependent.
 *
 *   6. **Public-entry boundary** — `src/index.ts` specifically
 *      must not import `fs`, must not call `.transform(`, and
 *      must not import `@nekostack/cli`. (Subsumed by the rules
 *      above; broken out explicitly so a future reviewer doesn't
 *      have to derive it.)
 *
 *   7. **Sentinel coverage** — small in-file tests prove the
 *      comment-stripper actually catches forbidden patterns in
 *      code AND ignores them in comments. Without this, a future
 *      regex tweak that silently weakens the scanner would let
 *      regressions slip through.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// =============================================================================
// Source discovery
// =============================================================================

const SRC_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
);

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (name.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

function relSrc(absPath: string): string {
  const idx = absPath.indexOf(`src${sep}`);
  if (idx < 0) return absPath;
  return absPath.slice(idx).split(sep).join("/");
}

const ALL_SOURCE_FILES = listSourceFiles(SRC_ROOT).sort();
const ALL_SOURCE_REL = ALL_SOURCE_FILES.map(relSrc).sort();

// =============================================================================
// Comment-stripper + scanner
// =============================================================================

/**
 * Strip block comments and line comments from `src`. The purity
 * scan must not false-positive on JSDoc / inline-comment prose
 * that mentions forbidden patterns ("never calls console.log",
 * "ban `.transform(`", etc.). Same approach as the schema-side
 * handler-purity gate.
 */
export function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const PATTERNS = {
  transformCall: /\.transform\s*\(/,
  fsImport: /\bfrom\s+["'](?:node:)?fs(?:\/|["'])/,
  consoleLog: /\bconsole\s*\.\s*log\s*\(/,
  consoleError: /\bconsole\s*\.\s*error\s*\(/,
  consoleWarn: /\bconsole\s*\.\s*warn\s*\(/,
  consoleInfo: /\bconsole\s*\.\s*info\s*\(/,
  consoleDebug: /\bconsole\s*\.\s*debug\s*\(/,
  processExit: /\bprocess\s*\.\s*exit\s*\(/,
  processAbort: /\bprocess\s*\.\s*abort\s*\(/,
  processStdoutWrite: /\bprocess\s*\.\s*stdout\s*\.\s*write\s*\(/,
  processStderrWrite: /\bprocess\s*\.\s*stderr\s*\.\s*write\s*\(/,
  // Match `from "@nekostack/cli"` and any subpath (`/...`).
  cliImport: /\bfrom\s+["']@nekostack\/cli(?:["']|\/)/,
} as const;

function stripped(file: string): string {
  return stripComments(readFileSync(file, "utf8"));
}

// =============================================================================
// 1. File inventory sentinel
// =============================================================================

describe("purity — file inventory sentinel", () => {
  it("the exact set of `src/**/*.ts` files matches the locked inventory", () => {
    expect(ALL_SOURCE_REL).toEqual([
      "src/adapters/index.ts",
      "src/adapters/json-file-input.ts",
      "src/adapters/json-file-output.ts",
      "src/adapters/jsonl-audit.ts",
      "src/audit.ts",
      "src/index.ts",
      "src/per-record-pipeline.ts",
      "src/pre-flight.ts",
      "src/runner.ts",
      "src/types.ts",
    ]);
  });
});

// =============================================================================
// 2. Transform execution boundary
// =============================================================================

describe("purity — `.transform(` lives ONLY in `src/per-record-pipeline.ts`", () => {
  for (const file of ALL_SOURCE_FILES) {
    const rel = relSrc(file);
    if (rel === "src/per-record-pipeline.ts") {
      it(`\`${rel}\` IS allowed to contain \`.transform(\` (positive sentinel)`, () => {
        expect(stripped(file)).toMatch(PATTERNS.transformCall);
      });
    } else {
      it(`\`${rel}\` contains NO \`.transform(\``, () => {
        expect(stripped(file)).not.toMatch(PATTERNS.transformCall);
      });
    }
  }
});

// =============================================================================
// 3. Filesystem boundary
// =============================================================================

describe("purity — fs imports live ONLY under `src/adapters/`", () => {
  for (const file of ALL_SOURCE_FILES) {
    const rel = relSrc(file);
    if (rel.startsWith("src/adapters/")) {
      // Adapters are the filesystem boundary; imports are allowed.
      // We don't positively-assert they're present (the barrel
      // file `adapters/index.ts` does not import fs, and that's
      // fine — only the three concrete adapters do).
      continue;
    }
    it(`\`${rel}\` contains NO fs / node:fs import`, () => {
      expect(stripped(file)).not.toMatch(PATTERNS.fsImport);
    });
  }
});

// =============================================================================
// 4. Console / process / stdio boundary
// =============================================================================

describe("purity — no console / process / stdio in any source file", () => {
  const FORBIDDEN: { name: string; pattern: RegExp }[] = [
    { name: "console.log", pattern: PATTERNS.consoleLog },
    { name: "console.error", pattern: PATTERNS.consoleError },
    { name: "console.warn", pattern: PATTERNS.consoleWarn },
    { name: "console.info", pattern: PATTERNS.consoleInfo },
    { name: "console.debug", pattern: PATTERNS.consoleDebug },
    { name: "process.exit", pattern: PATTERNS.processExit },
    { name: "process.abort", pattern: PATTERNS.processAbort },
    { name: "process.stdout.write", pattern: PATTERNS.processStdoutWrite },
    { name: "process.stderr.write", pattern: PATTERNS.processStderrWrite },
  ];

  for (const file of ALL_SOURCE_FILES) {
    const rel = relSrc(file);
    describe(`\`${rel}\``, () => {
      const src = stripped(file);
      it.each(FORBIDDEN)(
        "contains no `$name`",
        ({ pattern }) => {
          expect(src).not.toMatch(pattern);
        },
      );
    });
  }
});

// =============================================================================
// 5. CLI-import boundary
// =============================================================================

describe("purity — no source file imports from `@nekostack/cli`", () => {
  for (const file of ALL_SOURCE_FILES) {
    const rel = relSrc(file);
    it(`\`${rel}\` contains no \`@nekostack/cli\` import`, () => {
      expect(stripped(file)).not.toMatch(PATTERNS.cliImport);
    });
  }
});

// =============================================================================
// 6. Public-entry boundary (explicit re-statement of #2 + #3 + #5
//                          on src/index.ts only)
// =============================================================================

describe("purity — `src/index.ts` specifically", () => {
  const INDEX = join(SRC_ROOT, "index.ts");
  const SRC = stripped(INDEX);

  it("does not import `fs` / `node:fs`", () => {
    expect(SRC).not.toMatch(PATTERNS.fsImport);
  });

  it("does not call `.transform(`", () => {
    expect(SRC).not.toMatch(PATTERNS.transformCall);
  });

  it("does not import from `@nekostack/cli`", () => {
    expect(SRC).not.toMatch(PATTERNS.cliImport);
  });
});

// =============================================================================
// 7. Sentinel coverage — the scanner catches what it claims
// =============================================================================
//
// Without sentinels, a future regex tweak (e.g. accidentally
// requiring case-insensitive `i` flag, or dropping a word
// boundary) could silently weaken the scanner. These rows
// exercise each pattern against tiny inline source snippets to
// prove the scanner positively catches forbidden code AND
// negatively skips JSDoc / line-comment prose that names the
// pattern in plain English.

describe("purity — sentinel coverage (scanner catches forbidden code, ignores comments)", () => {
  it("catches `.transform(` in code", () => {
    expect(stripComments("const x = obj.transform(input);")).toMatch(
      PATTERNS.transformCall,
    );
  });

  it("does NOT match `transform(input)` without the leading dot (stub-style)", () => {
    // The stub generator emits a template literal containing
    // `transform(input) { ... }`. The leading-dot anchor keeps
    // that out of the false-positive set.
    expect(
      stripComments('const stub = `transform(input) { ... }`;'),
    ).not.toMatch(PATTERNS.transformCall);
  });

  it("ignores `console.log` inside a JSDoc block", () => {
    const src = `/**\n * does NOT call console.log\n */\nexport const x = 1;`;
    expect(stripComments(src)).not.toMatch(PATTERNS.consoleLog);
  });

  it("ignores `process.exit` inside a line comment", () => {
    const src = `export const x = 1; // mentions process.exit but it's a comment`;
    expect(stripComments(src)).not.toMatch(PATTERNS.processExit);
  });

  it("catches a real `fs` import", () => {
    expect(
      stripComments(`import { readFile } from "node:fs/promises";\n`),
    ).toMatch(PATTERNS.fsImport);
    expect(stripComments(`import * as fs from "fs";\n`)).toMatch(
      PATTERNS.fsImport,
    );
  });

  it("does NOT false-positive on a comment that contains the substring `fs`", () => {
    // The pattern anchors on `from "fs"` / `from "node:fs"`; a
    // bare mention of "fs" in prose stays inert.
    const src = `/** filesystem boundary lives in adapters */\nexport const x = 1;`;
    expect(stripComments(src)).not.toMatch(PATTERNS.fsImport);
  });

  it("catches `@nekostack/cli` imports (root + subpath)", () => {
    expect(
      stripComments(`import { x } from "@nekostack/cli";\n`),
    ).toMatch(PATTERNS.cliImport);
    expect(
      stripComments(`import { y } from "@nekostack/cli/loaders";\n`),
    ).toMatch(PATTERNS.cliImport);
  });

  it("does NOT match `@nekostack/schema/cli` (the legal subpath)", () => {
    // The runner DOES import `@nekostack/schema/cli` — that must
    // not trip the CLI-package import guard. The `cliImport`
    // pattern is anchored on `@nekostack/cli` exactly; the schema
    // subpath has a different namespace prefix.
    expect(
      stripComments(`import { z } from "@nekostack/schema/cli";\n`),
    ).not.toMatch(PATTERNS.cliImport);
  });

  it("stripComments removes block and line comments verbatim", () => {
    expect(stripComments("/* block */ x")).toBe(" x");
    expect(stripComments("x // line")).toBe("x ");
  });
});
