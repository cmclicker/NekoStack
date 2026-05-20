/**
 * Step 10 — `stubMigrationHandler` gate tests.
 *
 * Thin wrapper over `stubMigration` — the test surface is small and
 * focused on the pass-through contract:
 *
 *   - success forwards unchanged
 *   - `suggestedPath` preserved
 *   - `content` preserved verbatim
 *   - failure forwards unchanged for missing `from` endpoint
 *   - failure forwards unchanged for missing `to` endpoint
 *   - Issue payloads preserved
 *   - registry is not mutated
 *   - static-scan purity (no fs / process / console / dynamic import)
 *
 * Detailed coverage of the stub-generator itself (path convention,
 * header alignment, parser round-trip, root-import negative gate,
 * etc.) lives in `stub.test.ts`. This file covers each branch once
 * to confirm the wrapper doesn't drop or rewrite anything.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { stubMigrationHandler } from "../../../src/migrations/handlers/stub.js";
import type { Registry, RegistryEntry } from "../../../src/registry/types.js";
import { s } from "../../../src/index.js";

// =============================================================================
// Fixtures — hand-built registry, same approach as stub.test.ts
// =============================================================================

const HASH_FROM_IR =
  "sha256:0000000000000000000000000000000000000000000000000000000000000001" as const;
const HASH_TO_IR =
  "sha256:0000000000000000000000000000000000000000000000000000000000000002" as const;
const HASH_FROM_SRC =
  "sha256:0000000000000000000000000000000000000000000000000000000000000003" as const;
const HASH_TO_SRC =
  "sha256:0000000000000000000000000000000000000000000000000000000000000004" as const;

const SCHEMA_ID = "com.fixture.stub-handler.User";

function makeRegistryEntry(
  schemaId: string,
  version: string,
  irHash: `sha256:${string}`,
  sourceHash: `sha256:${string}`,
  sourcePath: string,
): RegistryEntry {
  const schema = s.object({ id: s.string() }).id(schemaId).version(version);
  return {
    schemaId,
    schemaVersion: version,
    irHash,
    sourceHash,
    sourcePath,
    schema,
  };
}

function buildSchemaRegistry(entries: readonly RegistryEntry[]): Registry {
  const outer = new Map<string, Map<string, RegistryEntry>>();
  for (const e of entries) {
    let inner = outer.get(e.schemaId);
    if (inner === undefined) {
      inner = new Map();
      outer.set(e.schemaId, inner);
    }
    inner.set(e.schemaVersion ?? "", e);
  }
  return outer as Registry;
}

function defaultRegistry(): Registry {
  return buildSchemaRegistry([
    makeRegistryEntry(
      SCHEMA_ID,
      "1.0.0",
      HASH_FROM_IR,
      HASH_FROM_SRC,
      "schemas/user.schema.ts",
    ),
    makeRegistryEntry(
      SCHEMA_ID,
      "2.0.0",
      HASH_TO_IR,
      HASH_TO_SRC,
      "schemas/user.schema.ts",
    ),
  ]);
}

// =============================================================================
// Pass-through contract
// =============================================================================

describe("stubMigrationHandler — pass-through", () => {
  it("success forwards unchanged with the locked envelope shape", () => {
    const r = stubMigrationHandler({
      schemaRegistry: defaultRegistry(),
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.schemaId).toBe(SCHEMA_ID);
      expect(r.data.fromVersion).toBe("1.0.0");
      expect(r.data.toVersion).toBe("2.0.0");
      expect(typeof r.data.suggestedPath).toBe("string");
      expect(typeof r.data.content).toBe("string");
    }
  });

  it("`suggestedPath` is preserved verbatim from the generator", () => {
    const r = stubMigrationHandler({
      schemaRegistry: defaultRegistry(),
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      // Path convention is asserted in stub.test.ts; here we just
      // confirm the wrapper doesn't rewrite it. The expected value
      // comes from the locked path convention: `<schema-dir>/migrations/<basename>.<from-slug>-to-<to-slug>.migration.ts`.
      expect(r.data.suggestedPath).toBe(
        "schemas/migrations/user.1-0-0-to-2-0-0.migration.ts",
      );
    }
  });

  it("`content` is preserved verbatim and includes the migration header", () => {
    const r = stubMigrationHandler({
      schemaRegistry: defaultRegistry(),
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.content).toContain("@migration by @nekostack/schema");
      expect(r.data.content).toContain(SCHEMA_ID);
      expect(r.data.content).toContain(HASH_FROM_IR);
      expect(r.data.content).toContain(HASH_TO_IR);
      expect(r.data.content).toContain("export default migration");
    }
  });

  it("failure forwards unchanged for missing `from` endpoint", () => {
    const r = stubMigrationHandler({
      schemaRegistry: buildSchemaRegistry([
        makeRegistryEntry(
          SCHEMA_ID,
          "2.0.0",
          HASH_TO_IR,
          HASH_TO_SRC,
          "schemas/user.schema.ts",
        ),
      ]),
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues).toHaveLength(1);
      expect(r.issues[0]!.code).toBe("migration_missing_endpoint");
      expect(r.issues[0]!.metadata?.missing).toEqual(["from"]);
    }
  });

  it("failure forwards unchanged for missing `to` endpoint", () => {
    const r = stubMigrationHandler({
      schemaRegistry: buildSchemaRegistry([
        makeRegistryEntry(
          SCHEMA_ID,
          "1.0.0",
          HASH_FROM_IR,
          HASH_FROM_SRC,
          "schemas/user.schema.ts",
        ),
      ]),
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues[0]!.metadata?.missing).toEqual(["to"]);
    }
  });

  it("Issue payloads preserved on the failure branch", () => {
    const r = stubMigrationHandler({
      schemaRegistry: buildSchemaRegistry([]),
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.issues[0]!;
      expect(issue.code).toBe("migration_missing_endpoint");
      expect(issue.severity).toBe("error");
      expect(issue.metadata?.schemaId).toBe(SCHEMA_ID);
      expect(issue.metadata?.fromVersion).toBe("1.0.0");
      expect(issue.metadata?.toVersion).toBe("2.0.0");
      // Both endpoints absent → both reported in `missing`.
      expect(issue.metadata?.missing).toEqual(["from", "to"]);
    }
  });
});

// =============================================================================
// Invariants
// =============================================================================

describe("stubMigrationHandler — invariants", () => {
  it("does not mutate the input schemaRegistry", () => {
    const schemaRegistry = defaultRegistry();
    const schemaIdsBefore = [...schemaRegistry.keys()];
    const versionsBefore = [
      ...(schemaRegistry.get(SCHEMA_ID)?.keys() ?? []),
    ];

    stubMigrationHandler({
      schemaRegistry,
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });

    expect([...schemaRegistry.keys()]).toEqual(schemaIdsBefore);
    expect([...(schemaRegistry.get(SCHEMA_ID)?.keys() ?? [])]).toEqual(
      versionsBefore,
    );
  });

  it("produces byte-identical output for identical inputs (determinism)", () => {
    const opts = {
      schemaRegistry: defaultRegistry(),
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    };
    const a = stubMigrationHandler(opts);
    const b = stubMigrationHandler(opts);
    expect(a.success && b.success).toBe(true);
    if (a.success && b.success) {
      expect(a.data.content).toBe(b.data.content);
      expect(a.data.suggestedPath).toBe(b.data.suggestedPath);
    }
  });
});

// =============================================================================
// Side-effect discipline — static-scan
// =============================================================================

describe("stub-handler source — side-effect discipline (static-scan)", () => {
  const SRC = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "..",
      "src",
      "migrations",
      "handlers",
      "stub.ts",
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
    { name: "dynamic import()", pattern: /\bimport\s*\(/ },
    { name: ".transform(", pattern: /\.transform\s*\(/ },
  ];

  it.each(FORBIDDEN)(
    "stub-handler source does not call `$name`",
    ({ pattern }) => {
      expect(STRIPPED).not.toMatch(pattern);
    },
  );
});
