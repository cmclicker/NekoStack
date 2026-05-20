/**
 * Step 3 — `buildMigrationRegistry` gate tests.
 *
 * Covers:
 *   - empty input → empty registry, success
 *   - single migration indexes correctly
 *   - multiple schemaIds coexist
 *   - multiple outgoing edges from one fromVersion
 *   - sourcePath + migration object identity preserved
 *   - hashes come from the provenance header, not the migration
 *     default export (the two can disagree; the registry binds to
 *     the header)
 *   - duplicate triple → `duplicate_migration` issue
 *   - multiple duplicates collected without short-circuit
 *   - malformed provenance → `integrity_error` (forwarded from the
 *     parser, with `sourcePath` attached)
 *   - duplicates + malformed entries coexist in one failure result
 *   - never throws — every malformed entry returns Result.failure
 *   - static-scan purity (no fs / console / process / dynamic import)
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildMigrationRegistry } from "../../src/migrations/build-migration-registry.js";
import type {
  AnyMigration,
  MigrationRegistry,
  MigrationSourceEntry,
} from "../../src/migrations/types.js";

// =============================================================================
// Fixture helpers
// =============================================================================

const HASH_A =
  "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" as const;
const HASH_B =
  "sha256:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as const;
const HASH_C =
  "sha256:fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210" as const;
const HASH_D =
  "sha256:00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff" as const;

interface HeaderOpts {
  readonly schemaId?: string;
  readonly fromVersion?: string;
  readonly toVersion?: string;
  readonly fromIrHash?: string;
  readonly toIrHash?: string;
  readonly fromSourceHash?: string;
  readonly toSourceHash?: string;
  readonly generator?: string;
  readonly generatorVersion?: string;
}

function header(o: HeaderOpts = {}): string {
  return `/**
 * @migration by @nekostack/schema
 * schemaId:         ${o.schemaId ?? "com.x.User"}
 * fromVersion:      ${o.fromVersion ?? "1.0.0"}
 * toVersion:        ${o.toVersion ?? "2.0.0"}
 * fromIrHash:       ${o.fromIrHash ?? HASH_A}
 * toIrHash:         ${o.toIrHash ?? HASH_B}
 * fromSourceHash:   ${o.fromSourceHash ?? HASH_C}
 * toSourceHash:     ${o.toSourceHash ?? HASH_D}
 * generator:        ${o.generator ?? "neko-schema-migrate-stub"}
 * generatorVersion: ${o.generatorVersion ?? "@nekostack/schema@0.8.0"}
 */
export default {};
`;
}

function makeMigration(
  schemaId: string,
  from: string,
  to: string,
): AnyMigration {
  return {
    schemaId,
    from,
    to,
    transform: (input: unknown) => input,
  };
}

function entry(
  sourcePath: string,
  hdr: HeaderOpts,
  migration?: AnyMigration,
): MigrationSourceEntry {
  return {
    sourcePath,
    sourceText: header(hdr),
    migration:
      migration ??
      makeMigration(
        hdr.schemaId ?? "com.x.User",
        hdr.fromVersion ?? "1.0.0",
        hdr.toVersion ?? "2.0.0",
      ),
  };
}

function lookup(
  registry: MigrationRegistry,
  schemaId: string,
  from: string,
  to: string,
) {
  return registry.get(schemaId)?.get(from)?.get(to);
}

// =============================================================================
// Happy paths
// =============================================================================

describe("buildMigrationRegistry — happy paths", () => {
  it("returns an empty registry for an empty entry list", () => {
    const r = buildMigrationRegistry([]);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.size).toBe(0);
    }
  });

  it("indexes a single migration by `(schemaId, fromVersion, toVersion)`", () => {
    const r = buildMigrationRegistry([entry("a.migration.ts", {})]);
    expect(r.success).toBe(true);
    if (r.success) {
      const m = lookup(r.data, "com.x.User", "1.0.0", "2.0.0");
      expect(m).toBeDefined();
      expect(m!.schemaId).toBe("com.x.User");
      expect(m!.fromVersion).toBe("1.0.0");
      expect(m!.toVersion).toBe("2.0.0");
    }
  });

  it("indexes multiple schemaIds without collision", () => {
    const r = buildMigrationRegistry([
      entry("user.migration.ts", { schemaId: "com.x.User" }),
      entry("account.migration.ts", { schemaId: "com.x.Account" }),
    ]);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.size).toBe(2);
      expect(lookup(r.data, "com.x.User", "1.0.0", "2.0.0")).toBeDefined();
      expect(lookup(r.data, "com.x.Account", "1.0.0", "2.0.0")).toBeDefined();
    }
  });

  it("indexes multiple outgoing edges from one fromVersion", () => {
    // 1.0.0 → 2.0.0  and  1.0.0 → 3.0.0  both originate from 1.0.0.
    // The middle-level `Map<fromVersion, Map<toVersion, entry>>`
    // must hold both as siblings on the same inner map.
    const r = buildMigrationRegistry([
      entry("v1-to-v2.migration.ts", { toVersion: "2.0.0" }),
      entry("v1-to-v3.migration.ts", { toVersion: "3.0.0" }),
    ]);
    expect(r.success).toBe(true);
    if (r.success) {
      const inner = r.data.get("com.x.User")?.get("1.0.0");
      expect(inner?.size).toBe(2);
      expect(inner?.has("2.0.0")).toBe(true);
      expect(inner?.has("3.0.0")).toBe(true);
    }
  });

  it("preserves sourcePath verbatim on the indexed entry", () => {
    const r = buildMigrationRegistry([
      entry("schemas/migrations/user.1-0-0-to-2-0-0.migration.ts", {}),
    ]);
    expect(r.success).toBe(true);
    if (r.success) {
      const m = lookup(r.data, "com.x.User", "1.0.0", "2.0.0");
      expect(m!.sourcePath).toBe(
        "schemas/migrations/user.1-0-0-to-2-0-0.migration.ts",
      );
    }
  });

  it("preserves migration object identity", () => {
    const original = makeMigration("com.x.User", "1.0.0", "2.0.0");
    const r = buildMigrationRegistry([
      entry("user.migration.ts", {}, original),
    ]);
    expect(r.success).toBe(true);
    if (r.success) {
      const m = lookup(r.data, "com.x.User", "1.0.0", "2.0.0");
      expect(m!.migration).toBe(original);
    }
  });

  it("uses hashes from the provenance header (not from migration default-export)", () => {
    // The registry binds to *recorded provenance*, not the
    // runtime-loaded `migration` value. Construct an entry where
    // the header carries known hashes and assert they round-trip
    // verbatim — including their sha256-branded shape.
    const r = buildMigrationRegistry([
      entry("a.migration.ts", {
        fromIrHash: HASH_A,
        toIrHash: HASH_B,
        fromSourceHash: HASH_C,
        toSourceHash: HASH_D,
      }),
    ]);
    expect(r.success).toBe(true);
    if (r.success) {
      const m = lookup(r.data, "com.x.User", "1.0.0", "2.0.0");
      expect(m!.fromIrHash).toBe(HASH_A);
      expect(m!.toIrHash).toBe(HASH_B);
      expect(m!.fromSourceHash).toBe(HASH_C);
      expect(m!.toSourceHash).toBe(HASH_D);
    }
  });
});

// =============================================================================
// Duplicate detection
// =============================================================================

describe("buildMigrationRegistry — duplicate detection", () => {
  it("duplicate `(schemaId, fromVersion, toVersion)` returns `duplicate_migration`", () => {
    const r = buildMigrationRegistry([
      entry("a.migration.ts", {}),
      entry("b.migration.ts", {}),
    ]);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues).toHaveLength(1);
      const issue = r.issues[0]!;
      expect(issue.code).toBe("duplicate_migration");
      expect(issue.severity).toBe("error");
      expect(issue.message).toContain("com.x.User");
      expect(issue.message).toContain("1.0.0");
      expect(issue.message).toContain("2.0.0");
      expect(issue.metadata?.schemaId).toBe("com.x.User");
      expect(issue.metadata?.fromVersion).toBe("1.0.0");
      expect(issue.metadata?.toVersion).toBe("2.0.0");
      expect(issue.metadata?.sourcePaths).toEqual([
        "a.migration.ts",
        "b.migration.ts",
      ]);
    }
  });

  it("collects multiple distinct duplicates without short-circuit", () => {
    const r = buildMigrationRegistry([
      entry("user-a.migration.ts", { schemaId: "com.x.User" }),
      entry("user-b.migration.ts", { schemaId: "com.x.User" }),
      entry("account-a.migration.ts", { schemaId: "com.x.Account" }),
      entry("account-b.migration.ts", { schemaId: "com.x.Account" }),
    ]);
    expect(r.success).toBe(false);
    if (!r.success) {
      const dupCodes = r.issues.filter(
        (i) => i.code === "duplicate_migration",
      );
      expect(dupCodes).toHaveLength(2);
      const schemaIds = dupCodes
        .map((i) => i.metadata?.schemaId as string)
        .sort();
      expect(schemaIds).toEqual(["com.x.Account", "com.x.User"]);
    }
  });

  it("triples that share only `(schemaId, fromVersion)` are NOT duplicates", () => {
    // Same schemaId, same fromVersion, different toVersion → two
    // legal outgoing edges, not a duplicate.
    const r = buildMigrationRegistry([
      entry("a.migration.ts", { toVersion: "2.0.0" }),
      entry("b.migration.ts", { toVersion: "3.0.0" }),
    ]);
    expect(r.success).toBe(true);
  });
});

// =============================================================================
// Malformed provenance forwarding
// =============================================================================

describe("buildMigrationRegistry — malformed provenance", () => {
  it("forwards `integrity_error` Issues with the offending sourcePath attached", () => {
    const r = buildMigrationRegistry([
      {
        sourcePath: "bad.migration.ts",
        sourceText: "export default {};",
        migration: makeMigration("com.x.User", "1.0.0", "2.0.0"),
      },
    ]);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues[0]!.code).toBe("integrity_error");
      // Re-keyed to the source path so the CLI can locate the bad file.
      expect(r.issues[0]!.path).toEqual(["bad.migration.ts"]);
      expect(r.issues[0]!.metadata?.sourcePath).toBe("bad.migration.ts");
    }
  });

  it("does NOT silently skip malformed entries — every malformed file produces an Issue", () => {
    const r = buildMigrationRegistry([
      {
        sourcePath: "x.migration.ts",
        sourceText: "// no header",
        migration: makeMigration("com.x.User", "1.0.0", "2.0.0"),
      },
      {
        sourcePath: "y.migration.ts",
        sourceText: "/** missing fields */\nexport default {};\n",
        migration: makeMigration("com.x.User", "2.0.0", "3.0.0"),
      },
    ]);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues).toHaveLength(2);
      const paths = r.issues.map((i) => i.path[0]).sort();
      expect(paths).toEqual(["x.migration.ts", "y.migration.ts"]);
    }
  });

  it("collects malformed + duplicate issues together (no short-circuit)", () => {
    const r = buildMigrationRegistry([
      entry("good-a.migration.ts", {}),
      entry("good-b.migration.ts", {}), // duplicate of good-a
      {
        sourcePath: "bad.migration.ts",
        sourceText: "not a JSDoc block",
        migration: makeMigration("com.x.User", "1.0.0", "2.0.0"),
      },
    ]);
    expect(r.success).toBe(false);
    if (!r.success) {
      const codes = r.issues.map((i) => i.code).sort();
      expect(codes).toEqual(["duplicate_migration", "integrity_error"]);
    }
  });
});

// =============================================================================
// Throw discipline
// =============================================================================

describe("buildMigrationRegistry — never throws", () => {
  it.each([
    [""],
    ["// no header"],
    ["/** unterminated"],
    ["{}"],
    ["/**\n * schemaId: x\n */\n"],
  ])("does not throw on malformed sourceText %#", (sourceText) => {
    expect(() =>
      buildMigrationRegistry([
        {
          sourcePath: "x.migration.ts",
          sourceText,
          migration: makeMigration("com.x.User", "1.0.0", "2.0.0"),
        },
      ]),
    ).not.toThrow();
  });
});

// =============================================================================
// Deterministic lookup shape
// =============================================================================

describe("buildMigrationRegistry — registry shape", () => {
  it("is a three-level ReadonlyMap (schemaId → fromVersion → toVersion → entry)", () => {
    const r = buildMigrationRegistry([entry("a.migration.ts", {})]);
    expect(r.success).toBe(true);
    if (r.success) {
      // Outer level — keyed by schemaId.
      const outer = r.data;
      expect(outer instanceof Map).toBe(true);
      expect([...outer.keys()]).toEqual(["com.x.User"]);
      // Middle level — keyed by fromVersion.
      const middle = outer.get("com.x.User")!;
      expect(middle instanceof Map).toBe(true);
      expect([...middle.keys()]).toEqual(["1.0.0"]);
      // Inner level — keyed by toVersion → entry.
      const inner = middle.get("1.0.0")!;
      expect(inner instanceof Map).toBe(true);
      expect([...inner.keys()]).toEqual(["2.0.0"]);
    }
  });
});

// =============================================================================
// Side-effect discipline — static-scan
// =============================================================================

describe("build-migration-registry source — side-effect discipline (static-scan)", () => {
  const SRC = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "src",
      "migrations",
      "build-migration-registry.ts",
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
    "build-migration-registry source does not call `$name`",
    ({ pattern }) => {
      expect(STRIPPED).not.toMatch(pattern);
    },
  );
});
