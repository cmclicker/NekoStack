/**
 * Step 8 — `planMigrationHandler` gate tests.
 *
 * The handler is a thin wrapper around `planMigration`, so the test
 * surface is small and focused on the pass-through contract:
 *
 *   - success payloads forward unchanged
 *   - failure payloads forward unchanged (per Issue code class)
 *   - `PlanNote`s (over_specified / additive_no_migration) reach
 *     the caller without alteration
 *   - `UnsupportedNodeKindError` thrown by `diffNodes` propagates
 *     out of the handler (no swallow / no remap)
 *   - registries are not mutated
 *   - `migration.transform` is never invoked
 *   - static-scan purity (no fs / process / console / dynamic import)
 *
 * Detailed branch coverage for `planMigration` itself lives in
 * `plan-migration.test.ts`. This file deliberately covers each
 * branch only once to confirm the wrapper doesn't drop or rewrite
 * anything.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { s } from "../../../src/index.js";
import type { AnySchema } from "../../../src/index.js";
import {
  buildRegistry,
  type Registry,
  type RegistrySourceEntry,
} from "../../../src/cli-integration.js";
import { buildMigrationRegistry } from "../../../src/migrations/build-migration-registry.js";
import { planMigrationHandler } from "../../../src/migrations/handlers/plan.js";
import type {
  AnyMigration,
  MigrationRegistry,
  MigrationSourceEntry,
} from "../../../src/migrations/types.js";
import { UnsupportedNodeKindError } from "../../../src/generators/errors.js";
import type { SchemaNode } from "../../../src/ir/nodes.js";
import type { RegistryEntry } from "../../../src/registry/types.js";

// =============================================================================
// Fixtures — three User versions covering the breaking and additive paths
// =============================================================================

const SCHEMA_ID = "com.fixture.plan-handler.User";

const v1 = s
  .object({ id: s.string(), name: s.string() })
  .id(SCHEMA_ID)
  .version("1.0.0");
const v2 = s
  .object({ id: s.string(), name: s.string(), email: s.string().optional() })
  .id(SCHEMA_ID)
  .version("2.0.0");
const v3 = s.object({ id: s.string() }).id(SCHEMA_ID).version("3.0.0");

const VALID_HASH =
  "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" as const;

const NEVER_CALLED = (_input: unknown): never => {
  throw new Error(
    "Sentinel: planMigrationHandler must never invoke migration.transform",
  );
};

function buildSchemaRegistry(...schemas: readonly AnySchema[]): Registry {
  const entries: RegistrySourceEntry[] = schemas.map((schema, i) => ({
    sourcePath: `fixture-${i}.schema.ts`,
    sourceText: `// fixture ${i}\n`,
    schemas: [schema],
  }));
  const r = buildRegistry(entries);
  if (!r.success) throw new Error("buildRegistry failed in test setup");
  return r.data;
}

function migrationSource(opts: {
  schemaId?: string;
  from: string;
  to: string;
}): MigrationSourceEntry {
  const schemaId = opts.schemaId ?? SCHEMA_ID;
  const migration: AnyMigration = {
    schemaId,
    from: opts.from,
    to: opts.to,
    transform: NEVER_CALLED,
  };
  return {
    sourcePath: `${schemaId}.${opts.from}-to-${opts.to}.migration.ts`,
    sourceText: `/**
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
`,
    migration,
  };
}

function buildMigRegistry(
  ...defs: { schemaId?: string; from: string; to: string }[]
): MigrationRegistry {
  const r = buildMigrationRegistry(defs.map(migrationSource));
  if (!r.success) throw new Error("buildMigrationRegistry failed in test setup");
  return r.data;
}

// =============================================================================
// Pass-through contract
// =============================================================================

describe("planMigrationHandler — pass-through", () => {
  it("success forwards unchanged (no-change branch)", () => {
    const r = planMigrationHandler({
      schemaRegistry: buildSchemaRegistry(v1),
      migrationRegistry: buildMigRegistry(),
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "1.0.0",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.worstSeverity).toBeNull();
      expect(r.data.chain).toEqual([]);
      expect(r.data.notes).toEqual([]);
    }
  });

  it("success forwards unchanged (breaking with exact chain)", () => {
    const r = planMigrationHandler({
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

  it("`additive_no_migration` note passes through", () => {
    const r = planMigrationHandler({
      schemaRegistry: buildSchemaRegistry(v1, v2),
      migrationRegistry: buildMigRegistry(),
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.worstSeverity).toBe("additive");
      expect(r.data.notes).toHaveLength(1);
      expect(r.data.notes[0]!.kind).toBe("additive_no_migration");
    }
  });

  it("`over_specified` note passes through (cosmetic + exact migration)", () => {
    // Two stable versions with metadata-only divergence → cosmetic.
    const stableId = "com.fixture.plan-handler.Stable";
    const s1 = s
      .object({ id: s.string() })
      .id(stableId)
      .version("1.0.0")
      .describe("first");
    const s2 = s
      .object({ id: s.string() })
      .id(stableId)
      .version("2.0.0")
      .describe("second");
    const r = planMigrationHandler({
      schemaRegistry: buildSchemaRegistry(s1, s2),
      migrationRegistry: buildMigRegistry({
        schemaId: stableId,
        from: "1.0.0",
        to: "2.0.0",
      }),
      schemaId: stableId,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.worstSeverity).toBe("cosmetic");
      expect(r.data.chain).toEqual([]);
      expect(r.data.notes).toHaveLength(1);
      expect(r.data.notes[0]!.kind).toBe("over_specified");
    }
  });

  it("failure forwards unchanged (missing endpoint)", () => {
    const r = planMigrationHandler({
      schemaRegistry: buildSchemaRegistry(v1),
      migrationRegistry: buildMigRegistry(),
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "9.9.9",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues[0]!.code).toBe("migration_missing_endpoint");
    }
  });

  it("failure forwards unchanged (chain broken)", () => {
    // v1 → v3 is breaking; the only registered migration is 2→3,
    // so no path bridges 1 → 3.
    const r = planMigrationHandler({
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
});

// =============================================================================
// UnsupportedNodeKindError propagation
// =============================================================================

describe("planMigrationHandler — fail-loud propagation", () => {
  it("propagates `UnsupportedNodeKindError` from `diffNodes`", () => {
    // Construct a synthetic Registry whose entries have unsupported
    // IR kinds. `findSchema` returns these entries; the planner
    // hands their `.schema.node` to `diffNodes`, which throws. The
    // handler must NOT catch.
    const unsupportedNode = {
      kind: "union",
      options: [],
    } as unknown as SchemaNode;
    const fakeSchema = { node: unsupportedNode } as unknown as AnySchema;
    const fakeEntry: RegistryEntry = {
      schemaId: SCHEMA_ID,
      schemaVersion: "1.0.0",
      irHash: VALID_HASH,
      sourceHash: VALID_HASH,
      sourcePath: "synthetic.schema.ts",
      schema: fakeSchema,
    };
    const fakeEntry2: RegistryEntry = {
      ...fakeEntry,
      schemaVersion: "2.0.0",
      sourcePath: "synthetic-v2.schema.ts",
    };
    const inner = new Map<string, RegistryEntry>([
      ["1.0.0", fakeEntry],
      ["2.0.0", fakeEntry2],
    ]);
    const registry: Registry = new Map([[SCHEMA_ID, inner]]);

    expect(() =>
      planMigrationHandler({
        schemaRegistry: registry,
        migrationRegistry: buildMigRegistry(),
        schemaId: SCHEMA_ID,
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
      }),
    ).toThrow(UnsupportedNodeKindError);
  });
});

// =============================================================================
// Non-mutation + transform invariant
// =============================================================================

describe("planMigrationHandler — invariants", () => {
  it("does not mutate the input registries", () => {
    const schemaRegistry = buildSchemaRegistry(v1, v2, v3);
    const migrationRegistry = buildMigRegistry(
      { from: "1.0.0", to: "2.0.0" },
      { from: "2.0.0", to: "3.0.0" },
    );

    const schemaIdsBefore = [...schemaRegistry.keys()];
    const migrationKeysBefore = [...migrationRegistry.keys()];

    planMigrationHandler({
      schemaRegistry,
      migrationRegistry,
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "3.0.0",
    });

    expect([...schemaRegistry.keys()]).toEqual(schemaIdsBefore);
    expect([...migrationRegistry.keys()]).toEqual(migrationKeysBefore);
  });

  it("never invokes `migration.transform` (sentinel throws if called)", () => {
    // Every migration uses NEVER_CALLED. If the handler reaches
    // inside any entry's `transform`, this test crashes.
    const r = planMigrationHandler({
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
  });
});

// =============================================================================
// Side-effect discipline — static-scan
// =============================================================================

describe("plan-handler source — side-effect discipline (static-scan)", () => {
  const SRC = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "..",
      "src",
      "migrations",
      "handlers",
      "plan.ts",
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
    "plan-handler source does not call `$name`",
    ({ pattern }) => {
      expect(STRIPPED).not.toMatch(pattern);
    },
  );
});
