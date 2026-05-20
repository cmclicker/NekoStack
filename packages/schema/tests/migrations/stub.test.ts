/**
 * Step 6 — `stubMigration` gate tests.
 *
 * Covers:
 *   - suggestedPath follows `<schema-dir>/migrations/<basename>.<from-slug>-to-<to-slug>.migration.ts`
 *   - slugify applies to prerelease/build versions
 *   - basename derived from the FROM schema's sourcePath
 *   - content includes the full provenance header (all 9 fields)
 *   - content imports `Migration` from `@nekostack/schema/cli`
 *   - content does NOT import from the root `@nekostack/schema`
 *   - content carries a default-exported migration with stub transform
 *   - missing from / to / both endpoints → migration_missing_endpoint
 *   - deterministic output for identical inputs
 *   - parser round-trip: stub content parses cleanly via
 *     `parseMigrationProvenanceFromText` — proves the emitted header
 *     shape is compatible with the verifier downstream
 *   - static-scan purity (no fs / process / console / dynamic import)
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { stubMigration } from "../../src/migrations/stub.js";
import { parseMigrationProvenanceFromText } from "../../src/migrations/parse-provenance.js";
import type { Registry, RegistryEntry } from "../../src/registry/types.js";
import { s } from "../../src/index.js";

// =============================================================================
// Fixture helpers — hand-built schema registry so we control hashes
// =============================================================================

const HASH_FROM_IR =
  "sha256:0000000000000000000000000000000000000000000000000000000000000001" as const;
const HASH_TO_IR =
  "sha256:0000000000000000000000000000000000000000000000000000000000000002" as const;
const HASH_FROM_SRC =
  "sha256:0000000000000000000000000000000000000000000000000000000000000003" as const;
const HASH_TO_SRC =
  "sha256:0000000000000000000000000000000000000000000000000000000000000004" as const;

const SCHEMA_ID = "com.fixture.stub.User";

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

function buildHandwrittenSchemaRegistry(
  entries: readonly RegistryEntry[],
): Registry {
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
  return buildHandwrittenSchemaRegistry([
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
// suggestedPath
// =============================================================================

describe("stubMigration — suggestedPath", () => {
  it("places the file under `<schema-dir>/migrations/` with the locked stem shape", () => {
    const r = stubMigration({
      schemaRegistry: defaultRegistry(),
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.suggestedPath).toBe(
        "schemas/migrations/user.1-0-0-to-2-0-0.migration.ts",
      );
    }
  });

  it("slugifies prerelease versions", () => {
    const r = stubMigration({
      schemaRegistry: buildHandwrittenSchemaRegistry([
        makeRegistryEntry(
          SCHEMA_ID,
          "1.0.0-beta.1",
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
      ]),
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0-beta.1",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.suggestedPath).toBe(
        "schemas/migrations/user.1-0-0-beta-1-to-2-0-0.migration.ts",
      );
    }
  });

  it("slugifies build-metadata versions", () => {
    const r = stubMigration({
      schemaRegistry: buildHandwrittenSchemaRegistry([
        makeRegistryEntry(
          SCHEMA_ID,
          "1.0.0",
          HASH_FROM_IR,
          HASH_FROM_SRC,
          "schemas/user.schema.ts",
        ),
        makeRegistryEntry(
          SCHEMA_ID,
          "2.0.0+build.5",
          HASH_TO_IR,
          HASH_TO_SRC,
          "schemas/user.schema.ts",
        ),
      ]),
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0+build.5",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.suggestedPath).toBe(
        "schemas/migrations/user.1-0-0-to-2-0-0-build-5.migration.ts",
      );
    }
  });

  it("derives basename from the FROM schema's sourcePath (strips `.schema.ts`)", () => {
    const r = stubMigration({
      schemaRegistry: buildHandwrittenSchemaRegistry([
        makeRegistryEntry(
          SCHEMA_ID,
          "1.0.0",
          HASH_FROM_IR,
          HASH_FROM_SRC,
          "packages/example/src/account.schema.ts",
        ),
        makeRegistryEntry(
          SCHEMA_ID,
          "2.0.0",
          HASH_TO_IR,
          HASH_TO_SRC,
          "packages/example/src/account.schema.ts",
        ),
      ]),
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.suggestedPath).toBe(
        "packages/example/src/migrations/account.1-0-0-to-2-0-0.migration.ts",
      );
    }
  });

  it("falls back to filename-minus-last-ext when sourcePath doesn't end in `.schema.{ts,js,mts,cts}`", () => {
    const r = stubMigration({
      schemaRegistry: buildHandwrittenSchemaRegistry([
        makeRegistryEntry(
          SCHEMA_ID,
          "1.0.0",
          HASH_FROM_IR,
          HASH_FROM_SRC,
          "schemas/contract.config.ts",
        ),
        makeRegistryEntry(
          SCHEMA_ID,
          "2.0.0",
          HASH_TO_IR,
          HASH_TO_SRC,
          "schemas/contract.config.ts",
        ),
      ]),
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.suggestedPath).toBe(
        "schemas/migrations/contract.config.1-0-0-to-2-0-0.migration.ts",
      );
    }
  });
});

// =============================================================================
// content — provenance header
// =============================================================================

describe("stubMigration — content header", () => {
  it("contains all nine provenance fields with the locked values", () => {
    const r = stubMigration({
      schemaRegistry: defaultRegistry(),
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      const c = r.data.content;
      expect(c).toContain("@migration by @nekostack/schema");
      expect(c).toContain(`schemaId:`);
      expect(c).toContain(SCHEMA_ID);
      expect(c).toMatch(/fromVersion:\s+1\.0\.0/);
      expect(c).toMatch(/toVersion:\s+2\.0\.0/);
      expect(c).toContain(HASH_FROM_IR);
      expect(c).toContain(HASH_TO_IR);
      expect(c).toContain(HASH_FROM_SRC);
      expect(c).toContain(HASH_TO_SRC);
      expect(c).toMatch(/generator:\s+neko-schema-migrate-stub/);
      expect(c).toMatch(/generatorVersion:\s+@nekostack\/schema@/);
    }
  });

  it("round-trips through `parseMigrationProvenanceFromText`", () => {
    // Strongest possible test that the stub emits a header the
    // verifier can read back. If the stub's format and the parser's
    // expected format ever drift, this assertion fails.
    const r = stubMigration({
      schemaRegistry: defaultRegistry(),
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      const parsed = parseMigrationProvenanceFromText(r.data.content);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.schemaId).toBe(SCHEMA_ID);
        expect(parsed.data.fromVersion).toBe("1.0.0");
        expect(parsed.data.toVersion).toBe("2.0.0");
        expect(parsed.data.fromIrHash).toBe(HASH_FROM_IR);
        expect(parsed.data.toIrHash).toBe(HASH_TO_IR);
        expect(parsed.data.fromSourceHash).toBe(HASH_FROM_SRC);
        expect(parsed.data.toSourceHash).toBe(HASH_TO_SRC);
        expect(parsed.data.generator).toBe("neko-schema-migrate-stub");
      }
    }
  });
});

// =============================================================================
// content — import discipline + body
// =============================================================================

describe("stubMigration — content body", () => {
  it("imports `Migration` from `@nekostack/schema/cli`", () => {
    const r = stubMigration({
      schemaRegistry: defaultRegistry(),
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.content).toMatch(
        /import\s+type\s+\{\s*Migration\s*\}\s+from\s+"@nekostack\/schema\/cli"/,
      );
    }
  });

  it("does NOT import from the root `@nekostack/schema`", () => {
    const r = stubMigration({
      schemaRegistry: defaultRegistry(),
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      // Root-leakage gate: any `from "@nekostack/schema"` (exact
      // closing quote, not `/cli` etc.) is a violation of the v0.6
      // engine-swap-safe boundary.
      expect(r.data.content).not.toMatch(/from\s+"@nekostack\/schema"/);
    }
  });

  it("carries a typed `Migration<schemaId, from, to>` declaration", () => {
    const r = stubMigration({
      schemaRegistry: defaultRegistry(),
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.content).toContain(
        `Migration<"${SCHEMA_ID}", "1.0.0", "2.0.0">`,
      );
    }
  });

  it("includes a default export and a stub `transform` body", () => {
    const r = stubMigration({
      schemaRegistry: defaultRegistry(),
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.content).toContain("export default migration");
      expect(r.data.content).toMatch(/transform\(input\)/);
      // The stub body throws — v0.8 never executes it, so the
      // stub's job is just to give authors a starting point.
      expect(r.data.content).toContain("Not yet implemented");
    }
  });
});

// =============================================================================
// Failure paths
// =============================================================================

describe("stubMigration — failure paths", () => {
  it("missing `from` endpoint → migration_missing_endpoint", () => {
    const r = stubMigration({
      schemaRegistry: buildHandwrittenSchemaRegistry([
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
      expect(r.issues[0]!.code).toBe("migration_missing_endpoint");
      expect(r.issues[0]!.metadata?.missing).toEqual(["from"]);
    }
  });

  it("missing `to` endpoint → migration_missing_endpoint", () => {
    const r = stubMigration({
      schemaRegistry: buildHandwrittenSchemaRegistry([
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

  it("missing both endpoints → reports both", () => {
    const r = stubMigration({
      schemaRegistry: buildHandwrittenSchemaRegistry([]),
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues[0]!.metadata?.missing).toEqual(["from", "to"]);
    }
  });
});

// =============================================================================
// Determinism
// =============================================================================

describe("stubMigration — determinism", () => {
  it("produces byte-identical output for identical inputs", () => {
    const opts = {
      schemaRegistry: defaultRegistry(),
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    };
    const a = stubMigration(opts);
    const b = stubMigration(opts);
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

describe("stub source — side-effect discipline (static-scan)", () => {
  const SRC = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "src",
      "migrations",
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
  ];

  it.each(FORBIDDEN)(
    "stub source does not call `$name`",
    ({ pattern }) => {
      expect(STRIPPED).not.toMatch(pattern);
    },
  );
});
