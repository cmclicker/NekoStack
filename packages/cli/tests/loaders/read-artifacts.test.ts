/**
 * Step 24 — `read-artifacts.ts` gate tests.
 *
 * Covers:
 *   - reads all four locked artifact-name suffixes
 *   - recurses into nested subdirectories
 *   - reads multi-schema discriminated paths (Decision #6)
 *   - ignores non-artifact filenames in the same directory
 *   - empty directory returns `[]`
 *   - missing directory returns `[]` (no throw)
 *   - reads content verbatim as UTF-8
 *   - paths are `generatedDir`-relative and forward-slash-normalized
 *   - deterministic alphabetical ordering
 *   - static-scan: source carries no `console.*`, `process.exit`, or
 *     stdout/stderr writes
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  ARTIFACT_SUFFIXES,
  loadCommittedArtifacts,
} from "../../src/loaders/read-artifacts.js";

const FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
  "read-artifacts",
);

const fixture = (name: string): string => join(FIXTURES, name);

// =============================================================================
// Happy paths
// =============================================================================

describe("loadCommittedArtifacts — happy paths", () => {
  it("reads all four artifact-name suffixes in a single directory", async () => {
    const arts = await loadCommittedArtifacts(fixture("all-kinds"));
    expect(arts).toHaveLength(4);
    const paths = arts.map((a) => a.path).sort();
    expect(paths).toEqual([
      "tenant.json.schema.json",
      "tenant.openapi.json",
      "tenant.types.ts",
      "tenant.zod.ts",
    ]);
  });

  it("recurses into nested subdirectories", async () => {
    const arts = await loadCommittedArtifacts(fixture("nested"));
    const paths = arts.map((a) => a.path);
    expect(paths).toContain("outer.types.ts");
    expect(paths).toContain("sub/deep/inner.zod.ts");
  });

  it("reads multi-schema discriminated paths", async () => {
    const arts = await loadCommittedArtifacts(fixture("multi-discriminated"));
    expect(arts).toHaveLength(2);
    const paths = arts.map((a) => a.path).sort();
    expect(paths).toEqual([
      "account.com-x-auditevent.openapi.json",
      "account.com-x-tenant.types.ts",
    ]);
  });

  it("returns paths in deterministic ascending order", async () => {
    const arts = await loadCommittedArtifacts(fixture("all-kinds"));
    const paths = arts.map((a) => a.path);
    expect(paths).toEqual([...paths].sort());
  });

  it("ARTIFACT_SUFFIXES is the documented four-kind list", () => {
    expect([...ARTIFACT_SUFFIXES]).toEqual([
      ".types.ts",
      ".zod.ts",
      ".json.schema.json",
      ".openapi.json",
    ]);
  });
});

// =============================================================================
// Content and path preservation
// =============================================================================

describe("loadCommittedArtifacts — content + path preservation", () => {
  it("reads content verbatim as UTF-8", async () => {
    const arts = await loadCommittedArtifacts(fixture("all-kinds"));
    const ts = arts.find((a) => a.path === "tenant.types.ts");
    expect(ts).toBeDefined();
    const onDisk = readFileSync(fixture("all-kinds/tenant.types.ts"), "utf8");
    expect(ts!.content).toBe(onDisk);
  });

  it("paths are forward-slash-normalized and relative to generatedDir", async () => {
    const arts = await loadCommittedArtifacts(fixture("nested"));
    for (const a of arts) {
      expect(a.path).not.toContain("\\");
      expect(a.path.startsWith("/")).toBe(false);
      expect(/^[A-Za-z]:/.test(a.path)).toBe(false);
    }
  });
});

// =============================================================================
// Edge cases
// =============================================================================

describe("loadCommittedArtifacts — edge cases", () => {
  it("ignores non-artifact filenames in the same directory", async () => {
    const arts = await loadCommittedArtifacts(fixture("ignores"));
    // Only `valid.types.ts` should appear; README.md / random.txt /
    // plain.ts must not.
    expect(arts).toHaveLength(1);
    expect(arts[0]!.path).toBe("valid.types.ts");
  });

  it("empty directory returns []", async () => {
    const arts = await loadCommittedArtifacts(fixture("empty"));
    expect(arts).toEqual([]);
  });

  it("missing directory returns [] (no throw)", async () => {
    const arts = await loadCommittedArtifacts(
      fixture("definitely-does-not-exist"),
    );
    expect(arts).toEqual([]);
  });

  it("path that's a regular file (not a dir) returns []", async () => {
    const arts = await loadCommittedArtifacts(
      fixture("all-kinds/tenant.types.ts"),
    );
    expect(arts).toEqual([]);
  });
});

// =============================================================================
// Side-effect discipline (static scan)
// =============================================================================

describe("loadCommittedArtifacts — side-effect discipline (static-scan)", () => {
  const SRC = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "src",
      "loaders",
      "read-artifacts.ts",
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
  ];

  it.each(FORBIDDEN)(
    "read-artifacts source does not call `$name`",
    ({ pattern }) => {
      expect(STRIPPED).not.toMatch(pattern);
    },
  );
});
