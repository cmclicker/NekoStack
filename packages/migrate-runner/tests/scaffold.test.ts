/**
 * Step 1 — scaffold gate.
 *
 * Proves the new `@nekostack/migrate-runner` package is wired up:
 *
 *   - `src/index.ts` is importable
 *   - the workspace `@nekostack/schema` peer is resolvable through
 *     the (future) runner subpath we'll consume from
 *     `@nekostack/schema/cli` in later steps
 *   - the package source carries no `.transform(` call, no
 *     `console.*`, no `process.exit`, no direct stdout/stderr writes
 *     — the static-scan boundary that every subsequent step must
 *     keep clean
 *
 * The scaffold deliberately ships NO behavior. Subsequent steps land
 * core types (Step 2), pre-flight (Step 3), per-record pipeline
 * (Step 4), audit (Step 5), runner (Step 6), adapters (Step 7), and
 * the full test matrix (Step 8) — see PR body for the locked
 * checklist.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PACKAGE_NAME } from "../src/index.js";

// =============================================================================
// Wiring
// =============================================================================

describe("@nekostack/migrate-runner — scaffold wiring", () => {
  it("exports the package name constant", () => {
    expect(PACKAGE_NAME).toBe("@nekostack/migrate-runner");
  });

  it("resolves the `@nekostack/schema` workspace peer via the public root", async () => {
    // Sanity that the workspace links resolve at test time. The
    // runner consumes `@nekostack/schema/cli` (NOT the root) in
    // later steps; for Step 1 we just prove the workspace link
    // exists. Importing from the root is the safe v0.6 surface.
    const schema = await import("@nekostack/schema");
    expect(schema).toBeTypeOf("object");
    expect(schema).toHaveProperty("s");
    expect(schema).toHaveProperty("parse");
  });
});

// =============================================================================
// Static-scan boundary — must stay clean from Step 1 onward.
// =============================================================================
//
// The v0.9 plan (PHASE_PLAN_v0.9.md Decision #1 + the boundary table)
// is enforced by static scan on the runner package, mirroring the
// schema-side handler-purity gate and the CLI command-module gates.
//
// Allowed: `fs.*`, `import()`, async I/O. The runner IS the
// filesystem / data boundary for migration data, by design.
//
// Forbidden in `src/`:
//   - `console.log / error / warn / info / debug` (writers must be
//     injected by the caller)
//   - `process.exit / abort` (the runner returns Results, never
//     calls exit)
//   - `process.stdout.write` / `process.stderr.write` (same reason)
//
// **Specifically forbidden across every runner source file EXCEPT
// the future `per-record-pipeline.ts` (Step 4):**
//   - `.transform(` (only the per-record pipeline invokes a
//     migration's transform; every other file must remain
//     transform-free, just like the schema-side handler purity gate)
//
// Step 1 has only `src/index.ts`. The pipeline file doesn't exist
// yet, so for the scaffold we ban `.transform(` everywhere in `src/`.
// When Step 4 lands, the scan will be widened to allow `.transform(`
// in exactly one file — the per-record pipeline.

const SRC_INDEX = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "src",
    "index.ts",
  ),
  "utf8",
);

const STRIPPED = SRC_INDEX.replace(/\/\*[\s\S]*?\*\//g, "").replace(
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
  // The v0.8 boundary that v0.9 inherits at the schema-side surface.
  // The runner package WILL gain a single legitimate `.transform(`
  // call inside `per-record-pipeline.ts` when Step 4 lands; this
  // scan is widened then. For the Step 1 scaffold every source file
  // must be transform-free.
  { name: ".transform(", pattern: /\.transform\s*\(/ },
];

describe("@nekostack/migrate-runner — Step 1 source discipline (static scan)", () => {
  it.each(FORBIDDEN)(
    "`src/index.ts` does not contain `$name`",
    ({ pattern }) => {
      expect(STRIPPED).not.toMatch(pattern);
    },
  );
});
