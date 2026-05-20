/**
 * Step 2 — `parseMigrationProvenanceFromText` gate tests.
 *
 * Covers:
 *   - happy paths: parses every required field; tolerates whitespace
 *     alignment; handles prerelease/build version strings; preserves
 *     sha256-prefixed hash branding.
 *   - failure paths: unknown_format / missing_migration_provenance /
 *     missing_field (each required field) / malformed_hash (each
 *     hash field) / malformed_field (empty value).
 *   - never throws — every malformed input returns Result.failure.
 *   - static-scan purity: source carries no `fs.*`, `console.*`,
 *     `process.exit`, or stdio writes.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  parseMigrationProvenanceFromText,
  type ParsedMigrationProvenance,
} from "../../src/migrations/parse-provenance.js";

// =============================================================================
// Header builder — keeps the fixture string in one place
// =============================================================================

const VALID_HASH =
  "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" as const;
const OTHER_HASH =
  "sha256:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as const;
const THIRD_HASH =
  "sha256:fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210" as const;
const FOURTH_HASH =
  "sha256:00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff" as const;

interface HeaderOverrides {
  readonly schemaId?: string;
  readonly fromVersion?: string;
  readonly toVersion?: string;
  readonly fromIrHash?: string;
  readonly toIrHash?: string;
  readonly fromSourceHash?: string;
  readonly toSourceHash?: string;
  readonly generator?: string;
  readonly generatorVersion?: string;
  readonly omit?: keyof Omit<HeaderOverrides, "omit" | "extraBody">;
  readonly extraBody?: string;
}

function header(overrides: HeaderOverrides = {}): string {
  const lines: Array<readonly [string, string]> = [
    ["schemaId", overrides.schemaId ?? "com.x.User"],
    ["fromVersion", overrides.fromVersion ?? "1.0.0"],
    ["toVersion", overrides.toVersion ?? "2.0.0"],
    ["fromIrHash", overrides.fromIrHash ?? VALID_HASH],
    ["toIrHash", overrides.toIrHash ?? OTHER_HASH],
    ["fromSourceHash", overrides.fromSourceHash ?? THIRD_HASH],
    ["toSourceHash", overrides.toSourceHash ?? FOURTH_HASH],
    ["generator", overrides.generator ?? "neko-schema-migrate-stub"],
    ["generatorVersion", overrides.generatorVersion ?? "@nekostack/schema@0.8.0"],
  ];
  const body =
    "/**\n * @migration by @nekostack/schema\n" +
    lines
      .filter(([k]) => k !== overrides.omit)
      .map(([k, v]) => ` * ${k}: ${v}`)
      .join("\n") +
    "\n *\n * DO NOT REMOVE THE HEADER.\n */\n" +
    (overrides.extraBody ?? "export default {};\n");
  return body;
}

// =============================================================================
// Happy paths
// =============================================================================

describe("parseMigrationProvenanceFromText — happy paths", () => {
  it("parses a fully-populated valid header", () => {
    const r = parseMigrationProvenanceFromText(header());
    expect(r.success).toBe(true);
    if (r.success) {
      const expected: ParsedMigrationProvenance = {
        generator: "neko-schema-migrate-stub",
        generatorVersion: "@nekostack/schema@0.8.0",
        schemaId: "com.x.User",
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        fromIrHash: VALID_HASH,
        toIrHash: OTHER_HASH,
        fromSourceHash: THIRD_HASH,
        toSourceHash: FOURTH_HASH,
      };
      expect(r.data).toEqual(expected);
    }
  });

  it("tolerates aligned-padding whitespace between key and value", () => {
    // The stub generator pads values for visual alignment. The
    // JSDoc field regex collapses arbitrary whitespace after the
    // colon, so this must parse identically to the un-padded form.
    const padded = `/**
 * @migration by @nekostack/schema
 * schemaId:         com.x.User
 * fromVersion:      1.0.0
 * toVersion:        2.0.0
 * fromIrHash:       ${VALID_HASH}
 * toIrHash:         ${OTHER_HASH}
 * fromSourceHash:   ${THIRD_HASH}
 * toSourceHash:     ${FOURTH_HASH}
 * generator:        neko-schema-migrate-stub
 * generatorVersion: @nekostack/schema@0.8.0
 */
export default {};
`;
    const r = parseMigrationProvenanceFromText(padded);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.schemaId).toBe("com.x.User");
      expect(r.data.fromVersion).toBe("1.0.0");
      expect(r.data.toVersion).toBe("2.0.0");
    }
  });

  it("preserves prerelease and build versions as plain strings", () => {
    const r = parseMigrationProvenanceFromText(
      header({ fromVersion: "1.0.0-beta.1", toVersion: "2.0.0+build.5" }),
    );
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.fromVersion).toBe("1.0.0-beta.1");
      expect(r.data.toVersion).toBe("2.0.0+build.5");
    }
  });

  it("preserves sha256-branded hash type for every hash field", () => {
    const r = parseMigrationProvenanceFromText(header());
    expect(r.success).toBe(true);
    if (r.success) {
      for (const v of [
        r.data.fromIrHash,
        r.data.toIrHash,
        r.data.fromSourceHash,
        r.data.toSourceHash,
      ]) {
        expect(v).toMatch(/^sha256:[0-9a-f]{64}$/);
      }
    }
  });

  it("ignores leading whitespace before the JSDoc block", () => {
    const r = parseMigrationProvenanceFromText("\n\n  " + header());
    expect(r.success).toBe(true);
  });
});

// =============================================================================
// Failure paths
// =============================================================================

describe("parseMigrationProvenanceFromText — failure paths", () => {
  it("returns `unknown_format` when the file does not start with `/**`", () => {
    const r = parseMigrationProvenanceFromText(
      "export default { schemaId: 'x' };\n",
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues).toHaveLength(1);
      expect(r.issues[0]!.code).toBe("integrity_error");
      expect(r.issues[0]!.metadata?.reason).toBe("unknown_format");
    }
  });

  it("returns `missing_migration_provenance` when the JSDoc block is unterminated", () => {
    const r = parseMigrationProvenanceFromText(
      "/** schemaId: com.x.User\nexport default {};\n",
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues[0]!.metadata?.reason).toBe("missing_migration_provenance");
    }
  });

  it.each([
    "schemaId",
    "fromVersion",
    "toVersion",
    "fromIrHash",
    "toIrHash",
    "fromSourceHash",
    "toSourceHash",
    "generator",
    "generatorVersion",
  ] as const)("returns `missing_field` when `%s` is absent", (omit) => {
    const r = parseMigrationProvenanceFromText(header({ omit }));
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues[0]!.code).toBe("integrity_error");
      expect(r.issues[0]!.metadata?.reason).toBe("missing_field");
      expect(r.issues[0]!.message).toContain(omit);
    }
  });

  it.each([
    "fromIrHash",
    "toIrHash",
    "fromSourceHash",
    "toSourceHash",
  ] as const)("returns `malformed_hash` when `%s` is not a sha256 string", (field) => {
    const r = parseMigrationProvenanceFromText(
      header({ [field]: "not-a-hash" } as HeaderOverrides),
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues[0]!.metadata?.reason).toBe("malformed_hash");
      expect(r.issues[0]!.message).toContain(field);
    }
  });

  it("returns `malformed_hash` for a too-short hex digest", () => {
    const r = parseMigrationProvenanceFromText(
      header({ fromIrHash: "sha256:deadbeef" }),
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues[0]!.metadata?.reason).toBe("malformed_hash");
    }
  });

  it("returns `malformed_hash` for the wrong digest prefix", () => {
    const r = parseMigrationProvenanceFromText(
      header({
        fromIrHash:
          "md5:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      }),
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues[0]!.metadata?.reason).toBe("malformed_hash");
    }
  });
});

// =============================================================================
// Throw discipline
// =============================================================================

describe("parseMigrationProvenanceFromText — never throws", () => {
  it.each([
    [""],
    ["// just a comment"],
    ["{}"],
    ["null"],
    ["/** unterminated"],
    ["/** missing fields */\nexport default {};"],
    ["/**\n * schemaId: \n */\n"],
  ])("does not throw on malformed input %#", (input) => {
    expect(() => parseMigrationProvenanceFromText(input)).not.toThrow();
    const r = parseMigrationProvenanceFromText(input);
    expect(r.success).toBe(false);
  });
});

// =============================================================================
// Issue shape
// =============================================================================

describe("parseMigrationProvenanceFromText — Issue shape", () => {
  it("every failure produces exactly one `integrity_error` Issue with metadata.reason", () => {
    const r = parseMigrationProvenanceFromText("garbage");
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.issues).toHaveLength(1);
      const issue = r.issues[0]!;
      expect(issue.code).toBe("integrity_error");
      expect(issue.severity).toBe("error");
      expect(issue.path).toEqual([]);
      expect(typeof issue.metadata?.reason).toBe("string");
    }
  });
});

// =============================================================================
// Side-effect discipline — static-scan
// =============================================================================

describe("parse-provenance source — side-effect discipline (static-scan)", () => {
  const SRC = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "src",
      "migrations",
      "parse-provenance.ts",
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
    "parse-provenance source does not call `$name`",
    ({ pattern }) => {
      expect(STRIPPED).not.toMatch(pattern);
    },
  );
});
