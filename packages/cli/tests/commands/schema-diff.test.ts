/**
 * Step 30 — `neko schema diff` command gate tests.
 *
 * Covers:
 *   - operand resolution: schemaId / schemaId@version / file path
 *   - exit-code mapping: breaking → LOGICAL_FAILURE; additive /
 *     cosmetic / no-change → SUCCESS
 *   - JSON output shape `{ changes, worstSeverity }`
 *   - missing schema id / version → LOGICAL_FAILURE with issues
 *   - load failures → IO_ERROR
 *   - duplicate registry → LOGICAL_FAILURE
 *   - `list` (Step 29) still works
 *   - `check` / `generate` placeholders still behave
 *   - static-scan purity on `diff.ts`
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runDiff } from "../../src/commands/schema/diff.js";
import {
  dispatch,
  EXIT_CODES,
  type ExitCode,
} from "../../src/cli.js";

const FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
  "walk-workspace",
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
  partial: Partial<Parameters<typeof runDiff>[0]> & {
    readonly a: string;
    readonly b: string;
  },
): Promise<Captured> {
  let stdout = "";
  let stderr = "";
  const code = await runDiff({
    root: fixture("diff-cases"),
    json: false,
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

async function runViaDispatch(argv: readonly string[]): Promise<Captured> {
  let stdout = "";
  let stderr = "";
  const code = await dispatch(argv, {
    stdout: (s) => {
      stdout += s;
    },
    stderr: (s) => {
      stderr += s;
    },
  });
  return { code, stdout, stderr };
}

// =============================================================================
// Operand resolution
// =============================================================================

describe("runDiff — operand resolution", () => {
  it("resolves schemaId@version on both sides", async () => {
    const r = await runDirect({
      a: "com.fixture.walk.DiffUser@1.0.0",
      b: "com.fixture.walk.DiffUser@2.0.0",
    });
    // v1 → v2 is additive only.
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stdout).toMatch(/additive/);
  });

  it("resolves bare schemaId to the highest-semver entry", async () => {
    // Bare `com.fixture.walk.DiffUser` resolves to v3 (highest).
    // Diffing v1 → v3 is breaking (name field removed).
    const r = await runDirect({
      a: "com.fixture.walk.DiffUser@1.0.0",
      b: "com.fixture.walk.DiffUser",
    });
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(r.stdout).toMatch(/breaking/);
  });

  it("resolves file-path operands relative to --root", async () => {
    const r = await runDirect({
      a: "user-v1.schema.ts",
      b: "user-v3.schema.ts",
    });
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(r.stdout).toMatch(/breaking/);
  });

  it("mixes file-path and schemaId@version operands", async () => {
    const r = await runDirect({
      a: "user-v1.schema.ts",
      b: "com.fixture.walk.DiffUser@2.0.0",
    });
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stdout).toMatch(/additive/);
  });
});

// =============================================================================
// Exit-code mapping
// =============================================================================

describe("runDiff — exit code mapping", () => {
  it("additive diff returns SUCCESS", async () => {
    const r = await runDirect({
      a: "com.fixture.walk.DiffUser@1.0.0",
      b: "com.fixture.walk.DiffUser@2.0.0",
    });
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
  });

  it("breaking diff returns LOGICAL_FAILURE", async () => {
    const r = await runDirect({
      a: "com.fixture.walk.DiffUser@1.0.0",
      b: "com.fixture.walk.DiffUser@3.0.0",
    });
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
  });

  it("no-change diff (schema against itself) returns SUCCESS", async () => {
    const r = await runDirect({
      a: "com.fixture.walk.DiffStable@1.0.0",
      b: "com.fixture.walk.DiffStable@1.0.0",
    });
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stdout).toContain("No changes.");
  });
});

// =============================================================================
// JSON output shape
// =============================================================================

describe("runDiff — --json output", () => {
  it("emits one-line JSON of `{ changes, worstSeverity }` on success", async () => {
    const r = await runDirect({
      a: "com.fixture.walk.DiffUser@1.0.0",
      b: "com.fixture.walk.DiffUser@2.0.0",
      json: true,
    });
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stderr).toBe("");
    expect(r.stdout.endsWith("\n")).toBe(true);
    const parsed = JSON.parse(r.stdout) as {
      changes: Array<{ severity: string; kind: string; message: string }>;
      worstSeverity: string | null;
    };
    expect(parsed.worstSeverity).toBe("additive");
    expect(parsed.changes.length).toBeGreaterThan(0);
    for (const c of parsed.changes) {
      expect(typeof c.severity).toBe("string");
      expect(typeof c.kind).toBe("string");
    }
  });

  it("breaking diff in --json mode also returns LOGICAL_FAILURE", async () => {
    const r = await runDirect({
      a: "com.fixture.walk.DiffUser@1.0.0",
      b: "com.fixture.walk.DiffUser@3.0.0",
      json: true,
    });
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    const parsed = JSON.parse(r.stdout) as { worstSeverity: string };
    expect(parsed.worstSeverity).toBe("breaking");
  });

  it("no-change diff in --json mode emits worstSeverity: null", async () => {
    const r = await runDirect({
      a: "com.fixture.walk.DiffStable@1.0.0",
      b: "com.fixture.walk.DiffStable@1.0.0",
      json: true,
    });
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    const parsed = JSON.parse(r.stdout) as {
      changes: unknown[];
      worstSeverity: string | null;
    };
    expect(parsed.changes).toEqual([]);
    expect(parsed.worstSeverity).toBeNull();
  });
});

// =============================================================================
// Resolution failures
// =============================================================================

describe("runDiff — resolution failures", () => {
  it("unknown schemaId → LOGICAL_FAILURE with schema_not_found", async () => {
    const r = await runDirect({
      a: "com.does.not.Exist",
      b: "com.fixture.walk.DiffUser@1.0.0",
    });
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(r.stderr).toContain("schema_not_found");
    expect(r.stderr).toContain("com.does.not.Exist");
  });

  it("missing version on a known schemaId → version_not_found", async () => {
    const r = await runDirect({
      a: "com.fixture.walk.DiffUser@99.0.0",
      b: "com.fixture.walk.DiffUser@1.0.0",
    });
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(r.stderr).toContain("version_not_found");
    expect(r.stderr).toContain("99.0.0");
  });

  it("file operand outside the workspace → schema_not_found", async () => {
    const r = await runDirect({
      a: "definitely/does/not/exist.schema.ts",
      b: "com.fixture.walk.DiffUser@1.0.0",
    });
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(r.stderr).toContain("schema_not_found");
  });

  it("both operands failing produces two issues in one response", async () => {
    const r = await runDirect({
      a: "com.does.not.A",
      b: "com.does.not.B",
    });
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(r.stderr.match(/schema_not_found/g)?.length ?? 0).toBe(2);
  });

  it("resolution failure in --json mode emits issues on stdout", async () => {
    const r = await runDirect({
      a: "com.does.not.Exist",
      b: "com.fixture.walk.DiffUser@1.0.0",
      json: true,
    });
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(r.stderr).toBe("");
    const parsed = JSON.parse(r.stdout) as {
      issues: Array<{ code: string }>;
    };
    expect(parsed.issues[0]!.code).toBe("schema_not_found");
  });

  // ---------------------------------------------------------------------------
  // Multi-schema file operand — must be rejected, not silently disambiguated
  // ---------------------------------------------------------------------------

  it("file operand on a multi-schema file returns LOGICAL_FAILURE", async () => {
    const r = await runDirect({
      a: "multi.schema.ts",
      b: "com.fixture.walk.DiffUser@1.0.0",
    });
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(r.stderr).toContain("schema_not_found");
  });

  it("multi-schema file operand error mentions using schemaId", async () => {
    const r = await runDirect({
      a: "multi.schema.ts",
      b: "com.fixture.walk.DiffUser@1.0.0",
    });
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    // The message must point the user at the operand form that has
    // no ambiguity — `schemaId` or `schemaId@version`.
    expect(r.stderr).toMatch(/use schemaId/);
    expect(r.stderr).toMatch(/multi\.schema\.ts/);
  });

  it("multi-schema file JSON output carries metadata.reason = ambiguous_file_operand", async () => {
    const r = await runDirect({
      a: "multi.schema.ts",
      b: "com.fixture.walk.DiffUser@1.0.0",
      json: true,
    });
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(r.stderr).toBe("");
    const parsed = JSON.parse(r.stdout) as {
      issues: Array<{
        code: string;
        metadata?: {
          reason?: string;
          kind?: string;
          operand?: string;
          schemaIds?: unknown[];
        };
      }>;
    };
    const ambiguous = parsed.issues.find(
      (i) => i.metadata?.reason === "ambiguous_file_operand",
    );
    expect(ambiguous).toBeDefined();
    expect(ambiguous!.code).toBe("schema_not_found");
    expect(ambiguous!.metadata?.kind).toBe("file");
    expect(ambiguous!.metadata?.operand).toBe("multi.schema.ts");
    expect(Array.isArray(ambiguous!.metadata?.schemaIds)).toBe(true);
    expect(ambiguous!.metadata?.schemaIds).toEqual([
      "com.fixture.walk.DiffMultiA",
      "com.fixture.walk.DiffMultiB",
    ]);
  });
});

// =============================================================================
// Workspace prelude failures
// =============================================================================

describe("runDiff — workspace prelude failures", () => {
  it("load failures → IO_ERROR (operands not even evaluated)", async () => {
    const r = await runDirect({
      root: fixture("failures"),
      a: "any",
      b: "thing",
    });
    expect(r.code).toBe(EXIT_CODES.IO_ERROR);
    expect(r.stderr).toMatch(/failed to load/);
  });

  it("duplicate registry → LOGICAL_FAILURE", async () => {
    const r = await runDirect({
      root: fixture("duplicates"),
      a: "com.fixture.walk.Duplicate",
      b: "com.fixture.walk.Duplicate",
    });
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(r.stderr).toContain("duplicate_schema_id");
  });
});

// =============================================================================
// End-to-end via dispatch
// =============================================================================

describe("dispatch — `schema diff` wiring", () => {
  it("`neko schema diff <a> <b> --root <fixture>` returns SUCCESS for additive", async () => {
    const r = await runViaDispatch([
      "schema",
      "diff",
      "com.fixture.walk.DiffUser@1.0.0",
      "com.fixture.walk.DiffUser@2.0.0",
      "--root",
      fixture("diff-cases"),
    ]);
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stdout).toMatch(/additive/);
  });

  it("`--json` round-trips a breaking diff", async () => {
    const r = await runViaDispatch([
      "schema",
      "diff",
      "com.fixture.walk.DiffUser@1.0.0",
      "com.fixture.walk.DiffUser@3.0.0",
      "--root",
      fixture("diff-cases"),
      "--json",
    ]);
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(JSON.parse(r.stdout)).toHaveProperty("worstSeverity", "breaking");
  });

  it("missing required positional → USAGE_ERROR via commander", async () => {
    const r = await runViaDispatch(["schema", "diff", "only-one"]);
    expect(r.code).toBe(EXIT_CODES.USAGE_ERROR);
  });

  it("`list` (Step 29) still works after Step 30 wiring", async () => {
    const r = await runViaDispatch([
      "schema",
      "list",
      "--root",
      fixture("basic"),
    ]);
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stdout).toMatch(/2 schemas in workspace:/);
  });

  // No placeholder verbs remain post-Step 32.
});

// =============================================================================
// Static-scan purity
// =============================================================================

describe("schema/diff — side-effect discipline (static-scan)", () => {
  const SRC = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "src",
      "commands",
      "schema",
      "diff.ts",
    ),
    "utf8",
  );

  const STRIPPED = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(
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

  it.each(FORBIDDEN)(
    "diff.ts source does not call `$name`",
    ({ pattern }) => {
      expect(STRIPPED).not.toMatch(pattern);
    },
  );
});
