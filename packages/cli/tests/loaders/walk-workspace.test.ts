/**
 * Step 23 — `walk-workspace.ts` gate tests.
 *
 * Covers the locked behavior:
 *   - default pattern finds `.schema.ts` and `.schema.js`
 *   - default pattern ignores non-schema files
 *   - user-supplied pattern REPLACES the default (does not extend)
 *   - reads sourceText from disk verbatim
 *   - preserves sourcePath as a workspace-relative forward-slash form
 *   - threads each load's schemas into RegistrySourceEntry
 *   - aggregates multiple load failures instead of short-circuiting
 *   - empty workspace returns `{ entries: [], failures: [] }`
 *   - discovers nested schema files at arbitrary depth
 *   - static-scan: walker source carries no `console.*`,
 *     `process.exit`, or stdout/stderr writes
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  DEFAULT_SCHEMA_PATTERN,
  walkWorkspace,
} from "../../src/loaders/walk-workspace.js";

const FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
  "walk-workspace",
);

const fixture = (name: string): string => join(FIXTURES, name);

// =============================================================================
// Default pattern
// =============================================================================

describe("walkWorkspace — default pattern", () => {
  it("finds both `.schema.ts` and `.schema.js`", async () => {
    const r = await walkWorkspace({ root: fixture("basic") });
    expect(r.failures).toEqual([]);
    expect(r.entries).toHaveLength(2);
    const ids = r.entries
      .flatMap((e) => e.schemas.map((s) => s.node.metadata?.id))
      .sort();
    expect(ids).toEqual(["com.fixture.walk.Alpha", "com.fixture.walk.Beta"]);
  });

  it("ignores files that don't match `.schema.{ts,js}`", async () => {
    const r = await walkWorkspace({ root: fixture("basic") });
    expect(r.failures).toEqual([]);
    // `not-a-schema.ts` and `readme.md` must not appear.
    const paths = r.entries.map((e) => e.sourcePath);
    expect(paths).not.toContain("not-a-schema.ts");
    expect(paths).not.toContain("readme.md");
  });

  it("discovers nested schema files at arbitrary depth", async () => {
    const r = await walkWorkspace({ root: fixture("nested") });
    expect(r.failures).toEqual([]);
    expect(r.entries).toHaveLength(2);
    const paths = r.entries.map((e) => e.sourcePath);
    expect(paths).toEqual(["sub/inner/deep.schema.ts", "top.schema.ts"]);
  });

  it("DEFAULT_SCHEMA_PATTERN is the documented constant", () => {
    expect(DEFAULT_SCHEMA_PATTERN).toBe("**/*.schema.{ts,js}");
  });
});

// =============================================================================
// User-supplied pattern
// =============================================================================

describe("walkWorkspace — user-supplied pattern replaces the default", () => {
  it("a custom pattern replaces (does not extend) the default", async () => {
    // Override with a pattern that picks up `*.contract.ts` files. The
    // `default-named.schema.ts` in the same directory MUST NOT appear
    // in the results — the override is replace-semantics.
    const r = await walkWorkspace({
      root: fixture("custom-pattern"),
      pattern: "**/*.contract.ts",
    });
    expect(r.failures).toEqual([]);
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0]!.sourcePath).toBe("renamed.contract.ts");
    expect(r.entries[0]!.schemas[0]!.node.metadata?.id).toBe(
      "com.fixture.walk.Renamed",
    );
  });

  it("default pattern on the same root sees only the .schema.ts file", async () => {
    const r = await walkWorkspace({ root: fixture("custom-pattern") });
    expect(r.failures).toEqual([]);
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0]!.sourcePath).toBe("default-named.schema.ts");
  });
});

// =============================================================================
// Source-text + source-path preservation
// =============================================================================

describe("walkWorkspace — source identity preservation", () => {
  it("reads sourceText from disk verbatim", async () => {
    const r = await walkWorkspace({ root: fixture("basic") });
    expect(r.failures).toEqual([]);
    const alpha = r.entries.find((e) => e.sourcePath === "alpha.schema.ts");
    expect(alpha).toBeDefined();
    const onDisk = readFileSync(fixture("basic/alpha.schema.ts"), "utf8");
    expect(alpha!.sourceText).toBe(onDisk);
  });

  it("sourcePath is workspace-relative and forward-slash-normalized", async () => {
    const r = await walkWorkspace({ root: fixture("nested") });
    expect(r.failures).toEqual([]);
    for (const e of r.entries) {
      expect(e.sourcePath).not.toContain("\\");
      // Relative — never starts with `/` or a drive letter.
      expect(e.sourcePath.startsWith("/")).toBe(false);
      expect(/^[A-Za-z]:/.test(e.sourcePath)).toBe(false);
    }
  });

  it("wires each module's schemas into its RegistrySourceEntry", async () => {
    const r = await walkWorkspace({ root: fixture("basic") });
    expect(r.failures).toEqual([]);
    for (const e of r.entries) {
      expect(e.schemas.length).toBeGreaterThan(0);
      for (const s of e.schemas) {
        expect(typeof s.node.kind).toBe("string");
      }
    }
  });
});

// =============================================================================
// Empty workspace + failure aggregation
// =============================================================================

describe("walkWorkspace — edge cases", () => {
  it("empty workspace returns `{ entries: [], failures: [] }`", async () => {
    const r = await walkWorkspace({ root: fixture("empty") });
    expect(r.entries).toEqual([]);
    expect(r.failures).toEqual([]);
  });

  it("aggregates multiple load failures without short-circuiting", async () => {
    const r = await walkWorkspace({ root: fixture("failures") });
    // The `good` file should still appear in entries even though two
    // sibling files failed — that's the aggregation contract.
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0]!.sourcePath).toBe("good.schema.ts");

    // Both `runtime-throws` and `no-export` should be in failures,
    // each with the right reason and the workspace-relative path.
    expect(r.failures).toHaveLength(2);
    const byPath = new Map(r.failures.map((f) => [f.path, f.reason]));
    expect(byPath.get("runtime-throws.schema.ts")).toBe("runtime_error");
    expect(byPath.get("no-export.schema.ts")).toBe("no_schema_export");
  });
});

// =============================================================================
// Side-effect discipline (static scan; same approach as Step 22)
// =============================================================================

describe("walkWorkspace — side-effect discipline (static-scan)", () => {
  const WALKER_SRC = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "src",
      "loaders",
      "walk-workspace.ts",
    ),
    "utf8",
  );

  const STRIPPED = WALKER_SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(
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
  ];

  it.each(FORBIDDEN)("walker source does not call `$name`", ({ pattern }) => {
    expect(STRIPPED).not.toMatch(pattern);
  });
});
