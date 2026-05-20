/**
 * Step 4 — `planMigration` gate tests.
 *
 * Covers the Round-3 locked behavior end-to-end:
 *
 *   - missing endpoints  →  `migration_missing_endpoint`
 *   - no-change          →  empty chain, `worstSeverity: null`
 *   - cosmetic           →  empty chain, `worstSeverity: "cosmetic"`
 *   - cosmetic + exact   →  empty chain + `over_specified` note
 *   - additive, no mig   →  empty chain + `additive_no_migration`
 *   - additive + exact   →  chain = [exact]
 *   - breaking + exact   →  chain = [exact]
 *   - breaking multi-hop →  ordered chain through intermediates
 *   - breaking no migs   →  `migration_not_found`
 *   - breaking, broken   →  `migration_chain_broken`
 *   - breaking, ambig.   →  `migration_ambiguous_chain`
 *   - `versionPath` correctness in every branch
 *   - `transform` is never invoked (sentinel function throws if called)
 *   - deterministic output across repeated calls
 *   - static-scan purity (no fs / console / process / dynamic import)
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { s } from "../../src/index.js";
import type { AnySchema } from "../../src/index.js";
import {
  buildRegistry,
  type RegistrySourceEntry,
  type Registry,
} from "../../src/cli-integration.js";
import { buildMigrationRegistry } from "../../src/migrations/build-migration-registry.js";
import { planMigration } from "../../src/migrations/plan-migration.js";
import type {
  AnyMigration,
  MigrationRegistry,
  MigrationSourceEntry,
} from "../../src/migrations/types.js";

// =============================================================================
// Schema fixtures
// =============================================================================

// User schema, three versions:
//   1.0.0  →  { id, name }                    (baseline)
//   2.0.0  →  { id, name, email?: optional }  (additive over v1)
//   3.0.0  →  { id }                          (breaking over v1: name removed)
//
// Plus an unchanged "stable" pair for the no-change branch and a
// cosmetic-only pair for the description-changes-only branch.

const SCHEMA_ID = "com.fixture.plan.User";

const v1 = s
  .object({ id: s.string(), name: s.string() })
  .id(SCHEMA_ID)
  .version("1.0.0");

const v2 = s
  .object({ id: s.string(), name: s.string(), email: s.string().optional() })
  .id(SCHEMA_ID)
  .version("2.0.0");

const v3 = s.object({ id: s.string() }).id(SCHEMA_ID).version("3.0.0");

// Cosmetic-only pair — same structural shape, only metadata changes.
const STABLE_ID = "com.fixture.plan.Stable";
const stableV1 = s
  .object({ id: s.string() })
  .id(STABLE_ID)
  .version("1.0.0")
  .describe("first");
const stableV2 = s
  .object({ id: s.string() })
  .id(STABLE_ID)
  .version("2.0.0")
  .describe("second");

function buildSchemaRegistry(...schemas: readonly AnySchema[]): Registry {
  const entries: RegistrySourceEntry[] = schemas.map((schema, i) => ({
    sourcePath: `fixture-${i}.schema.ts`,
    sourceText: `// fixture ${i}\n`,
    schemas: [schema],
  }));
  const r = buildRegistry(entries);
  if (!r.success) throw new Error("buildRegistry failed in test fixture setup");
  return r.data;
}

// =============================================================================
// Migration fixtures
// =============================================================================

const VALID_HASH =
  "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" as const;

interface MigrationFixtureOpts {
  readonly schemaId?: string;
  readonly from: string;
  readonly to: string;
}

const NEVER_CALLED = (input: unknown): never => {
  throw new Error(
    "Sentinel: planMigration must never invoke migration.transform",
  );
};

function migrationSource(opts: MigrationFixtureOpts): MigrationSourceEntry {
  const schemaId = opts.schemaId ?? SCHEMA_ID;
  const migration: AnyMigration = {
    schemaId,
    from: opts.from,
    to: opts.to,
    transform: NEVER_CALLED,
  };
  const sourceText = `/**
 * @migration by @nekostack/schema
 * schemaId:         ${schemaId}
 * fromVersion:      ${opts.from}
 * toVersion:        ${opts.to}
 * fromIrHash:       ${VALID_HASH}
 * toIrHash:         ${VALID_HASH}
 * fromSourceHash:   ${VALID_HASH}
 * toSourceHash:     ${VALID_HASH}
 * generator:        neko-schema-migrate-stub
 * generatorVersion: @nekostack/schema@0.8.0
 */
export default {};
`;
  return {
    sourcePath: `${schemaId}.${opts.from}-to-${opts.to}.migration.ts`,
    sourceText,
    migration,
  };
}

function buildMigRegistry(
  ...defs: MigrationFixtureOpts[]
): MigrationRegistry {
  const entries = defs.map(migrationSource);
  const r = buildMigrationRegistry(entries);
  if (!r.success) {
    throw new Error("buildMigrationRegistry failed in test fixture setup");
  }
  return r.data;
}

// =============================================================================
// Endpoint resolution failures
// =============================================================================

describe("planMigration — endpoint resolution", () => {
  it("missing `from` endpoint returns `migration_missing_endpoint`", () => {
    const r = planMigration({
      schemaRegistry: buildSchemaRegistry(v2),
      migrationRegistry: buildMigRegistry(),
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

  it("missing `to` endpoint returns `migration_missing_endpoint`", () => {
    const r = planMigration({
      schemaRegistry: buildSchemaRegistry(v1),
      migrationRegistry: buildMigRegistry(),
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues[0]!.code).toBe("migration_missing_endpoint");
      expect(r.issues[0]!.metadata?.missing).toEqual(["to"]);
    }
  });

  it("both endpoints missing reports both", () => {
    const r = planMigration({
      schemaRegistry: buildSchemaRegistry(),
      migrationRegistry: buildMigRegistry(),
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
// Severity-gated branches: null, cosmetic, additive, breaking
// =============================================================================

describe("planMigration — no-change (worstSeverity === null)", () => {
  it("identical schemas across versions → empty chain, severity null", () => {
    // Use stableV1 against itself by registering it once and asking
    // for a self-transition through the same version. (The registry
    // doesn't permit two entries with the same `(id, version)`.) The
    // self-transition case is the cleanest "no-change" exercise.
    const r = planMigration({
      schemaRegistry: buildSchemaRegistry(stableV1),
      migrationRegistry: buildMigRegistry(),
      schemaId: STABLE_ID,
      fromVersion: "1.0.0",
      toVersion: "1.0.0",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.chain).toEqual([]);
      expect(r.data.worstSeverity).toBeNull();
      expect(r.data.versionPath).toEqual(["1.0.0", "1.0.0"]);
      expect(r.data.notes).toEqual([]);
    }
  });
});

describe("planMigration — cosmetic transition", () => {
  it("description-only change → empty chain, severity cosmetic, no notes", () => {
    const r = planMigration({
      schemaRegistry: buildSchemaRegistry(stableV1, stableV2),
      migrationRegistry: buildMigRegistry(),
      schemaId: STABLE_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.chain).toEqual([]);
      expect(r.data.worstSeverity).toBe("cosmetic");
      expect(r.data.versionPath).toEqual(["1.0.0", "2.0.0"]);
      expect(r.data.notes).toEqual([]);
    }
  });

  it("cosmetic + an explicitly-registered migration → over_specified note (chain stays empty)", () => {
    const r = planMigration({
      schemaRegistry: buildSchemaRegistry(stableV1, stableV2),
      migrationRegistry: buildMigRegistry({
        schemaId: STABLE_ID,
        from: "1.0.0",
        to: "2.0.0",
      }),
      schemaId: STABLE_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.chain).toEqual([]); // not included in chain
      expect(r.data.notes).toHaveLength(1);
      expect(r.data.notes[0]!.kind).toBe("over_specified");
    }
  });
});

describe("planMigration — additive transition", () => {
  it("no explicit migration → empty chain + additive_no_migration note", () => {
    const r = planMigration({
      schemaRegistry: buildSchemaRegistry(v1, v2),
      migrationRegistry: buildMigRegistry(),
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.chain).toEqual([]);
      expect(r.data.worstSeverity).toBe("additive");
      expect(r.data.notes).toHaveLength(1);
      expect(r.data.notes[0]!.kind).toBe("additive_no_migration");
    }
  });

  it("exact migration registered → included in chain, no note", () => {
    const r = planMigration({
      schemaRegistry: buildSchemaRegistry(v1, v2),
      migrationRegistry: buildMigRegistry({ from: "1.0.0", to: "2.0.0" }),
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.chain).toHaveLength(1);
      expect(r.data.chain[0]!.fromVersion).toBe("1.0.0");
      expect(r.data.chain[0]!.toVersion).toBe("2.0.0");
      expect(r.data.notes).toEqual([]);
    }
  });
});

describe("planMigration — breaking transition", () => {
  it("exact migration → chain of one", () => {
    const r = planMigration({
      schemaRegistry: buildSchemaRegistry(v1, v3),
      migrationRegistry: buildMigRegistry({ from: "1.0.0", to: "3.0.0" }),
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "3.0.0",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.worstSeverity).toBe("breaking");
      expect(r.data.chain).toHaveLength(1);
      expect(r.data.versionPath).toEqual(["1.0.0", "3.0.0"]);
    }
  });

  it("multi-hop chain via intermediates → ordered chain through 2.0.0", () => {
    // 1.0.0 → 2.0.0 → 3.0.0. The endpoint diff (v1 vs v3) is
    // breaking. The intermediate migrations bridge.
    const r = planMigration({
      schemaRegistry: buildSchemaRegistry(v1, v2, v3),
      migrationRegistry: buildMigRegistry(
        { from: "1.0.0", to: "2.0.0" },
        { from: "2.0.0", to: "3.0.0" },
      ),
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "3.0.0",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.chain).toHaveLength(2);
      expect(r.data.chain[0]!.fromVersion).toBe("1.0.0");
      expect(r.data.chain[0]!.toVersion).toBe("2.0.0");
      expect(r.data.chain[1]!.fromVersion).toBe("2.0.0");
      expect(r.data.chain[1]!.toVersion).toBe("3.0.0");
      expect(r.data.versionPath).toEqual(["1.0.0", "2.0.0", "3.0.0"]);
    }
  });

  it("no migrations registered for the schemaId → migration_not_found", () => {
    const r = planMigration({
      schemaRegistry: buildSchemaRegistry(v1, v3),
      migrationRegistry: buildMigRegistry(), // empty
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "3.0.0",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues[0]!.code).toBe("migration_not_found");
    }
  });

  it("migrations exist but no chain bridges → migration_chain_broken", () => {
    // Registered: 2.0.0 → 3.0.0 only. Asked: 1.0.0 → 3.0.0.
    const r = planMigration({
      schemaRegistry: buildSchemaRegistry(v1, v2, v3),
      migrationRegistry: buildMigRegistry({ from: "2.0.0", to: "3.0.0" }),
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "3.0.0",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues[0]!.code).toBe("migration_chain_broken");
    }
  });

  it("two distinct chains reach the target → migration_ambiguous_chain", () => {
    // 1.0.0 → 2.0.0 → 3.0.0  AND  1.0.0 → 3.0.0 directly.
    const r = planMigration({
      schemaRegistry: buildSchemaRegistry(v1, v2, v3),
      migrationRegistry: buildMigRegistry(
        { from: "1.0.0", to: "2.0.0" },
        { from: "2.0.0", to: "3.0.0" },
        { from: "1.0.0", to: "3.0.0" },
      ),
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "3.0.0",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues[0]!.code).toBe("migration_ambiguous_chain");
      expect(r.issues[0]!.metadata?.chainCount).toBe(2);
    }
  });
});

// =============================================================================
// Behavioral invariants
// =============================================================================

describe("planMigration — invariants", () => {
  it("never invokes `migration.transform`", () => {
    // The sentinel `transform` throws if called. If the planner
    // touches any migration's transform anywhere — even on a
    // success path — this test fails.
    const r = planMigration({
      schemaRegistry: buildSchemaRegistry(v1, v2, v3),
      migrationRegistry: buildMigRegistry(
        { from: "1.0.0", to: "2.0.0" },
        { from: "2.0.0", to: "3.0.0" },
      ),
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "3.0.0",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      for (const entry of r.data.chain) {
        expect(typeof entry.migration.transform).toBe("function");
      }
    }
  });

  it("is deterministic across repeated calls with the same inputs", () => {
    const schemaRegistry = buildSchemaRegistry(v1, v2, v3);
    const migrationRegistry = buildMigRegistry(
      { from: "1.0.0", to: "2.0.0" },
      { from: "2.0.0", to: "3.0.0" },
    );
    const opts = {
      schemaRegistry,
      migrationRegistry,
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "3.0.0",
    } as const;
    const a = planMigration(opts);
    const b = planMigration(opts);
    expect(a.success && b.success).toBe(true);
    if (a.success && b.success) {
      expect(a.data.versionPath).toEqual(b.data.versionPath);
      expect(a.data.chain.length).toBe(b.data.chain.length);
      for (let i = 0; i < a.data.chain.length; i++) {
        expect(a.data.chain[i]!.fromVersion).toBe(b.data.chain[i]!.fromVersion);
        expect(a.data.chain[i]!.toVersion).toBe(b.data.chain[i]!.toVersion);
      }
    }
  });
});

// =============================================================================
// Side-effect discipline — static-scan
// =============================================================================

describe("plan-migration source — side-effect discipline (static-scan)", () => {
  const SRC = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "src",
      "migrations",
      "plan-migration.ts",
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
    // Sentinel that `transform` is never called from source:
    { name: ".transform(", pattern: /\.transform\s*\(/ },
  ];

  it.each(FORBIDDEN)(
    "plan-migration source does not call `$name`",
    ({ pattern }) => {
      expect(STRIPPED).not.toMatch(pattern);
    },
  );
});
