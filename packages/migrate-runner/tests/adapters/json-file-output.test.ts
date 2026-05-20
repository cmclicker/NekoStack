/**
 * Step 7 — JSON file output adapter gate.
 *
 * Covers:
 *   - persist() buffers without writing before flush()
 *   - flush() writes a JSON array
 *   - parent directory created when missing
 *   - repeated flush is deterministic
 *   - public-entry runtime export gate
 *   - static-scan boundary
 */
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { createJsonFileOutputAdapter } from "../../src/adapters/json-file-output.js";
import { createJsonFileOutputAdapter as publicCreate } from "../../src/index.js";

const tempRoots: string[] = [];
function freshDir(): string {
  const root = mkdtempSync(join(tmpdir(), "neko-runner-jso-"));
  tempRoots.push(root);
  return root;
}
afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop()!, { recursive: true, force: true });
  }
});

// =============================================================================
// persist buffers; flush writes
// =============================================================================

describe("createJsonFileOutputAdapter — persist buffers without writing before flush", () => {
  it("persist() calls do not create the file", async () => {
    const dir = freshDir();
    const path = join(dir, "out.json");
    const adapter = createJsonFileOutputAdapter(path);
    await adapter.persist({ value: 1 });
    await adapter.persist({ value: 2 });
    expect(existsSync(path)).toBe(false);
  });

  it("flush() writes a JSON array of persisted records", async () => {
    const dir = freshDir();
    const path = join(dir, "out.json");
    const adapter = createJsonFileOutputAdapter(path);
    await adapter.persist({ value: 1 });
    await adapter.persist({ value: 2 });
    await adapter.persist({ value: 3 });
    expect(adapter.flush).toBeDefined();
    await adapter.flush!();
    const onDisk = readFileSync(path, "utf8");
    const parsed = JSON.parse(onDisk) as unknown[];
    expect(parsed).toEqual([{ value: 1 }, { value: 2 }, { value: 3 }]);
  });

  it("flush() on an empty buffer writes `[]`", async () => {
    const dir = freshDir();
    const path = join(dir, "out.json");
    const adapter = createJsonFileOutputAdapter(path);
    await adapter.flush!();
    const onDisk = readFileSync(path, "utf8");
    expect(JSON.parse(onDisk)).toEqual([]);
  });
});

// =============================================================================
// Parent directory creation
// =============================================================================

describe("createJsonFileOutputAdapter — parent dir creation", () => {
  it("creates nested parent directories on flush", async () => {
    const root = freshDir();
    const path = join(root, "deep", "nested", "out.json");
    const adapter = createJsonFileOutputAdapter(path);
    await adapter.persist({ value: 42 });
    await adapter.flush!();
    expect(existsSync(path)).toBe(true);
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    expect(parsed).toEqual([{ value: 42 }]);
  });
});

// =============================================================================
// Repeated flush is deterministic
// =============================================================================

describe("createJsonFileOutputAdapter — deterministic repeated flush", () => {
  it("two flush() calls with the same buffer state write identical content", async () => {
    const dir = freshDir();
    const path = join(dir, "out.json");
    const adapter = createJsonFileOutputAdapter(path);
    await adapter.persist({ value: 1 });
    await adapter.persist({ value: 2 });
    await adapter.flush!();
    const first = readFileSync(path, "utf8");
    await adapter.flush!();
    const second = readFileSync(path, "utf8");
    expect(first).toBe(second);
  });

  it("persist between flushes — second flush writes the accumulated buffer", async () => {
    const dir = freshDir();
    const path = join(dir, "out.json");
    const adapter = createJsonFileOutputAdapter(path);
    await adapter.persist({ value: 1 });
    await adapter.flush!();
    await adapter.persist({ value: 2 });
    await adapter.flush!();
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    expect(parsed).toEqual([{ value: 1 }, { value: 2 }]);
  });
});

// =============================================================================
// Public-entry runtime export gate
// =============================================================================

describe("createJsonFileOutputAdapter — public-entry runtime export gate", () => {
  it("`@nekostack/migrate-runner` re-exports `createJsonFileOutputAdapter` identity-preserved", () => {
    expect(publicCreate).toBe(createJsonFileOutputAdapter);
  });
});

// =============================================================================
// Static-scan boundary on the adapter source
// =============================================================================

describe("json-file-output.ts — Step 7 source discipline (static scan)", () => {
  const SRC = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "src",
      "adapters",
      "json-file-output.ts",
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
    { name: ".transform(", pattern: /\.transform\s*\(/ },
  ];

  it.each(FORBIDDEN)(
    "json-file-output.ts contains no `$name`",
    ({ pattern }) => {
      expect(STRIPPED).not.toMatch(pattern);
    },
  );
});
