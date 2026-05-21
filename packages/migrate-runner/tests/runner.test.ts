/**
 * Step 6 — runner orchestrator gate.
 *
 * Exercises `createMigrationRunner(options).run(opts)` end-to-end
 * against in-memory schemas / migrations / input streams / output
 * sinks. Every fixture uses real (non-poison) transforms because
 * the orchestrator delegates `.transform(...)` to the per-record
 * pipeline (Step 4); the runner's own static-scan still bans
 * `.transform(`, proving the orchestrator does not invoke transforms
 * directly.
 *
 * Scenarios (locked test surface):
 *   - factory uses provided adapters (audit + output)
 *   - factory creates a default memory audit adapter when omitted
 *   - pre-flight failure short-circuits before stream / persist /
 *     transform
 *   - empty-chain pre-flight success short-circuits cleanly
 *   - dry-run runs the pipeline but never persists
 *   - execute persists successful outputs
 *   - validate-only is pre-flight-only (stream not consumed)
 *   - audit success entry written
 *   - audit failure entry written
 *   - auditBefore / auditAfter respected
 *   - persist failure classified `persist_failed` and audited
 *   - output flush called in execute when available
 *   - flush failure classified `persist_failed`
 *   - onError continue processes later records
 *   - onError stop halts after first failure
 *   - resume skips cursor-success indexes
 *   - AbortSignal before stream / between records → `cancelled`
 *   - sequential ordering preserved
 *   - public-entry runtime export gate
 *   - static scan: runner.ts has no `console.*`, no `process.*`,
 *     no `fs` imports, NO `.transform(`
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { irHash, s } from "@nekostack/schema";
import {
  buildRegistry,
  sourceHashFromText,
} from "@nekostack/schema/cli";
import type {
  AnyMigration,
  MigrationEntry,
  Registry,
} from "@nekostack/schema/cli";
import { createMigrationRunner } from "../src/runner.js";
import { createMigrationRunner as publicCreateMigrationRunner } from "../src/index.js";
import {
  createMemoryAuditAdapter,
  makeAuditEntry,
} from "../src/audit.js";
import type {
  AuditEntry,
  InputAdapter,
  MemoryAuditAdapter,
  MigrationRegistry,
  OutputAdapter,
} from "../src/types.js";

// =============================================================================
// Setup helpers
// =============================================================================

type RegFixture = {
  registry: Registry;
  irHashes: Record<string, `sha256:${string}`>;
  sourceHashes: Record<string, `sha256:${string}`>;
};

function buildSchemaReg(
  schemas: ReadonlyArray<{
    id: string;
    version: string;
    schema: ReturnType<typeof s.object>;
  }>,
): RegFixture {
  const irHashes: Record<string, `sha256:${string}`> = {};
  const sourceHashes: Record<string, `sha256:${string}`> = {};
  const entries = schemas.map((row) => {
    const key = `${row.id}@${row.version}`;
    const sourcePath = `${row.id.replace(/\./g, "_")}-${row.version}.schema.ts`;
    const sourceText = `// fixture source for ${key}\n`;
    irHashes[key] = `sha256:${irHash(row.schema.node)}` as `sha256:${string}`;
    sourceHashes[key] = sourceHashFromText(sourceText);
    return { sourcePath, sourceText, schemas: [row.schema] };
  });
  const r = buildRegistry(entries);
  if (!r.success) {
    throw new Error(
      `schema registry build failed: ${JSON.stringify(r.issues)}`,
    );
  }
  return { registry: r.data, irHashes, sourceHashes };
}

function makeMigration(opts: {
  schemaId: string;
  fromVersion: string;
  toVersion: string;
  fromIrHash: `sha256:${string}`;
  toIrHash: `sha256:${string}`;
  fromSourceHash: `sha256:${string}`;
  toSourceHash: `sha256:${string}`;
  transform: (input: unknown) => unknown;
}): MigrationEntry {
  const mig: AnyMigration = {
    schemaId: opts.schemaId,
    from: opts.fromVersion,
    to: opts.toVersion,
    transform: opts.transform as AnyMigration["transform"],
  };
  return {
    schemaId: opts.schemaId,
    fromVersion: opts.fromVersion,
    toVersion: opts.toVersion,
    fromIrHash: opts.fromIrHash,
    toIrHash: opts.toIrHash,
    fromSourceHash: opts.fromSourceHash,
    toSourceHash: opts.toSourceHash,
    sourcePath: `migrations/${opts.schemaId.replace(/\./g, "_")}.${opts.fromVersion}-to-${opts.toVersion}.migration.ts`,
    migration: mig,
  };
}

function buildMigReg(entries: readonly MigrationEntry[]): MigrationRegistry {
  const out = new Map<
    string,
    Map<string, Map<string, MigrationEntry>>
  >();
  for (const e of entries) {
    let byFrom = out.get(e.schemaId);
    if (byFrom === undefined) {
      byFrom = new Map();
      out.set(e.schemaId, byFrom);
    }
    let byTo = byFrom.get(e.fromVersion);
    if (byTo === undefined) {
      byTo = new Map();
      byFrom.set(e.fromVersion, byTo);
    }
    byTo.set(e.toVersion, e);
  }
  return out as MigrationRegistry;
}

function makeInputAdapter<T>(items: readonly T[]): InputAdapter<T> {
  return {
    async *stream(): AsyncIterable<T> {
      for (const item of items) yield item;
    },
  };
}

function makeRecordingOutputAdapter(): {
  adapter: OutputAdapter;
  persisted: unknown[];
  flushCount: { n: number };
} {
  const persisted: unknown[] = [];
  const flushCount = { n: 0 };
  const adapter: OutputAdapter = {
    async persist(record) {
      persisted.push(record);
    },
    async flush() {
      flushCount.n += 1;
    },
  };
  return { adapter, persisted, flushCount };
}

// Shared schemas used across most tests.
const SCHEMA_ID = "com.fix.runner.Step6";
const v1 = s.object({ value: s.string() }).id(SCHEMA_ID).version("1.0.0");
const v2 = s.object({ value: s.number() }).id(SCHEMA_ID).version("2.0.0");
const STR_TO_NUM = (input: unknown) => {
  const r = input as { value: string };
  return { value: Number(r.value) };
};

function setupBoundFixture() {
  const { registry, irHashes, sourceHashes } = buildSchemaReg([
    { id: SCHEMA_ID, version: "1.0.0", schema: v1 },
    { id: SCHEMA_ID, version: "2.0.0", schema: v2 },
  ]);
  const migReg = buildMigReg([
    makeMigration({
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      fromIrHash: irHashes[`${SCHEMA_ID}@1.0.0`]!,
      toIrHash: irHashes[`${SCHEMA_ID}@2.0.0`]!,
      fromSourceHash: sourceHashes[`${SCHEMA_ID}@1.0.0`]!,
      toSourceHash: sourceHashes[`${SCHEMA_ID}@2.0.0`]!,
      transform: STR_TO_NUM,
    }),
  ]);
  return { registry, migReg };
}

// =============================================================================
// Factory wiring
// =============================================================================

describe("createMigrationRunner — factory wiring", () => {
  it("uses the supplied audit adapter", () => {
    const { registry, migReg } = setupBoundFixture();
    const audit = createMemoryAuditAdapter();
    const { adapter: out } = makeRecordingOutputAdapter();
    const runner = createMigrationRunner({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      inputAdapter: makeInputAdapter([]),
      outputAdapter: out,
      auditAdapter: audit,
    });
    expect(runner.auditAdapter).toBe(audit);
  });

  it("creates a default memory audit adapter when omitted", () => {
    const { registry, migReg } = setupBoundFixture();
    const { adapter: out } = makeRecordingOutputAdapter();
    const runner = createMigrationRunner({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      inputAdapter: makeInputAdapter([]),
      outputAdapter: out,
    });
    // The default is a memory adapter — it exposes `.entries`.
    expect(typeof (runner.auditAdapter as MemoryAuditAdapter).entries).toBe(
      "object",
    );
    expect(
      Array.isArray((runner.auditAdapter as MemoryAuditAdapter).entries),
    ).toBe(true);
  });
});

// =============================================================================
// Pre-flight short-circuits
// =============================================================================

describe("run — pre-flight failure short-circuits before stream / persist / transform", () => {
  it("returns RunFailure with classification `pre_flight_failed`; no stream consumed; no persist; no transform", async () => {
    const { registry, irHashes, sourceHashes } = buildSchemaReg([
      { id: SCHEMA_ID, version: "1.0.0", schema: v1 },
      { id: SCHEMA_ID, version: "2.0.0", schema: v2 },
    ]);
    // No migration registered for the breaking v1→v2 transition →
    // planner returns migration_not_found → pre-flight refuses.
    void irHashes;
    void sourceHashes;
    const migReg = buildMigReg([]);

    let streamRead = false;
    let persisted = false;
    const inputAdapter: InputAdapter<unknown> = {
      async *stream() {
        streamRead = true;
        yield { value: "x" };
      },
    };
    const outputAdapter: OutputAdapter = {
      async persist() {
        persisted = true;
      },
    };
    const audit = createMemoryAuditAdapter();
    const runner = createMigrationRunner({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      inputAdapter,
      outputAdapter,
      auditAdapter: audit,
    });
    const r = await runner.run({
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      mode: "execute",
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.classification).toBe("pre_flight_failed");
    expect(streamRead).toBe(false);
    expect(persisted).toBe(false);
    expect(audit.entries).toEqual([]);
  });
});

// =============================================================================
// Empty-chain short-circuit
// =============================================================================

describe("run — empty-chain pre-flight success short-circuits cleanly", () => {
  it("returns RunSuccess with counts 0 and never reads the stream", async () => {
    // Same-version fromVersion=toVersion → planner returns null
    // severity + empty chain.
    const { registry, irHashes, sourceHashes } = buildSchemaReg([
      { id: SCHEMA_ID, version: "1.0.0", schema: v1 },
    ]);
    void irHashes;
    void sourceHashes;
    const migReg = buildMigReg([]);

    let streamRead = false;
    const inputAdapter: InputAdapter<unknown> = {
      async *stream() {
        streamRead = true;
        yield { value: "x" };
      },
    };
    const { adapter: out } = makeRecordingOutputAdapter();
    const audit = createMemoryAuditAdapter();
    const runner = createMigrationRunner({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      inputAdapter,
      outputAdapter: out,
      auditAdapter: audit,
    });
    const r = await runner.run({
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "1.0.0",
      mode: "execute",
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.recordCount).toBe(0);
    expect(r.successCount).toBe(0);
    expect(r.failureCount).toBe(0);
    expect(streamRead).toBe(false);
    expect(audit.entries).toEqual([]);
  });
});

// =============================================================================
// Mode dispatch
// =============================================================================

describe("run — mode dispatch", () => {
  it("`dry-run` runs the pipeline but never persists", async () => {
    const { registry, migReg } = setupBoundFixture();
    const { adapter: out, persisted } = makeRecordingOutputAdapter();
    const audit = createMemoryAuditAdapter();
    const runner = createMigrationRunner({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      inputAdapter: makeInputAdapter([{ value: "1" }, { value: "2" }]),
      outputAdapter: out,
      auditAdapter: audit,
    });
    const r = await runner.run({
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      mode: "dry-run",
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.successCount).toBe(2);
    expect(persisted).toEqual([]);
    expect(audit.entries).toHaveLength(2);
    expect(audit.entries.every((e) => e.status === "success")).toBe(true);
  });

  it("`execute` persists every successful output in order", async () => {
    const { registry, migReg } = setupBoundFixture();
    const { adapter: out, persisted } = makeRecordingOutputAdapter();
    const runner = createMigrationRunner({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      inputAdapter: makeInputAdapter([
        { value: "1" },
        { value: "2" },
        { value: "3" },
      ]),
      outputAdapter: out,
    });
    const r = await runner.run({
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      mode: "execute",
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.recordCount).toBe(3);
    expect(r.successCount).toBe(3);
    expect(persisted).toEqual([
      { value: 1 },
      { value: 2 },
      { value: 3 },
    ]);
  });

  it("`validate-only` is pre-flight-only — stream not consumed; no persist; no audit", async () => {
    const { registry, migReg } = setupBoundFixture();
    let streamRead = false;
    const inputAdapter: InputAdapter<unknown> = {
      async *stream() {
        streamRead = true;
        yield { value: "1" };
      },
    };
    const { adapter: out, persisted } = makeRecordingOutputAdapter();
    const audit = createMemoryAuditAdapter();
    const runner = createMigrationRunner({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      inputAdapter,
      outputAdapter: out,
      auditAdapter: audit,
    });
    const r = await runner.run({
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      mode: "validate-only",
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.mode).toBe("validate-only");
    expect(r.recordCount).toBe(0);
    expect(streamRead).toBe(false);
    expect(persisted).toEqual([]);
    expect(audit.entries).toEqual([]);
  });
});

// =============================================================================
// Audit entries
// =============================================================================

describe("run — audit entries", () => {
  it("writes a success audit entry per successful record", async () => {
    const { registry, migReg } = setupBoundFixture();
    const { adapter: out } = makeRecordingOutputAdapter();
    const audit = createMemoryAuditAdapter();
    const runner = createMigrationRunner({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      inputAdapter: makeInputAdapter([{ value: "1" }]),
      outputAdapter: out,
      auditAdapter: audit,
    });
    const r = await runner.run({
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      mode: "execute",
    });
    expect(r.success).toBe(true);
    expect(audit.entries).toHaveLength(1);
    expect(audit.entries[0]!.status).toBe("success");
    expect(audit.entries[0]!.recordIndex).toBe(0);
    expect(audit.entries[0]!.runId).toBe((r as { runId: string }).runId);
    expect(audit.entries[0]!.__auditSchemaVersion).toBe("1");
  });

  it("writes a failure audit entry per failed record (input validation)", async () => {
    const { registry, migReg } = setupBoundFixture();
    const { adapter: out } = makeRecordingOutputAdapter();
    const audit = createMemoryAuditAdapter();
    const runner = createMigrationRunner({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      // Input is a number — source schema requires string.
      inputAdapter: makeInputAdapter([{ value: 42 }]),
      outputAdapter: out,
      auditAdapter: audit,
    });
    const r = await runner.run({
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      mode: "execute",
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.classification).toBe("input_validation_failed");
    expect(audit.entries).toHaveLength(1);
    expect(audit.entries[0]!.status).toBe("failure");
    expect(audit.entries[0]!.classification).toBe("input_validation_failed");
  });

  it("respects `auditBefore: true` (before populated) — `auditAfter: true` (after populated)", async () => {
    const { registry, migReg } = setupBoundFixture();
    const { adapter: out } = makeRecordingOutputAdapter();
    const audit = createMemoryAuditAdapter();
    const runner = createMigrationRunner({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      inputAdapter: makeInputAdapter([{ value: "7" }]),
      outputAdapter: out,
      auditAdapter: audit,
    });
    await runner.run({
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      mode: "execute",
      auditBefore: true,
      auditAfter: true,
    });
    expect(audit.entries[0]!.before).toEqual({ value: "7" });
    expect(audit.entries[0]!.after).toEqual({ value: 7 });
  });

  it("`auditBefore: false` / `auditAfter: false` → entries omit `before` / `after`", async () => {
    const { registry, migReg } = setupBoundFixture();
    const { adapter: out } = makeRecordingOutputAdapter();
    const audit = createMemoryAuditAdapter();
    const runner = createMigrationRunner({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      inputAdapter: makeInputAdapter([{ value: "7" }]),
      outputAdapter: out,
      auditAdapter: audit,
    });
    await runner.run({
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      mode: "execute",
    });
    const e = audit.entries[0]!;
    expect("before" in e).toBe(false);
    expect("after" in e).toBe(false);
  });
});

// =============================================================================
// Persist + flush
// =============================================================================

describe("run — persist failure handling", () => {
  it("persist throw → classification `persist_failed` + audit failure + onError continue", async () => {
    const { registry, migReg } = setupBoundFixture();
    let persistCount = 0;
    const persisted: unknown[] = [];
    const outputAdapter: OutputAdapter = {
      async persist(record) {
        persistCount += 1;
        if (persistCount === 2) throw new Error("disk full");
        persisted.push(record);
      },
    };
    const audit = createMemoryAuditAdapter();
    const runner = createMigrationRunner({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      inputAdapter: makeInputAdapter([
        { value: "1" },
        { value: "2" },
        { value: "3" },
      ]),
      outputAdapter,
      auditAdapter: audit,
    });
    const r = await runner.run({
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      mode: "execute",
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.classification).toBe("persist_failed");
    expect(r.successCount).toBe(2);
    expect(r.failureCount).toBe(1);
    expect(persisted).toEqual([{ value: 1 }, { value: 3 }]);
    // The second record is in the audit log with persist_failed.
    const failed = audit.entries.find(
      (e) => e.status === "failure" && e.recordIndex === 1,
    );
    expect(failed?.classification).toBe("persist_failed");
  });
});

describe("run — flush behavior in execute mode", () => {
  it("calls `outputAdapter.flush` once after the stream when present", async () => {
    const { registry, migReg } = setupBoundFixture();
    const { adapter, flushCount } = makeRecordingOutputAdapter();
    const runner = createMigrationRunner({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      inputAdapter: makeInputAdapter([{ value: "1" }, { value: "2" }]),
      outputAdapter: adapter,
    });
    const r = await runner.run({
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      mode: "execute",
    });
    expect(r.success).toBe(true);
    expect(flushCount.n).toBe(1);
  });

  it("flush throw → classification `persist_failed`", async () => {
    const { registry, migReg } = setupBoundFixture();
    const outputAdapter: OutputAdapter = {
      async persist() {
        /* noop */
      },
      async flush() {
        throw new Error("flush dead");
      },
    };
    const runner = createMigrationRunner({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      inputAdapter: makeInputAdapter([{ value: "1" }]),
      outputAdapter,
    });
    const r = await runner.run({
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      mode: "execute",
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.classification).toBe("persist_failed");
    expect(r.errorMessage).toContain("flush");
  });

  it("dry-run does NOT call flush", async () => {
    const { registry, migReg } = setupBoundFixture();
    const { adapter, flushCount } = makeRecordingOutputAdapter();
    const runner = createMigrationRunner({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      inputAdapter: makeInputAdapter([{ value: "1" }]),
      outputAdapter: adapter,
    });
    await runner.run({
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      mode: "dry-run",
    });
    expect(flushCount.n).toBe(0);
  });
});

// =============================================================================
// onError policy
// =============================================================================

describe("run — onError policy", () => {
  it("`continue` (default) processes later records after a per-record failure", async () => {
    const { registry, migReg } = setupBoundFixture();
    const { adapter: out, persisted } = makeRecordingOutputAdapter();
    const audit = createMemoryAuditAdapter();
    const runner = createMigrationRunner({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      // Record 1 (index 1) fails input validation; records 0 and
      // 2 succeed.
      inputAdapter: makeInputAdapter([
        { value: "1" },
        { value: 42 } as unknown,
        { value: "3" },
      ]),
      outputAdapter: out,
      auditAdapter: audit,
    });
    const r = await runner.run({
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      mode: "execute",
      // onError omitted → default "continue"
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.successCount).toBe(2);
    expect(r.failureCount).toBe(1);
    expect(r.recordCount).toBe(3);
    expect(persisted).toEqual([{ value: 1 }, { value: 3 }]);
    expect(audit.entries).toHaveLength(3);
  });

  it("`stop` halts after the first per-record failure; later records not processed", async () => {
    const { registry, migReg } = setupBoundFixture();
    const { adapter: out, persisted } = makeRecordingOutputAdapter();
    const audit = createMemoryAuditAdapter();
    const runner = createMigrationRunner({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      inputAdapter: makeInputAdapter([
        { value: "1" },
        { value: 42 } as unknown,
        { value: "3" },
      ]),
      outputAdapter: out,
      auditAdapter: audit,
    });
    const r = await runner.run({
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      mode: "execute",
      onError: "stop",
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.classification).toBe("input_validation_failed");
    expect(r.successCount).toBe(1);
    expect(r.failureCount).toBe(1);
    // Only the first record was persisted; the second failed and
    // halted the run before processing record index 2.
    expect(persisted).toEqual([{ value: 1 }]);
    expect(audit.entries).toHaveLength(2);
  });
});

// =============================================================================
// Resume cursor
// =============================================================================

describe("run — resume from cursor", () => {
  it("skips record indexes the audit cursor marks as `success` for the resumed runId", async () => {
    const { registry, migReg } = setupBoundFixture();
    const audit = createMemoryAuditAdapter();
    // Seed the audit log: pretend run-A processed records 0 and 2
    // successfully and record 1 failed.
    const resumeRunId = "run-A";
    const chainEntries: AuditEntry["chainEntries"] = [
      {
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        sourcePath: "migrations/com_fix_runner_Step6.1.0.0-to-2.0.0.migration.ts",
      },
    ];
    await audit.append(
      makeAuditEntry({
        runId: resumeRunId,
        schemaId: SCHEMA_ID,
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        chainEntries,
        recordIndex: 0,
        status: "success",
      }),
    );
    await audit.append(
      makeAuditEntry({
        runId: resumeRunId,
        schemaId: SCHEMA_ID,
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        chainEntries,
        recordIndex: 1,
        status: "failure",
        classification: "transform_threw",
        errorMessage: "old",
      }),
    );
    await audit.append(
      makeAuditEntry({
        runId: resumeRunId,
        schemaId: SCHEMA_ID,
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        chainEntries,
        recordIndex: 2,
        status: "success",
      }),
    );

    const { adapter: out, persisted } = makeRecordingOutputAdapter();
    const runner = createMigrationRunner({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      inputAdapter: makeInputAdapter([
        { value: "a-0" },
        { value: "1" },
        { value: "a-2" },
      ]),
      outputAdapter: out,
      auditAdapter: audit,
    });
    const r = await runner.run({
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      mode: "execute",
      resumeFrom: { runId: resumeRunId },
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    // recordCount counts every record the stream yielded (3),
    // including the skipped ones; successCount counts only the
    // actually-processed-and-succeeded records (1 — index 1).
    expect(r.recordCount).toBe(3);
    expect(r.successCount).toBe(1);
    expect(r.runId).toBe(resumeRunId); // resumed runId is reused
    expect(persisted).toEqual([{ value: 1 }]);
  });
});

// =============================================================================
// AbortSignal cancellation
// =============================================================================

describe("run — AbortSignal cancellation", () => {
  it("pre-stream abort → RunFailure classification `cancelled`; stream never read", async () => {
    const { registry, migReg } = setupBoundFixture();
    let streamRead = false;
    const inputAdapter: InputAdapter<unknown> = {
      async *stream() {
        streamRead = true;
        yield { value: "1" };
      },
    };
    const { adapter: out } = makeRecordingOutputAdapter();
    const ac = new AbortController();
    ac.abort();
    const runner = createMigrationRunner({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      inputAdapter,
      outputAdapter: out,
    });
    const r = await runner.run({
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      mode: "execute",
      signal: ac.signal,
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.classification).toBe("cancelled");
    expect(streamRead).toBe(false);
  });

  it("between-records abort → cancelled after N records processed", async () => {
    const { registry, migReg } = setupBoundFixture();
    const ac = new AbortController();
    let yielded = 0;
    const inputAdapter: InputAdapter<unknown> = {
      async *stream() {
        for (let i = 0; i < 5; i++) {
          if (yielded === 2) {
            // Trigger cancellation after the runner's loop body
            // processed two records. The next iteration of the
            // runner's for-await will see signal.aborted and return.
            ac.abort();
          }
          yielded += 1;
          yield { value: String(i) };
        }
      },
    };
    const { adapter: out, persisted } = makeRecordingOutputAdapter();
    const runner = createMigrationRunner({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      inputAdapter,
      outputAdapter: out,
    });
    const r = await runner.run({
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      mode: "execute",
      signal: ac.signal,
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.classification).toBe("cancelled");
    // Some records were persisted before the abort fired; the
    // count is deterministic given our stream's behavior (we
    // abort after `yielded === 2`, which fires on the 3rd yield).
    expect(persisted.length).toBeGreaterThan(0);
    expect(persisted.length).toBeLessThan(5);
  });
});

// =============================================================================
// Sequential ordering
// =============================================================================

describe("run — sequential ordering preserved", () => {
  it("audit entries are written in input-stream order; persisted records in same order", async () => {
    const { registry, migReg } = setupBoundFixture();
    const { adapter: out, persisted } = makeRecordingOutputAdapter();
    const audit = createMemoryAuditAdapter();
    const runner = createMigrationRunner({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      inputAdapter: makeInputAdapter([
        { value: "10" },
        { value: "20" },
        { value: "30" },
        { value: "40" },
      ]),
      outputAdapter: out,
      auditAdapter: audit,
    });
    await runner.run({
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      mode: "execute",
    });
    expect(audit.entries.map((e) => e.recordIndex)).toEqual([0, 1, 2, 3]);
    expect(persisted).toEqual([
      { value: 10 },
      { value: 20 },
      { value: 30 },
      { value: 40 },
    ]);
  });
});

// =============================================================================
// Locked Step 6 contract shapes (regression guard, round-2 cleanup)
// =============================================================================
//
// The Step 6 implementation made specific calls that the type
// JSDoc now documents:
//   - validate-only writes NO per-record audit entries (stream
//     not consumed)
//   - empty-chain no-op writes NO per-record audit entries
//   - pre-stream cancellation returns `cancelled` with all counts
//     at 0 (NOT failureCount > 0 — failureCount is `0` here)
//   - pre-flight failure returns `pre_flight_failed` and
//     deliberately OMITS recordCount / successCount / failureCount
//     (the runner never began the record walk)
//
// These behaviors are partially asserted by earlier blocks; this
// block locks them as explicit regression sentinels so the chosen
// Step 6 interpretation cannot drift silently.

describe("createMigrationRunner — locked Step 6 no-record-walk shapes", () => {
  it("validate-only writes NO audit entries (even when the stream has items it never consumed)", async () => {
    const { registry, migReg } = setupBoundFixture();
    const { adapter: out } = makeRecordingOutputAdapter();
    const audit = createMemoryAuditAdapter();
    const runner = createMigrationRunner({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      inputAdapter: makeInputAdapter([
        { value: "1" },
        { value: "2" },
        { value: "3" },
      ]),
      outputAdapter: out,
      auditAdapter: audit,
    });
    const r = await runner.run({
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      mode: "validate-only",
      auditBefore: true,
      auditAfter: true, // even with retention flags on, no entries
    });
    expect(r.success).toBe(true);
    expect(audit.entries.length).toBe(0);
  });

  it("empty-chain no-op (from === to) writes NO audit entries", async () => {
    const { registry } = buildSchemaReg([
      { id: SCHEMA_ID, version: "1.0.0", schema: v1 },
    ]);
    const migReg = buildMigReg([]);
    const { adapter: out } = makeRecordingOutputAdapter();
    const audit = createMemoryAuditAdapter();
    const runner = createMigrationRunner({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      inputAdapter: makeInputAdapter([{ value: "x" }]),
      outputAdapter: out,
      auditAdapter: audit,
    });
    const r = await runner.run({
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "1.0.0",
      mode: "execute",
      auditBefore: true,
      auditAfter: true,
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.recordCount).toBe(0);
    expect(r.successCount).toBe(0);
    expect(r.failureCount).toBe(0);
    expect(audit.entries.length).toBe(0);
  });

  it("pre-stream cancellation returns RunFailure with classification === 'cancelled' AND failureCount === 0", async () => {
    const { registry, migReg } = setupBoundFixture();
    const { adapter: out } = makeRecordingOutputAdapter();
    const audit = createMemoryAuditAdapter();
    const ac = new AbortController();
    ac.abort();
    const runner = createMigrationRunner({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      inputAdapter: makeInputAdapter([{ value: "1" }, { value: "2" }]),
      outputAdapter: out,
      auditAdapter: audit,
    });
    const r = await runner.run({
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      mode: "execute",
      signal: ac.signal,
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.classification).toBe("cancelled");
    // Pre-stream cancellation: counts are present per the locked
    // RunFailure JSDoc (cancelled may have counts), and they're
    // all zero because no record was processed.
    expect(r.recordCount).toBe(0);
    expect(r.successCount).toBe(0);
    expect(r.failureCount).toBe(0);
    // Audit also empty — cancellation pre-stream means no entries.
    expect(audit.entries.length).toBe(0);
  });

  it("pre-flight failure returns RunFailure WITHOUT recordCount/successCount/failureCount keys", async () => {
    const { registry } = buildSchemaReg([
      { id: SCHEMA_ID, version: "1.0.0", schema: v1 },
      { id: SCHEMA_ID, version: "2.0.0", schema: v2 },
    ]);
    // No migration registered → planner refuses with
    // migration_not_found → pre-flight failure.
    const migReg = buildMigReg([]);
    const { adapter: out } = makeRecordingOutputAdapter();
    const audit = createMemoryAuditAdapter();
    const runner = createMigrationRunner({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      inputAdapter: makeInputAdapter([{ value: "1" }]),
      outputAdapter: out,
      auditAdapter: audit,
    });
    const r = await runner.run({
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      mode: "execute",
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.classification).toBe("pre_flight_failed");
    // The locked Step 6 RunFailure shape for pre_flight_failed
    // OMITS the record-walk counts because the walk never began.
    // Assert via `in` operator on the runtime value — this is the
    // strongest regression guard against the runner accidentally
    // populating those fields in the future.
    expect("recordCount" in r).toBe(false);
    expect("successCount" in r).toBe(false);
    expect("failureCount" in r).toBe(false);
    expect(audit.entries.length).toBe(0);
  });
});

// =============================================================================
// Public-entry runtime export gate
// =============================================================================

describe("createMigrationRunner — public-entry runtime export gate", () => {
  it("`@nekostack/migrate-runner`'s package entry re-exports `createMigrationRunner` identity-preserved", () => {
    expect(publicCreateMigrationRunner).toBe(createMigrationRunner);
  });
});

// =============================================================================
// Static-scan boundary
// =============================================================================

describe("runner — Step 6 source discipline (static scan)", () => {
  const SRC = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "src",
      "runner.ts",
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
    // The runner is NOT the per-record pipeline; it MUST NOT
    // invoke a migration's transform. Every transform call
    // flows through runRecordPipeline (Step 4).
    { name: ".transform(", pattern: /\.transform\s*\(/ },
    // `node:fs` / `fs` imports — the orchestrator delegates I/O
    // to adapters; no direct filesystem access.
    { name: "fs import", pattern: /\bfrom\s+["'](?:node:)?fs(?:\/|["'])/ },
  ];

  it.each(FORBIDDEN)(
    "runner source contains no `$name`",
    ({ pattern }) => {
      expect(STRIPPED).not.toMatch(pattern);
    },
  );
});

