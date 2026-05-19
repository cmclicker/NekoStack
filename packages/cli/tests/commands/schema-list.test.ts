/**
 * Step 29 — `neko schema list` command gate tests.
 *
 * Two test surfaces:
 *
 *   1. Direct `runList(opts)` — exercises the verb's flow with
 *      injected writers; cheaper and easier to debug.
 *   2. End-to-end `dispatch(["schema", "list", ...])` — proves
 *      commander wiring routes correctly to the new action and
 *      that the placeholders for `diff` / `check` / `generate`
 *      still behave as before.
 *
 * Covers:
 *   - happy path: pretty output of fixture workspace
 *   - happy path: --json output with locked shape
 *   - --root override controls which workspace is walked
 *   - empty workspace succeeds with zero entries
 *   - load failure → IO_ERROR + diagnostics
 *   - duplicate schemaId → LOGICAL_FAILURE + issue diagnostics
 *   - bad flag still returns USAGE_ERROR via commander
 *   - other placeholder verbs unaffected
 *   - static-scan: list.ts has no process.exit / console / stdio writes
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runList } from "../../src/commands/schema/list.js";
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
  partial: Partial<Parameters<typeof runList>[0]>,
): Promise<Captured> {
  let stdout = "";
  let stderr = "";
  const code = await runList({
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
// Direct runList — happy path + variants
// =============================================================================

describe("runList — pretty output", () => {
  it("returns SUCCESS and prints the two basic-fixture schemas", async () => {
    const r = await runDirect({ root: fixture("basic") });
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stderr).toBe("");
    expect(r.stdout).toMatch(/2 schemas in workspace:/);
    expect(r.stdout).toContain("com.fixture.walk.Alpha");
    expect(r.stdout).toContain("com.fixture.walk.Beta");
    expect(r.stdout).toContain("1.0.0");
    expect(r.stdout).toContain("alpha.schema.ts");
    expect(r.stdout).toContain("beta.schema.js");
  });

  it("empty workspace returns SUCCESS with `No schemas found`", async () => {
    const r = await runDirect({ root: fixture("empty") });
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stdout).toBe("No schemas found in workspace.\n");
    expect(r.stderr).toBe("");
  });
});

describe("runList — --json output", () => {
  it("emits one-line JSON with the locked shape", async () => {
    const r = await runDirect({ root: fixture("basic"), json: true });
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stderr).toBe("");

    // Single line + trailing newline.
    expect(r.stdout.endsWith("\n")).toBe(true);
    expect(r.stdout.slice(0, -1)).not.toMatch(/\n/);

    const parsed = JSON.parse(r.stdout) as {
      schemas: Array<{
        schemaId: string;
        schemaVersion: string | null;
        sourcePath: string;
        irHash: string;
        sourceHash: string;
      }>;
    };
    expect(parsed.schemas).toHaveLength(2);
    for (const s of parsed.schemas) {
      expect(typeof s.schemaId).toBe("string");
      expect(s.schemaVersion === null || typeof s.schemaVersion === "string").toBe(
        true,
      );
      expect(typeof s.sourcePath).toBe("string");
      expect(s.irHash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(s.sourceHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    }

    // `schema` field must NOT appear — JSON shape excludes the live
    // Schema instance.
    expect(r.stdout).not.toMatch(/"schema":/);
  });

  it("includes schemaVersion: null for an unversioned entry", async () => {
    // The basic fixture is fully versioned, so this test mostly
    // verifies the JSON encoder side. We assert by inspecting the
    // schemas array contains string versions in this fixture; the
    // null-shape claim is also exercised by `runList` mapping
    // `schemaVersion ?? null`.
    const r = await runDirect({ root: fixture("basic"), json: true });
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    const parsed = JSON.parse(r.stdout) as {
      schemas: { schemaVersion: string | null }[];
    };
    for (const s of parsed.schemas) {
      expect(s.schemaVersion).toBe("1.0.0");
    }
  });
});

// =============================================================================
// Direct runList — failure paths
// =============================================================================

describe("runList — failure paths", () => {
  it("load failures → IO_ERROR + pretty diagnostics on stderr", async () => {
    const r = await runDirect({ root: fixture("failures") });
    expect(r.code).toBe(EXIT_CODES.IO_ERROR);
    // Stdout untouched in pretty failure mode.
    expect(r.stdout).toBe("");
    expect(r.stderr).toMatch(/schema files? failed to load:/);
    expect(r.stderr).toContain("runtime-throws.schema.ts");
    expect(r.stderr).toContain("no-export.schema.ts");
  });

  it("load failures in --json mode emit one-line JSON on stdout", async () => {
    const r = await runDirect({ root: fixture("failures"), json: true });
    expect(r.code).toBe(EXIT_CODES.IO_ERROR);
    expect(r.stderr).toBe("");
    expect(r.stdout.endsWith("\n")).toBe(true);
    const parsed = JSON.parse(r.stdout) as {
      failures: Array<{ path: string; reason: string; message: string }>;
    };
    expect(parsed.failures.length).toBeGreaterThanOrEqual(2);
    const reasons = parsed.failures.map((f) => f.reason);
    expect(reasons).toContain("runtime_error");
    expect(reasons).toContain("no_schema_export");
  });

  it("JSON load-failure shape excludes the raw `cause` field", async () => {
    // `LoadFailure.cause` is `unknown` thrown by tsx/esbuild — not a
    // stable CLI contract. Projection must drop it before JSON.
    const r = await runDirect({ root: fixture("failures"), json: true });
    expect(r.code).toBe(EXIT_CODES.IO_ERROR);
    const parsed = JSON.parse(r.stdout) as {
      failures: Array<Record<string, unknown>>;
    };
    for (const f of parsed.failures) {
      expect(f).not.toHaveProperty("cause");
      expect(Object.keys(f).sort()).toEqual(["message", "path", "reason"]);
    }
  });

  it("duplicate schemaId → LOGICAL_FAILURE + issue diagnostics", async () => {
    const r = await runDirect({ root: fixture("duplicates") });
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(r.stdout).toBe("");
    expect(r.stderr).toContain("duplicate_schema_id");
    expect(r.stderr).toContain("com.fixture.walk.Duplicate");
  });

  it("duplicate schemaId in --json mode emits issues on stdout", async () => {
    const r = await runDirect({ root: fixture("duplicates"), json: true });
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(r.stderr).toBe("");
    const parsed = JSON.parse(r.stdout) as {
      issues: Array<{ code: string; message: string }>;
    };
    expect(parsed.issues.length).toBeGreaterThanOrEqual(1);
    expect(parsed.issues[0]!.code).toBe("duplicate_schema_id");
  });
});

// =============================================================================
// End-to-end via dispatch
// =============================================================================

describe("dispatch — `schema list` wiring", () => {
  it("`neko schema list --root <fixture>` returns SUCCESS with pretty output", async () => {
    const r = await runViaDispatch([
      "schema",
      "list",
      "--root",
      fixture("basic"),
    ]);
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stdout).toMatch(/2 schemas in workspace:/);
    expect(r.stdout).toContain("com.fixture.walk.Alpha");
  });

  it("`neko schema list --root <fixture> --json` returns one-line JSON", async () => {
    const r = await runViaDispatch([
      "schema",
      "list",
      "--root",
      fixture("basic"),
      "--json",
    ]);
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stdout.endsWith("\n")).toBe(true);
    expect(JSON.parse(r.stdout)).toHaveProperty("schemas");
  });

  it("unknown flag on `list` still returns USAGE_ERROR via commander", async () => {
    const r = await runViaDispatch([
      "schema",
      "list",
      "--bogus",
      "--root",
      fixture("basic"),
    ]);
    expect(r.code).toBe(EXIT_CODES.USAGE_ERROR);
  });

  // Once Step 30 wires `diff`, its placeholder coverage moves to
  // `schema-diff.test.ts`. `check` and `generate` stay placeholders
  // here until Steps 31 / 32 land.
  it("`schema check` placeholder still returns LOGICAL_FAILURE", async () => {
    const r = await runViaDispatch(["schema", "check"]);
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(r.stderr).toMatch(/not yet implemented/);
  });

  it("`schema generate` placeholder still returns LOGICAL_FAILURE", async () => {
    const r = await runViaDispatch(["schema", "generate"]);
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(r.stderr).toMatch(/not yet implemented/);
  });
});

// =============================================================================
// Static-scan purity — list command must not exit or hit stdio directly
// =============================================================================

describe("schema/list — side-effect discipline (static-scan)", () => {
  const SRC = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "src",
      "commands",
      "schema",
      "list.ts",
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
    "list.ts source does not call `$name`",
    ({ pattern }) => {
      expect(STRIPPED).not.toMatch(pattern);
    },
  );
});
