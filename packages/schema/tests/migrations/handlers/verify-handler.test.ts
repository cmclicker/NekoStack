/**
 * Step 9 — `verifyMigrationsHandler` gate tests.
 *
 * Thin wrapper over `verifyMigrationProvenance` — the test surface
 * is small and focused on the pass-through contract:
 *
 *   - success forwards unchanged for `bound` verdicts
 *   - success forwards unchanged for `cosmetic_drift` verdicts
 *   - failure forwards unchanged for `drift`
 *   - failure forwards unchanged for `missing_endpoint`
 *   - `summary` counts preserved on success
 *   - Issue payloads preserved on failure
 *   - registries are not mutated
 *   - `migration.transform` is never invoked
 *   - static-scan purity (no fs / process / console / dynamic import)
 *
 * Detailed verdict-matrix coverage lives in
 * `verify-provenance.test.ts`. This file covers each branch once to
 * confirm the wrapper doesn't drop or rewrite anything.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { verifyMigrationsHandler } from "../../../src/migrations/handlers/verify.js";
import type {
  AnyMigration,
  MigrationEntry,
  MigrationRegistry,
} from "../../../src/migrations/types.js";
import type { Registry, RegistryEntry } from "../../../src/registry/types.js";
import { s } from "../../../src/index.js";

// =============================================================================
// Hand-built fixtures — same approach as verify-provenance.test.ts so we can
// vary hash fields independently of the v0.2 generators.
// =============================================================================

const HASH_FROM_IR =
  "sha256:0000000000000000000000000000000000000000000000000000000000000001" as const;
const HASH_TO_IR =
  "sha256:0000000000000000000000000000000000000000000000000000000000000002" as const;
const HASH_FROM_SRC =
  "sha256:0000000000000000000000000000000000000000000000000000000000000003" as const;
const HASH_TO_SRC =
  "sha256:0000000000000000000000000000000000000000000000000000000000000004" as const;
const WRONG_HASH =
  "sha256:0000000000000000000000000000000000000000000000000000000000000009" as const;

const SCHEMA_ID = "com.fixture.verify-handler.User";

const NEVER_CALLED = (_input: unknown): never => {
  throw new Error(
    "Sentinel: verifyMigrationsHandler must never invoke migration.transform",
  );
};

function makeRegistryEntry(
  schemaId: string,
  version: string,
  irHash: `sha256:${string}`,
  sourceHash: `sha256:${string}`,
): RegistryEntry {
  const schema = s.object({ id: s.string() }).id(schemaId).version(version);
  return {
    schemaId,
    schemaVersion: version,
    irHash,
    sourceHash,
    sourcePath: `${schemaId}.${version}.schema.ts`,
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

function makeMigrationEntry(opts: {
  schemaId?: string;
  fromVersion?: string;
  toVersion?: string;
  fromIrHash?: `sha256:${string}`;
  toIrHash?: `sha256:${string}`;
  fromSourceHash?: `sha256:${string}`;
  toSourceHash?: `sha256:${string}`;
}): MigrationEntry {
  const schemaId = opts.schemaId ?? SCHEMA_ID;
  const fromVersion = opts.fromVersion ?? "1.0.0";
  const toVersion = opts.toVersion ?? "2.0.0";
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
    fromIrHash: opts.fromIrHash ?? HASH_FROM_IR,
    toIrHash: opts.toIrHash ?? HASH_TO_IR,
    fromSourceHash: opts.fromSourceHash ?? HASH_FROM_SRC,
    toSourceHash: opts.toSourceHash ?? HASH_TO_SRC,
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

function fullySyncedSchemaRegistry(): Registry {
  return buildSchemaRegistry([
    makeRegistryEntry(SCHEMA_ID, "1.0.0", HASH_FROM_IR, HASH_FROM_SRC),
    makeRegistryEntry(SCHEMA_ID, "2.0.0", HASH_TO_IR, HASH_TO_SRC),
  ]);
}

// =============================================================================
// Pass-through contract
// =============================================================================

describe("verifyMigrationsHandler — pass-through", () => {
  it("success forwards unchanged for `bound` verdicts", () => {
    const r = verifyMigrationsHandler({
      schemaRegistry: fullySyncedSchemaRegistry(),
      migrationRegistry: buildMigrationRegistryFromEntries([
        makeMigrationEntry({}),
      ]),
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.verdicts).toHaveLength(1);
      expect(r.data.verdicts[0]!.status).toBe("bound");
    }
  });

  it("success forwards unchanged for `cosmetic_drift` verdicts", () => {
    const r = verifyMigrationsHandler({
      schemaRegistry: fullySyncedSchemaRegistry(),
      migrationRegistry: buildMigrationRegistryFromEntries([
        makeMigrationEntry({ toSourceHash: WRONG_HASH }),
      ]),
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.verdicts[0]!.status).toBe("cosmetic_drift");
      expect(r.data.summary.cosmetic_drift).toBe(1);
    }
  });

  it("failure forwards unchanged for `drift`", () => {
    const r = verifyMigrationsHandler({
      schemaRegistry: fullySyncedSchemaRegistry(),
      migrationRegistry: buildMigrationRegistryFromEntries([
        makeMigrationEntry({ fromIrHash: WRONG_HASH }),
      ]),
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues).toHaveLength(1);
      expect(r.issues[0]!.code).toBe("migration_drift");
    }
  });

  it("failure forwards unchanged for `missing_endpoint`", () => {
    const r = verifyMigrationsHandler({
      schemaRegistry: buildSchemaRegistry([]),
      migrationRegistry: buildMigrationRegistryFromEntries([
        makeMigrationEntry({}),
      ]),
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues[0]!.code).toBe("migration_missing_endpoint");
    }
  });

  it("`summary` counts preserved across all four statuses on the success branch", () => {
    // 3 bound + 1 cosmetic_drift. Failure-class verdicts excluded
    // because the verifier drops to Result.failure (and the
    // summary travels in data, not issues, on that branch).
    const r = verifyMigrationsHandler({
      schemaRegistry: buildSchemaRegistry([
        makeRegistryEntry(SCHEMA_ID, "1.0.0", HASH_FROM_IR, HASH_FROM_SRC),
        makeRegistryEntry(SCHEMA_ID, "2.0.0", HASH_TO_IR, HASH_TO_SRC),
        makeRegistryEntry(SCHEMA_ID, "3.0.0", HASH_FROM_IR, HASH_FROM_SRC),
        makeRegistryEntry(SCHEMA_ID, "4.0.0", HASH_TO_IR, HASH_TO_SRC),
      ]),
      migrationRegistry: buildMigrationRegistryFromEntries([
        // bound
        makeMigrationEntry({}),
        // bound
        makeMigrationEntry({
          fromVersion: "2.0.0",
          toVersion: "3.0.0",
          fromIrHash: HASH_TO_IR,
          toIrHash: HASH_FROM_IR,
          fromSourceHash: HASH_TO_SRC,
          toSourceHash: HASH_FROM_SRC,
        }),
        // bound
        makeMigrationEntry({
          fromVersion: "3.0.0",
          toVersion: "4.0.0",
          fromIrHash: HASH_FROM_IR,
          toIrHash: HASH_TO_IR,
          fromSourceHash: HASH_FROM_SRC,
          toSourceHash: HASH_TO_SRC,
        }),
        // cosmetic_drift (fromSourceHash diverges)
        makeMigrationEntry({
          fromVersion: "1.0.0",
          toVersion: "3.0.0",
          fromIrHash: HASH_FROM_IR,
          toIrHash: HASH_FROM_IR,
          fromSourceHash: WRONG_HASH,
          toSourceHash: HASH_FROM_SRC,
        }),
      ]),
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.summary).toEqual({
        bound: 3,
        cosmetic_drift: 1,
        drift: 0,
        missing_endpoint: 0,
      });
    }
  });

  it("Issue payloads preserved on the failure branch (one Issue per drift/missing verdict)", () => {
    const r = verifyMigrationsHandler({
      schemaRegistry: buildSchemaRegistry([
        makeRegistryEntry(SCHEMA_ID, "1.0.0", HASH_FROM_IR, HASH_FROM_SRC),
        makeRegistryEntry(SCHEMA_ID, "2.0.0", HASH_TO_IR, HASH_TO_SRC),
      ]),
      migrationRegistry: buildMigrationRegistryFromEntries([
        // drift
        makeMigrationEntry({
          fromIrHash: WRONG_HASH,
        }),
        // missing_endpoint (other schemaId not in registry)
        makeMigrationEntry({
          schemaId: "com.fixture.verify-handler.Other",
        }),
      ]),
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const codes = r.issues.map((i) => i.code).sort();
      expect(codes).toEqual([
        "migration_drift",
        "migration_missing_endpoint",
      ]);
    }
  });
});

// =============================================================================
// Invariants
// =============================================================================

describe("verifyMigrationsHandler — invariants", () => {
  it("does not mutate the input registries", () => {
    const schemaRegistry = fullySyncedSchemaRegistry();
    const migrationRegistry = buildMigrationRegistryFromEntries([
      makeMigrationEntry({}),
    ]);

    const schemaIdsBefore = [...schemaRegistry.keys()];
    const migrationKeysBefore = [...migrationRegistry.keys()];

    verifyMigrationsHandler({ schemaRegistry, migrationRegistry });

    expect([...schemaRegistry.keys()]).toEqual(schemaIdsBefore);
    expect([...migrationRegistry.keys()]).toEqual(migrationKeysBefore);
  });

  it("never invokes `migration.transform`", () => {
    // Every migration uses NEVER_CALLED. If the handler reaches
    // into any entry's `transform`, this test crashes.
    const r = verifyMigrationsHandler({
      schemaRegistry: fullySyncedSchemaRegistry(),
      migrationRegistry: buildMigrationRegistryFromEntries([
        makeMigrationEntry({}),
      ]),
    });
    expect(r.success).toBe(true);
  });
});

// =============================================================================
// Side-effect discipline — static-scan
// =============================================================================

describe("verify-handler source — side-effect discipline (static-scan)", () => {
  const SRC = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "..",
      "src",
      "migrations",
      "handlers",
      "verify.ts",
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
    "verify-handler source does not call `$name`",
    ({ pattern }) => {
      expect(STRIPPED).not.toMatch(pattern);
    },
  );
});
