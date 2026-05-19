/**
 * Step 22 — `tsx-loader.ts` gate tests.
 *
 * Verifies the loader's four failure classifications + happy paths:
 *
 *   - happy paths   — one schema / multiple schemas / Schema + non-Schema exports
 *   - failure       — file does not exist (`io_error`)
 *   - failure       — directory passed as path (`io_error`)
 *   - failure       — module throws at evaluation (`runtime_error`)
 *   - failure       — compile-error source (`compile_error`)
 *   - failure       — module exposes zero Schema instances (`no_schema_export`)
 *   - silence       — static-scan asserts the source carries no
 *                     `console.*`, `process.exit`, or stdout/stderr
 *                     write calls. Runtime spies are deliberately
 *                     avoided: vitest's own reporter writes through
 *                     `process.stderr.write`, so replacing that
 *                     implementation hangs the run. The schema-side
 *                     handler-purity gate makes the same omission.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadSchemaModule } from "../../src/loaders/tsx-loader.js";

const FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
  "tsx-loader",
);

function fixture(name: string): string {
  return join(FIXTURES, name);
}

// =============================================================================
// Happy paths
// =============================================================================

describe("tsx-loader — happy paths", () => {
  it("loads a single-schema fixture and returns the schema", async () => {
    const r = await loadSchemaModule(fixture("one-schema.schema.ts"));
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.path).toBe(fixture("one-schema.schema.ts"));
    expect(r.data.schemas).toHaveLength(1);
    expect(r.data.schemas[0]!.node.metadata?.id).toBe(
      "com.fixture.tsx-loader.User",
    );
    expect(r.data.schemas[0]!.node.metadata?.version).toBe("1.0.0");
  });

  it("loads a multi-schema fixture (sorted ascending by schemaId)", async () => {
    // The loader sorts results by `schemaId` before returning, so the
    // order is stable across ESM runtimes (plain Node + tsx returns
    // alphabetical-by-export-name; vitest's worker returns declaration
    // order). After sorting by schemaId, both environments produce
    // the same `Account < Tenant` ordering.
    const r = await loadSchemaModule(fixture("multi-schema.schema.ts"));
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.schemas).toHaveLength(2);
    expect(r.data.schemas.map((s) => s.node.metadata?.id)).toEqual([
      "com.fixture.tsx-loader.Account",
      "com.fixture.tsx-loader.Tenant",
    ]);
  });

  it("filters out non-Schema exports without failing", async () => {
    const r = await loadSchemaModule(fixture("with-extras.schema.ts"));
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.schemas).toHaveLength(1);
    expect(r.data.schemas[0]!.node.metadata?.id).toBe(
      "com.fixture.tsx-loader.Profile",
    );
  });
});

// =============================================================================
// Failure paths
// =============================================================================

describe("tsx-loader — failure paths", () => {
  it("classifies a missing file as `io_error`", async () => {
    const r = await loadSchemaModule(fixture("does-not-exist.schema.ts"));
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.failure.reason).toBe("io_error");
    expect(r.failure.path).toBe(fixture("does-not-exist.schema.ts"));
    expect(r.failure.message).toBeTruthy();
    expect(r.failure.cause).toBeInstanceOf(Error);
  });

  it("classifies a directory path as `io_error`", async () => {
    const r = await loadSchemaModule(FIXTURES);
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.failure.reason).toBe("io_error");
    expect(r.failure.message).toMatch(/not a regular file/);
  });

  it("classifies a module that throws at load as `runtime_error`", async () => {
    const r = await loadSchemaModule(fixture("runtime-throws.schema.ts"));
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.failure.reason).toBe("runtime_error");
    expect(r.failure.message).toMatch(/intentional fixture failure/);
    expect(r.failure.cause).toBeInstanceOf(Error);
  });

  it("classifies a malformed-source module as `compile_error`", async () => {
    const r = await loadSchemaModule(fixture("compile-error.schema.ts"));
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.failure.reason).toBe("compile_error");
    expect(r.failure.message).toBeTruthy();
    expect(r.failure.cause).toBeDefined();
  });

  it("classifies a no-Schema module as `no_schema_export`", async () => {
    const r = await loadSchemaModule(fixture("no-schema.schema.ts"));
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.failure.reason).toBe("no_schema_export");
    expect(r.failure.path).toBe(fixture("no-schema.schema.ts"));
    expect(r.failure.message).toMatch(/no `Schema` exports/);
    expect(r.failure.cause).toBeUndefined();
  });
});

// =============================================================================
// Side-effect discipline — loader never touches stdout / stderr / exit
// =============================================================================

describe("tsx-loader — side-effect discipline (static-scan)", () => {
  // Same approach as the schema-side handler-purity gate: read the
  // source file and grep for forbidden patterns. Runtime spies were
  // attempted but the console-spy approach hung tsx's ESM pipeline
  // (likely because tsx logs through `console.*` during its worker
  // bootstrap and the mock impl interfered). Static-scan is faster,
  // more reliable, and matches the schema-side convention.
  const LOADER_SRC = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "loaders", "tsx-loader.ts"),
    "utf8",
  );

  // Strip block comments + line comments so JSDoc references like
  // "no `console.*`" don't trigger a false positive.
  const STRIPPED = LOADER_SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(
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
    "loader source does not call `$name`",
    ({ pattern }) => {
      expect(STRIPPED).not.toMatch(pattern);
    },
  );
});
