/**
 * Step 22 — `neko schema migrate verify` command gate tests.
 *
 * Direct `runMigrateVerify(opts)` only — commander wiring lands in a
 * later step. Verdict-sensitive cases need real `irHash` and
 * `sourceHash` values that match (or deliberately mismatch) the
 * schemas the workspace declares; the `buildVerifyFixture()` helper
 * computes those at setup time and writes a temp workspace, mirroring
 * `schema-check.test.ts`'s pattern. Non-hash-sensitive cases (loader
 * failures, duplicates, integrity) reuse the static `migrate-plan`
 * fixtures from Step 21 to avoid bloat.
 *
 * Covers (per Step 22 scope):
 *   - empty workspace → SUCCESS with zero summary
 *   - bound → SUCCESS
 *   - cosmetic_drift only → SUCCESS, warning-class
 *   - drift → LOGICAL_FAILURE
 *   - missing_endpoint → LOGICAL_FAILURE
 *   - mixed bound + cosmetic_drift + drift + missing_endpoint →
 *     LOGICAL_FAILURE; summary counts correct
 *   - schema-side loader failure → IO_ERROR
 *   - migration-side loader failure → IO_ERROR
 *   - duplicate schema → LOGICAL_FAILURE
 *   - duplicate migration → LOGICAL_FAILURE
 *   - malformed migration provenance → INTEGRITY_ERROR
 *   - JSON failure includes verdicts + summary + issues
 *   - JSON output never includes `migration` / `transform`
 *   - pretty distinguishes the four verdict labels
 *   - `migration.transform` is NEVER invoked
 *   - static-scan: command source has no console/process/stdio/.transform(
 */
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { s, irHash } from "@nekostack/schema";
import { sourceHashFromText } from "@nekostack/schema/cli";
import { runMigrateVerify } from "../../src/commands/schema/migrate/verify.js";
import { EXIT_CODES, type ExitCode } from "../../src/exit-codes.js";

const STATIC_FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
  "migrate-plan",
);

// =============================================================================
// Schema source + irHash / sourceHash computation
// =============================================================================

const SCHEMA_A_V1_SOURCE = `import { s } from "@nekostack/schema";

export const V1 = s
  .object({ a: s.string() })
  .id("com.fixture.cli.migrate-verify.A")
  .version("1.0.0");
`;

const SCHEMA_A_V2_SOURCE = `import { s } from "@nekostack/schema";

export const V2 = s
  .object({ a: s.string(), b: s.string().optional() })
  .id("com.fixture.cli.migrate-verify.A")
  .version("2.0.0");
`;

const SCHEMA_A_V3_SOURCE = `import { s } from "@nekostack/schema";

export const V3 = s
  .object({ a: s.string(), b: s.string().optional(), c: s.string().optional() })
  .id("com.fixture.cli.migrate-verify.A")
  .version("3.0.0");
`;

const SCHEMA_B_V1_SOURCE = `import { s } from "@nekostack/schema";

export const V1 = s
  .object({ x: s.string() })
  .id("com.fixture.cli.migrate-verify.B")
  .version("1.0.0");
`;

const SCHEMA_B_V2_SOURCE = `import { s } from "@nekostack/schema";

export const V2 = s
  .object({ x: s.number() })
  .id("com.fixture.cli.migrate-verify.B")
  .version("2.0.0");
`;

// Inline schema replicas — must match the source above structurally
// so `irHash(<inline>.node)` produces the same hash the CLI computes
// after loading the workspace.
const A_V1 = s
  .object({ a: s.string() })
  .id("com.fixture.cli.migrate-verify.A")
  .version("1.0.0");
const A_V2 = s
  .object({ a: s.string(), b: s.string().optional() })
  .id("com.fixture.cli.migrate-verify.A")
  .version("2.0.0");
const A_V3 = s
  .object({ a: s.string(), b: s.string().optional(), c: s.string().optional() })
  .id("com.fixture.cli.migrate-verify.A")
  .version("3.0.0");
const B_V1 = s
  .object({ x: s.string() })
  .id("com.fixture.cli.migrate-verify.B")
  .version("1.0.0");
const B_V2 = s
  .object({ x: s.number() })
  .id("com.fixture.cli.migrate-verify.B")
  .version("2.0.0");

const A_V1_IR_HASH = `sha256:${irHash(A_V1.node)}` as const;
const A_V2_IR_HASH = `sha256:${irHash(A_V2.node)}` as const;
const A_V3_IR_HASH = `sha256:${irHash(A_V3.node)}` as const;
const B_V1_IR_HASH = `sha256:${irHash(B_V1.node)}` as const;
const B_V2_IR_HASH = `sha256:${irHash(B_V2.node)}` as const;

const A_V1_SOURCE_HASH = sourceHashFromText(SCHEMA_A_V1_SOURCE);
const A_V2_SOURCE_HASH = sourceHashFromText(SCHEMA_A_V2_SOURCE);
const A_V3_SOURCE_HASH = sourceHashFromText(SCHEMA_A_V3_SOURCE);
const B_V1_SOURCE_HASH = sourceHashFromText(SCHEMA_B_V1_SOURCE);
const B_V2_SOURCE_HASH = sourceHashFromText(SCHEMA_B_V2_SOURCE);

const WRONG_HASH = `sha256:${"0".repeat(64)}` as const;

// =============================================================================
// Migration file template
// =============================================================================

function makeMigration(opts: {
  readonly schemaId: string;
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly fromIrHash: `sha256:${string}`;
  readonly toIrHash: `sha256:${string}`;
  readonly fromSourceHash: `sha256:${string}`;
  readonly toSourceHash: `sha256:${string}`;
}): string {
  return `/**
 * @migration by @nekostack/schema
 * schemaId:         ${opts.schemaId}
 * fromVersion:      ${opts.fromVersion}
 * toVersion:        ${opts.toVersion}
 * fromIrHash:       ${opts.fromIrHash}
 * toIrHash:         ${opts.toIrHash}
 * fromSourceHash:   ${opts.fromSourceHash}
 * toSourceHash:     ${opts.toSourceHash}
 * generator:        neko-schema-migrate-stub
 * generatorVersion: @nekostack/schema@0.8.0
 */
import type { Migration } from "@nekostack/schema/cli";
const migration: Migration<"${opts.schemaId}", "${opts.fromVersion}", "${opts.toVersion}"> = {
  schemaId: "${opts.schemaId}",
  from: "${opts.fromVersion}",
  to: "${opts.toVersion}",
  transform(input) {
    return input;
  },
};
export default migration;
`;
}

// =============================================================================
// Fixture builder
// =============================================================================

type Scenario =
  | "empty"
  | "bound"
  | "cosmetic_drift"
  | "drift"
  | "missing_endpoint"
  | "mixed";

function buildVerifyFixture(scenario: Scenario): string {
  const root = mkdtempSync(join(tmpdir(), "neko-mig-verify-"));

  if (scenario === "empty") {
    // No migrations, no schemas — `walkWorkspace` returns empty,
    // `buildRegistry` returns empty, `readMigrations` returns empty,
    // `buildMigrationRegistry` returns empty. Verifier sees empty
    // registry → success, zero counts.
    return root;
  }

  // Write the two A schemas (used by all non-empty scenarios).
  writeFileSync(join(root, "a-v1.schema.ts"), SCHEMA_A_V1_SOURCE, "utf8");
  writeFileSync(join(root, "a-v2.schema.ts"), SCHEMA_A_V2_SOURCE, "utf8");

  if (scenario === "bound") {
    writeFileSync(
      join(root, "a.1-0-0-to-2-0-0.migration.ts"),
      makeMigration({
        schemaId: "com.fixture.cli.migrate-verify.A",
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        fromIrHash: A_V1_IR_HASH,
        toIrHash: A_V2_IR_HASH,
        fromSourceHash: A_V1_SOURCE_HASH,
        toSourceHash: A_V2_SOURCE_HASH,
      }),
      "utf8",
    );
    return root;
  }

  if (scenario === "cosmetic_drift") {
    // irHashes match the schemas; sourceHashes deliberately don't.
    writeFileSync(
      join(root, "a.1-0-0-to-2-0-0.migration.ts"),
      makeMigration({
        schemaId: "com.fixture.cli.migrate-verify.A",
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        fromIrHash: A_V1_IR_HASH,
        toIrHash: A_V2_IR_HASH,
        fromSourceHash: WRONG_HASH,
        toSourceHash: WRONG_HASH,
      }),
      "utf8",
    );
    return root;
  }

  if (scenario === "drift") {
    // irHash mismatch on at least one endpoint.
    writeFileSync(
      join(root, "a.1-0-0-to-2-0-0.migration.ts"),
      makeMigration({
        schemaId: "com.fixture.cli.migrate-verify.A",
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        fromIrHash: A_V1_IR_HASH,
        toIrHash: WRONG_HASH,
        fromSourceHash: A_V1_SOURCE_HASH,
        toSourceHash: A_V2_SOURCE_HASH,
      }),
      "utf8",
    );
    return root;
  }

  if (scenario === "missing_endpoint") {
    // Migration claims a `to` version that doesn't exist in the
    // schema registry (only v1 + v2 are written).
    writeFileSync(
      join(root, "a.1-0-0-to-9-9-9.migration.ts"),
      makeMigration({
        schemaId: "com.fixture.cli.migrate-verify.A",
        fromVersion: "1.0.0",
        toVersion: "9.9.9",
        fromIrHash: A_V1_IR_HASH,
        toIrHash: WRONG_HASH,
        fromSourceHash: A_V1_SOURCE_HASH,
        toSourceHash: WRONG_HASH,
      }),
      "utf8",
    );
    return root;
  }

  // scenario === "mixed":
  //   - A 1→2 bound
  //   - A 2→3 cosmetic_drift   (need A v3 schema)
  //   - B 1→2 drift             (need B v1, v2 schemas)
  //   - A 1→9 missing_endpoint  (no A v9 schema)
  writeFileSync(join(root, "a-v3.schema.ts"), SCHEMA_A_V3_SOURCE, "utf8");
  writeFileSync(join(root, "b-v1.schema.ts"), SCHEMA_B_V1_SOURCE, "utf8");
  writeFileSync(join(root, "b-v2.schema.ts"), SCHEMA_B_V2_SOURCE, "utf8");

  writeFileSync(
    join(root, "a.1-0-0-to-2-0-0.migration.ts"),
    makeMigration({
      schemaId: "com.fixture.cli.migrate-verify.A",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      fromIrHash: A_V1_IR_HASH,
      toIrHash: A_V2_IR_HASH,
      fromSourceHash: A_V1_SOURCE_HASH,
      toSourceHash: A_V2_SOURCE_HASH,
    }),
    "utf8",
  );
  writeFileSync(
    join(root, "a.2-0-0-to-3-0-0.migration.ts"),
    makeMigration({
      schemaId: "com.fixture.cli.migrate-verify.A",
      fromVersion: "2.0.0",
      toVersion: "3.0.0",
      fromIrHash: A_V2_IR_HASH,
      toIrHash: A_V3_IR_HASH,
      fromSourceHash: WRONG_HASH,
      toSourceHash: WRONG_HASH,
    }),
    "utf8",
  );
  writeFileSync(
    join(root, "b.1-0-0-to-2-0-0.migration.ts"),
    makeMigration({
      schemaId: "com.fixture.cli.migrate-verify.B",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      fromIrHash: B_V1_IR_HASH,
      toIrHash: WRONG_HASH,
      fromSourceHash: B_V1_SOURCE_HASH,
      toSourceHash: B_V2_SOURCE_HASH,
    }),
    "utf8",
  );
  writeFileSync(
    join(root, "a.1-0-0-to-9-9-9.migration.ts"),
    makeMigration({
      schemaId: "com.fixture.cli.migrate-verify.A",
      fromVersion: "1.0.0",
      toVersion: "9.9.9",
      fromIrHash: A_V1_IR_HASH,
      toIrHash: WRONG_HASH,
      fromSourceHash: A_V1_SOURCE_HASH,
      toSourceHash: WRONG_HASH,
    }),
    "utf8",
  );
  return root;
}

// =============================================================================
// Capture helpers
// =============================================================================

interface Captured {
  readonly code: ExitCode;
  readonly stdout: string;
  readonly stderr: string;
}

async function runDirect(
  partial: Partial<Parameters<typeof runMigrateVerify>[0]> & {
    readonly root: string;
  },
): Promise<Captured> {
  let stdout = "";
  let stderr = "";
  const code = await runMigrateVerify({
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
// One temp workspace per scenario, shared across the describe block
// =============================================================================

const fixtures: Record<Scenario, string> = {} as Record<Scenario, string>;
const SCENARIOS: readonly Scenario[] = [
  "empty",
  "bound",
  "cosmetic_drift",
  "drift",
  "missing_endpoint",
  "mixed",
];

beforeAll(() => {
  for (const s of SCENARIOS) fixtures[s] = buildVerifyFixture(s);
});

afterAll(() => {
  for (const s of SCENARIOS) rmSync(fixtures[s], { recursive: true, force: true });
});

// =============================================================================
// Hash-sensitive verdict paths
// =============================================================================

describe("runMigrateVerify — verdict paths", () => {
  it("empty workspace → SUCCESS with zero summary", async () => {
    const r = await runDirect({ root: fixtures.empty, json: true });
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    const parsed = JSON.parse(r.stdout) as {
      verdicts: unknown[];
      summary: {
        bound: number;
        cosmetic_drift: number;
        drift: number;
        missing_endpoint: number;
      };
    };
    expect(parsed.verdicts).toEqual([]);
    expect(parsed.summary).toEqual({
      bound: 0,
      cosmetic_drift: 0,
      drift: 0,
      missing_endpoint: 0,
    });
  });

  it("empty workspace → pretty `No migrations to verify`", async () => {
    const r = await runDirect({ root: fixtures.empty });
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stdout).toBe("No migrations to verify.\n");
    expect(r.stderr).toBe("");
  });

  it("bound → SUCCESS", async () => {
    const r = await runDirect({ root: fixtures.bound });
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stderr).toBe("");
    expect(r.stdout).toContain("bound=1");
    expect(r.stdout).toContain("[bound]");
  });

  it("cosmetic_drift only → SUCCESS, warning-class label visible", async () => {
    const r = await runDirect({ root: fixtures.cosmetic_drift });
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stderr).toBe("");
    expect(r.stdout).toContain("cosmetic_drift=1");
    expect(r.stdout).toContain("[warn ] cosmetic_drift");
  });

  it("drift → LOGICAL_FAILURE", async () => {
    const r = await runDirect({ root: fixtures.drift });
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(r.stdout).toContain("drift=1");
    expect(r.stdout).toContain("[FAIL ] drift");
    expect(r.stderr).toContain("migration_drift");
  });

  it("missing_endpoint → LOGICAL_FAILURE", async () => {
    const r = await runDirect({ root: fixtures.missing_endpoint });
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(r.stdout).toContain("missing_endpoint=1");
    expect(r.stdout).toContain("[FAIL ] missing_endpoint");
    expect(r.stderr).toContain("migration_missing_endpoint");
  });

  it("mixed → LOGICAL_FAILURE with all four counts populated", async () => {
    const r = await runDirect({ root: fixtures.mixed, json: true });
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    const parsed = JSON.parse(r.stdout) as {
      verdicts: Array<{ status: string }>;
      summary: {
        bound: number;
        cosmetic_drift: number;
        drift: number;
        missing_endpoint: number;
      };
      issues: Array<{ code: string }>;
    };
    expect(parsed.summary.bound).toBe(1);
    expect(parsed.summary.cosmetic_drift).toBe(1);
    expect(parsed.summary.drift).toBe(1);
    expect(parsed.summary.missing_endpoint).toBe(1);
    expect(parsed.verdicts).toHaveLength(4);
    // Failure branch surfaces issues for drift + missing_endpoint only.
    const codes = parsed.issues.map((i) => i.code).sort();
    expect(codes).toEqual(["migration_drift", "migration_missing_endpoint"]);
  });
});

// =============================================================================
// JSON shape — failure includes verdicts+summary+issues; no migration/transform
// =============================================================================

describe("runMigrateVerify — JSON shape", () => {
  it("success JSON omits `issues` and contains verdicts + summary", async () => {
    const r = await runDirect({ root: fixtures.bound, json: true });
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    const parsed = JSON.parse(r.stdout) as Record<string, unknown>;
    expect(parsed).toHaveProperty("verdicts");
    expect(parsed).toHaveProperty("summary");
    expect(parsed).not.toHaveProperty("issues");
  });

  it("failure JSON includes verdicts + summary + issues", async () => {
    const r = await runDirect({ root: fixtures.drift, json: true });
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    const parsed = JSON.parse(r.stdout) as Record<string, unknown>;
    expect(parsed).toHaveProperty("verdicts");
    expect(parsed).toHaveProperty("summary");
    expect(parsed).toHaveProperty("issues");
  });

  it("JSON output never serializes `migration` or `transform`", async () => {
    const r = await runDirect({ root: fixtures.mixed, json: true });
    // Mixed has all four verdict shapes — strongest coverage for the
    // projection check.
    expect(r.stdout).not.toContain('"migration":');
    expect(r.stdout).not.toContain('"transform":');
  });

  it("JSON output is single-line + trailing newline", async () => {
    const r = await runDirect({ root: fixtures.bound, json: true });
    expect(r.stdout.endsWith("\n")).toBe(true);
    expect(r.stdout.slice(0, -1)).not.toMatch(/\n/);
  });
});

// =============================================================================
// Loader + registry failures (reuse migrate-plan static fixtures)
// =============================================================================

describe("runMigrateVerify — loader + registry failures", () => {
  it("schema-side loader failure → IO_ERROR, no `cause` in JSON", async () => {
    const r = await runDirect({
      root: join(STATIC_FIXTURES, "schema-loader-failure"),
      json: true,
    });
    expect(r.code).toBe(EXIT_CODES.IO_ERROR);
    expect(r.stdout).not.toContain('"cause":');
  });

  it("schema-side loader failure → pretty `schema file(s) failed to load`", async () => {
    const r = await runDirect({
      root: join(STATIC_FIXTURES, "schema-loader-failure"),
    });
    expect(r.code).toBe(EXIT_CODES.IO_ERROR);
    expect(r.stderr).toContain("schema file");
    expect(r.stderr).toContain("failed to load");
  });

  it("migration-side loader failure → IO_ERROR, no `cause` in JSON", async () => {
    const r = await runDirect({
      root: join(STATIC_FIXTURES, "migration-loader-failure"),
      json: true,
    });
    expect(r.code).toBe(EXIT_CODES.IO_ERROR);
    expect(r.stdout).not.toContain('"cause":');
  });

  it("migration-side loader failure → pretty `migration file(s) failed to load`", async () => {
    const r = await runDirect({
      root: join(STATIC_FIXTURES, "migration-loader-failure"),
    });
    expect(r.code).toBe(EXIT_CODES.IO_ERROR);
    expect(r.stderr).toContain("migration file");
    expect(r.stderr).toContain("failed to load");
    expect(r.stderr).not.toContain("schema file");
  });

  it("duplicate schema id → LOGICAL_FAILURE + duplicate_schema_id", async () => {
    const r = await runDirect({
      root: join(STATIC_FIXTURES, "duplicate-schema"),
    });
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(r.stderr).toContain("duplicate_schema_id");
  });

  it("duplicate migration → LOGICAL_FAILURE + duplicate_migration", async () => {
    const r = await runDirect({
      root: join(STATIC_FIXTURES, "duplicate-migration"),
    });
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(r.stderr).toContain("duplicate_migration");
  });

  it("malformed migration provenance → INTEGRITY_ERROR", async () => {
    const r = await runDirect({
      root: join(STATIC_FIXTURES, "integrity"),
    });
    expect(r.code).toBe(EXIT_CODES.INTEGRITY_ERROR);
    expect(r.stderr).toContain("integrity_error");
  });
});

// =============================================================================
// v0.8 boundary — transform never invoked
// =============================================================================

describe("runMigrateVerify — v0.8 boundary", () => {
  it("mixed-verdict run does not invoke any migration's transform", async () => {
    // Identity transforms; the strongest runtime statement is that
    // the command produced its output. The static-scan test below
    // proves no `.transform(` call exists in the command source.
    const r = await runDirect({ root: fixtures.mixed });
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(r.stdout).toContain("bound=1");
  });
});

// =============================================================================
// Static scan
// =============================================================================

describe("runMigrateVerify — source discipline (static scan)", () => {
  const CMD_SRC = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "src",
      "commands",
      "schema",
      "migrate",
      "verify.ts",
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
    // The v0.8 boundary.
    { name: ".transform(", pattern: /\.transform\s*\(/ },
  ];

  it.each(FORBIDDEN)("command source does not contain `$name`", ({ pattern }) => {
    expect(STRIPPED).not.toMatch(pattern);
  });
});

