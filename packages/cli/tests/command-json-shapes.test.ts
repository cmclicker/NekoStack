/**
 * Step 36 — JSON output envelope gate.
 *
 * Locks ONLY the top-level shape of each verb's `--json` output —
 * success envelopes and failure envelopes. Per-command semantics
 * (verdict tally, exit-code mapping, operand resolution, etc.) are
 * already covered in the per-command test files; this suite is a
 * narrow regression net for the machine-readable contracts.
 *
 * Success envelopes:
 *   list     → { schemas }
 *   diff     → { changes, worstSeverity }
 *   check    → { verdicts, summary }
 *   generate → { artifacts }
 *
 * Failure envelopes:
 *   load failure       → { failures: [{ path, reason, message }] }
 *   duplicate registry → { issues }
 *
 * Negative shape rules:
 *   - failure objects MUST NOT carry `cause`
 *   - generated-artifact metadata MUST NOT carry `content`
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
const failuresRoot = join(FIXTURES, "failures");
const duplicatesRoot = join(FIXTURES, "duplicates");
const diffCasesRoot = join(FIXTURES, "diff-cases");

const ONE_NAMED_SCHEMA = `import { s } from "@nekostack/schema";
export const Tiny = s.object({ id: s.string() }).id("com.fixture.cli.shape.Tiny").version("1.0.0");
`;

beforeAll(() => {
  emptyRoot = mkdtempSync(join(tmpdir(), "neko-json-shapes-"));
  oneSchemaRoot = mkdtempSync(join(tmpdir(), "neko-json-shapes-"));
  writeFileSync(join(oneSchemaRoot, "tiny.schema.ts"), ONE_NAMED_SCHEMA, "utf8");
});

afterAll(() => {
  rmSync(emptyRoot, { recursive: true, force: true });
  rmSync(oneSchemaRoot, { recursive: true, force: true });
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
