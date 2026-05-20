/**
 * Step 3 — `pre-flight.ts` gate.
 *
 * Exercises the v0.9 pre-flight contract end-to-end against
 * in-memory registries. The fixtures are built directly here (no
 * filesystem walk, no tsx loader) so the test is pure and self-
 * contained — `preFlight` consumes registries opaquely.
 *
 * Scenarios (17 from the Step 3 spec):
 *   1.  null severity (from===to) → success + empty chain
 *   2.  cosmetic severity (version-only diff) → success + empty chain + no notes
 *   3.  over_specified (cosmetic + exact migration) → success + empty chain + note
 *   4.  additive_no_migration → success + empty chain + note
 *   5.  additive + exact migration → success + chain[1]
 *   6.  breaking + exact migration → success + chain[1]
 *   7.  breaking multi-hop → success + chain[2] in order
 *   8.  planner: migration_missing_endpoint → pre_flight_failed
 *   9.  planner: migration_not_found → pre_flight_failed
 *  10.  planner: migration_chain_broken → pre_flight_failed
 *  11.  planner: migration_ambiguous_chain → pre_flight_failed
 *  12.  chain-scoped verify: unrelated broken migration outside chain
 *       does NOT fail the run (proves chain-scoped, not workspace-wide)
 *  13.  cosmetic_drift fails by default
 *  14.  cosmetic_drift passes with `allowCosmeticDrift: true`
 *  15.  drift fails
 *  16.  verifier-side missing_endpoint fails (chain has phantom
 *       intermediate vertex absent from schemaRegistry)
 *  17.  static scan: pre-flight.ts has no console/process/stdio
 *       writes and no `.transform(` call
 *
 * Plus: a sentinel that wraps every test migration's `transform`
 * with a throwing spy and asserts the spy is never called. That is
 * the strongest runtime guarantee that pre-flight is pure with
 * respect to the v0.8 boundary.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { irHash, s } from "@nekostack/schema";
import {
  buildRegistry,
  sourceHashFromText,
} from "@nekostack/schema/cli";
import type {
  AnyMigration,
  MigrationEntry,
  MigrationRegistry,
  Registry,
} from "@nekostack/schema/cli";
import { preFlight } from "../src/pre-flight.js";
import { preFlight as publicPreFlight } from "../src/index.js";

// =============================================================================
// Tiny in-memory registry builders
// =============================================================================

/**
 * `transform` that throws if pre-flight ever calls it. Every test
 * fixture's migration uses this — the runtime sentinel for the
 * "never invoke transform" boundary.
 */
function poisonTransform(): AnyMigration["transform"] {
  return ((input: unknown) => {
    throw new Error(
      "boundary violation — pre-flight invoked migration.transform",
    );
  }) as AnyMigration["transform"];
}

type RegistryFixture = {
  registry: Registry;
  irHashes: Record<string, `sha256:${string}`>;
  sourceHashes: Record<string, `sha256:${string}`>;
};

/**
 * Build a schema registry from a list of `(schemaId, version,
 * shape)` triples. Returns both the registry and the computed
 * hashes so migration fixtures can reference them by `(id, version)`
 * key.
 */
function buildSchemaReg(
  schemas: ReadonlyArray<{
    id: string;
    version: string;
    schema: ReturnType<typeof s.object>;
  }>,
): RegistryFixture {
  const irHashes: Record<string, `sha256:${string}`> = {};
  const sourceHashes: Record<string, `sha256:${string}`> = {};
  const entries = schemas.map((row) => {
    const key = `${row.id}@${row.version}`;
    const sourcePath = `${row.id.replace(/\./g, "_")}-${row.version}.schema.ts`;
    // Synthesize a deterministic sourceText per fixture so the
    // sourceHash is stable across runs. The content doesn't need
    // to be valid TS — the registry just stores the bytes.
    const sourceText = `// fixture source for ${key} on ${sourcePath}\n`;
    irHashes[key] = `sha256:${irHash(row.schema.node)}` as `sha256:${string}`;
    sourceHashes[key] = sourceHashFromText(sourceText);
    return { sourcePath, sourceText, schemas: [row.schema] };
  });
  const r = buildRegistry(entries);
  if (!r.success) {
    throw new Error(
      `schema registry build failed: ${JSON.stringify(r.issues)}`,
    );
  }
  return { registry: r.data, irHashes, sourceHashes };
}

const WRONG_HASH = `sha256:${"0".repeat(64)}` as `sha256:${string}`;

/**
 * Construct a `MigrationEntry` with explicit hash control. Used
 * to set up bound / cosmetic_drift / drift / missing_endpoint
 * scenarios.
 */
function makeMigration(opts: {
  schemaId: string;
  fromVersion: string;
  toVersion: string;
  fromIrHash: `sha256:${string}`;
  toIrHash: `sha256:${string}`;
  fromSourceHash: `sha256:${string}`;
  toSourceHash: `sha256:${string}`;
}): MigrationEntry {
  const mig: AnyMigration = {
    schemaId: opts.schemaId,
    from: opts.fromVersion,
    to: opts.toVersion,
    transform: poisonTransform(),
  };
  return {
    schemaId: opts.schemaId,
    fromVersion: opts.fromVersion,
    toVersion: opts.toVersion,
    fromIrHash: opts.fromIrHash,
    toIrHash: opts.toIrHash,
    fromSourceHash: opts.fromSourceHash,
    toSourceHash: opts.toSourceHash,
    sourcePath: `migrations/${opts.schemaId.replace(/\./g, "_")}.${opts.fromVersion}-to-${opts.toVersion}.migration.ts`,
    migration: mig,
  };
}

/** Build a three-level `MigrationRegistry` directly from entries. */
function buildMigReg(
  entries: readonly MigrationEntry[],
): MigrationRegistry {
  const out = new Map<
    string,
    Map<string, Map<string, MigrationEntry>>
  >();
  for (const e of entries) {
    let byFrom = out.get(e.schemaId);
    if (byFrom === undefined) {
      byFrom = new Map();
      out.set(e.schemaId, byFrom);
    }
    let byTo = byFrom.get(e.fromVersion);
    if (byTo === undefined) {
      byTo = new Map();
      byFrom.set(e.fromVersion, byTo);
    }
    byTo.set(e.toVersion, e);
  }
  return out as MigrationRegistry;
}

// =============================================================================
// Shared fixture shapes
// =============================================================================

const SCHEMA_ID = "com.fix.runner.PreFlight";
const SCHEMA_ID_B = "com.fix.runner.PreFlight.B";

const v1 = s
  .object({ a: s.string() })
  .id(SCHEMA_ID)
  .version("1.0.0");
const v2_cosmetic = s
  .object({ a: s.string() })
  .id(SCHEMA_ID)
  .version("2.0.0");
const v2_additive = s
  .object({ a: s.string(), b: s.string().optional() })
  .id(SCHEMA_ID)
  .version("2.0.0");
const v2_breaking = s
  .object({ a: s.number() })
  .id(SCHEMA_ID)
  .version("2.0.0");
const v1_5_breaking = s
  .object({ a: s.number() })
  .id(SCHEMA_ID)
  .version("1.5.0");

// =============================================================================
// 1. null severity — from === to
// =============================================================================

// =============================================================================
// Public runtime-export gate (round-2 cleanup)
// =============================================================================
//
// Step 3 makes `src/index.ts` re-export `preFlight`. The direct-from-
// module tests below prove the IMPLEMENTATION is correct; this block
// proves the PUBLIC PACKAGE ENTRY actually exposes the same function.
// Without it, a future edit that drops the `export { preFlight }`
// line from `src/index.ts` would leave every other test green while
// silently breaking the consumer surface.

describe("preFlight — public-entry runtime export gate", () => {
  it("`@nekostack/migrate-runner`'s package entry re-exports `preFlight` identity-preserved", () => {
    expect(publicPreFlight).toBe(preFlight);
  });

  it("`preFlight` is a function at runtime", () => {
    expect(typeof publicPreFlight).toBe("function");
  });
});

describe("preFlight — null severity (from === to) no-op", () => {
  it("returns success with empty chain and no notes", () => {
    const { registry } = buildSchemaReg([
      { id: SCHEMA_ID, version: "1.0.0", schema: v1 },
    ]);
    const migReg = buildMigReg([]);

    const r = preFlight({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "1.0.0",
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.chain).toEqual([]);
    expect(r.notes).toEqual([]);
    expect(r.worstSeverity).toBeNull();
  });
});

// =============================================================================
// 2. cosmetic severity (version-only diff)
// =============================================================================

describe("preFlight — cosmetic severity no-op", () => {
  it("v1 → v2 with identical IR (only schemaVersion differs) succeeds with empty chain", () => {
    const { registry } = buildSchemaReg([
      { id: SCHEMA_ID, version: "1.0.0", schema: v1 },
      { id: SCHEMA_ID, version: "2.0.0", schema: v2_cosmetic },
    ]);
    const migReg = buildMigReg([]);

    const r = preFlight({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.chain).toEqual([]);
    expect(r.notes).toEqual([]);
    expect(r.worstSeverity).toBe("cosmetic");
  });
});

// =============================================================================
// 3. over_specified — cosmetic + exact migration
// =============================================================================

describe("preFlight — over_specified note", () => {
  it("cosmetic diff + exact migration → success + over_specified note + empty chain", () => {
    const { registry, irHashes, sourceHashes } = buildSchemaReg([
      { id: SCHEMA_ID, version: "1.0.0", schema: v1 },
      { id: SCHEMA_ID, version: "2.0.0", schema: v2_cosmetic },
    ]);
    const migReg = buildMigReg([
      makeMigration({
        schemaId: SCHEMA_ID,
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        fromIrHash: irHashes[`${SCHEMA_ID}@1.0.0`]!,
        toIrHash: irHashes[`${SCHEMA_ID}@2.0.0`]!,
        fromSourceHash: sourceHashes[`${SCHEMA_ID}@1.0.0`]!,
        toSourceHash: sourceHashes[`${SCHEMA_ID}@2.0.0`]!,
      }),
    ]);

    const r = preFlight({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.chain).toEqual([]);
    expect(r.notes).toHaveLength(1);
    expect(r.notes[0]!.kind).toBe("over_specified");
  });
});

// =============================================================================
// 4. additive_no_migration
// =============================================================================

describe("preFlight — additive_no_migration note", () => {
  it("additive diff + no migration → success + additive_no_migration note", () => {
    const { registry } = buildSchemaReg([
      { id: SCHEMA_ID, version: "1.0.0", schema: v1 },
      { id: SCHEMA_ID, version: "2.0.0", schema: v2_additive },
    ]);
    const migReg = buildMigReg([]);

    const r = preFlight({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.chain).toEqual([]);
    expect(r.notes).toHaveLength(1);
    expect(r.notes[0]!.kind).toBe("additive_no_migration");
    expect(r.worstSeverity).toBe("additive");
  });
});

// =============================================================================
// 5. additive + exact migration → chain[1]
// =============================================================================

describe("preFlight — additive + exact migration", () => {
  it("returns chain[1] with the registered migration", () => {
    const { registry, irHashes, sourceHashes } = buildSchemaReg([
      { id: SCHEMA_ID, version: "1.0.0", schema: v1 },
      { id: SCHEMA_ID, version: "2.0.0", schema: v2_additive },
    ]);
    const migReg = buildMigReg([
      makeMigration({
        schemaId: SCHEMA_ID,
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        fromIrHash: irHashes[`${SCHEMA_ID}@1.0.0`]!,
        toIrHash: irHashes[`${SCHEMA_ID}@2.0.0`]!,
        fromSourceHash: sourceHashes[`${SCHEMA_ID}@1.0.0`]!,
        toSourceHash: sourceHashes[`${SCHEMA_ID}@2.0.0`]!,
      }),
    ]);

    const r = preFlight({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.chain).toHaveLength(1);
    expect(r.chain[0]!.fromVersion).toBe("1.0.0");
    expect(r.chain[0]!.toVersion).toBe("2.0.0");
    expect(r.notes).toEqual([]);
  });
});

// =============================================================================
// 6. breaking + exact migration → chain[1]
// =============================================================================

describe("preFlight — breaking + exact migration", () => {
  it("returns chain[1] for a one-hop breaking transition", () => {
    const { registry, irHashes, sourceHashes } = buildSchemaReg([
      { id: SCHEMA_ID, version: "1.0.0", schema: v1 },
      { id: SCHEMA_ID, version: "2.0.0", schema: v2_breaking },
    ]);
    const migReg = buildMigReg([
      makeMigration({
        schemaId: SCHEMA_ID,
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        fromIrHash: irHashes[`${SCHEMA_ID}@1.0.0`]!,
        toIrHash: irHashes[`${SCHEMA_ID}@2.0.0`]!,
        fromSourceHash: sourceHashes[`${SCHEMA_ID}@1.0.0`]!,
        toSourceHash: sourceHashes[`${SCHEMA_ID}@2.0.0`]!,
      }),
    ]);

    const r = preFlight({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.chain).toHaveLength(1);
    expect(r.worstSeverity).toBe("breaking");
  });
});

// =============================================================================
// 7. breaking multi-hop → chain[2] in order
// =============================================================================

describe("preFlight — breaking multi-hop", () => {
  it("returns chain[2] with the hops in (from→to) order", () => {
    const { registry, irHashes, sourceHashes } = buildSchemaReg([
      { id: SCHEMA_ID, version: "1.0.0", schema: v1 },
      { id: SCHEMA_ID, version: "1.5.0", schema: v1_5_breaking },
      { id: SCHEMA_ID, version: "2.0.0", schema: v2_breaking },
    ]);
    const migReg = buildMigReg([
      makeMigration({
        schemaId: SCHEMA_ID,
        fromVersion: "1.0.0",
        toVersion: "1.5.0",
        fromIrHash: irHashes[`${SCHEMA_ID}@1.0.0`]!,
        toIrHash: irHashes[`${SCHEMA_ID}@1.5.0`]!,
        fromSourceHash: sourceHashes[`${SCHEMA_ID}@1.0.0`]!,
        toSourceHash: sourceHashes[`${SCHEMA_ID}@1.5.0`]!,
      }),
      makeMigration({
        schemaId: SCHEMA_ID,
        fromVersion: "1.5.0",
        toVersion: "2.0.0",
        fromIrHash: irHashes[`${SCHEMA_ID}@1.5.0`]!,
        toIrHash: irHashes[`${SCHEMA_ID}@2.0.0`]!,
        fromSourceHash: sourceHashes[`${SCHEMA_ID}@1.5.0`]!,
        toSourceHash: sourceHashes[`${SCHEMA_ID}@2.0.0`]!,
      }),
    ]);

    const r = preFlight({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.chain).toHaveLength(2);
    expect(r.chain[0]!.fromVersion).toBe("1.0.0");
    expect(r.chain[0]!.toVersion).toBe("1.5.0");
    expect(r.chain[1]!.fromVersion).toBe("1.5.0");
    expect(r.chain[1]!.toVersion).toBe("2.0.0");
    expect(r.versionPath).toEqual(["1.0.0", "1.5.0", "2.0.0"]);
  });
});

// =============================================================================
// 8. planner: migration_missing_endpoint
// =============================================================================

describe("preFlight — planner failures map to pre_flight_failed", () => {
  it("missing endpoint → pre_flight_failed + migration_missing_endpoint issue", () => {
    const { registry } = buildSchemaReg([
      // Only v1 — request v1→v2 cannot resolve.
      { id: SCHEMA_ID, version: "1.0.0", schema: v1 },
    ]);
    const migReg = buildMigReg([]);

    const r = preFlight({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.classification).toBe("pre_flight_failed");
    expect(r.issues.some((i) => i.code === "migration_missing_endpoint")).toBe(
      true,
    );
  });

  it("breaking + no migrations at all → pre_flight_failed + migration_not_found", () => {
    const { registry } = buildSchemaReg([
      { id: SCHEMA_ID, version: "1.0.0", schema: v1 },
      { id: SCHEMA_ID, version: "2.0.0", schema: v2_breaking },
    ]);
    const migReg = buildMigReg([]);

    const r = preFlight({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.classification).toBe("pre_flight_failed");
    expect(r.issues.some((i) => i.code === "migration_not_found")).toBe(true);
  });

  it("breaking + migration goes to unrelated version → pre_flight_failed + migration_chain_broken", () => {
    const { registry, irHashes, sourceHashes } = buildSchemaReg([
      { id: SCHEMA_ID, version: "1.0.0", schema: v1 },
      { id: SCHEMA_ID, version: "2.0.0", schema: v2_breaking },
    ]);
    // Migration goes v1→v3 (v3 not a vertex on any chain to v2).
    const migReg = buildMigReg([
      makeMigration({
        schemaId: SCHEMA_ID,
        fromVersion: "1.0.0",
        toVersion: "3.0.0",
        fromIrHash: irHashes[`${SCHEMA_ID}@1.0.0`]!,
        toIrHash: WRONG_HASH,
        fromSourceHash: sourceHashes[`${SCHEMA_ID}@1.0.0`]!,
        toSourceHash: WRONG_HASH,
      }),
    ]);

    const r = preFlight({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.classification).toBe("pre_flight_failed");
    expect(r.issues.some((i) => i.code === "migration_chain_broken")).toBe(
      true,
    );
  });

  it("breaking + multiple chains → pre_flight_failed + migration_ambiguous_chain", () => {
    const { registry, irHashes, sourceHashes } = buildSchemaReg([
      { id: SCHEMA_ID, version: "1.0.0", schema: v1 },
      { id: SCHEMA_ID, version: "1.5.0", schema: v1_5_breaking },
      { id: SCHEMA_ID, version: "2.0.0", schema: v2_breaking },
    ]);
    // Two chains exist: 1→2 (direct) AND 1→1.5→2.
    const migReg = buildMigReg([
      makeMigration({
        schemaId: SCHEMA_ID,
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        fromIrHash: irHashes[`${SCHEMA_ID}@1.0.0`]!,
        toIrHash: irHashes[`${SCHEMA_ID}@2.0.0`]!,
        fromSourceHash: sourceHashes[`${SCHEMA_ID}@1.0.0`]!,
        toSourceHash: sourceHashes[`${SCHEMA_ID}@2.0.0`]!,
      }),
      makeMigration({
        schemaId: SCHEMA_ID,
        fromVersion: "1.0.0",
        toVersion: "1.5.0",
        fromIrHash: irHashes[`${SCHEMA_ID}@1.0.0`]!,
        toIrHash: irHashes[`${SCHEMA_ID}@1.5.0`]!,
        fromSourceHash: sourceHashes[`${SCHEMA_ID}@1.0.0`]!,
        toSourceHash: sourceHashes[`${SCHEMA_ID}@1.5.0`]!,
      }),
      makeMigration({
        schemaId: SCHEMA_ID,
        fromVersion: "1.5.0",
        toVersion: "2.0.0",
        fromIrHash: irHashes[`${SCHEMA_ID}@1.5.0`]!,
        toIrHash: irHashes[`${SCHEMA_ID}@2.0.0`]!,
        fromSourceHash: sourceHashes[`${SCHEMA_ID}@1.5.0`]!,
        toSourceHash: sourceHashes[`${SCHEMA_ID}@2.0.0`]!,
      }),
    ]);

    const r = preFlight({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.classification).toBe("pre_flight_failed");
    expect(r.issues.some((i) => i.code === "migration_ambiguous_chain")).toBe(
      true,
    );
  });
});

// =============================================================================
// 12. Chain-scoped verification — unrelated broken migration outside chain
// =============================================================================

describe("preFlight — chain-scoped verification (not workspace-wide-then-filter)", () => {
  it("unrelated broken migration in the workspace does NOT fail a clean chain", () => {
    const v1_B = s.object({ x: s.string() }).id(SCHEMA_ID_B).version("1.0.0");
    const v2_B = s.object({ x: s.number() }).id(SCHEMA_ID_B).version("2.0.0");
    const { registry, irHashes, sourceHashes } = buildSchemaReg([
      { id: SCHEMA_ID, version: "1.0.0", schema: v1 },
      { id: SCHEMA_ID, version: "2.0.0", schema: v2_breaking },
      { id: SCHEMA_ID_B, version: "1.0.0", schema: v1_B },
      { id: SCHEMA_ID_B, version: "2.0.0", schema: v2_B },
    ]);

    // Schema A: bound. Schema B: drift (irHashes deliberately
    // wrong). Pre-flight is asked to plan A's chain — B's broken
    // migration is in the workspace registry but is OUT of the
    // chain-scoped registry and must not influence the result.
    const migReg = buildMigReg([
      makeMigration({
        schemaId: SCHEMA_ID,
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        fromIrHash: irHashes[`${SCHEMA_ID}@1.0.0`]!,
        toIrHash: irHashes[`${SCHEMA_ID}@2.0.0`]!,
        fromSourceHash: sourceHashes[`${SCHEMA_ID}@1.0.0`]!,
        toSourceHash: sourceHashes[`${SCHEMA_ID}@2.0.0`]!,
      }),
      makeMigration({
        schemaId: SCHEMA_ID_B,
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        fromIrHash: WRONG_HASH,
        toIrHash: WRONG_HASH,
        fromSourceHash: WRONG_HASH,
        toSourceHash: WRONG_HASH,
      }),
    ]);

    const r = preFlight({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.chain).toHaveLength(1);
    expect(r.chain[0]!.schemaId).toBe(SCHEMA_ID);
    // The chain-scoped registry contains ONLY schemaA's entry.
    expect(r.chainScopedRegistry.has(SCHEMA_ID)).toBe(true);
    expect(r.chainScopedRegistry.has(SCHEMA_ID_B)).toBe(false);
  });
});

// =============================================================================
// 13–14. cosmetic_drift behavior (default fail, opt-in pass)
// =============================================================================

describe("preFlight — cosmetic_drift handling (Decision #5 / OQ-5)", () => {
  function setupCosmeticDriftFixture() {
    const { registry, irHashes, sourceHashes } = buildSchemaReg([
      { id: SCHEMA_ID, version: "1.0.0", schema: v1 },
      { id: SCHEMA_ID, version: "2.0.0", schema: v2_breaking },
    ]);
    // irHashes match the schema registry → bound; sourceHashes
    // deliberately differ → cosmetic_drift.
    const migReg = buildMigReg([
      makeMigration({
        schemaId: SCHEMA_ID,
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        fromIrHash: irHashes[`${SCHEMA_ID}@1.0.0`]!,
        toIrHash: irHashes[`${SCHEMA_ID}@2.0.0`]!,
        fromSourceHash: WRONG_HASH,
        toSourceHash: WRONG_HASH,
      }),
    ]);
    void sourceHashes;
    return { registry, migReg };
  }

  it("cosmetic_drift fails by default (allowCosmeticDrift undefined)", () => {
    const { registry, migReg } = setupCosmeticDriftFixture();
    const r = preFlight({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.classification).toBe("pre_flight_failed");
    expect(r.issues.some((i) => i.code === "migration_cosmetic_drift")).toBe(
      true,
    );
  });

  it("cosmetic_drift fails when allowCosmeticDrift === false (explicit)", () => {
    const { registry, migReg } = setupCosmeticDriftFixture();
    const r = preFlight({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      allowCosmeticDrift: false,
    });
    expect(r.success).toBe(false);
  });

  it("cosmetic_drift passes when allowCosmeticDrift === true", () => {
    const { registry, migReg } = setupCosmeticDriftFixture();
    const r = preFlight({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      allowCosmeticDrift: true,
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.chain).toHaveLength(1);
  });
});

// =============================================================================
// 15. drift fails (irHash mismatch)
// =============================================================================

describe("preFlight — drift fails", () => {
  it("migration with wrong irHashes → pre_flight_failed + migration_drift", () => {
    const { registry, sourceHashes } = buildSchemaReg([
      { id: SCHEMA_ID, version: "1.0.0", schema: v1 },
      { id: SCHEMA_ID, version: "2.0.0", schema: v2_breaking },
    ]);
    // irHashes deliberately don't match the schema registry.
    const migReg = buildMigReg([
      makeMigration({
        schemaId: SCHEMA_ID,
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        fromIrHash: WRONG_HASH,
        toIrHash: WRONG_HASH,
        fromSourceHash: sourceHashes[`${SCHEMA_ID}@1.0.0`]!,
        toSourceHash: sourceHashes[`${SCHEMA_ID}@2.0.0`]!,
      }),
    ]);

    const r = preFlight({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.classification).toBe("pre_flight_failed");
    expect(r.issues.some((i) => i.code === "migration_drift")).toBe(true);
  });
});

// =============================================================================
// 16. verifier-side missing_endpoint (chain has intermediate not in registry)
// =============================================================================

describe("preFlight — verifier-side missing_endpoint", () => {
  it("chain with phantom intermediate vertex fails verification", () => {
    const { registry, irHashes, sourceHashes } = buildSchemaReg([
      // Only v1 and v2 are real schemas. The migrations below
      // claim a phantom v9 intermediate.
      { id: SCHEMA_ID, version: "1.0.0", schema: v1 },
      { id: SCHEMA_ID, version: "2.0.0", schema: v2_breaking },
    ]);
    const migReg = buildMigReg([
      makeMigration({
        schemaId: SCHEMA_ID,
        fromVersion: "1.0.0",
        toVersion: "9.9.9",
        fromIrHash: irHashes[`${SCHEMA_ID}@1.0.0`]!,
        toIrHash: WRONG_HASH,
        fromSourceHash: sourceHashes[`${SCHEMA_ID}@1.0.0`]!,
        toSourceHash: WRONG_HASH,
      }),
      makeMigration({
        schemaId: SCHEMA_ID,
        fromVersion: "9.9.9",
        toVersion: "2.0.0",
        fromIrHash: WRONG_HASH,
        toIrHash: irHashes[`${SCHEMA_ID}@2.0.0`]!,
        fromSourceHash: WRONG_HASH,
        toSourceHash: sourceHashes[`${SCHEMA_ID}@2.0.0`]!,
      }),
    ]);

    // Planner finds the chain [v1→v9.9.9, v9.9.9→v2]. Verifier-
    // side, findSchema for v9.9.9 returns undefined → verdict is
    // missing_endpoint.
    const r = preFlight({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.classification).toBe("pre_flight_failed");
    expect(
      r.issues.some((i) => i.code === "migration_missing_endpoint"),
    ).toBe(true);
  });
});

// =============================================================================
// Runtime sentinel — `migration.transform` is never invoked
// =============================================================================

describe("preFlight — v0.8 boundary: migration.transform is never invoked", () => {
  it("the throwing poison transform never fires across every fixture path", () => {
    // Every test above passes a `poisonTransform()` that throws if
    // called. If any of those tests ran without throwing, this
    // sentinel passes by construction. We re-assert the contract
    // by directly poisoning a fresh fixture and confirming the
    // happy path completes with no throw.
    const { registry, irHashes, sourceHashes } = buildSchemaReg([
      { id: SCHEMA_ID, version: "1.0.0", schema: v1 },
      { id: SCHEMA_ID, version: "2.0.0", schema: v2_breaking },
    ]);
    const migReg = buildMigReg([
      makeMigration({
        schemaId: SCHEMA_ID,
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        fromIrHash: irHashes[`${SCHEMA_ID}@1.0.0`]!,
        toIrHash: irHashes[`${SCHEMA_ID}@2.0.0`]!,
        fromSourceHash: sourceHashes[`${SCHEMA_ID}@1.0.0`]!,
        toSourceHash: sourceHashes[`${SCHEMA_ID}@2.0.0`]!,
      }),
    ]);

    expect(() =>
      preFlight({
        schemaRegistry: registry,
        migrationRegistry: migReg,
        schemaId: SCHEMA_ID,
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
      }),
    ).not.toThrow();
  });
});

// =============================================================================
// 17. Static-scan boundary on pre-flight.ts source
// =============================================================================

describe("preFlight — Step 3 source discipline (static scan)", () => {
  const SRC = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "src",
      "pre-flight.ts",
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
    // The v0.8 boundary: pre-flight is the runner's planning seam;
    // it MUST NOT invoke a migration's transform. The leading-dot
    // anchor matches a call (`x.transform(...)`) but not an object
    // literal `transform: ...` field — same convention used across
    // the schema-side handler-purity gate and the v0.8 CLI migrate
    // command scans.
    { name: ".transform(", pattern: /\.transform\s*\(/ },
  ];

  it.each(FORBIDDEN)(
    "pre-flight source contains no `$name`",
    ({ pattern }) => {
      expect(STRIPPED).not.toMatch(pattern);
    },
  );
});
