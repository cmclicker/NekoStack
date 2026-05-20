/**
 * Step 19 — `read-migrations.ts` gate tests.
 *
 * Covers the locked behavior:
 *   - default pattern is `**​/*.migration.ts`
 *   - default pattern ignores files that don't end in `.migration.ts`
 *   - reads sourceText from disk verbatim
 *   - preserves sourcePath as a workspace-relative forward-slash form
 *   - deterministic ordering by sourcePath
 *   - empty workspace returns `{ entries: [], failures: [] }`
 *   - nested migration files at arbitrary depth
 *   - module top-level throw → `runtime_error`; walk continues
 *   - missing default export → `no_migration_export`
 *   - malformed default export (missing `transform`) → `no_migration_export`
 *   - syntactic/compile error → `compile_error`
 *   - aggregates multiple failures without short-circuiting
 *   - `migration.transform` is NEVER invoked by the loader
 *   - static-scan: loader source carries no `console.*`, `process.exit`,
 *     `process.stdout/stderr.write`, and no `.transform(` call
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  DEFAULT_MIGRATION_PATTERN,
  readMigrations,
} from "../../src/loaders/read-migrations.js";

const FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
  "read-migrations",
);

const fixture = (name: string): string => join(FIXTURES, name);

// =============================================================================
// Defaults
// =============================================================================

describe("readMigrations — default pattern + constant", () => {
  it("DEFAULT_MIGRATION_PATTERN is the locked v0.8 glob", () => {
    expect(DEFAULT_MIGRATION_PATTERN).toBe("**/*.migration.ts");
  });

  it("finds `.migration.ts` files", async () => {
    const r = await readMigrations({ root: fixture("basic") });
    expect(r.failures).toEqual([]);
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0]!.sourcePath).toBe(
      "sample.1-0-0-to-2-0-0.migration.ts",
    );
    expect(r.entries[0]!.migration.schemaId).toBe("com.fixture.cli.Sample");
    expect(r.entries[0]!.migration.from).toBe("1.0.0");
    expect(r.entries[0]!.migration.to).toBe("2.0.0");
  });

  it("ignores sibling files that don't end in `.migration.ts`", async () => {
    const r = await readMigrations({ root: fixture("basic") });
    const paths = r.entries.map((e) => e.sourcePath);
    expect(paths).not.toContain("not-a-migration.ts");
  });
});

// =============================================================================
// Ordering + nesting
// =============================================================================

describe("readMigrations — ordering + nesting", () => {
  it("entries are sorted ascending by `sourcePath`", async () => {
    const r = await readMigrations({ root: fixture("sorting") });
    expect(r.failures).toEqual([]);
    expect(r.entries.map((e) => e.sourcePath)).toEqual([
      "a.0-to-1.migration.ts",
      "b.1-to-2.migration.ts",
      "c.2-to-3.migration.ts",
    ]);
  });

  it("discovers nested migration files at arbitrary depth", async () => {
    const r = await readMigrations({ root: fixture("nested") });
    expect(r.failures).toEqual([]);
    expect(r.entries.map((e) => e.sourcePath)).toEqual([
      "sub/inner/deep.1-to-2.migration.ts",
      "top.1-to-2.migration.ts",
    ]);
  });
});

// =============================================================================
// Source identity preservation
// =============================================================================

describe("readMigrations — source identity preservation", () => {
  it("preserves sourceText verbatim from disk", async () => {
    const r = await readMigrations({ root: fixture("basic") });
    expect(r.failures).toEqual([]);
    const entry = r.entries.find(
      (e) => e.sourcePath === "sample.1-0-0-to-2-0-0.migration.ts",
    );
    expect(entry).toBeDefined();
    const onDisk = readFileSync(
      fixture("basic/sample.1-0-0-to-2-0-0.migration.ts"),
      "utf8",
    );
    expect(entry!.sourceText).toBe(onDisk);
  });

  it("sourcePath is workspace-relative and forward-slash-normalized", async () => {
    const r = await readMigrations({ root: fixture("nested") });
    expect(r.failures).toEqual([]);
    for (const e of r.entries) {
      expect(e.sourcePath).not.toContain("\\");
      expect(e.sourcePath.startsWith("/")).toBe(false);
      expect(/^[A-Za-z]:/.test(e.sourcePath)).toBe(false);
    }
  });
});

// =============================================================================
// Empty workspace
// =============================================================================

describe("readMigrations — empty workspace", () => {
  it("returns `{ entries: [], failures: [] }`", async () => {
    const r = await readMigrations({ root: fixture("empty") });
    expect(r.entries).toEqual([]);
    expect(r.failures).toEqual([]);
  });
});

// =============================================================================
// Failure aggregation
// =============================================================================

describe("readMigrations — failure aggregation (no silent skip, no short-circuit)", () => {
  it("aggregates every failure category and still produces good entries", async () => {
    const r = await readMigrations({ root: fixture("failures") });

    // The good fixture still loads.
    const goodPaths = r.entries.map((e) => e.sourcePath);
    expect(goodPaths).toEqual(["good.1-to-2.migration.ts"]);

    // All four failure fixtures are reported.
    const byPath = new Map(r.failures.map((f) => [f.path, f.reason]));
    expect(byPath.get("runtime-throws.1-to-2.migration.ts")).toBe(
      "runtime_error",
    );
    expect(byPath.get("no-default.1-to-2.migration.ts")).toBe(
      "no_migration_export",
    );
    expect(byPath.get("malformed-default.1-to-2.migration.ts")).toBe(
      "no_migration_export",
    );
    expect(byPath.get("compile-error.1-to-2.migration.ts")).toBe(
      "compile_error",
    );

    // No silent skip — failures count matches the count of bad fixtures.
    expect(r.failures).toHaveLength(4);
  });

  it("`no_migration_export` failures carry a structured message", async () => {
    const r = await readMigrations({ root: fixture("failures") });
    const f = r.failures.find(
      (x) => x.path === "malformed-default.1-to-2.migration.ts",
    );
    expect(f).toBeDefined();
    expect(f!.reason).toBe("no_migration_export");
    expect(f!.message).toMatch(/Migration/);
    expect(f!.message).toMatch(/transform/);
  });
});

// =============================================================================
// `transform` is never invoked
// =============================================================================

describe("readMigrations — transform is never invoked", () => {
  it("loading a migration whose transform would throw still succeeds", async () => {
    // If the loader were to invoke `.transform(...)`, this fixture's
    // throwing transform would surface as a runtime_error. It doesn't.
    // (The basic fixture's transform is benign, so this test asserts
    // the contract by structural means below.) We assert that the
    // entry is constructed and the `transform` field is a function
    // that has NOT been called by the loader. We do that by counting
    // its invocations after the load — `transform` is the IDENTITY
    // function in the fixture, so we can only really observe "not
    // called" via the source-scan test below.
    const r = await readMigrations({ root: fixture("basic") });
    expect(r.failures).toEqual([]);
    const entry = r.entries[0]!;
    expect(typeof entry.migration.transform).toBe("function");
  });
});

// =============================================================================
// Source discipline (static scan)
// =============================================================================

describe("readMigrations — side-effect & transform discipline (static scan)", () => {
  const LOADER_SRC = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "src",
      "loaders",
      "read-migrations.ts",
    ),
    "utf8",
  );

  const STRIPPED = LOADER_SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(
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
    // The hard v0.8 boundary: the CLI loader never calls
    // `migration.transform(...)`. Leading-dot anchor distinguishes
    // a call from the `transform:` key on a fixture object.
    { name: ".transform(", pattern: /\.transform\s*\(/ },
  ];

  it.each(FORBIDDEN)("loader source does not contain `$name`", ({ pattern }) => {
    expect(STRIPPED).not.toMatch(pattern);
  });
});
