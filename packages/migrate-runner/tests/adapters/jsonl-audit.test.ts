/**
 * Step 7 — JSONL audit adapter gate.
 *
 * Covers:
 *   - append() writes one JSON line per entry
 *   - cursor() returns only success-status indexes for the
 *     requested runId
 *   - cursor() ignores failures and other runIds
 *   - blank lines in the file are skipped silently (legal padding)
 *   - malformed JSONL fails loud
 *   - append-only: file grows; never rewrites existing lines
 *   - missing file → cursor returns []
 *   - parent directory created on first append
 *   - public-entry runtime export gate
 *   - static-scan boundary
 */
import {
  appendFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { createJsonlAuditAdapter } from "../../src/adapters/jsonl-audit.js";
import { createJsonlAuditAdapter as publicCreate } from "../../src/index.js";
import { makeAuditEntry } from "../../src/audit.js";
import type { AuditEntry } from "../../src/types.js";

const tempRoots: string[] = [];
function freshDir(): string {
  const root = mkdtempSync(join(tmpdir(), "neko-runner-jsa-"));
  tempRoots.push(root);
  return root;
}
afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop()!, { recursive: true, force: true });
  }
});

const CHAIN: AuditEntry["chainEntries"] = [
  {
    fromVersion: "1.0.0",
    toVersion: "2.0.0",
    sourcePath: "migrations/com_fix_X.1.0.0-to-2.0.0.migration.ts",
  },
];

function entry(opts: {
  runId: string;
  recordIndex: number;
  status: "success" | "failure";
}): AuditEntry {
  return makeAuditEntry({
    runId: opts.runId,
    schemaId: "com.fix.X",
    fromVersion: "1.0.0",
    toVersion: "2.0.0",
    chainEntries: CHAIN,
    recordIndex: opts.recordIndex,
    status: opts.status,
    ...(opts.status === "failure"
      ? { classification: "transform_threw" as const, errorMessage: "boom" }
      : {}),
  });
}

// =============================================================================
// append + file layout
// =============================================================================

describe("createJsonlAuditAdapter — append writes one JSON line per entry", () => {
  it("each appended entry produces exactly one trailing-newline line", async () => {
    const dir = freshDir();
    const path = join(dir, "audit.jsonl");
    const a = createJsonlAuditAdapter(path);
    await a.append(entry({ runId: "r1", recordIndex: 0, status: "success" }));
    await a.append(entry({ runId: "r1", recordIndex: 1, status: "failure" }));
    await a.append(entry({ runId: "r1", recordIndex: 2, status: "success" }));

    const content = readFileSync(path, "utf8");
    const lines = content.split("\n");
    // Three entries + the trailing empty string after the final \n
    expect(lines).toHaveLength(4);
    expect(lines[3]).toBe("");
    const first = JSON.parse(lines[0]!) as AuditEntry;
    expect(first.__auditSchemaVersion).toBe("1");
    expect(first.recordIndex).toBe(0);
    expect(first.status).toBe("success");
  });

  it("creates nested parent directories on first append", async () => {
    const root = freshDir();
    const path = join(root, "deep", "nested", "audit.jsonl");
    const a = createJsonlAuditAdapter(path);
    await a.append(entry({ runId: "r1", recordIndex: 0, status: "success" }));
    expect(existsSync(path)).toBe(true);
  });
});

// =============================================================================
// cursor filtering
// =============================================================================

describe("createJsonlAuditAdapter — cursor() filtering", () => {
  it("returns success-status indexes for the requested runId; failures + other runIds filtered", async () => {
    const dir = freshDir();
    const path = join(dir, "audit.jsonl");
    const a = createJsonlAuditAdapter(path);
    // run-A: indexes 0,1,2,3,4 — even indexes succeed.
    for (let i = 0; i < 5; i++) {
      await a.append(
        entry({
          runId: "run-A",
          recordIndex: i,
          status: i % 2 === 0 ? "success" : "failure",
        }),
      );
    }
    // run-B: indexes 0,1,2 — all succeed.
    for (let i = 0; i < 3; i++) {
      await a.append(
        entry({ runId: "run-B", recordIndex: i, status: "success" }),
      );
    }

    expect(await a.cursor("run-A")).toEqual([0, 2, 4]);
    expect(await a.cursor("run-B")).toEqual([0, 1, 2]);
    expect(await a.cursor("does-not-exist")).toEqual([]);
  });

  it("ignores failure entries for the requested runId", async () => {
    const dir = freshDir();
    const path = join(dir, "audit.jsonl");
    const a = createJsonlAuditAdapter(path);
    await a.append(entry({ runId: "r", recordIndex: 0, status: "failure" }));
    expect(await a.cursor("r")).toEqual([]);
  });

  it("missing file returns [] (resume against a fresh path)", async () => {
    const dir = freshDir();
    const path = join(dir, "does-not-exist.jsonl");
    const a = createJsonlAuditAdapter(path);
    expect(await a.cursor("any-run")).toEqual([]);
  });
});

// =============================================================================
// Blank lines + malformed JSONL
// =============================================================================

describe("createJsonlAuditAdapter — blank lines tolerated; malformed JSONL fails loud", () => {
  it("blank lines between entries are skipped silently", async () => {
    const dir = freshDir();
    const path = join(dir, "audit.jsonl");
    const a = createJsonlAuditAdapter(path);
    await a.append(entry({ runId: "r", recordIndex: 0, status: "success" }));
    // Inject blank lines.
    appendFileSync(path, "\n\n   \n");
    await a.append(entry({ runId: "r", recordIndex: 1, status: "success" }));
    expect(await a.cursor("r")).toEqual([0, 1]);
  });

  it("a malformed non-empty line throws on cursor()", async () => {
    const dir = freshDir();
    const path = join(dir, "audit.jsonl");
    const a = createJsonlAuditAdapter(path);
    await a.append(entry({ runId: "r", recordIndex: 0, status: "success" }));
    appendFileSync(path, "this-is-not-json\n");
    await expect(a.cursor("r")).rejects.toThrow(/malformed JSON/);
  });
});

// =============================================================================
// Append-only: file grows; never rewrites existing lines
// =============================================================================

describe("createJsonlAuditAdapter — append-only behavior", () => {
  it("repeated appends add new lines without rewriting earlier ones", async () => {
    const dir = freshDir();
    const path = join(dir, "audit.jsonl");
    const a = createJsonlAuditAdapter(path);
    await a.append(entry({ runId: "r", recordIndex: 0, status: "success" }));
    const after1 = readFileSync(path, "utf8");
    const firstLineSnapshot = after1.split("\n")[0]!;

    await a.append(entry({ runId: "r", recordIndex: 1, status: "success" }));
    const after2 = readFileSync(path, "utf8");

    // File grew (more bytes).
    expect(after2.length).toBeGreaterThan(after1.length);
    // The first line is byte-identical to the snapshot.
    expect(after2.split("\n")[0]).toBe(firstLineSnapshot);
    // Two real entries on disk now.
    expect(
      after2.split("\n").filter((l) => l.trim() !== ""),
    ).toHaveLength(2);
  });
});

// =============================================================================
// Public-entry runtime export gate
// =============================================================================

describe("createJsonlAuditAdapter — public-entry runtime export gate", () => {
  it("`@nekostack/migrate-runner` re-exports `createJsonlAuditAdapter` identity-preserved", () => {
    expect(publicCreate).toBe(createJsonlAuditAdapter);
  });
});

// =============================================================================
// Static-scan boundary on the adapter source
// =============================================================================

describe("jsonl-audit.ts — Step 7 source discipline (static scan)", () => {
  const SRC = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "src",
      "adapters",
      "jsonl-audit.ts",
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
    "jsonl-audit.ts contains no `$name`",
    ({ pattern }) => {
      expect(STRIPPED).not.toMatch(pattern);
    },
  );
});
