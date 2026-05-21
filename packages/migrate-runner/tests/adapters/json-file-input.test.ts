/**
 * Step 7 — JSON file input adapter gate.
 *
 * Covers:
 *   - top-level JSON array streams records in order
 *   - `{ records: [...] }` shape streams records in order
 *   - empty array works (stream yields nothing)
 *   - invalid JSON throws at stream time
 *   - unsupported top-level shape throws at stream time
 *   - parsed records are not mutated
 *   - public-entry runtime export gate
 *   - static-scan boundary
 */
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { createJsonFileInputAdapter } from "../../src/adapters/json-file-input.js";
import { createJsonFileInputAdapter as publicCreate } from "../../src/index.js";

const tempRoots: string[] = [];
function tmpFile(content: string, name = "input.json"): string {
  const root = mkdtempSync(join(tmpdir(), "neko-runner-jsi-"));
  tempRoots.push(root);
  const path = join(root, name);
  writeFileSync(path, content, "utf8");
  return path;
}
afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop()!, { recursive: true, force: true });
  }
});

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
}

// =============================================================================
// Happy paths
// =============================================================================

describe("createJsonFileInputAdapter — top-level array", () => {
  it("streams records in array order", async () => {
    const path = tmpFile(
      JSON.stringify([{ value: 1 }, { value: 2 }, { value: 3 }]),
    );
    const adapter = createJsonFileInputAdapter(path);
    const records = await collect(adapter.stream());
    expect(records).toEqual([{ value: 1 }, { value: 2 }, { value: 3 }]);
  });

  it("empty array → stream yields nothing", async () => {
    const path = tmpFile("[]");
    const adapter = createJsonFileInputAdapter(path);
    const records = await collect(adapter.stream());
    expect(records).toEqual([]);
  });
});

describe("createJsonFileInputAdapter — `{ records: [...] }` shape", () => {
  it("streams records from the `records` array in order", async () => {
    const path = tmpFile(
      JSON.stringify({
        meta: { version: 1 },
        records: [{ value: "a" }, { value: "b" }],
      }),
    );
    const adapter = createJsonFileInputAdapter(path);
    const records = await collect(adapter.stream());
    expect(records).toEqual([{ value: "a" }, { value: "b" }]);
  });

  it("`{ records: [] }` → stream yields nothing", async () => {
    const path = tmpFile(JSON.stringify({ records: [] }));
    const adapter = createJsonFileInputAdapter(path);
    const records = await collect(adapter.stream());
    expect(records).toEqual([]);
  });
});

// =============================================================================
// Error paths
// =============================================================================

describe("createJsonFileInputAdapter — error paths", () => {
  it("invalid JSON throws on stream iteration (adapter-readable message)", async () => {
    const path = tmpFile("{not valid json");
    const adapter = createJsonFileInputAdapter(path);
    await expect(collect(adapter.stream())).rejects.toThrow(/not valid JSON/);
  });

  it("unsupported top-level shape throws on stream iteration", async () => {
    const path = tmpFile(JSON.stringify({ wrong: [1, 2] }));
    const adapter = createJsonFileInputAdapter(path);
    await expect(collect(adapter.stream())).rejects.toThrow(
      /must be either a top-level array or an object with a `records` array/,
    );
  });

  it("`null` is unsupported", async () => {
    const path = tmpFile("null");
    const adapter = createJsonFileInputAdapter(path);
    await expect(collect(adapter.stream())).rejects.toThrow(
      /must be either a top-level array or an object with a `records` array/,
    );
  });

  it("missing file → readFile throws (the runner catches as adapter_init_failed)", async () => {
    const adapter = createJsonFileInputAdapter(
      join(tmpdir(), `neko-runner-missing-${Date.now()}.json`),
    );
    await expect(collect(adapter.stream())).rejects.toThrow();
  });
});

// =============================================================================
// Non-mutation
// =============================================================================

describe("createJsonFileInputAdapter — does not mutate parsed records", () => {
  it("records read from the stream do not have hidden mutations", async () => {
    const path = tmpFile(JSON.stringify([{ value: 1 }, { value: 2 }]));
    const adapter = createJsonFileInputAdapter(path);
    const records = await collect(adapter.stream());
    // Re-stream — must yield equal records (no in-place mutation by
    // the first stream call).
    const records2 = await collect(adapter.stream());
    expect(records).toEqual(records2);
  });
});

// =============================================================================
// Public-entry runtime export gate
// =============================================================================

describe("createJsonFileInputAdapter — public-entry runtime export gate", () => {
  it("`@nekostack/migrate-runner` re-exports `createJsonFileInputAdapter` identity-preserved", () => {
    expect(publicCreate).toBe(createJsonFileInputAdapter);
  });
});

// =============================================================================
// Static-scan boundary on the adapter source
// =============================================================================

describe("json-file-input.ts — Step 7 source discipline (static scan)", () => {
  const SRC = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "src",
      "adapters",
      "json-file-input.ts",
    ),
    "utf8",
  );
  const STRIPPED = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(
    /\/\/.*$/gm,
    "",
  );

  // Note: `fs` imports ARE allowed in adapters — that's the whole
  // point of this step. The cross-cutting scan in
  // tests/scaffold.test.ts asserts fs imports are ONLY allowed
  // under src/adapters/*.
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
    // `.transform(` is allowed only in per-record-pipeline.ts.
    { name: ".transform(", pattern: /\.transform\s*\(/ },
  ];

  it.each(FORBIDDEN)(
    "json-file-input.ts contains no `$name`",
    ({ pattern }) => {
      expect(STRIPPED).not.toMatch(pattern);
    },
  );
});

