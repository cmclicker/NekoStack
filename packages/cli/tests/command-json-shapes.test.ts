/**
 * Final hardening — JSON output envelope gate.
 *
 * Locks ONLY the top-level shape of each verb's `--json` output —
 * success envelopes and failure envelopes. Per-command semantics
 * (verdict tally, exit-code mapping, operand resolution, etc.) are
 * already covered in the per-command test files; this suite is a
 * narrow regression net for the machine-readable contracts.
 *
 * Success envelopes:
 *   list             → { schemas }
 *   diff             → { changes, worstSeverity }
 *   check            → { verdicts, summary }
 *   generate         → { artifacts }
 *   migrate list     → { migrations }
 *   migrate plan     → { plan }
 *   migrate verify   → { verdicts, summary }              (success)
 *                    → { issues, summary, verdicts }      (failure)
 *   migrate stub     → { stub }                           (success)
 *                    → { failures }                       (overwrite refusal)
 *
 * Failure envelopes:
 *   load failure       → { failures: [{ path, reason, message }] }
 *   duplicate registry → { issues }
 *
 * Negative shape rules:
 *   - failure objects MUST NOT carry `cause`
 *   - generated-artifact metadata MUST NOT carry `content`
 *   - migrate JSON MUST NOT carry `migration` or `transform`
 *   - migrate-stub success MUST NOT carry `content`
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EXIT_CODES } from "../src/cli.js";
import { runCli } from "./cli-harness.js";

const FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "walk-workspace",
);

const MIGRATE_LIST_FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "migrate-list",
);
const MIGRATE_PLAN_FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "migrate-plan",
);

// =============================================================================
// Workspaces shared across the file
// =============================================================================
//
// - `emptyRoot`        — readable empty dir; every verb on this produces
//                        the empty-state success envelope.
// - `oneSchemaRoot`    — single named schema; lets `generate` emit
//                        artifacts whose JSON shape can be inspected.
// - `failuresRoot`     — workspace with load failures (existing fixture).
// - `duplicatesRoot`   — workspace with duplicate (schemaId, version)
//                        (existing fixture).
// - `diffCasesRoot`    — workspace with multiple versions of one schema
//                        so diff can be exercised against itself.

let emptyRoot: string;
let oneSchemaRoot: string;
let migrateStubRoot: string;
const failuresRoot = join(FIXTURES, "failures");
const duplicatesRoot = join(FIXTURES, "duplicates");
const diffCasesRoot = join(FIXTURES, "diff-cases");

// Migrate fixtures (static, from earlier steps — see fixtures/migrate-{list,plan}/).
const migrateListEmptyRoot = join(MIGRATE_LIST_FIXTURES, "empty");
const migrateListBasicRoot = join(MIGRATE_LIST_FIXTURES, "basic");
const migrateListLoaderFailureRoot = join(MIGRATE_LIST_FIXTURES, "loader-failure");
const migrateListDuplicatesRoot = join(MIGRATE_LIST_FIXTURES, "duplicates");
const migrateListIntegrityRoot = join(MIGRATE_LIST_FIXTURES, "integrity");
const migrateBreakingExactRoot = join(MIGRATE_PLAN_FIXTURES, "breaking-exact");
const migrateOverSpecifiedRoot = join(MIGRATE_PLAN_FIXTURES, "over-specified");

const ONE_NAMED_SCHEMA = `import { s } from "@nekostack/schema";
export const Tiny = s.object({ id: s.string() }).id("com.fixture.cli.shape.Tiny").version("1.0.0");
`;

// Schemas for the stub-envelope tests. Two versions of one schema —
// both present in the registry so `stubMigrationHandler` resolves the
// endpoints and the CLI writes the stub.
const STUB_V1_SCHEMA = `import { s } from "@nekostack/schema";
export const V1 = s
  .object({ a: s.string() })
  .id("com.fixture.cli.shape.StubTarget")
  .version("1.0.0");
`;
const STUB_V2_SCHEMA = `import { s } from "@nekostack/schema";
export const V2 = s
  .object({ a: s.number() })
  .id("com.fixture.cli.shape.StubTarget")
  .version("2.0.0");
`;

beforeAll(() => {
  emptyRoot = mkdtempSync(join(tmpdir(), "neko-json-shapes-"));
  oneSchemaRoot = mkdtempSync(join(tmpdir(), "neko-json-shapes-"));
  writeFileSync(join(oneSchemaRoot, "tiny.schema.ts"), ONE_NAMED_SCHEMA, "utf8");

  // Dedicated workspace for stub envelope tests — they write files;
  // using a temp dir keeps the fixtures/ tree read-only.
  migrateStubRoot = mkdtempSync(join(tmpdir(), "neko-json-shapes-stub-"));
  writeFileSync(join(migrateStubRoot, "v1.schema.ts"), STUB_V1_SCHEMA, "utf8");
  writeFileSync(join(migrateStubRoot, "v2.schema.ts"), STUB_V2_SCHEMA, "utf8");
});

afterAll(() => {
  rmSync(emptyRoot, { recursive: true, force: true });
  rmSync(oneSchemaRoot, { recursive: true, force: true });
  rmSync(migrateStubRoot, { recursive: true, force: true });
});

function keysOf(o: unknown): readonly string[] {
  return Object.keys(o as Record<string, unknown>).sort();
}

// =============================================================================
// Success envelopes
// =============================================================================

describe("--json success envelope: `list`", () => {
  it("has exactly the top-level key `schemas`", async () => {
    const r = await runCli(["schema", "list", "--json", "--root", emptyRoot]);
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    const parsed = JSON.parse(r.stdout) as Record<string, unknown>;
    expect(keysOf(parsed)).toEqual(["schemas"]);
    expect(Array.isArray(parsed.schemas)).toBe(true);
  });
});

describe("--json success envelope: `diff`", () => {
  it("has exactly the top-level keys `changes`, `worstSeverity`", async () => {
    // Self-diff over an existing fixture schema → empty changes,
    // `worstSeverity: null`. We're only locking the envelope here.
    const r = await runCli([
      "schema",
      "diff",
      "com.fixture.walk.DiffStable@1.0.0",
      "com.fixture.walk.DiffStable@1.0.0",
      "--json",
      "--root",
      diffCasesRoot,
    ]);
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    const parsed = JSON.parse(r.stdout) as Record<string, unknown>;
    expect(keysOf(parsed)).toEqual(["changes", "worstSeverity"]);
    expect(Array.isArray(parsed.changes)).toBe(true);
    expect(parsed.worstSeverity).toBeNull();
  });
});

describe("--json success envelope: `check`", () => {
  it("has exactly the top-level keys `summary`, `verdicts`", async () => {
    const r = await runCli(["schema", "check", "--json", "--root", emptyRoot]);
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    const parsed = JSON.parse(r.stdout) as Record<string, unknown>;
    expect(keysOf(parsed)).toEqual(["summary", "verdicts"]);
    expect(Array.isArray(parsed.verdicts)).toBe(true);
    expect(keysOf(parsed.summary)).toEqual([
      "clean",
      "cosmetic_drift",
      "integrity_error",
      "stale",
    ]);
  });
});

describe("--json success envelope: `generate`", () => {
  it("has exactly the top-level key `artifacts`", async () => {
    const r = await runCli([
      "schema",
      "generate",
      "--json",
      "--root",
      oneSchemaRoot,
    ]);
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    const parsed = JSON.parse(r.stdout) as Record<string, unknown>;
    expect(keysOf(parsed)).toEqual(["artifacts"]);
    expect(Array.isArray(parsed.artifacts)).toBe(true);
    expect((parsed.artifacts as unknown[]).length).toBeGreaterThan(0);
  });

  it("generated-artifact entries carry no `content` field", async () => {
    const r = await runCli([
      "schema",
      "generate",
      "--json",
      "--root",
      oneSchemaRoot,
    ]);
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    const parsed = JSON.parse(r.stdout) as {
      artifacts: Array<Record<string, unknown>>;
    };
    for (const a of parsed.artifacts) {
      expect(a).not.toHaveProperty("content");
      expect(keysOf(a)).toEqual([
        "irHash",
        "kind",
        "schemaId",
        "sourceHash",
        "suggestedPath",
      ]);
    }
  });
});

// =============================================================================
// Failure envelopes — load failure
// =============================================================================

describe("--json failure envelope: load failure", () => {
  it.each(["list", "diff", "check", "generate"] as const)(
    "`%s` emits `{ failures: [{ path, reason, message }] }` on IO_ERROR",
    async (verb) => {
      const argv =
        verb === "diff"
          ? [
              "schema",
              "diff",
              "com.x.A",
              "com.x.B",
              "--json",
              "--root",
              failuresRoot,
            ]
          : ["schema", verb, "--json", "--root", failuresRoot];
      const r = await runCli(argv);
      expect(r.code).toBe(EXIT_CODES.IO_ERROR);
      const parsed = JSON.parse(r.stdout) as Record<string, unknown>;
      expect(keysOf(parsed)).toEqual(["failures"]);
      const failures = parsed.failures as Array<Record<string, unknown>>;
      expect(failures.length).toBeGreaterThan(0);
      for (const f of failures) {
        expect(f).not.toHaveProperty("cause");
        expect(keysOf(f)).toEqual(["message", "path", "reason"]);
      }
    },
  );
});

// =============================================================================
// Failure envelopes — duplicate registry
// =============================================================================

describe("--json failure envelope: duplicate registry", () => {
  it.each(["list", "check", "generate"] as const)(
    "`%s` emits `{ issues }` on LOGICAL_FAILURE from duplicate ids",
    async (verb) => {
      const r = await runCli([
        "schema",
        verb,
        "--json",
        "--root",
        duplicatesRoot,
      ]);
      expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
      const parsed = JSON.parse(r.stdout) as Record<string, unknown>;
      expect(keysOf(parsed)).toEqual(["issues"]);
      const issues = parsed.issues as Array<Record<string, unknown>>;
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0]?.code).toBe("duplicate_schema_id");
    },
  );

  it("`diff` emits `{ issues }` on LOGICAL_FAILURE from duplicate ids", async () => {
    const r = await runCli([
      "schema",
      "diff",
      "com.fixture.walk.Duplicate",
      "com.fixture.walk.Duplicate",
      "--json",
      "--root",
      duplicatesRoot,
    ]);
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    const parsed = JSON.parse(r.stdout) as Record<string, unknown>;
    expect(keysOf(parsed)).toEqual(["issues"]);
  });
});

// =============================================================================
// Migrate success envelopes (v0.8)
// =============================================================================

describe("--json success envelope: `migrate list`", () => {
  it("empty workspace → has exactly the top-level key `migrations`", async () => {
    const r = await runCli([
      "schema",
      "migrate",
      "list",
      "--json",
      "--root",
      migrateListEmptyRoot,
    ]);
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    const parsed = JSON.parse(r.stdout) as Record<string, unknown>;
    expect(keysOf(parsed)).toEqual(["migrations"]);
    expect(parsed.migrations).toEqual([]);
  });

  it("populated workspace → `migrations` carries projected entries (no `migration` / `transform`)", async () => {
    const r = await runCli([
      "schema",
      "migrate",
      "list",
      "--json",
      "--root",
      migrateListBasicRoot,
    ]);
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stdout).not.toContain('"migration":');
    expect(r.stdout).not.toContain('"transform":');
    const parsed = JSON.parse(r.stdout) as {
      migrations: Array<Record<string, unknown>>;
    };
    expect(parsed.migrations.length).toBeGreaterThan(0);
    for (const m of parsed.migrations) {
      expect(m).not.toHaveProperty("migration");
      expect(m).not.toHaveProperty("transform");
      expect(keysOf(m)).toEqual([
        "fromIrHash",
        "fromSourceHash",
        "fromVersion",
        "schemaId",
        "sourcePath",
        "toIrHash",
        "toSourceHash",
        "toVersion",
      ]);
    }
  });
});

describe("--json success envelope: `migrate plan`", () => {
  it("breaking-exact fixture → has exactly the top-level key `plan`", async () => {
    const r = await runCli([
      "schema",
      "migrate",
      "plan",
      "com.fixture.cli.migrate-plan.BreakingExact",
      "1.0.0",
      "2.0.0",
      "--json",
      "--root",
      migrateBreakingExactRoot,
    ]);
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stdout).not.toContain('"migration":');
    expect(r.stdout).not.toContain('"transform":');
    const parsed = JSON.parse(r.stdout) as Record<string, unknown>;
    expect(keysOf(parsed)).toEqual(["plan"]);
    const plan = parsed.plan as Record<string, unknown>;
    expect(keysOf(plan)).toEqual([
      "chain",
      "fromVersion",
      "notes",
      "schemaId",
      "toVersion",
      "versionPath",
      "worstSeverity",
    ]);
    for (const hop of plan.chain as Array<Record<string, unknown>>) {
      expect(hop).not.toHaveProperty("migration");
      expect(hop).not.toHaveProperty("transform");
    }
  });
});

describe("--json success envelope: `migrate verify` (success branch)", () => {
  it("empty workspace → has exactly `summary` and `verdicts`", async () => {
    const r = await runCli([
      "schema",
      "migrate",
      "verify",
      "--json",
      "--root",
      emptyRoot,
    ]);
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    const parsed = JSON.parse(r.stdout) as Record<string, unknown>;
    expect(keysOf(parsed)).toEqual(["summary", "verdicts"]);
    expect(Array.isArray(parsed.verdicts)).toBe(true);
    expect(keysOf(parsed.summary)).toEqual([
      "bound",
      "cosmetic_drift",
      "drift",
      "missing_endpoint",
    ]);
  });
});

describe("--json failure envelope: `migrate verify` (failure branch)", () => {
  it("over-specified fixture (placeholder hashes drift vs real schema) → `{ issues, summary, verdicts }`", async () => {
    const r = await runCli([
      "schema",
      "migrate",
      "verify",
      "--json",
      "--root",
      migrateOverSpecifiedRoot,
    ]);
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(r.stdout).not.toContain('"migration":');
    expect(r.stdout).not.toContain('"transform":');
    const parsed = JSON.parse(r.stdout) as Record<string, unknown>;
    expect(keysOf(parsed)).toEqual(["issues", "summary", "verdicts"]);
    expect(Array.isArray(parsed.issues)).toBe(true);
    expect((parsed.issues as unknown[]).length).toBeGreaterThan(0);
  });
});

describe("--json success envelope: `migrate stub`", () => {
  it("has exactly the top-level key `stub`; no `content`", async () => {
    const r = await runCli([
      "schema",
      "migrate",
      "stub",
      "com.fixture.cli.shape.StubTarget",
      "1.0.0",
      "2.0.0",
      "--json",
      "--root",
      migrateStubRoot,
    ]);
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stdout).not.toContain('"content":');
    const parsed = JSON.parse(r.stdout) as Record<string, unknown>;
    expect(keysOf(parsed)).toEqual(["stub"]);
    const stub = parsed.stub as Record<string, unknown>;
    expect(stub).not.toHaveProperty("content");
    expect(keysOf(stub)).toEqual([
      "fromVersion",
      "schemaId",
      "suggestedPath",
      "toVersion",
    ]);
  });

  it("second invocation against same path → refuses with `{ failures }`, no `content`", async () => {
    // First invocation succeeded above (or in an earlier test in the
    // same temp root). Re-invoking now must refuse and emit the
    // `{ failures }` envelope with `stub_path_exists`.
    const r = await runCli([
      "schema",
      "migrate",
      "stub",
      "com.fixture.cli.shape.StubTarget",
      "1.0.0",
      "2.0.0",
      "--json",
      "--root",
      migrateStubRoot,
    ]);
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(r.stdout).not.toContain('"content":');
    const parsed = JSON.parse(r.stdout) as Record<string, unknown>;
    expect(keysOf(parsed)).toEqual(["failures"]);
    const failures = parsed.failures as Array<Record<string, unknown>>;
    expect(failures.length).toBe(1);
    expect(failures[0]!.reason).toBe("stub_path_exists");
    expect(failures[0]).not.toHaveProperty("cause");
  });
});

// =============================================================================
// Migrate failure envelopes — loader / registry / integrity
// =============================================================================

describe("--json failure envelope: `migrate list` loader failure", () => {
  it("emits `{ failures: [{ path, reason, message }] }` on IO_ERROR; no `cause`", async () => {
    const r = await runCli([
      "schema",
      "migrate",
      "list",
      "--json",
      "--root",
      migrateListLoaderFailureRoot,
    ]);
    expect(r.code).toBe(EXIT_CODES.IO_ERROR);
    const parsed = JSON.parse(r.stdout) as Record<string, unknown>;
    expect(keysOf(parsed)).toEqual(["failures"]);
    const failures = parsed.failures as Array<Record<string, unknown>>;
    expect(failures.length).toBeGreaterThan(0);
    for (const f of failures) {
      expect(f).not.toHaveProperty("cause");
      expect(keysOf(f)).toEqual(["message", "path", "reason"]);
    }
  });
});

describe("--json failure envelope: `migrate list` duplicate migration", () => {
  it("emits `{ issues }` with `duplicate_migration` on LOGICAL_FAILURE", async () => {
    const r = await runCli([
      "schema",
      "migrate",
      "list",
      "--json",
      "--root",
      migrateListDuplicatesRoot,
    ]);
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    const parsed = JSON.parse(r.stdout) as Record<string, unknown>;
    expect(keysOf(parsed)).toEqual(["issues"]);
    const issues = parsed.issues as Array<Record<string, unknown>>;
    expect(issues.some((i) => i.code === "duplicate_migration")).toBe(true);
  });
});

describe("--json failure envelope: `migrate list` integrity error", () => {
  it("emits `{ issues }` with `integrity_error` on INTEGRITY_ERROR (4)", async () => {
    const r = await runCli([
      "schema",
      "migrate",
      "list",
      "--json",
      "--root",
      migrateListIntegrityRoot,
    ]);
    expect(r.code).toBe(EXIT_CODES.INTEGRITY_ERROR);
    const parsed = JSON.parse(r.stdout) as Record<string, unknown>;
    expect(keysOf(parsed)).toEqual(["issues"]);
    const issues = parsed.issues as Array<Record<string, unknown>>;
    expect(issues.some((i) => i.code === "integrity_error")).toBe(true);
  });
});

// =============================================================================
// Migrate — global "no `migration` / `transform`" sentinel across every verb
// =============================================================================

describe("--json output of every migrate verb omits `migration` and `transform`", () => {
  it.each([
    ["list", ["schema", "migrate", "list"], () => migrateListBasicRoot],
    [
      "plan",
      [
        "schema",
        "migrate",
        "plan",
        "com.fixture.cli.migrate-plan.BreakingExact",
        "1.0.0",
        "2.0.0",
      ],
      () => migrateBreakingExactRoot,
    ],
    [
      "verify",
      ["schema", "migrate", "verify"],
      () => migrateOverSpecifiedRoot,
    ],
  ] as const)("`%s` JSON output never contains `migration` / `transform`", async (_verb, base, rootFn) => {
    const r = await runCli([...base, "--json", "--root", rootFn()]);
    // Exit code is verb-specific; we only care about the string-level
    // negative assertion here.
    void r.code;
    expect(r.stdout).not.toContain('"migration":');
    expect(r.stdout).not.toContain('"transform":');
  });
});
