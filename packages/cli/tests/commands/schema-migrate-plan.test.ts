/**
 * Step 21 — `neko schema migrate plan` command gate tests.
 *
 * Direct `runMigratePlan(opts)` tests only — commander wiring lands
 * in a later step. Mirrors `schema-migrate-list.test.ts`'s harness.
 *
 * Covers (per Step 21 scope):
 *   - no-change diff → SUCCESS, empty chain, no notes
 *   - over_specified (null/cosmetic + exact migration) → SUCCESS,
 *     empty chain, over_specified note
 *   - additive_no_migration (additive + no migration) → SUCCESS,
 *     empty chain, additive_no_migration note
 *   - additive + exact migration → SUCCESS, chain[1]
 *   - breaking + exact migration → SUCCESS, chain[1]
 *   - breaking + multi-hop chain → SUCCESS, chain[2], ordered hops
 *   - missing endpoint → LOGICAL_FAILURE + migration_missing_endpoint
 *   - breaking + no migration → LOGICAL_FAILURE + migration_not_found
 *   - breaking + chain broken → LOGICAL_FAILURE + migration_chain_broken
 *   - ambiguous chain → LOGICAL_FAILURE + migration_ambiguous_chain
 *   - schema-side loader failure → IO_ERROR, no `cause` in JSON
 *   - migration-side loader failure → IO_ERROR, no `cause` in JSON
 *   - duplicate schema id → LOGICAL_FAILURE + duplicate_schema_id
 *   - duplicate migration → LOGICAL_FAILURE + duplicate_migration
 *   - malformed migration provenance → INTEGRITY_ERROR
 *   - JSON output omits `migration` / `transform`
 *   - pretty output distinguishes success shapes
 *   - migration.transform is NEVER invoked
 *   - static-scan: command source has no console/process/stdio/.transform(
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runMigratePlan } from "../../src/commands/schema/migrate/plan.js";
import { EXIT_CODES, type ExitCode } from "../../src/exit-codes.js";

const FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
  "migrate-plan",
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
  partial: Partial<Parameters<typeof runMigratePlan>[0]> & {
    readonly schemaId: string;
    readonly fromVersion: string;
    readonly toVersion: string;
    readonly root: string;
  },
): Promise<Captured> {
  let stdout = "";
  let stderr = "";
  const code = await runMigratePlan({
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
// Success paths — pretty
// =============================================================================

describe("runMigratePlan — null/cosmetic (no migration needed)", () => {
  it("returns SUCCESS with empty chain and `No migration needed`", async () => {
    const r = await runDirect({
      root: fixture("no-change"),
      schemaId: "com.fixture.cli.migrate-plan.NoChange",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stderr).toBe("");
    expect(r.stdout).toContain("No migration needed");
  });

  it("over_specified (cosmetic diff + exact migration) → SUCCESS + note", async () => {
    const r = await runDirect({
      root: fixture("over-specified"),
      schemaId: "com.fixture.cli.migrate-plan.OverSpecified",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stdout).toContain("over_specified");
    expect(r.stdout).toContain("thing.1-0-0-to-2-0-0.migration.ts");
  });
});

describe("runMigratePlan — additive paths", () => {
  it("additive + no migration → SUCCESS with `additive_no_migration` note", async () => {
    const r = await runDirect({
      root: fixture("additive-no-migration"),
      schemaId: "com.fixture.cli.migrate-plan.AdditiveNoMig",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stdout).toContain("additive_no_migration");
  });

  it("additive + exact migration → SUCCESS with single-hop chain", async () => {
    const r = await runDirect({
      root: fixture("additive-with-migration"),
      schemaId: "com.fixture.cli.migrate-plan.AdditiveWithMig",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stdout).toContain("Chain (1 hop)");
    expect(r.stdout).toContain("1.0.0 → 2.0.0");
    expect(r.stdout).toContain("thing.1-0-0-to-2-0-0.migration.ts");
  });
});

describe("runMigratePlan — breaking paths", () => {
  it("breaking + exact migration → SUCCESS with single-hop chain", async () => {
    const r = await runDirect({
      root: fixture("breaking-exact"),
      schemaId: "com.fixture.cli.migrate-plan.BreakingExact",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stdout).toContain("Chain (1 hop)");
    expect(r.stdout).toContain("worstSeverity: breaking");
  });

  it("breaking + multi-hop → SUCCESS with ordered chain", async () => {
    const r = await runDirect({
      root: fixture("breaking-multi-hop"),
      schemaId: "com.fixture.cli.migrate-plan.MultiHop",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stdout).toContain("Chain (2 hops)");
    // Hops in order: 1.0.0 → 1.5.0 then 1.5.0 → 2.0.0
    const h1 = r.stdout.indexOf("1.0.0 → 1.5.0");
    const h2 = r.stdout.indexOf("1.5.0 → 2.0.0");
    expect(h1).toBeGreaterThan(-1);
    expect(h2).toBeGreaterThan(h1);
    expect(r.stdout).toContain("1.0.0 → 1.5.0 → 2.0.0");
  });
});

// =============================================================================
// Planner failures
// =============================================================================

describe("runMigratePlan — planner failures (LOGICAL_FAILURE)", () => {
  it("missing endpoint → LOGICAL_FAILURE + migration_missing_endpoint", async () => {
    const r = await runDirect({
      root: fixture("missing-endpoint"),
      schemaId: "com.fixture.cli.migrate-plan.MissingEndpoint",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(r.stderr).toContain("migration_missing_endpoint");
  });

  it("breaking + no migration → LOGICAL_FAILURE + migration_not_found", async () => {
    const r = await runDirect({
      root: fixture("breaking-no-migration"),
      schemaId: "com.fixture.cli.migrate-plan.BreakingNoMig",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(r.stderr).toContain("migration_not_found");
  });

  it("breaking + chain broken → LOGICAL_FAILURE + migration_chain_broken", async () => {
    const r = await runDirect({
      root: fixture("chain-broken"),
      schemaId: "com.fixture.cli.migrate-plan.ChainBroken",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(r.stderr).toContain("migration_chain_broken");
  });

  it("ambiguous chain → LOGICAL_FAILURE + migration_ambiguous_chain", async () => {
    const r = await runDirect({
      root: fixture("ambiguous-chain"),
      schemaId: "com.fixture.cli.migrate-plan.Ambiguous",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(r.stderr).toContain("migration_ambiguous_chain");
  });
});

// =============================================================================
// Loader + registry-build failures
// =============================================================================

describe("runMigratePlan — loader failures (IO_ERROR)", () => {
  it("schema-side loader failure → IO_ERROR + no `cause` in JSON", async () => {
    const r = await runDirect({
      root: fixture("schema-loader-failure"),
      schemaId: "com.fixture.cli.migrate-plan.SchemaLoaderFailure",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      json: true,
    });
    expect(r.code).toBe(EXIT_CODES.IO_ERROR);
    expect(r.stderr).toBe("");
    expect(r.stdout).not.toContain('"cause":');
    const parsed = JSON.parse(r.stdout) as {
      failures: Array<{ reason: string; path: string }>;
    };
    expect(parsed.failures.some((f) => f.reason === "runtime_error")).toBe(true);
  });

  it("schema-side loader failure → pretty defaults to `schema file(s) failed`", async () => {
    const r = await runDirect({
      root: fixture("schema-loader-failure"),
      schemaId: "com.fixture.cli.migrate-plan.SchemaLoaderFailure",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.code).toBe(EXIT_CODES.IO_ERROR);
    expect(r.stderr).toContain("schema file");
    expect(r.stderr).toContain("failed to load");
  });

  it("migration-side loader failure → IO_ERROR + no `cause` in JSON", async () => {
    const r = await runDirect({
      root: fixture("migration-loader-failure"),
      schemaId: "com.fixture.cli.migrate-plan.MigLoaderFailure",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      json: true,
    });
    expect(r.code).toBe(EXIT_CODES.IO_ERROR);
    expect(r.stdout).not.toContain('"cause":');
    const parsed = JSON.parse(r.stdout) as {
      failures: Array<{ reason: string; path: string }>;
    };
    expect(
      parsed.failures.some(
        (f) =>
          f.reason === "runtime_error" &&
          f.path.includes("runtime-throws"),
      ),
    ).toBe(true);
  });

  it("migration-side loader failure → pretty says `migration file(s) failed`", async () => {
    const r = await runDirect({
      root: fixture("migration-loader-failure"),
      schemaId: "com.fixture.cli.migrate-plan.MigLoaderFailure",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.code).toBe(EXIT_CODES.IO_ERROR);
    expect(r.stderr).toContain("migration file");
    expect(r.stderr).toContain("failed to load");
    // And NOT the schema noun.
    expect(r.stderr).not.toContain("schema file");
  });
});

describe("runMigratePlan — registry failures", () => {
  it("duplicate schema id → LOGICAL_FAILURE + duplicate_schema_id", async () => {
    const r = await runDirect({
      root: fixture("duplicate-schema"),
      schemaId: "com.fixture.cli.migrate-plan.DupSchema",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(r.stderr).toContain("duplicate_schema_id");
  });

  it("duplicate migration → LOGICAL_FAILURE + duplicate_migration", async () => {
    const r = await runDirect({
      root: fixture("duplicate-migration"),
      schemaId: "com.fixture.cli.migrate-plan.DupMig",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(r.stderr).toContain("duplicate_migration");
  });

  it("malformed provenance → INTEGRITY_ERROR + integrity_error", async () => {
    const r = await runDirect({
      root: fixture("integrity"),
      schemaId: "com.fixture.cli.migrate-plan.Integrity",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.code).toBe(EXIT_CODES.INTEGRITY_ERROR);
    expect(r.stderr).toContain("integrity_error");
  });
});

// =============================================================================
// JSON shape — `migration` / `transform` never serialized
// =============================================================================

describe("runMigratePlan — --json output never serializes `migration` / `transform`", () => {
  it("chain entries are projected (no `migration` / `transform`)", async () => {
    const r = await runDirect({
      root: fixture("breaking-multi-hop"),
      schemaId: "com.fixture.cli.migrate-plan.MultiHop",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      json: true,
    });
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stdout.endsWith("\n")).toBe(true);
    expect(r.stdout).not.toContain('"migration":');
    expect(r.stdout).not.toContain('"transform":');

    const parsed = JSON.parse(r.stdout) as {
      plan: {
        schemaId: string;
        fromVersion: string;
        toVersion: string;
        worstSeverity: string | null;
        versionPath: string[];
        chain: Array<Record<string, unknown>>;
        notes: Array<Record<string, unknown>>;
      };
    };
    expect(parsed.plan.schemaId).toBe("com.fixture.cli.migrate-plan.MultiHop");
    expect(parsed.plan.worstSeverity).toBe("breaking");
    expect(parsed.plan.versionPath).toEqual(["1.0.0", "1.5.0", "2.0.0"]);
    expect(parsed.plan.chain).toHaveLength(2);
    for (const hop of parsed.plan.chain) {
      expect(Object.keys(hop)).not.toContain("migration");
      expect(Object.keys(hop)).not.toContain("transform");
      // Projected fields are present.
      expect(hop).toHaveProperty("schemaId");
      expect(hop).toHaveProperty("fromVersion");
      expect(hop).toHaveProperty("toVersion");
      expect(hop).toHaveProperty("sourcePath");
      expect(hop).toHaveProperty("fromIrHash");
      expect(hop).toHaveProperty("toIrHash");
      expect(hop).toHaveProperty("fromSourceHash");
      expect(hop).toHaveProperty("toSourceHash");
    }
  });

  it("over_specified note projects its `migration` field without the closure", async () => {
    const r = await runDirect({
      root: fixture("over-specified"),
      schemaId: "com.fixture.cli.migrate-plan.OverSpecified",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      json: true,
    });
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stdout).not.toContain('"transform":');

    const parsed = JSON.parse(r.stdout) as {
      plan: { notes: Array<Record<string, unknown>>; chain: unknown[] };
    };
    expect(parsed.plan.chain).toEqual([]);
    expect(parsed.plan.notes).toHaveLength(1);
    const note = parsed.plan.notes[0]! as {
      kind: string;
      migration: Record<string, unknown>;
    };
    expect(note.kind).toBe("over_specified");
    // The note's migration projection has fields but no `transform`.
    expect(Object.keys(note.migration)).not.toContain("transform");
    expect(note.migration).toHaveProperty("sourcePath");
  });
});

// =============================================================================
// v0.8 boundary — transform never invoked
// =============================================================================

describe("runMigratePlan — v0.8 boundary", () => {
  it("multi-hop success does not invoke any migration's transform", async () => {
    // The fixture transforms are valid functions but the planner is
    // structural — it never calls them. The static-scan test below
    // proves the command source contains no `.transform(` call.
    const r = await runDirect({
      root: fixture("breaking-multi-hop"),
      schemaId: "com.fixture.cli.migrate-plan.MultiHop",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
  });
});

// =============================================================================
// Static-scan
// =============================================================================

describe("runMigratePlan — source discipline (static scan)", () => {
  const CMD_SRC = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "src",
      "commands",
      "schema",
      "migrate",
      "plan.ts",
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
    // The v0.8 boundary: the command never invokes migration.transform.
    { name: ".transform(", pattern: /\.transform\s*\(/ },
  ];

  it.each(FORBIDDEN)("command source does not contain `$name`", ({ pattern }) => {
    expect(STRIPPED).not.toMatch(pattern);
  });
});
