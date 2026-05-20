/**
 * Step 20 — `neko schema migrate list` command gate tests.
 *
 * Direct `runMigrateList(opts)` tests only — the commander wiring
 * lands in a later step. Same shape as `schema-list.test.ts`'s
 * `runDirect` half.
 *
 * Covers:
 *   - happy path: pretty output of one fixture migration
 *   - happy path: --json output with locked shape
 *   - multiple migrations sorted by (schemaId, fromVersion, toVersion)
 *   - nested migrations at arbitrary depth
 *   - empty workspace returns SUCCESS with `No migrations found`
 *   - loader failure → IO_ERROR + diagnostics; --json failure shape
 *     excludes `cause`
 *   - duplicate migration → LOGICAL_FAILURE + issue diagnostics
 *   - malformed provenance (malformed_hash) → INTEGRITY_ERROR
 *   - --json output never serializes `migration` (the AnyMigration)
 *     or its `transform` closure
 *   - migration.transform is NEVER invoked
 *   - static-scan: `migrate/list.ts` has no `console.*`,
 *     `process.exit`, `process.stdout/stderr.write`, or `.transform(`
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runMigrateList } from "../../src/commands/schema/migrate/list.js";
import { EXIT_CODES, type ExitCode } from "../../src/exit-codes.js";

const FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
  "migrate-list",
);

const fixture = (name: string): string => join(FIXTURES, name);

// =============================================================================
// Helpers
// =============================================================================

interface Captured {
  readonly code: ExitCode;
  readonly stdout: string;
  readonly stderr: string;
}

async function runDirect(
  partial: Partial<Parameters<typeof runMigrateList>[0]>,
): Promise<Captured> {
  let stdout = "";
  let stderr = "";
  const code = await runMigrateList({
    root: fixture("basic"),
    json: false,
    quiet: false,
    stdout: (s) => {
      stdout += s;
    },
    stderr: (s) => {
      stderr += s;
    },
    ...partial,
  });
  return { code, stdout, stderr };
}

// =============================================================================
// Happy path — pretty
// =============================================================================

describe("runMigrateList — pretty output", () => {
  it("returns SUCCESS and prints one fixture migration", async () => {
    const r = await runDirect({ root: fixture("basic") });
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stderr).toBe("");
    expect(r.stdout).toMatch(/1 migration in workspace:/);
    expect(r.stdout).toContain("com.fixture.cli.migrate-list.Basic");
    expect(r.stdout).toContain("1.0.0 → 2.0.0");
    expect(r.stdout).toContain("one.1-0-0-to-2-0-0.migration.ts");
  });

  it("empty workspace returns SUCCESS with `No migrations found`", async () => {
    const r = await runDirect({ root: fixture("empty") });
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stdout).toBe("No migrations found in workspace.\n");
    expect(r.stderr).toBe("");
  });

  it("sorts entries by (schemaId, fromVersion, toVersion)", async () => {
    const r = await runDirect({ root: fixture("sorting") });
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stderr).toBe("");
    // Three fixtures: A 1→2, A 2→3, B 1→2 — expect that exact order
    // (alphabetical by schemaId; within A, ascending by fromVersion).
    const sortAIdx1 = r.stdout.indexOf("Sort.A");
    const sortAIdx2 = r.stdout.lastIndexOf("Sort.A");
    const sortBIdx = r.stdout.indexOf("Sort.B");
    expect(sortAIdx1).toBeGreaterThan(-1);
    expect(sortAIdx2).toBeGreaterThan(sortAIdx1);
    expect(sortBIdx).toBeGreaterThan(sortAIdx2);
    // A's two entries: 1→2 before 2→3.
    const aFirst = r.stdout.indexOf("1 → 2", sortAIdx1);
    const aSecond = r.stdout.indexOf("2 → 3", sortAIdx1);
    expect(aFirst).toBeLessThan(aSecond);
  });

  it("discovers nested migration files at arbitrary depth", async () => {
    const r = await runDirect({ root: fixture("nested") });
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stderr).toBe("");
    expect(r.stdout).toContain("Nested.Top");
    expect(r.stdout).toContain("Nested.Deep");
    expect(r.stdout).toContain("sub/inner/deep.1-to-2.migration.ts");
    expect(r.stdout).toContain("top.1-to-2.migration.ts");
  });
});

// =============================================================================
// Happy path — JSON
// =============================================================================

describe("runMigrateList — --json output", () => {
  it("emits one-line JSON with the locked shape", async () => {
    const r = await runDirect({ root: fixture("basic"), json: true });
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stderr).toBe("");
    expect(r.stdout.endsWith("\n")).toBe(true);
    expect(r.stdout.slice(0, -1)).not.toMatch(/\n/);

    const parsed = JSON.parse(r.stdout) as {
      migrations: Array<{
        schemaId: string;
        fromVersion: string;
        toVersion: string;
        sourcePath: string;
        fromIrHash: string;
        toIrHash: string;
        fromSourceHash: string;
        toSourceHash: string;
      }>;
    };
    expect(parsed.migrations).toHaveLength(1);
    const m = parsed.migrations[0]!;
    expect(m.schemaId).toBe("com.fixture.cli.migrate-list.Basic");
    expect(m.fromVersion).toBe("1.0.0");
    expect(m.toVersion).toBe("2.0.0");
    expect(m.sourcePath).toBe("one.1-0-0-to-2-0-0.migration.ts");
    expect(m.fromIrHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(m.toIrHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(m.fromSourceHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(m.toSourceHash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("--json output NEVER includes the `migration` AnyMigration or its `transform`", async () => {
    const r = await runDirect({ root: fixture("basic"), json: true });
    expect(r.code).toBe(EXIT_CODES.SUCCESS);

    // String-level checks — covers both raw serialization and any
    // accidental nesting under another key.
    expect(r.stdout).not.toContain('"migration":');
    expect(r.stdout).not.toContain('"transform":');

    // And structurally: no entry has either key.
    const parsed = JSON.parse(r.stdout) as {
      migrations: Array<Record<string, unknown>>;
    };
    for (const m of parsed.migrations) {
      expect(Object.keys(m)).not.toContain("migration");
      expect(Object.keys(m)).not.toContain("transform");
    }
  });

  it("emits `{ migrations: [] }` for the empty workspace", async () => {
    const r = await runDirect({ root: fixture("empty"), json: true });
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stderr).toBe("");
    const parsed = JSON.parse(r.stdout) as { migrations: unknown[] };
    expect(parsed.migrations).toEqual([]);
  });
});

// =============================================================================
// Loader failure
// =============================================================================

describe("runMigrateList — loader failure", () => {
  it("returns IO_ERROR and writes failures to stderr in pretty mode", async () => {
    const r = await runDirect({ root: fixture("loader-failure") });
    expect(r.code).toBe(EXIT_CODES.IO_ERROR);
    expect(r.stdout).toBe("");
    expect(r.stderr).toContain("runtime_error");
    expect(r.stderr).toContain("runtime-throws.1-to-2.migration.ts");
  });

  it("returns IO_ERROR and writes failures to stdout in JSON mode (no `cause`)", async () => {
    const r = await runDirect({
      root: fixture("loader-failure"),
      json: true,
    });
    expect(r.code).toBe(EXIT_CODES.IO_ERROR);
    expect(r.stderr).toBe("");
    const parsed = JSON.parse(r.stdout) as {
      failures: Array<{
        path: string;
        reason: string;
        message: string;
        cause?: unknown;
      }>;
    };
    expect(parsed.failures.length).toBeGreaterThan(0);
    const f = parsed.failures.find((x) =>
      x.path.endsWith("runtime-throws.1-to-2.migration.ts"),
    );
    expect(f).toBeDefined();
    expect(f!.reason).toBe("runtime_error");
    // `cause` is `unknown` from tsx/esbuild and MUST NOT be serialized.
    expect(Object.keys(f!)).not.toContain("cause");
    // String-level guard against accidental projection.
    expect(r.stdout).not.toContain('"cause":');
  });
});

// =============================================================================
// Registry failures: duplicate + integrity
// =============================================================================

describe("runMigrateList — registry-build failures", () => {
  it("duplicate migration triple → LOGICAL_FAILURE + duplicate_migration issue", async () => {
    const r = await runDirect({ root: fixture("duplicates") });
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(r.stdout).toBe("");
    expect(r.stderr).toContain("duplicate_migration");
    expect(r.stderr).toContain("com.fixture.cli.migrate-list.Dup");
  });

  it("duplicate migration (JSON) writes `{ issues }` to stdout, LOGICAL_FAILURE exit", async () => {
    const r = await runDirect({ root: fixture("duplicates"), json: true });
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(r.stderr).toBe("");
    const parsed = JSON.parse(r.stdout) as {
      issues: Array<{ code: string }>;
    };
    expect(parsed.issues.some((i) => i.code === "duplicate_migration")).toBe(
      true,
    );
  });

  it("malformed provenance hash → INTEGRITY_ERROR + integrity_error issue", async () => {
    const r = await runDirect({ root: fixture("integrity") });
    expect(r.code).toBe(EXIT_CODES.INTEGRITY_ERROR);
    expect(r.stdout).toBe("");
    expect(r.stderr).toContain("integrity_error");
  });

  it("malformed provenance (JSON) writes `{ issues }` to stdout, INTEGRITY_ERROR exit", async () => {
    const r = await runDirect({ root: fixture("integrity"), json: true });
    expect(r.code).toBe(EXIT_CODES.INTEGRITY_ERROR);
    expect(r.stderr).toBe("");
    const parsed = JSON.parse(r.stdout) as {
      issues: Array<{ code: string }>;
    };
    expect(parsed.issues.some((i) => i.code === "integrity_error")).toBe(true);
  });
});

// =============================================================================
// transform never invoked
// =============================================================================

describe("runMigrateList — v0.8 boundary", () => {
  it("does not invoke any migration's `transform` (would be observable via throw)", async () => {
    // The fixture transforms are identity functions; the strongest
    // statement we can make at runtime is that the command succeeded
    // and produced output. The static-scan test below proves the
    // command source itself contains no `.transform(` call.
    const r = await runDirect({ root: fixture("basic") });
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
  });
});

// =============================================================================
// Static-scan discipline
// =============================================================================

describe("runMigrateList — source discipline (static scan)", () => {
  const CMD_SRC = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "src",
      "commands",
      "schema",
      "migrate",
      "list.ts",
    ),
    "utf8",
  );

  const STRIPPED = CMD_SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(
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
    // The v0.8 boundary: the command never calls `migration.transform(...)`.
    // Leading-dot anchor distinguishes a call from the `transform:` key
    // a fixture object might have.
    { name: ".transform(", pattern: /\.transform\s*\(/ },
  ];

  it.each(FORBIDDEN)("command source does not contain `$name`", ({ pattern }) => {
    expect(STRIPPED).not.toMatch(pattern);
  });
});
