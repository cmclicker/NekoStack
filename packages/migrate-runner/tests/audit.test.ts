/**
 * Step 5 — audit primitive gate.
 *
 * Exercises `createMemoryAuditAdapter()` and `makeAuditEntry(...)`.
 * Both ship in [`packages/migrate-runner/src/audit.ts`](../src/audit.ts).
 * The persistent JSONL file adapter lives in Step 7 and is NOT in
 * scope here.
 *
 * Scenarios:
 *   1.  fresh adapter starts empty (`entries.length === 0`)
 *   2.  `append` stores entries in append order
 *   3.  every appended entry preserves `__auditSchemaVersion: "1"`
 *   4.  `cursor(runId)` returns only successful record indexes for
 *       that run; ignores failures; ignores other runIds
 *   5.  append-only: later `append` calls do not mutate earlier
 *       entries (frozen snapshots; identity preserved across pushes)
 *   6.  caller-side mutation of the original entry reference does
 *       NOT change what the adapter stored (shallow snapshot)
 *   7.  `before` / `after` fields are preserved when present
 *   8.  `makeAuditEntry` sets `__auditSchemaVersion: "1"` and a
 *       default ISO-8601 timestamp; overrides honored
 *   9.  public-entry runtime export gate (createMemoryAuditAdapter
 *       and makeAuditEntry re-exported identity-preserved)
 *  10.  static-scan: audit.ts has no console / process / fs / .transform(
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createMemoryAuditAdapter,
  makeAuditEntry,
} from "../src/audit.js";
import {
  createMemoryAuditAdapter as publicCreateMemoryAuditAdapter,
  makeAuditEntry as publicMakeAuditEntry,
} from "../src/index.js";
import type { AuditEntry } from "../src/types.js";

// =============================================================================
// Fixture chain entries used in audit-entry construction
// =============================================================================

const CHAIN_ENTRIES_FIXTURE: AuditEntry["chainEntries"] = [
  {
    fromVersion: "1.0.0",
    toVersion: "2.0.0",
    sourcePath: "migrations/com_fix_X.1.0.0-to-2.0.0.migration.ts",
  },
];

// =============================================================================
// 1. fresh adapter is empty
// =============================================================================

describe("createMemoryAuditAdapter — empty initial state", () => {
  it("a fresh adapter has zero entries", () => {
    const a = createMemoryAuditAdapter();
    expect(a.entries.length).toBe(0);
  });

  it("`cursor` on an empty adapter returns an empty array for any runId", async () => {
    const a = createMemoryAuditAdapter();
    expect(await a.cursor("any-run-id")).toEqual([]);
  });
});

// =============================================================================
// 2. append stores in order
// =============================================================================

describe("createMemoryAuditAdapter — append stores entries in order", () => {
  it("entries appear in append order", async () => {
    const a = createMemoryAuditAdapter();
    const e0 = makeAuditEntry({
      runId: "run-1",
      schemaId: "com.fix.X",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      chainEntries: CHAIN_ENTRIES_FIXTURE,
      recordIndex: 0,
      status: "success",
      timestamp: "2026-05-20T00:00:00.000Z",
    });
    const e1 = makeAuditEntry({
      runId: "run-1",
      schemaId: "com.fix.X",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      chainEntries: CHAIN_ENTRIES_FIXTURE,
      recordIndex: 1,
      status: "success",
      timestamp: "2026-05-20T00:00:01.000Z",
    });
    await a.append(e0);
    await a.append(e1);
    expect(a.entries.length).toBe(2);
    expect(a.entries[0]!.recordIndex).toBe(0);
    expect(a.entries[1]!.recordIndex).toBe(1);
  });
});

// =============================================================================
// 3. __auditSchemaVersion: "1" preserved
// =============================================================================

describe("createMemoryAuditAdapter — `__auditSchemaVersion: \"1\"` preserved on every entry", () => {
  it("every appended entry carries the locked schema version", async () => {
    const a = createMemoryAuditAdapter();
    for (let i = 0; i < 5; i++) {
      await a.append(
        makeAuditEntry({
          runId: "run-1",
          schemaId: "com.fix.X",
          fromVersion: "1.0.0",
          toVersion: "2.0.0",
          chainEntries: CHAIN_ENTRIES_FIXTURE,
          recordIndex: i,
          status: i % 2 === 0 ? "success" : "failure",
          ...(i % 2 === 0
            ? {}
            : { classification: "transform_threw" as const, errorMessage: "boom" }),
        }),
      );
    }
    expect(a.entries.length).toBe(5);
    for (const entry of a.entries) {
      expect(entry.__auditSchemaVersion).toBe("1");
    }
  });
});

// =============================================================================
// 4. cursor — only successes for the given runId
// =============================================================================

describe("createMemoryAuditAdapter — cursor() filtering", () => {
  it("returns only `success`-status indexes for the requested runId", async () => {
    const a = createMemoryAuditAdapter();
    // Run "alpha" — indexes 0,1,2,3,4. 0,2,4 succeed; 1,3 fail.
    for (let i = 0; i < 5; i++) {
      await a.append(
        makeAuditEntry({
          runId: "alpha",
          schemaId: "com.fix.X",
          fromVersion: "1.0.0",
          toVersion: "2.0.0",
          chainEntries: CHAIN_ENTRIES_FIXTURE,
          recordIndex: i,
          status: i % 2 === 0 ? "success" : "failure",
          ...(i % 2 === 0
            ? {}
            : {
                classification: "transform_threw" as const,
                errorMessage: "boom",
              }),
        }),
      );
    }
    // Run "beta" — all succeed; should NOT appear in alpha's cursor.
    for (let i = 0; i < 3; i++) {
      await a.append(
        makeAuditEntry({
          runId: "beta",
          schemaId: "com.fix.Y",
          fromVersion: "1.0.0",
          toVersion: "2.0.0",
          chainEntries: CHAIN_ENTRIES_FIXTURE,
          recordIndex: i,
          status: "success",
        }),
      );
    }

    const alphaCursor = await a.cursor("alpha");
    expect(alphaCursor).toEqual([0, 2, 4]);

    const betaCursor = await a.cursor("beta");
    expect(betaCursor).toEqual([0, 1, 2]);

    const unknownCursor = await a.cursor("does-not-exist");
    expect(unknownCursor).toEqual([]);
  });

  it("ignores failure-status entries even for the right runId", async () => {
    const a = createMemoryAuditAdapter();
    await a.append(
      makeAuditEntry({
        runId: "run-1",
        schemaId: "com.fix.X",
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        chainEntries: CHAIN_ENTRIES_FIXTURE,
        recordIndex: 0,
        status: "failure",
        classification: "input_validation_failed",
        errorMessage: "bad input",
      }),
    );
    expect(await a.cursor("run-1")).toEqual([]);
  });
});

// =============================================================================
// 5. append-only behavior — identity preserved across pushes
// =============================================================================

describe("createMemoryAuditAdapter — append-only (later appends do not mutate earlier entries)", () => {
  it("appended entries' object references are stable across subsequent appends", async () => {
    const a = createMemoryAuditAdapter();
    await a.append(
      makeAuditEntry({
        runId: "run-1",
        schemaId: "com.fix.X",
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        chainEntries: CHAIN_ENTRIES_FIXTURE,
        recordIndex: 0,
        status: "success",
      }),
    );
    const snapshotBefore = [...a.entries];
    const e0Ref = a.entries[0]!;
    await a.append(
      makeAuditEntry({
        runId: "run-1",
        schemaId: "com.fix.X",
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        chainEntries: CHAIN_ENTRIES_FIXTURE,
        recordIndex: 1,
        status: "success",
      }),
    );
    expect(a.entries[0]).toBe(e0Ref);
    expect(a.entries[0]).toBe(snapshotBefore[0]);
    expect(a.entries.length).toBe(2);
  });

  it("appended entry is frozen — direct mutation throws (strict mode) or is silently ignored", async () => {
    const a = createMemoryAuditAdapter();
    await a.append(
      makeAuditEntry({
        runId: "run-1",
        schemaId: "com.fix.X",
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        chainEntries: CHAIN_ENTRIES_FIXTURE,
        recordIndex: 0,
        status: "success",
      }),
    );
    const stored = a.entries[0]!;
    expect(Object.isFrozen(stored)).toBe(true);
  });
});

// =============================================================================
// 5b. `entries` view is a frozen defensive snapshot (round-2 cleanup)
// =============================================================================
//
// The audit log is append-only by contract. Returning the internal
// mutable array from the `entries` getter would let any JS caller
// (or any TS caller using a cast) bypass that contract via `push`
// or `.length = 0`. The getter MUST return a frozen defensive copy.

describe("createMemoryAuditAdapter — entries view is a frozen defensive snapshot", () => {
  it("the returned view is Object.isFrozen-true", async () => {
    const a = createMemoryAuditAdapter();
    await a.append(
      makeAuditEntry({
        runId: "run-1",
        schemaId: "com.fix.X",
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        chainEntries: CHAIN_ENTRIES_FIXTURE,
        recordIndex: 0,
        status: "success",
      }),
    );
    const view = a.entries;
    expect(Object.isFrozen(view)).toBe(true);
  });

  it("mutation of the returned view via `push` cannot reach the adapter's stored entries", async () => {
    const a = createMemoryAuditAdapter();
    await a.append(
      makeAuditEntry({
        runId: "run-1",
        schemaId: "com.fix.X",
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        chainEntries: CHAIN_ENTRIES_FIXTURE,
        recordIndex: 0,
        status: "success",
      }),
    );
    const view = a.entries;
    const fake = makeAuditEntry({
      runId: "run-1",
      schemaId: "com.fix.X",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      chainEntries: CHAIN_ENTRIES_FIXTURE,
      recordIndex: 99,
      status: "success",
    });
    // Strict-mode ES modules throw TypeError on mutation of a
    // frozen array. The test runs under ESM strict.
    expect(() => {
      (view as AuditEntry[]).push(fake);
    }).toThrow(TypeError);
    // Belt-and-suspenders: regardless of whether the throw was
    // observed, the adapter's stored length MUST be unchanged.
    expect(a.entries).toHaveLength(1);
    expect(a.entries[0]!.recordIndex).toBe(0);
  });

  it("mutation via `length = 0` is also blocked", async () => {
    const a = createMemoryAuditAdapter();
    for (let i = 0; i < 3; i++) {
      await a.append(
        makeAuditEntry({
          runId: "run-1",
          schemaId: "com.fix.X",
          fromVersion: "1.0.0",
          toVersion: "2.0.0",
          chainEntries: CHAIN_ENTRIES_FIXTURE,
          recordIndex: i,
          status: "success",
        }),
      );
    }
    const view = a.entries;
    expect(() => {
      (view as AuditEntry[]).length = 0;
    }).toThrow(TypeError);
    expect(a.entries).toHaveLength(3);
  });

  it("mutation via index assignment is also blocked", async () => {
    const a = createMemoryAuditAdapter();
    await a.append(
      makeAuditEntry({
        runId: "run-1",
        schemaId: "com.fix.X",
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        chainEntries: CHAIN_ENTRIES_FIXTURE,
        recordIndex: 0,
        status: "success",
      }),
    );
    const view = a.entries;
    const fake = makeAuditEntry({
      runId: "run-1",
      schemaId: "com.fix.X",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      chainEntries: CHAIN_ENTRIES_FIXTURE,
      recordIndex: 99,
      status: "success",
    });
    expect(() => {
      (view as AuditEntry[])[0] = fake;
    }).toThrow(TypeError);
    expect(a.entries[0]!.recordIndex).toBe(0);
  });

  it("append still preserves entry-object snapshots after the defensive wrapper change", async () => {
    const a = createMemoryAuditAdapter();
    await a.append(
      makeAuditEntry({
        runId: "run-1",
        schemaId: "com.fix.X",
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        chainEntries: CHAIN_ENTRIES_FIXTURE,
        recordIndex: 0,
        status: "success",
      }),
    );
    const e0Ref = a.entries[0]!;
    await a.append(
      makeAuditEntry({
        runId: "run-1",
        schemaId: "com.fix.X",
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        chainEntries: CHAIN_ENTRIES_FIXTURE,
        recordIndex: 1,
        status: "success",
      }),
    );
    // Even though `.entries` allocates a new frozen wrapper per
    // call, the individual entry-object references are stable.
    expect(a.entries[0]).toBe(e0Ref);
    expect(Object.isFrozen(a.entries[0])).toBe(true);
  });

  it("`cursor` behavior unchanged after the defensive snapshot fix", async () => {
    const a = createMemoryAuditAdapter();
    for (let i = 0; i < 4; i++) {
      await a.append(
        makeAuditEntry({
          runId: "run-x",
          schemaId: "com.fix.X",
          fromVersion: "1.0.0",
          toVersion: "2.0.0",
          chainEntries: CHAIN_ENTRIES_FIXTURE,
          recordIndex: i,
          status: i === 2 ? "failure" : "success",
          ...(i === 2
            ? {
                classification: "transform_threw" as const,
                errorMessage: "boom",
              }
            : {}),
        }),
      );
    }
    expect(await a.cursor("run-x")).toEqual([0, 1, 3]);
  });
});

// =============================================================================
// 6. caller-side mutation does NOT affect stored snapshot
// =============================================================================

describe("createMemoryAuditAdapter — caller-side mutation isolation", () => {
  it("mutating the original entry after append does not change the adapter's stored copy", async () => {
    const a = createMemoryAuditAdapter();
    const entry = makeAuditEntry({
      runId: "run-1",
      schemaId: "com.fix.X",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      chainEntries: CHAIN_ENTRIES_FIXTURE,
      recordIndex: 0,
      status: "success",
    });
    await a.append(entry);
    // Mutate the original. The adapter's snapshot was frozen at
    // append time, so its values remain at the original snapshot.
    (entry as { recordIndex: number }).recordIndex = 999;
    expect(a.entries[0]!.recordIndex).toBe(0);
  });
});

// =============================================================================
// 7. before / after preserved when present
// =============================================================================

describe("createMemoryAuditAdapter — before/after retention", () => {
  it("entries carry `before` and `after` when supplied at construction", async () => {
    const a = createMemoryAuditAdapter();
    await a.append(
      makeAuditEntry({
        runId: "run-1",
        schemaId: "com.fix.X",
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        chainEntries: CHAIN_ENTRIES_FIXTURE,
        recordIndex: 0,
        status: "success",
        before: { value: "42" },
        after: { value: 42 },
      }),
    );
    expect(a.entries[0]!.before).toEqual({ value: "42" });
    expect(a.entries[0]!.after).toEqual({ value: 42 });
  });

  it("entries omit `before` and `after` when NOT supplied", async () => {
    const a = createMemoryAuditAdapter();
    await a.append(
      makeAuditEntry({
        runId: "run-1",
        schemaId: "com.fix.X",
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        chainEntries: CHAIN_ENTRIES_FIXTURE,
        recordIndex: 0,
        status: "success",
      }),
    );
    const e = a.entries[0]!;
    expect("before" in e).toBe(false);
    expect("after" in e).toBe(false);
  });
});

// =============================================================================
// 8. makeAuditEntry — version literal + timestamp defaulting
// =============================================================================

describe("makeAuditEntry — constructor discipline", () => {
  it("always sets `__auditSchemaVersion: \"1\"`", () => {
    const e = makeAuditEntry({
      runId: "r",
      schemaId: "s",
      fromVersion: "1",
      toVersion: "2",
      chainEntries: CHAIN_ENTRIES_FIXTURE,
      recordIndex: 0,
      status: "success",
    });
    expect(e.__auditSchemaVersion).toBe("1");
  });

  it("defaults `timestamp` to an ISO-8601 string when omitted", () => {
    const before = new Date().toISOString();
    const e = makeAuditEntry({
      runId: "r",
      schemaId: "s",
      fromVersion: "1",
      toVersion: "2",
      chainEntries: CHAIN_ENTRIES_FIXTURE,
      recordIndex: 0,
      status: "success",
    });
    const after = new Date().toISOString();
    expect(typeof e.timestamp).toBe("string");
    // ISO-8601 lexicographic comparison is monotonic at second
    // resolution; bracket the test's wall-clock window.
    expect(e.timestamp >= before).toBe(true);
    expect(e.timestamp <= after).toBe(true);
    // Sanity-check the ISO shape.
    expect(e.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("honors an explicit `timestamp` override", () => {
    const e = makeAuditEntry({
      runId: "r",
      schemaId: "s",
      fromVersion: "1",
      toVersion: "2",
      chainEntries: CHAIN_ENTRIES_FIXTURE,
      recordIndex: 0,
      status: "success",
      timestamp: "2020-01-01T00:00:00.000Z",
    });
    expect(e.timestamp).toBe("2020-01-01T00:00:00.000Z");
  });

  it("emits failure shape correctly when status === 'failure'", () => {
    const e = makeAuditEntry({
      runId: "r",
      schemaId: "s",
      fromVersion: "1",
      toVersion: "2",
      chainEntries: CHAIN_ENTRIES_FIXTURE,
      recordIndex: 0,
      status: "failure",
      classification: "transform_threw",
      errorMessage: "boom",
    });
    expect(e.status).toBe("failure");
    expect(e.classification).toBe("transform_threw");
    expect(e.errorMessage).toBe("boom");
  });
});

// =============================================================================
// 9. public-entry runtime export gate
// =============================================================================

describe("audit — public-entry runtime export gate", () => {
  it("`createMemoryAuditAdapter` re-exports identity-preserved from the package entry", () => {
    expect(publicCreateMemoryAuditAdapter).toBe(createMemoryAuditAdapter);
  });

  it("`makeAuditEntry` re-exports identity-preserved from the package entry", () => {
    expect(publicMakeAuditEntry).toBe(makeAuditEntry);
  });

  it("both helpers are functions at runtime", () => {
    expect(typeof publicCreateMemoryAuditAdapter).toBe("function");
    expect(typeof publicMakeAuditEntry).toBe("function");
  });
});

// =============================================================================
// 10. Static-scan boundary on audit.ts
// =============================================================================

describe("audit — Step 5 source discipline (static scan)", () => {
  const SRC = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "src",
      "audit.ts",
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
    // The in-memory audit adapter does not write to disk; persistent
    // adapters land in Step 7 in `adapters/jsonl-audit.ts`.
    { name: "fs import", pattern: /\bfrom\s+["'](?:node:)?fs(?:\/|["'])/ },
    // The v0.8 boundary — only per-record-pipeline.ts may call
    // `.transform(`. Audit has no business invoking a migration.
    { name: ".transform(", pattern: /\.transform\s*\(/ },
  ];

  it.each(FORBIDDEN)(
    "audit source contains no `$name`",
    ({ pattern }) => {
      expect(STRIPPED).not.toMatch(pattern);
    },
  );
});
