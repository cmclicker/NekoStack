/**
 * Step 28 — pretty formatter gate tests.
 *
 * Each formatter test checks the same three things:
 *   1. Non-empty input renders the documented row shape.
 *   2. Empty input renders a useful single-line message.
 *   3. Output ends with exactly one trailing newline.
 *
 * Plus cross-cutting:
 *   - deterministic output for arrays (no incidental sorting)
 *   - inputs are not mutated
 *   - static-scan purity: no `console.*`, `process.*`, or stdio writes
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { s } from "@nekostack/schema";
import type {
  DiffChange,
  FreshnessVerdict,
  GeneratedArtifact,
  RegistryEntry,
} from "@nekostack/schema/cli";
import type { Issue } from "@nekostack/schema";
import type { LoadFailure } from "../../src/loaders/tsx-loader.js";
import {
  formatCheckPretty,
  formatDiffPretty,
  formatGeneratePretty,
  formatIssuesPretty,
  formatListPretty,
  formatLoadFailuresPretty,
} from "../../src/formatters/pretty.js";

// =============================================================================
// Fixture helpers
// =============================================================================

function makeRegistryEntry(
  schemaId: string,
  version: string | undefined,
  sourcePath: string,
): RegistryEntry {
  const schema = s.object({ id: s.string() });
  return {
    schemaId,
    schemaVersion: version,
    irHash: "sha256:00",
    sourceHash: "sha256:00",
    sourcePath,
    schema,
  };
}

// =============================================================================
// formatListPretty
// =============================================================================

describe("formatListPretty", () => {
  it("empty list produces a useful single-line message", () => {
    const out = formatListPretty([]);
    expect(out).toBe("No schemas found in workspace.\n");
  });

  it("renders schemaId / version / sourcePath per entry", () => {
    const out = formatListPretty([
      makeRegistryEntry("com.x.Account", "1.0.0", "schemas/account.schema.ts"),
      makeRegistryEntry("com.x.Tenant", "2.1.0", "schemas/tenant.schema.ts"),
    ]);
    expect(out).toContain("2 schemas in workspace:");
    expect(out).toContain("com.x.Account");
    expect(out).toContain("1.0.0");
    expect(out).toContain("schemas/account.schema.ts");
    expect(out).toContain("com.x.Tenant");
    expect(out).toContain("2.1.0");
  });

  it("singular 'schema' for a one-entry list", () => {
    const out = formatListPretty([
      makeRegistryEntry("com.x.User", "1.0.0", "schemas/user.schema.ts"),
    ]);
    expect(out).toContain("1 schema in workspace:");
  });

  it("displays unversioned entries as `(unversioned)`", () => {
    const out = formatListPretty([
      makeRegistryEntry("com.x.Legacy", undefined, "schemas/legacy.schema.ts"),
    ]);
    expect(out).toContain("(unversioned)");
  });

  it("ends with exactly one trailing newline", () => {
    const out = formatListPretty([
      makeRegistryEntry("com.x.A", "1.0.0", "a.schema.ts"),
    ]);
    expect(out.endsWith("\n")).toBe(true);
    expect(out.endsWith("\n\n")).toBe(false);
  });

  it("does not mutate the input array", () => {
    const entries = [
      makeRegistryEntry("com.x.B", "1.0.0", "b.schema.ts"),
      makeRegistryEntry("com.x.A", "1.0.0", "a.schema.ts"),
    ];
    const before = entries.map((e) => e.schemaId);
    formatListPretty(entries);
    expect(entries.map((e) => e.schemaId)).toEqual(before);
  });
});

// =============================================================================
// formatDiffPretty
// =============================================================================

describe("formatDiffPretty", () => {
  it("empty changes produce `No changes.\\n`", () => {
    const out = formatDiffPretty({ changes: [], worstSeverity: null });
    expect(out).toBe("No changes.\n");
  });

  it("renders severity / kind / path / message per change", () => {
    const changes: DiffChange[] = [
      {
        severity: "breaking",
        path: ["user", "email"],
        kind: "field_removed",
        message: "Field `email` removed",
      },
      {
        severity: "additive",
        path: [],
        kind: "field_added",
        message: "Field `phone` added (optional)",
      },
    ];
    const out = formatDiffPretty({ changes, worstSeverity: "breaking" });
    expect(out).toContain("2 changes (worst severity: breaking):");
    expect(out).toContain("[breaking] field_removed at user.email");
    expect(out).toContain("Field `email` removed");
    // Root-level path renders as `(root)`.
    expect(out).toContain("[additive] field_added at (root)");
  });

  it("ends with exactly one trailing newline", () => {
    const out = formatDiffPretty({
      changes: [
        {
          severity: "cosmetic",
          path: ["a"],
          kind: "metadata_changed",
          message: "x",
        },
      ],
      worstSeverity: "cosmetic",
    });
    expect(out.endsWith("\n")).toBe(true);
    expect(out.endsWith("\n\n")).toBe(false);
  });

  it("does not re-sort changes — preserves handler-emitted order", () => {
    const changes: DiffChange[] = [
      { severity: "additive", path: ["z"], kind: "field_added", message: "z" },
      { severity: "additive", path: ["a"], kind: "field_added", message: "a" },
    ];
    const out = formatDiffPretty({ changes, worstSeverity: "additive" });
    // The 'z' row appears before 'a' in the output:
    const zIdx = out.indexOf("at z");
    const aIdx = out.indexOf("at a");
    expect(zIdx).toBeGreaterThan(-1);
    expect(aIdx).toBeGreaterThan(-1);
    expect(zIdx).toBeLessThan(aIdx);
  });
});

// =============================================================================
// formatCheckPretty
// =============================================================================

describe("formatCheckPretty", () => {
  it("empty verdicts produce a useful single-line message", () => {
    expect(formatCheckPretty([])).toBe("No artifacts to check.\n");
  });

  it("renders status / artifactPath per verdict and a header tally", () => {
    const verdicts: FreshnessVerdict[] = [
      { status: "clean", artifactPath: "a.types.ts" },
      { status: "cosmetic_drift", artifactPath: "b.zod.ts" },
      { status: "stale", artifactPath: "c.openapi.json" },
      { status: "integrity_error", artifactPath: "d.json.schema.json" },
    ];
    const out = formatCheckPretty(verdicts);
    expect(out).toContain(
      "4 artifacts: 1 clean, 1 cosmetic_drift, 1 stale, 1 integrity_error",
    );
    expect(out).toContain("[clean] a.types.ts");
    expect(out).toContain("[cosmetic_drift] b.zod.ts");
    expect(out).toContain("[stale] c.openapi.json");
    expect(out).toContain("[integrity_error] d.json.schema.json");
  });

  it("omits zero-count rows from the header tally", () => {
    const verdicts: FreshnessVerdict[] = [
      { status: "clean", artifactPath: "a.types.ts" },
      { status: "clean", artifactPath: "b.types.ts" },
    ];
    const out = formatCheckPretty(verdicts);
    expect(out).toContain("2 artifacts: 2 clean");
    expect(out).not.toMatch(/0 (cosmetic_drift|stale|integrity_error)/);
  });

  it("ends with exactly one trailing newline", () => {
    const out = formatCheckPretty([
      { status: "clean", artifactPath: "a.types.ts" },
    ]);
    expect(out.endsWith("\n")).toBe(true);
    expect(out.endsWith("\n\n")).toBe(false);
  });
});

// =============================================================================
// formatGeneratePretty
// =============================================================================

describe("formatGeneratePretty", () => {
  it("empty artifacts produce `No artifacts generated.\\n`", () => {
    expect(formatGeneratePretty([])).toBe("No artifacts generated.\n");
  });

  it("renders schemaId / kind / suggestedPath per artifact", () => {
    const artifacts: GeneratedArtifact[] = [
      {
        schemaId: "com.x.User",
        kind: "typescript",
        suggestedPath: "schemas/generated/user.types.ts",
        content: "...",
        irHash: "sha256:00",
        sourceHash: "sha256:00",
      },
      {
        schemaId: "com.x.User",
        kind: "zod",
        suggestedPath: "schemas/generated/user.zod.ts",
        content: "...",
        irHash: "sha256:00",
        sourceHash: "sha256:00",
      },
    ];
    const out = formatGeneratePretty(artifacts);
    expect(out).toContain("Generated 2 artifacts");
    expect(out).toContain("com.x.User");
    expect(out).toContain("typescript");
    expect(out).toContain("schemas/generated/user.types.ts");
    expect(out).toContain("zod");
    expect(out).toContain("schemas/generated/user.zod.ts");
  });

  it("ends with exactly one trailing newline", () => {
    const out = formatGeneratePretty([
      {
        schemaId: "com.x.A",
        kind: "typescript",
        suggestedPath: "a.types.ts",
        content: "...",
        irHash: "sha256:00",
        sourceHash: "sha256:00",
      },
    ]);
    expect(out.endsWith("\n")).toBe(true);
    expect(out.endsWith("\n\n")).toBe(false);
  });
});

// =============================================================================
// formatLoadFailuresPretty
// =============================================================================

describe("formatLoadFailuresPretty", () => {
  it("empty input prints `No load failures.\\n`", () => {
    expect(formatLoadFailuresPretty([])).toBe("No load failures.\n");
  });

  it("renders reason / path / message per failure", () => {
    const failures: LoadFailure[] = [
      {
        path: "foo.schema.ts",
        reason: "compile_error",
        message: "Transform failed",
      },
      {
        path: "bar.schema.ts",
        reason: "runtime_error",
        message: "Error: boom",
      },
    ];
    const out = formatLoadFailuresPretty(failures);
    expect(out).toContain("2 schema files failed to load:");
    expect(out).toContain("[compile_error] foo.schema.ts — Transform failed");
    expect(out).toContain("[runtime_error] bar.schema.ts — Error: boom");
  });

  it("singular form for a one-failure list", () => {
    const out = formatLoadFailuresPretty([
      {
        path: "x.schema.ts",
        reason: "io_error",
        message: "ENOENT",
      },
    ]);
    expect(out).toContain("1 schema file failed to load:");
  });

  it("ends with exactly one trailing newline", () => {
    const out = formatLoadFailuresPretty([
      { path: "x.schema.ts", reason: "io_error", message: "ENOENT" },
    ]);
    expect(out.endsWith("\n")).toBe(true);
    expect(out.endsWith("\n\n")).toBe(false);
  });
});

// =============================================================================
// formatIssuesPretty
// =============================================================================

describe("formatIssuesPretty", () => {
  it("empty issue list prints `No issues.\\n`", () => {
    expect(formatIssuesPretty([])).toBe("No issues.\n");
  });

  it("renders severity / code / path / message per issue", () => {
    const issues: Issue[] = [
      {
        code: "invalid_type",
        path: ["user", "age"],
        message: "Expected number, received string",
        severity: "error",
      },
      {
        code: "duplicate_schema_id",
        path: [],
        message: "Duplicate id",
        severity: "error",
      },
    ];
    const out = formatIssuesPretty(issues);
    expect(out).toContain("2 issues:");
    expect(out).toContain("[error] invalid_type at user.age — Expected number, received string");
    expect(out).toContain("[error] duplicate_schema_id — Duplicate id");
  });

  it("ends with exactly one trailing newline", () => {
    const out = formatIssuesPretty([
      {
        code: "invalid_type",
        path: [],
        message: "x",
        severity: "error",
      },
    ]);
    expect(out.endsWith("\n")).toBe(true);
    expect(out.endsWith("\n\n")).toBe(false);
  });
});

// =============================================================================
// Side-effect discipline (static-scan)
// =============================================================================

describe("pretty formatters — side-effect discipline (static-scan)", () => {
  const SRC = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "src",
      "formatters",
      "pretty.ts",
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
    { name: "fs.read", pattern: /\bfs\b.*read/ },
    { name: "fs.write", pattern: /\bfs\b.*write/ },
  ];

  it.each(FORBIDDEN)(
    "pretty formatter source does not call `$name`",
    ({ pattern }) => {
      expect(STRIPPED).not.toMatch(pattern);
    },
  );
});
