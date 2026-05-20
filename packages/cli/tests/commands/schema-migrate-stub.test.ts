/**
 * Step 23 — `neko schema migrate stub` command gate tests.
 *
 * Direct `runMigrateStub(opts)` only — commander wiring lands later.
 * `runMigrateStub` is the only v0.8 migrate verb that writes a file,
 * so most tests build a temp workspace (containing the schemas) with
 * `mkdtempSync` and then assert filesystem effects (file created,
 * parent dir created, content shape, refusal to overwrite).
 *
 * Covers (per Step 23 scope):
 *   - writes stub to `stub.suggestedPath` under root
 *   - creates parent `migrations/` directory recursively
 *   - JSON success shape `{ stub: { schemaId, fromVersion, toVersion,
 *     suggestedPath } }` omits the `content` field
 *   - pretty success line reports the suggestedPath
 *   - generated file imports `Migration` from `@nekostack/schema/cli`
 *     (NOT from the root `@nekostack/schema`)
 *   - generated file has the 9-field JSDoc provenance header opening
 *     with `@migration by @nekostack/schema`
 *   - generated content parse-round-trips through
 *     `parseMigrationProvenanceFromText` (sanity check that the stub
 *     produces a header the schema package will accept)
 *   - refuses to overwrite an existing file at the destination;
 *     preserves the existing content; exits LOGICAL_FAILURE
 *   - missing `from` endpoint → LOGICAL_FAILURE + migration_missing_endpoint
 *   - missing `to` endpoint → LOGICAL_FAILURE + migration_missing_endpoint
 *   - duplicate schema id → LOGICAL_FAILURE + duplicate_schema_id
 *   - schema-side loader failure → IO_ERROR
 *   - v0.8 boundary: no `apply` behavior; no transform execution
 *   - static-scan: command source has no console.* / process.exit /
 *     process.std{out,err}.write / `.transform(`
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
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { parseMigrationProvenanceFromText } from "@nekostack/schema/cli";
import { runMigrateStub } from "../../src/commands/schema/migrate/stub.js";
import { EXIT_CODES, type ExitCode } from "../../src/exit-codes.js";

const STATIC_FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
  "migrate-plan",
);

// =============================================================================
// Schema sources used by the tests
// =============================================================================

const V1_SCHEMA = `import { s } from "@nekostack/schema";

export const V1 = s
  .object({ a: s.string() })
  .id("com.fixture.cli.migrate-stub.User")
  .version("1.0.0");
`;

const V2_SCHEMA = `import { s } from "@nekostack/schema";

export const V2 = s
  .object({ a: s.number() })
  .id("com.fixture.cli.migrate-stub.User")
  .version("2.0.0");
`;

// =============================================================================
// Temp-dir lifecycle
// =============================================================================

const tempRoots: string[] = [];

function makeWorkspace(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "neko-mig-stub-"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel.split("/").join(sep));
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content, "utf8");
  }
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const r = tempRoots.pop()!;
    rmSync(r, { recursive: true, force: true });
  }
});

// =============================================================================
// Capture
// =============================================================================

interface Captured {
  readonly code: ExitCode;
  readonly stdout: string;
  readonly stderr: string;
}

async function runDirect(
  partial: Partial<Parameters<typeof runMigrateStub>[0]> & {
    readonly root: string;
    readonly schemaId: string;
    readonly fromVersion: string;
    readonly toVersion: string;
  },
): Promise<Captured> {
  let stdout = "";
  let stderr = "";
  const code = await runMigrateStub({
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
// Happy path
// =============================================================================

describe("runMigrateStub — happy path", () => {
  it("writes stub at `<root>/migrations/<basename>.<from-slug>-to-<to-slug>.migration.ts`", async () => {
    const root = makeWorkspace({
      "user-v1.schema.ts": V1_SCHEMA,
      "user-v2.schema.ts": V2_SCHEMA,
    });

    const r = await runDirect({
      root,
      schemaId: "com.fixture.cli.migrate-stub.User",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });

    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stderr).toBe("");
    expect(r.stdout).toContain("Wrote stub:");

    // The stub's suggestedPath uses the v0.7-compatible slug rule
    // applied to the FROM-endpoint schema's basename.
    const expected = join(
      root,
      "migrations",
      "user-v1.1-0-0-to-2-0-0.migration.ts",
    );
    expect(existsSync(expected)).toBe(true);
  });

  it("creates the `migrations/` parent directory recursively", async () => {
    const root = makeWorkspace({
      "user-v1.schema.ts": V1_SCHEMA,
      "user-v2.schema.ts": V2_SCHEMA,
    });

    expect(existsSync(join(root, "migrations"))).toBe(false);

    const r = await runDirect({
      root,
      schemaId: "com.fixture.cli.migrate-stub.User",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(existsSync(join(root, "migrations"))).toBe(true);
  });

  it("JSON success shape omits `content`", async () => {
    const root = makeWorkspace({
      "user-v1.schema.ts": V1_SCHEMA,
      "user-v2.schema.ts": V2_SCHEMA,
    });

    const r = await runDirect({
      root,
      schemaId: "com.fixture.cli.migrate-stub.User",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      json: true,
    });

    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stdout.endsWith("\n")).toBe(true);
    expect(r.stdout.slice(0, -1)).not.toMatch(/\n/);
    expect(r.stdout).not.toContain('"content":');

    const parsed = JSON.parse(r.stdout) as {
      stub: {
        schemaId: string;
        fromVersion: string;
        toVersion: string;
        suggestedPath: string;
        content?: string;
      };
    };
    expect(parsed.stub.schemaId).toBe("com.fixture.cli.migrate-stub.User");
    expect(parsed.stub.fromVersion).toBe("1.0.0");
    expect(parsed.stub.toVersion).toBe("2.0.0");
    expect(parsed.stub.suggestedPath).toContain("migrations/");
    expect(parsed.stub.suggestedPath.endsWith(".migration.ts")).toBe(true);
    expect("content" in parsed.stub).toBe(false);
  });

  it("pretty success reports the suggestedPath", async () => {
    const root = makeWorkspace({
      "user-v1.schema.ts": V1_SCHEMA,
      "user-v2.schema.ts": V2_SCHEMA,
    });

    const r = await runDirect({
      root,
      schemaId: "com.fixture.cli.migrate-stub.User",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });

    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    expect(r.stdout).toMatch(/^Wrote stub: /);
    expect(r.stdout).toContain("user-v1.1-0-0-to-2-0-0.migration.ts");
  });
});

// =============================================================================
// Generated content shape
// =============================================================================

describe("runMigrateStub — generated content shape", () => {
  async function writeAndRead(): Promise<string> {
    const root = makeWorkspace({
      "user-v1.schema.ts": V1_SCHEMA,
      "user-v2.schema.ts": V2_SCHEMA,
    });
    await runDirect({
      root,
      schemaId: "com.fixture.cli.migrate-stub.User",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    return readFileSync(
      join(root, "migrations", "user-v1.1-0-0-to-2-0-0.migration.ts"),
      "utf8",
    );
  }

  it("imports `Migration` from `@nekostack/schema/cli` (NOT from root)", async () => {
    const content = await writeAndRead();
    expect(content).toContain(
      `import type { Migration } from "@nekostack/schema/cli"`,
    );
    expect(content).not.toContain(`from "@nekostack/schema"`);
  });

  it("includes the 9-field JSDoc provenance header", async () => {
    const content = await writeAndRead();
    expect(content).toContain("@migration by @nekostack/schema");
    expect(content).toContain("schemaId:");
    expect(content).toContain("fromVersion:");
    expect(content).toContain("toVersion:");
    expect(content).toContain("fromIrHash:");
    expect(content).toContain("toIrHash:");
    expect(content).toContain("fromSourceHash:");
    expect(content).toContain("toSourceHash:");
    expect(content).toContain("generator:");
    expect(content).toContain("generatorVersion:");
  });

  it("parse-round-trips through `parseMigrationProvenanceFromText`", async () => {
    const content = await writeAndRead();
    const parsed = parseMigrationProvenanceFromText(content);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.schemaId).toBe(
        "com.fixture.cli.migrate-stub.User",
      );
      expect(parsed.data.fromVersion).toBe("1.0.0");
      expect(parsed.data.toVersion).toBe("2.0.0");
      expect(parsed.data.fromIrHash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(parsed.data.toIrHash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(parsed.data.fromSourceHash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(parsed.data.toSourceHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
  });
});

// =============================================================================
// Refuse-to-overwrite
// =============================================================================

describe("runMigrateStub — refuses to overwrite", () => {
  it("does not overwrite an existing file; preserves content; exits LOGICAL_FAILURE", async () => {
    const root = makeWorkspace({
      "user-v1.schema.ts": V1_SCHEMA,
      "user-v2.schema.ts": V2_SCHEMA,
      "migrations/user-v1.1-0-0-to-2-0-0.migration.ts":
        "// hand-authored content the author cares about\n",
    });

    const dest = join(
      root,
      "migrations",
      "user-v1.1-0-0-to-2-0-0.migration.ts",
    );
    const before = readFileSync(dest, "utf8");

    const r = await runDirect({
      root,
      schemaId: "com.fixture.cli.migrate-stub.User",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });

    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(r.stdout).toBe("");
    expect(r.stderr).toContain("stub_path_exists");
    expect(r.stderr).toContain("user-v1.1-0-0-to-2-0-0.migration.ts");

    // Content untouched — strict byte equality.
    const after = readFileSync(dest, "utf8");
    expect(after).toBe(before);
  });

  it("JSON refusal reports `{ failures: [{ reason: 'stub_path_exists', ... }] }`", async () => {
    const root = makeWorkspace({
      "user-v1.schema.ts": V1_SCHEMA,
      "user-v2.schema.ts": V2_SCHEMA,
      "migrations/user-v1.1-0-0-to-2-0-0.migration.ts": "// already here\n",
    });

    const r = await runDirect({
      root,
      schemaId: "com.fixture.cli.migrate-stub.User",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      json: true,
    });

    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    const parsed = JSON.parse(r.stdout) as {
      failures: Array<{ path: string; reason: string; message: string }>;
    };
    expect(parsed.failures).toHaveLength(1);
    expect(parsed.failures[0]!.reason).toBe("stub_path_exists");
  });
});

// =============================================================================
// Missing endpoints
// =============================================================================

describe("runMigrateStub — missing endpoints", () => {
  it("missing `from` endpoint → LOGICAL_FAILURE + migration_missing_endpoint", async () => {
    const root = makeWorkspace({
      // Only v2 exists.
      "user-v2.schema.ts": V2_SCHEMA,
    });

    const r = await runDirect({
      root,
      schemaId: "com.fixture.cli.migrate-stub.User",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });

    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(r.stderr).toContain("migration_missing_endpoint");
  });

  it("missing `to` endpoint → LOGICAL_FAILURE + migration_missing_endpoint", async () => {
    const root = makeWorkspace({
      // Only v1 exists.
      "user-v1.schema.ts": V1_SCHEMA,
    });

    const r = await runDirect({
      root,
      schemaId: "com.fixture.cli.migrate-stub.User",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });

    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(r.stderr).toContain("migration_missing_endpoint");
  });
});

// =============================================================================
// Loader + registry failures (reuse static migrate-plan fixtures)
// =============================================================================

describe("runMigrateStub — schema-side failures", () => {
  it("duplicate schema id → LOGICAL_FAILURE + duplicate_schema_id", async () => {
    const r = await runDirect({
      root: join(STATIC_FIXTURES, "duplicate-schema"),
      schemaId: "com.fixture.cli.migrate-plan.DupSchema",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.code).toBe(EXIT_CODES.LOGICAL_FAILURE);
    expect(r.stderr).toContain("duplicate_schema_id");
  });

  it("schema-side loader failure → IO_ERROR", async () => {
    const r = await runDirect({
      root: join(STATIC_FIXTURES, "schema-loader-failure"),
      schemaId: "com.fixture.cli.migrate-plan.SchemaLoaderFailure",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.code).toBe(EXIT_CODES.IO_ERROR);
    expect(r.stderr).toContain("schema file");
    expect(r.stderr).toContain("failed to load");
  });
});

// =============================================================================
// v0.8 boundary — no transform / no apply
// =============================================================================

describe("runMigrateStub — v0.8 boundary", () => {
  it("does not implement an apply behavior (success only writes one file)", async () => {
    const root = makeWorkspace({
      "user-v1.schema.ts": V1_SCHEMA,
      "user-v2.schema.ts": V2_SCHEMA,
    });

    const before = Date.now();
    const r = await runDirect({
      root,
      schemaId: "com.fixture.cli.migrate-stub.User",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    void before;

    expect(r.code).toBe(EXIT_CODES.SUCCESS);
    // Exactly one file written under migrations/ — no data application,
    // no execution side-effects on the workspace.
    const fs = await import("node:fs/promises");
    const migrationsDir = join(root, "migrations");
    const entries = await fs.readdir(migrationsDir);
    expect(entries).toEqual(["user-v1.1-0-0-to-2-0-0.migration.ts"]);
  });
});

// =============================================================================
// Static scan
// =============================================================================

describe("runMigrateStub — source discipline (static scan)", () => {
  const CMD_SRC = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "src",
      "commands",
      "schema",
      "migrate",
      "stub.ts",
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
    { name: ".transform(", pattern: /\.transform\s*\(/ },
  ];

  it.each(FORBIDDEN)("command source does not contain `$name`", ({ pattern }) => {
    expect(STRIPPED).not.toMatch(pattern);
  });
});
