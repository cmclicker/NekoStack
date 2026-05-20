/**
 * Step 7 — `listMigrationsHandler` gate tests.
 *
 * Covers:
 *   - empty registry → success with `entries: []`
 *   - single migration round-trips
 *   - multiple schemaIds sorted ascending
 *   - multiple fromVersions sorted ascending within a schemaId
 *   - multiple toVersions sorted ascending within a (schemaId, fromVersion)
 *   - full composite ordering across all three axes
 *   - preserves `MigrationEntry` object identity
 *   - does not mutate the input registry
 *   - deterministic across repeated calls
 *   - static-scan purity (no fs / console / process / dynamic import)
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { listMigrationsHandler } from "../../../src/migrations/handlers/list.js";
import type {
  AnyMigration,
  MigrationEntry,
  MigrationRegistry,
} from "../../../src/migrations/types.js";

// =============================================================================
// Fixture helpers
// =============================================================================

const HASH =
  "sha256:0000000000000000000000000000000000000000000000000000000000000001" as const;

const NEVER_CALLED = (_input: unknown): never => {
  throw new Error(
    "Sentinel: listMigrationsHandler must never invoke migration.transform",
  );
};

function makeEntry(
  schemaId: string,
  fromVersion: string,
  toVersion: string,
): MigrationEntry {
  const migration: AnyMigration = {
    schemaId,
    from: fromVersion,
    to: toVersion,
    transform: NEVER_CALLED,
  };
  return {
    schemaId,
    fromVersion,
    toVersion,
    fromIrHash: HASH,
    toIrHash: HASH,
    fromSourceHash: HASH,
    toSourceHash: HASH,
    sourcePath: `${schemaId}.${fromVersion}-to-${toVersion}.migration.ts`,
    migration,
  };
}

function buildMigrationRegistryFromEntries(
  entries: readonly MigrationEntry[],
): MigrationRegistry {
  const outer = new Map<
    string,
    Map<string, Map<string, MigrationEntry>>
  >();
  for (const e of entries) {
    let byFrom = outer.get(e.schemaId);
    if (byFrom === undefined) {
      byFrom = new Map();
      outer.set(e.schemaId, byFrom);
    }
    let byTo = byFrom.get(e.fromVersion);
    if (byTo === undefined) {
      byTo = new Map();
      byFrom.set(e.fromVersion, byTo);
    }
    byTo.set(e.toVersion, e);
  }
  return outer as MigrationRegistry;
}

// =============================================================================
// Envelope behavior
// =============================================================================

describe("listMigrationsHandler — envelope", () => {
  it("empty registry → success with empty entries", () => {
    const r = listMigrationsHandler({
      migrationRegistry: buildMigrationRegistryFromEntries([]),
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.entries).toEqual([]);
    }
  });

  it("single migration round-trips", () => {
    const entry = makeEntry("com.x.User", "1.0.0", "2.0.0");
    const r = listMigrationsHandler({
      migrationRegistry: buildMigrationRegistryFromEntries([entry]),
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.entries).toHaveLength(1);
      expect(r.data.entries[0]!.schemaId).toBe("com.x.User");
      expect(r.data.entries[0]!.fromVersion).toBe("1.0.0");
      expect(r.data.entries[0]!.toVersion).toBe("2.0.0");
    }
  });
});

// =============================================================================
// Ordering — one axis at a time
// =============================================================================

describe("listMigrationsHandler — ordering", () => {
  it("sorts schemaIds ascending", () => {
    // Inserted in non-sorted order; expect alphabetical out.
    const r = listMigrationsHandler({
      migrationRegistry: buildMigrationRegistryFromEntries([
        makeEntry("com.b.X", "1.0.0", "2.0.0"),
        makeEntry("com.a.X", "1.0.0", "2.0.0"),
        makeEntry("com.c.X", "1.0.0", "2.0.0"),
      ]),
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.entries.map((e) => e.schemaId)).toEqual([
        "com.a.X",
        "com.b.X",
        "com.c.X",
      ]);
    }
  });

  it("sorts fromVersions ascending within a schemaId", () => {
    const r = listMigrationsHandler({
      migrationRegistry: buildMigrationRegistryFromEntries([
        makeEntry("com.x.X", "3.0.0", "4.0.0"),
        makeEntry("com.x.X", "1.0.0", "2.0.0"),
        makeEntry("com.x.X", "2.0.0", "3.0.0"),
      ]),
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.entries.map((e) => e.fromVersion)).toEqual([
        "1.0.0",
        "2.0.0",
        "3.0.0",
      ]);
    }
  });

  it("sorts toVersions ascending within a (schemaId, fromVersion)", () => {
    // Two outgoing edges from `1.0.0`: → 3.0.0 and → 2.0.0.
    const r = listMigrationsHandler({
      migrationRegistry: buildMigrationRegistryFromEntries([
        makeEntry("com.x.X", "1.0.0", "3.0.0"),
        makeEntry("com.x.X", "1.0.0", "2.0.0"),
      ]),
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.entries.map((e) => e.toVersion)).toEqual(["2.0.0", "3.0.0"]);
    }
  });
});

// =============================================================================
// Full composite ordering
// =============================================================================

describe("listMigrationsHandler — composite ordering", () => {
  it("orders by (schemaId, fromVersion, toVersion) across a mixed registry", () => {
    const r = listMigrationsHandler({
      migrationRegistry: buildMigrationRegistryFromEntries([
        makeEntry("com.b.X", "1.0.0", "2.0.0"),
        makeEntry("com.a.X", "2.0.0", "3.0.0"),
        makeEntry("com.a.X", "1.0.0", "3.0.0"),
        makeEntry("com.b.X", "1.0.0", "1.5.0"),
        makeEntry("com.a.X", "1.0.0", "2.0.0"),
      ]),
    });
    expect(r.success).toBe(true);
    if (r.success) {
      const order = r.data.entries.map(
        (e) => `${e.schemaId}/${e.fromVersion}/${e.toVersion}`,
      );
      expect(order).toEqual([
        "com.a.X/1.0.0/2.0.0",
        "com.a.X/1.0.0/3.0.0",
        "com.a.X/2.0.0/3.0.0",
        "com.b.X/1.0.0/1.5.0",
        "com.b.X/1.0.0/2.0.0",
      ]);
    }
  });
});

// =============================================================================
// Object-identity preservation
// =============================================================================

describe("listMigrationsHandler — object identity", () => {
  it("preserves `MigrationEntry` object identity", () => {
    const entry = makeEntry("com.x.X", "1.0.0", "2.0.0");
    const r = listMigrationsHandler({
      migrationRegistry: buildMigrationRegistryFromEntries([entry]),
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.entries[0]).toBe(entry); // reference equality
    }
  });

  it("preserves inner `migration` object identity transitively", () => {
    const entry = makeEntry("com.x.X", "1.0.0", "2.0.0");
    const r = listMigrationsHandler({
      migrationRegistry: buildMigrationRegistryFromEntries([entry]),
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.entries[0]!.migration).toBe(entry.migration);
    }
  });
});

// =============================================================================
// Non-mutation + determinism
// =============================================================================

describe("listMigrationsHandler — non-mutation + determinism", () => {
  it("does not mutate the input registry", () => {
    const registry = buildMigrationRegistryFromEntries([
      makeEntry("com.b.X", "1.0.0", "2.0.0"),
      makeEntry("com.a.X", "1.0.0", "2.0.0"),
    ]);
    const beforeOuterKeys = [...registry.keys()];
    const beforeInnerKeys: Record<string, string[]> = {};
    for (const [k, v] of registry) {
      beforeInnerKeys[k] = [...v.keys()];
    }
    listMigrationsHandler({ migrationRegistry: registry });
    expect([...registry.keys()]).toEqual(beforeOuterKeys);
    for (const [k, v] of registry) {
      expect([...v.keys()]).toEqual(beforeInnerKeys[k]);
    }
  });

  it("repeated calls produce identical output", () => {
    const opts = {
      migrationRegistry: buildMigrationRegistryFromEntries([
        makeEntry("com.x.X", "2.0.0", "3.0.0"),
        makeEntry("com.x.X", "1.0.0", "2.0.0"),
      ]),
    };
    const a = listMigrationsHandler(opts);
    const b = listMigrationsHandler(opts);
    expect(a.success && b.success).toBe(true);
    if (a.success && b.success) {
      expect(a.data.entries).toEqual(b.data.entries);
    }
  });
});

// =============================================================================
// Side-effect discipline — static-scan
// =============================================================================

describe("list-handler source — side-effect discipline (static-scan)", () => {
  const SRC = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "..",
      "src",
      "migrations",
      "handlers",
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
    { name: "fs.read", pattern: /\bfs\b.*read/ },
    { name: "fs.write", pattern: /\bfs\b.*write/ },
    { name: "dynamic import()", pattern: /\bimport\s*\(/ },
    { name: ".transform(", pattern: /\.transform\s*\(/ },
  ];

  it.each(FORBIDDEN)(
    "list-handler source does not call `$name`",
    ({ pattern }) => {
      expect(STRIPPED).not.toMatch(pattern);
    },
  );
});
