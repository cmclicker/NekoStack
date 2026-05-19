/**
 * Step 12 — handler purity gate.
 *
 * Master plan Decision #1 boundary: schema-side handlers are pure.
 * They take typed data, return typed `Result<T>`, never call `fs.*`,
 * `console.*`, `process.exit`, or `import()`. This file pins that
 * contract two ways:
 *
 * 1. **Static file-level check.** Each handler source file plus its
 *    immediate non-external imports are scanned for forbidden
 *    `import` statements (`node:fs`, `node:fs/promises`, the bare
 *    `fs` / `fs/promises` shorthands, and `import(` for dynamic
 *    loading). If any handler reaches for filesystem APIs, the
 *    structural check catches it at PR time without needing to
 *    invoke the handler at all.
 *
 *    Node 22 marks `node:fs` exports as non-configurable, so
 *    `vi.spyOn(fs, "readFileSync")` throws on installation. The
 *    static check sidesteps that limitation while still providing
 *    a deterministic gate.
 *
 * 2. **Runtime spy check.** `console.*` and `process.exit` /
 *    `process.abort` are spied during each handler invocation and
 *    asserted not-called. These two surfaces ARE spyable and catch
 *    the realistic "I added a quick `console.log` for debugging"
 *    regression that the static check might miss (e.g., a helper
 *    that already imports `console` for some legitimate purpose).
 *
 * Scope: no production code changes; no CLI behavior; no public
 * exports. Only the four schema-side handlers
 * (`listHandler` / `diffHandler` / `checkHandler` / `generateHandler`)
 * are gated here. CLI-side filesystem code (Steps 22-31) deliberately
 * does use `fs.*` and is NOT constrained by this test.
 */
import {
  describe,
  expect,
  it,
  vi,
  beforeEach,
  afterEach,
  type MockInstance,
} from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { s } from "../../src/index.js";
import { generateZod } from "../../src/generators/zod.js";
import { sourceHashFromText } from "../../src/registry/source-hash.js";
import { buildRegistry } from "../../src/registry/build-registry.js";
import { listHandler } from "../../src/registry/handlers/list.js";
import { diffHandler } from "../../src/registry/handlers/diff.js";
import { checkHandler } from "../../src/registry/handlers/check.js";
import { generateHandler } from "../../src/registry/handlers/generate.js";
import type {
  CommittedArtifact,
  Registry,
  RegistrySourceEntry,
} from "../../src/registry/types.js";

// =============================================================================
// Static file-level import check
// =============================================================================

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = resolve(__dirname, "../../src");

/**
 * Files transitively reachable from a handler — handler file plus the
 * non-external imports each handler composes. Anything CLI-side is
 * deliberately omitted.
 *
 * Hand-curated rather than auto-walked (Master plan: "the goal is not
 * a full import graph engine; it is to make the gate honest"). For
 * `generateHandler` this list expanded in audit round 12 to include
 * every generator module the handler delegates to — without that
 * reach, an `fs` import added to a generator would bypass the gate
 * because `fs` can't be reliably spied at runtime under Node 22.
 */
const HANDLER_REACH: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["listHandler", ["registry/handlers/list.ts"]],
  [
    "diffHandler",
    ["registry/handlers/diff.ts", "registry/diff.ts"],
  ],
  [
    "checkHandler",
    [
      "registry/handlers/check.ts",
      "registry/parse-provenance.ts",
      "registry/build-registry.ts",
      "registry/source-hash.ts",
    ],
  ],
  [
    "generateHandler",
    [
      // Handler + its source-hash helper.
      "registry/handlers/generate.ts",
      "registry/source-hash.ts",
      // Direct generator modules invoked by the handler.
      "generators/ts.ts",
      "generators/zod.ts",
      "generators/json-schema.ts",
      "generators/openapi.ts",
      // Shared generator infrastructure reached transitively from the
      // four above.
      "generators/header.ts",
      "generators/schema-fragment.ts",
      "generators/zod-mapping.ts",
      "generators/json-schema-meta.ts",
      "generators/version.ts",
      "generators/errors.ts",
      // IR helpers reached by header / json-schema / openapi.
      "ir/hash.ts",
      "ir/serialize.ts",
    ],
  ],
];

const FORBIDDEN_IMPORT_PATTERNS: readonly RegExp[] = [
  /from\s+["']node:fs["']/,
  /from\s+["']node:fs\/promises["']/,
  /from\s+["']fs["']/,
  /from\s+["']fs\/promises["']/,
  // `import("…")` dynamic-import expressions
  /\bimport\(/,
];

/**
 * Top-level/code-level forbidden tokens. Runtime spies only catch
 * calls made *during* handler invocation; a `console.log(...)` or
 * `process.exit(...)` executed at module-import time (e.g., from a
 * side-effecting top-level statement) would be invisible because the
 * spies are installed after the modules are imported. Adding these
 * to the static scan closes that hole.
 *
 * Patterns are loose enough to catch both calls (`process.exit(1)`)
 * and reference saves (`const ex = process.exit; ex(1)`).
 */
const FORBIDDEN_RUNTIME_PATTERNS: readonly RegExp[] = [
  /\bconsole\.[a-z]+/i,
  /\bprocess\.exit\b/,
  /\bprocess\.abort\b/,
];

const ALL_FORBIDDEN_PATTERNS: readonly RegExp[] = [
  ...FORBIDDEN_IMPORT_PATTERNS,
  ...FORBIDDEN_RUNTIME_PATTERNS,
];

/**
 * Strip block + line comments before scanning. Source-level JSDoc
 * blocks routinely mention forbidden tokens like `import()` and
 * `fs.*` in prose ("no `import()`, no `fs.*` in handlers"); stripping
 * comments first means the regex only fires on actual code.
 *
 * The strippers are simple — no string-literal awareness — because
 * the handler source files don't contain `import(` or `from "node:fs"`
 * inside string literals. If a future handler does, this can be
 * tightened.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments / JSDoc
    .replace(/^\s*\/\/.*$/gm, ""); // whole-line line comments
}

describe("handler purity — static scan (deterministic, file-level)", () => {
  it.each(HANDLER_REACH)(
    "no `fs` / dynamic-`import()` / `console.*` / `process.exit|abort` reach in any file behind %s",
    (handlerName, relPaths) => {
      for (const rel of relPaths) {
        const absolute = resolve(SRC_ROOT, rel);
        const source = stripComments(readFileSync(absolute, "utf8"));
        for (const pattern of ALL_FORBIDDEN_PATTERNS) {
          expect(
            pattern.test(source),
            `${handlerName} (file ${rel}) matches forbidden pattern ${pattern}. ` +
              `Master plan Decision #1 forbids filesystem / dynamic-import / console / process surface in schema-side handlers.`,
          ).toBe(false);
        }
      }
    },
  );

  it("(sentinel) `import { readFileSync } from \"node:fs\"` is caught", () => {
    const offending = `import { readFileSync } from "node:fs";`;
    const stripped = stripComments(offending);
    expect(ALL_FORBIDDEN_PATTERNS.some((p) => p.test(stripped))).toBe(true);
  });

  it("(sentinel) a dynamic `import(...)` in code is caught", () => {
    const offending = `const mod = await import("./x.js");`;
    const stripped = stripComments(offending);
    expect(ALL_FORBIDDEN_PATTERNS.some((p) => p.test(stripped))).toBe(true);
  });

  it("(sentinel) a top-level `console.log(...)` is caught", () => {
    // The motivating regression — top-level / module-load-time
    // console output that runtime spies installed *after* import
    // would miss entirely.
    const offending = `console.log("debug: loaded handler");\nexport function listHandler() {}`;
    const stripped = stripComments(offending);
    expect(ALL_FORBIDDEN_PATTERNS.some((p) => p.test(stripped))).toBe(true);
  });

  it("(sentinel) a `console.error(...)` reference is caught", () => {
    const offending = `function bad() { console.error("uh oh"); }`;
    const stripped = stripComments(offending);
    expect(ALL_FORBIDDEN_PATTERNS.some((p) => p.test(stripped))).toBe(true);
  });

  it("(sentinel) `process.exit(...)` is caught", () => {
    const offending = `if (broken) process.exit(1);`;
    const stripped = stripComments(offending);
    expect(ALL_FORBIDDEN_PATTERNS.some((p) => p.test(stripped))).toBe(true);
  });

  it("(sentinel) `process.abort()` is caught", () => {
    const offending = `process.abort();`;
    const stripped = stripComments(offending);
    expect(ALL_FORBIDDEN_PATTERNS.some((p) => p.test(stripped))).toBe(true);
  });

  it("(sentinel) saved-reference patterns like `const x = console.log` are caught", () => {
    const offending = `const x = console.log; x("hi");`;
    const stripped = stripComments(offending);
    expect(ALL_FORBIDDEN_PATTERNS.some((p) => p.test(stripped))).toBe(true);
  });

  it("(sentinel) a clean handler source does not match", () => {
    const clean = `import type { Registry } from "../types.js";\nimport { irHash } from "../../ir/hash.js";`;
    const stripped = stripComments(clean);
    expect(ALL_FORBIDDEN_PATTERNS.some((p) => p.test(stripped))).toBe(false);
  });

  it("(sentinel) `import(` mentioned only in a JSDoc comment does NOT match (false-positive suppression)", () => {
    const commentOnly = `/**\n * No \`import()\` allowed.\n */\nexport const x = 1;`;
    const stripped = stripComments(commentOnly);
    expect(ALL_FORBIDDEN_PATTERNS.some((p) => p.test(stripped))).toBe(false);
  });

  it("(sentinel) `console.log` / `process.exit` mentioned only in JSDoc do NOT match", () => {
    const commentOnly = `/**\n * Don't reach for \`console.log\` or \`process.exit()\` from a handler.\n */\nexport const x = 1;`;
    const stripped = stripComments(commentOnly);
    expect(ALL_FORBIDDEN_PATTERNS.some((p) => p.test(stripped))).toBe(false);
  });
});

// =============================================================================
// Runtime spy harness — console.* + process.exit / process.abort
// =============================================================================

interface SpySet {
  readonly all: readonly MockInstance[];
  readonly byName: Record<string, MockInstance>;
}

function installRuntimeSpies(): SpySet {
  const byName: Record<string, MockInstance> = {};
  for (const name of ["log", "warn", "error", "info", "debug"] as const) {
    byName[`console.${name}`] = vi
      .spyOn(console, name)
      .mockImplementation(() => undefined);
  }
  byName["process.exit"] = vi
    .spyOn(process, "exit")
    .mockImplementation((() => undefined) as never);
  byName["process.abort"] = vi
    .spyOn(process, "abort")
    .mockImplementation((() => undefined) as never);
  return { byName, all: Object.values(byName) };
}

function expectNoRuntimeSideEffects(spies: SpySet): void {
  const called = Object.entries(spies.byName)
    .filter(([, spy]) => spy.mock.calls.length > 0)
    .map(([name, spy]) => `${name} (${spy.mock.calls.length}x)`);
  if (called.length > 0) {
    throw new Error(
      `Handler called restricted API(s): ${called.join(", ")}. ` +
        `Master plan Decision #1 forbids console.* / process.exit from schema-side handlers.`,
    );
  }
  for (const spy of spies.all) {
    expect(spy).not.toHaveBeenCalled();
  }
}

// =============================================================================
// Shared fixtures
// =============================================================================

const TENANT = () =>
  s.object({ id: s.string() }).id("com.x.Tenant").version("1.0.0");
const AUDIT = () =>
  s.object({ id: s.string() }).id("com.x.AuditEvent").version("1.0.0");

function makeRegistry(): Registry {
  const r = buildRegistry([
    {
      sourcePath: "schemas/tenant.schema.ts",
      sourceText: "// canonical tenant source\n",
      schemas: [TENANT()],
    },
    {
      sourcePath: "schemas/audit.schema.ts",
      sourceText: "// canonical audit source\n",
      schemas: [AUDIT()],
    },
  ]);
  if (!r.success) throw new Error("fixture should succeed");
  return r.data;
}

function cleanArtifact(): CommittedArtifact {
  const sourceText = "// canonical tenant source\n";
  return {
    path: "schemas/generated/tenant.zod.ts",
    content: generateZod(TENANT().node, {
      sourceHash: sourceHashFromText(sourceText),
    }),
  };
}

function malformedArtifact(): CommittedArtifact {
  return {
    path: "schemas/generated/broken.zod.ts",
    content: "// not a valid header\nexport const schema = z.string();\n",
  };
}

const multiSchemaEntries: readonly RegistrySourceEntry[] = [
  {
    sourcePath: "schemas/users.schema.ts",
    sourceText: "// users\n",
    schemas: [TENANT()],
  },
  {
    sourcePath: "schemas/domain.schema.ts",
    sourceText: "// domain (multi)\n",
    schemas: [TENANT(), AUDIT()],
  },
];

// =============================================================================
// Per-handler runtime gates
// =============================================================================

describe("handler purity — listHandler runtime", () => {
  let spies: SpySet;
  beforeEach(() => {
    spies = installRuntimeSpies();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not call console.* or process.* on a non-trivial registry", () => {
    listHandler({ registry: makeRegistry() });
    expectNoRuntimeSideEffects(spies);
  });

  it("does not call any restricted API on an empty registry either", () => {
    listHandler({ registry: new Map() as Registry });
    expectNoRuntimeSideEffects(spies);
  });
});

describe("handler purity — diffHandler runtime", () => {
  let spies: SpySet;
  beforeEach(() => {
    spies = installRuntimeSpies();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not call restricted APIs on a mixed-severity diff", () => {
    const before = s
      .object({ id: s.string(), legacy: s.string() })
      .describe("v1").node;
    const after = s
      .object({ id: s.string(), name: s.string().optional() })
      .describe("v2").node;
    diffHandler({ before, after });
    expectNoRuntimeSideEffects(spies);
  });

  it("does not call restricted APIs on unchanged inputs", () => {
    const node = s.object({ id: s.string() }).node;
    diffHandler({ before: node, after: node });
    expectNoRuntimeSideEffects(spies);
  });
});

describe("handler purity — checkHandler runtime", () => {
  let spies: SpySet;
  beforeEach(() => {
    spies = installRuntimeSpies();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not call restricted APIs on the success path (clean verdict)", () => {
    checkHandler({
      registry: makeRegistry(),
      committedArtifacts: [cleanArtifact()],
    });
    expectNoRuntimeSideEffects(spies);
  });

  it("does not call restricted APIs on the failure path (malformed provenance)", () => {
    // The malformed-artifact path is exactly where a "let me just
    // log this real quick" temptation would land. Gate it here.
    checkHandler({
      registry: makeRegistry(),
      committedArtifacts: [malformedArtifact()],
    });
    expectNoRuntimeSideEffects(spies);
  });

  it("does not call restricted APIs across mixed verdicts + failures", () => {
    checkHandler({
      registry: makeRegistry(),
      committedArtifacts: [cleanArtifact(), malformedArtifact()],
    });
    expectNoRuntimeSideEffects(spies);
  });
});

describe("handler purity — generateHandler runtime", () => {
  let spies: SpySet;
  beforeEach(() => {
    spies = installRuntimeSpies();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not call restricted APIs on a single-schema entry", () => {
    generateHandler({
      entries: [
        {
          sourcePath: "schemas/tenant.schema.ts",
          sourceText: "// tenant\n",
          schemas: [TENANT()],
        },
      ],
    });
    expectNoRuntimeSideEffects(spies);
  });

  it("does not call restricted APIs on multi-schema entries (discriminator path)", () => {
    generateHandler({ entries: multiSchemaEntries });
    expectNoRuntimeSideEffects(spies);
  });

  it("does not call restricted APIs with anonymous schemas mixed in", () => {
    const Anon = s.object({ id: s.string() });
    generateHandler({
      entries: [
        {
          sourcePath: "schemas/mixed.schema.ts",
          sourceText: "// mixed\n",
          schemas: [TENANT(), Anon],
        },
      ],
    });
    expectNoRuntimeSideEffects(spies);
  });

  it("does not call restricted APIs on an empty entries list", () => {
    generateHandler({ entries: [] });
    expectNoRuntimeSideEffects(spies);
  });
});

// =============================================================================
// Sentinel — the runtime spy harness actually catches real calls
// =============================================================================

describe("handler purity — runtime sentinel (the spy harness catches real calls)", () => {
  let spies: SpySet;
  beforeEach(() => {
    spies = installRuntimeSpies();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("a deliberate `console.log` IS caught by the assertion", () => {
    console.log("sentinel — should be caught");
    expect(() => expectNoRuntimeSideEffects(spies)).toThrow(
      /Handler called restricted API/,
    );
  });

  it("a deliberate `console.error` IS caught", () => {
    console.error("sentinel — should be caught");
    expect(() => expectNoRuntimeSideEffects(spies)).toThrow(
      /Handler called restricted API/,
    );
  });

  it("a deliberate `process.exit` IS caught (mocked, does not actually exit)", () => {
    process.exit(0);
    expect(() => expectNoRuntimeSideEffects(spies)).toThrow(
      /Handler called restricted API/,
    );
  });
});
