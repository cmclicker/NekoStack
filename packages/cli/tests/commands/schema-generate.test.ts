/**
 * Step 32 — `neko schema generate` command gate tests.
 *
 * Covers:
 *   - generates all four artifact kinds for one named schema
 *   - creates the generated/ directory
 *   - overwrites existing stale artifacts
 *   - JSON output omits `content` but carries the metadata fields
 *   - empty workspace returns SUCCESS with `No artifacts generated.`
 *   - anonymous-only workspace returns SUCCESS with no files written
 *   - load failures → IO_ERROR + JSON projection drops `cause`
 *   - duplicate registry → LOGICAL_FAILURE (caught before write)
 *   - pattern positional replaces the default glob
 *   - dispatch wiring routes argv through to the real command
 *   - emitted suggested paths match the schema-side `suggestedPathFor`
 *     convention (`<dir>/generated/<basename>.<kind-ext>`)
 *   - static-scan purity: no console.* / process.exit / stdio writes
 *     (filesystem writes are deliberately allowed for this verb)
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runGenerate } from "../../src/commands/schema/generate.js";
import { EXIT_CODES, type ExitCode } from "../../src/cli.js";
import { runCli } from "../cli-harness.js";

// =============================================================================
// Fixture helpers
// =============================================================================

const ONE_NAMED_SCHEMA = `import { s } from "@nekostack/schema";

export const User = s
  .object({ id: s.string(), name: s.string() })
  .id("com.fixture.cli.generate.User")
  .version("1.0.0");
`;

const ANONYMOUS_SCHEMA = `import { s } from "@nekostack/schema";

// No .id() — should be silently skipped by generateHandler.
export const Anon = s.object({ id: s.string() });
`;

const TWO_NAMED_SCHEMAS = `import { s } from "@nekostack/schema";

// Single source file declaring two named schemas. Master plan
// Decision #6 disambiguates the per-schema artifact paths via a
// schemaId-derived slug between basename and artifact extension.

export const Alpha = s
  .object({ id: s.string() })
  .id("com.fixture.cli.generate.Alpha")
  .version("1.0.0");

export const Beta = s
  .object({ id: s.string(), name: s.string() })
  .id("com.fixture.cli.generate.Beta")
  .version("1.0.0");
`;

function buildOneSchemaWorkspace(): string {
  const root = mkdtempSync(join(tmpdir(), "neko-generate-"));
  writeFileSync(join(root, "user.schema.ts"), ONE_NAMED_SCHEMA, "utf8");
  return root;
}

function buildAnonymousWorkspace(): string {
  const root = mkdtempSync(join(tmpdir(), "neko-generate-"));
  writeFileSync(join(root, "anon.schema.ts"), ANONYMOUS_SCHEMA, "utf8");
  return root;
}

function buildEmptyWorkspace(): string {
  const root = mkdtempSync(join(tmpdir(), "neko-generate-"));
  return root;
}

function buildMultiSchemaWorkspace(): string {
  const root = mkdtempSync(join(tmpdir(), "neko-generate-"));
  writeFileSync(join(root, "shared.schema.ts"), TWO_NAMED_SCHEMAS, "utf8");
  return root;
}

function buildStaleArtifactsWorkspace(): string {
  const root = mkdtempSync(join(tmpdir(), "neko-generate-"));
  writeFileSync(join(root, "user.schema.ts"), ONE_NAMED_SCHEMA, "utf8");
  // Pre-seed the generated dir with an obviously stale TS artifact
  // that `generate` must overwrite.
  mkdirSync(join(root, "generated"), { recursive: true });
  writeFileSync(
    join(root, "generated", "user.types.ts"),
    "// stale content — must be overwritten by generate\n",
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
  root: string,
  partial: Partial<Parameters<typeof runGenerate>[0]> = {},
): Promise<Captured> {
  let stdout = "";
  let stderr = "";
  const code = await runGenerate({
    root,
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

const runViaDispatch = runCli;

// =============================================================================
// Lifecycle
// =============================================================================

const tempDirs: string[] = [];

function tracked(root: string): string {
  tempDirs.push(root);
  return root;
}

afterAll(() => {
  for (const d of tempDirs) rmSync(d, { recursive: true, force: true });
});

// =============================================================================
// Happy path — one schema, all four artifacts
// =============================================================================

describe("runGenerate — one schema", () => {
  let root: string;
  beforeAll(() => {
    root = tracked(buildOneSchemaWorkspace());
  });

  it("returns SUCCESS and writes all four artifact files to disk", async () => {
    const r = await runDirect(root);
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stderr).toBe("");

    const expected = [
      "generated/user.types.ts",
      "generated/user.zod.ts",
      "generated/user.json.schema.json",
      "generated/user.openapi.json",
    ];
    for (const rel of expected) {
      expect(existsSync(join(root, rel))).toBe(true);
    }
  });

  it("each written artifact carries a v0.7 provenance header", () => {
    const ts = readFileSync(join(root, "generated", "user.types.ts"), "utf8");
    expect(ts).toContain("@generated by @nekostack/schema");
    expect(ts).toContain("schemaId:         com.fixture.cli.generate.User");
    expect(ts).toContain("schemaVersion:    1.0.0");
    expect(ts).toContain("generatorVersion: @nekostack/schema@0.7.0");
    // sourceHash is the v0.7 addition — must be present.
    expect(ts).toMatch(/sourceHash:\s+sha256:[0-9a-f]{64}/);
  });

  it("creates the generated/ directory even if it did not exist", () => {
    // The fixture started without `generated/` (verified by the
    // first test's existence check), and the second invocation
    // succeeds without recreating the fixture — proves mkdir
    // -p semantics.
    const r2 = buildOneSchemaWorkspace();
    tempDirs.push(r2);
    expect(existsSync(join(r2, "generated"))).toBe(false);
    return runDirect(r2).then(() => {
      expect(existsSync(join(r2, "generated"))).toBe(true);
    });
  });
});

// =============================================================================
// Multi-schema source file — regression for the Step 11 path-collision fix,
// exercised through the actual CLI write path.
// =============================================================================

describe("runGenerate — multi-schema source file", () => {
  let root: string;
  beforeAll(() => {
    root = tracked(buildMultiSchemaWorkspace());
  });

  it("writes 8 disambiguated artifacts (2 schemas × 4 kinds) without collision", async () => {
    const r = await runDirect(root);
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stderr).toBe("");

    // Master plan Decision #6 slug rule:
    //   schemaId lowercased, non-alphanumeric runs → `-`, trim ends.
    //   `com.fixture.cli.generate.Alpha` → `com-fixture-cli-generate-alpha`.
    const alphaSlug = "com-fixture-cli-generate-alpha";
    const betaSlug = "com-fixture-cli-generate-beta";
    const expectedPaths = [
      `generated/shared.${alphaSlug}.types.ts`,
      `generated/shared.${alphaSlug}.zod.ts`,
      `generated/shared.${alphaSlug}.json.schema.json`,
      `generated/shared.${alphaSlug}.openapi.json`,
      `generated/shared.${betaSlug}.types.ts`,
      `generated/shared.${betaSlug}.zod.ts`,
      `generated/shared.${betaSlug}.json.schema.json`,
      `generated/shared.${betaSlug}.openapi.json`,
    ];
    for (const rel of expectedPaths) {
      expect(existsSync(join(root, rel))).toBe(true);
    }
  });

  it("every emitted artifact has a unique on-disk path", async () => {
    const r = await runDirect(root, { json: true });
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    const parsed = JSON.parse(r.stdout) as {
      artifacts: Array<{ suggestedPath: string }>;
    };
    expect(parsed.artifacts).toHaveLength(8);
    const paths = parsed.artifacts.map((a) => a.suggestedPath);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("each schema's artifacts carry only that schema's id (no overwrite)", () => {
    const alphaTs = readFileSync(
      join(root, "generated", "shared.com-fixture-cli-generate-alpha.types.ts"),
      "utf8",
    );
    const betaTs = readFileSync(
      join(root, "generated", "shared.com-fixture-cli-generate-beta.types.ts"),
      "utf8",
    );

    // Alpha's artifact header references Alpha's schemaId and NOT
    // Beta's — proves the second write didn't overwrite the first.
    expect(alphaTs).toContain("schemaId:         com.fixture.cli.generate.Alpha");
    expect(alphaTs).not.toContain("com.fixture.cli.generate.Beta");
    expect(betaTs).toContain("schemaId:         com.fixture.cli.generate.Beta");
    expect(betaTs).not.toContain("com.fixture.cli.generate.Alpha");
  });
});

// =============================================================================
// Overwrite behavior
// =============================================================================

describe("runGenerate — overwrite", () => {
  it("overwrites existing stale artifacts", async () => {
    const root = tracked(buildStaleArtifactsWorkspace());
    const stalePath = join(root, "generated", "user.types.ts");
    expect(readFileSync(stalePath, "utf8")).toMatch(/^\/\/ stale content/);
    const r = await runDirect(root);
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    const content = readFileSync(stalePath, "utf8");
    expect(content).not.toMatch(/^\/\/ stale content/);
    expect(content).toContain("@generated by @nekostack/schema");
  });
});

// =============================================================================
// JSON output shape
// =============================================================================

describe("runGenerate — --json output", () => {
  it("emits artifact metadata with no `content` field", async () => {
    const root = tracked(buildOneSchemaWorkspace());
    const r = await runDirect(root, { json: true });
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stderr).toBe("");
    expect(r.stdout.endsWith("\n")).toBe(true);

    const parsed = JSON.parse(r.stdout) as {
      artifacts: Array<{
        schemaId: string;
        kind: string;
        suggestedPath: string;
        irHash: string;
        sourceHash: string;
        content?: unknown;
      }>;
    };
    expect(parsed.artifacts).toHaveLength(4);
    for (const a of parsed.artifacts) {
      expect(a).not.toHaveProperty("content");
      expect(Object.keys(a).sort()).toEqual([
        "irHash",
        "kind",
        "schemaId",
        "sourceHash",
        "suggestedPath",
      ]);
      expect(a.schemaId).toBe("com.fixture.cli.generate.User");
      expect(a.irHash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(a.sourceHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    }

    const kinds = parsed.artifacts.map((a) => a.kind).sort();
    expect(kinds).toEqual(["jsonSchema", "openApi", "typescript", "zod"]);

    const paths = parsed.artifacts.map((a) => a.suggestedPath).sort();
    expect(paths).toEqual([
      "generated/user.json.schema.json",
      "generated/user.openapi.json",
      "generated/user.types.ts",
      "generated/user.zod.ts",
    ]);
  });
});

// =============================================================================
// Empty / anonymous-only workspaces
// =============================================================================

describe("runGenerate — empty + anonymous", () => {
  it("empty workspace returns SUCCESS with `No artifacts generated.`", async () => {
    const root = tracked(buildEmptyWorkspace());
    const r = await runDirect(root);
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stdout).toBe("No artifacts generated.\n");
    expect(r.stderr).toBe("");
    // No generated/ directory should be created.
    expect(existsSync(join(root, "generated"))).toBe(false);
  });

  it("anonymous-only workspace skips silently and writes no artifacts", async () => {
    const root = tracked(buildAnonymousWorkspace());
    const r = await runDirect(root);
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stdout).toBe("No artifacts generated.\n");
    expect(existsSync(join(root, "generated"))).toBe(false);
  });
});

// =============================================================================
// Workspace prelude failures
// =============================================================================

describe("runGenerate — workspace prelude failures", () => {
  const FIXTURES_DIR = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "fixtures",
    "walk-workspace",
  );

  it("load failures → IO_ERROR + nothing written", async () => {
    const root = join(FIXTURES_DIR, "failures");
    const r = await runDirect(root);
    expect(r.code).toBe(EXIT_CODES.IO_ERROR);
    expect(r.stdout).toBe("");
    expect(r.stderr).toMatch(/failed to load/);
    // Pre-existing repo content under that fixture directory should
    // be untouched — no `generated/` materializes.
    expect(existsSync(join(root, "generated"))).toBe(false);
  });

  it("JSON load failures drop the raw `cause` field", async () => {
    const r = await runDirect(join(FIXTURES_DIR, "failures"), { json: true });
    expect(r.code).toBe(EXIT_CODES.IO_ERROR);
    const parsed = JSON.parse(r.stdout) as {
      failures: Array<Record<string, unknown>>;
    };
    for (const f of parsed.failures) {
      expect(f).not.toHaveProperty("cause");
      expect(Object.keys(f).sort()).toEqual(["message", "path", "reason"]);
    }
  });

  it("duplicate registry → LOGICAL_FAILURE before any write", async () => {
    const root = join(FIXTURES_DIR, "duplicates");
    const r = await runDirect(root);
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(r.stderr).toContain("duplicate_schema_id");
    expect(existsSync(join(root, "generated"))).toBe(false);
  });
});

// =============================================================================
// End-to-end via dispatch
// =============================================================================

describe("dispatch — `schema generate` wiring", () => {
  it("`neko schema generate --root <fixture>` returns SUCCESS and writes files", async () => {
    const root = tracked(buildOneSchemaWorkspace());
    const r = await runViaDispatch([
      "schema",
      "generate",
      "--root",
      root,
    ]);
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(existsSync(join(root, "generated", "user.types.ts"))).toBe(true);
  });

  it("`[pattern]` positional replaces the default glob (no schemas match → no-op SUCCESS)", async () => {
    const root = tracked(buildOneSchemaWorkspace());
    const r = await runViaDispatch([
      "schema",
      "generate",
      "**/*.no-match.ts",
      "--root",
      root,
    ]);
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stdout).toBe("No artifacts generated.\n");
    expect(existsSync(join(root, "generated"))).toBe(false);
  });

  it("`--json` round-trips the artifact-metadata shape", async () => {
    const root = tracked(buildOneSchemaWorkspace());
    const r = await runViaDispatch([
      "schema",
      "generate",
      "--root",
      root,
      "--json",
    ]);
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    const parsed = JSON.parse(r.stdout) as { artifacts: unknown[] };
    expect(parsed.artifacts).toHaveLength(4);
  });
});

// =============================================================================
// Static-scan purity — filesystem writes are deliberately allowed here
// =============================================================================

describe("schema/generate — side-effect discipline (static-scan)", () => {
  const SRC = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "src",
      "commands",
      "schema",
      "generate.ts",
    ),
    "utf8",
  );

  const STRIPPED = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(
    /\/\/.*$/gm,
    "",
  );

  // Note: `fs.write*` / `fs.mkdir` / etc. are NOT in this list —
  // this verb is the only one that may write files, and the
  // `node:fs/promises` import is the intentional boundary.
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
    "generate.ts source does not call `$name`",
    ({ pattern }) => {
      expect(STRIPPED).not.toMatch(pattern);
    },
  );
});
