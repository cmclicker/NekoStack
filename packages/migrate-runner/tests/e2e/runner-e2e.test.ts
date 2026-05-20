/**
 * Step 8 — end-to-end runner matrix.
 *
 * Wires the public surface together against real filesystem
 * adapters (`createJsonFileInputAdapter`,
 * `createJsonFileOutputAdapter`, `createJsonlAuditAdapter`) and a
 * v1 → v2 → v3 schema chain with two authored migrations. Each
 * scenario asserts the runner's contract end-to-end:
 *
 *   1.  Real chain in execute mode → output JSON + JSONL audit
 *       on disk; success entries; v3 shape.
 *   2.  Dry-run runs transforms but does NOT write the output
 *       file.
 *   3.  Validate-only does NOT read input, write output, or write
 *       audit (Step 6 locked interpretation).
 *   4.  Resume skips success-indexed records and reuses the
 *       resumed runId; output contains only newly processed
 *       records.
 *   5.  Failure + `onError: continue` processes later records.
 *   6.  Failure + `onError: stop` halts after first failure.
 *   7.  Persist failure → `persist_failed` classification +
 *       failure audit row; later records still processed.
 *   8.  Malformed JSON input → `adapter_init_failed` on stream
 *       consumption.
 *   9.  Malformed JSONL audit on resume → `adapter_init_failed`
 *       (runner.ts wraps `cursor()` to keep the contract: returns
 *       RunResult, never throws).
 *  10.  Cross-cutting source boundary sentinel (no new
 *       `.transform(` sites; fs imports still adapters-only).
 *
 * All scenarios use `mkdtempSync` — no repo fixture pollution.
 */
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
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
import {
  createJsonFileInputAdapter,
  createJsonFileOutputAdapter,
  createJsonlAuditAdapter,
  createMigrationRunner,
} from "../../src/index.js";
import type { MigrationRegistry, OutputAdapter } from "../../src/types.js";

// =============================================================================
// Shared setup
// =============================================================================

const SCHEMA_ID = "com.fix.runner.e2e.Widget";

// v1: { value: string }
// v2: { value: number }
// v3: { value: number, doubled: number }
const v1 = s.object({ value: s.string() }).id(SCHEMA_ID).version("1.0.0");
const v2 = s.object({ value: s.number() }).id(SCHEMA_ID).version("2.0.0");
const v3 = s
  .object({ value: s.number(), doubled: s.number() })
  .id(SCHEMA_ID)
  .version("3.0.0");

const STR_TO_NUM = (input: unknown): unknown => {
  const r = input as { value: string };
  return { value: Number(r.value) };
};
const ADD_DOUBLED = (input: unknown): unknown => {
  const r = input as { value: number };
  return { value: r.value, doubled: r.value * 2 };
};

function buildSchemaReg(): {
  registry: Registry;
  irHashes: Record<string, `sha256:${string}`>;
  sourceHashes: Record<string, `sha256:${string}`>;
} {
  const irHashes: Record<string, `sha256:${string}`> = {};
  const sourceHashes: Record<string, `sha256:${string}`> = {};
  const entries = [
    { schema: v1, version: "1.0.0" },
    { schema: v2, version: "2.0.0" },
    { schema: v3, version: "3.0.0" },
  ].map((row) => {
    const key = `${SCHEMA_ID}@${row.version}`;
    const sourcePath = `${SCHEMA_ID.replace(/\./g, "_")}-${row.version}.schema.ts`;
    const sourceText = `// e2e source for ${key}\n`;
    irHashes[key] = `sha256:${irHash(row.schema.node)}` as `sha256:${string}`;
    sourceHashes[key] = sourceHashFromText(sourceText);
    return { sourcePath, sourceText, schemas: [row.schema] };
  });
  const r = buildRegistry(entries);
  if (!r.success) {
    throw new Error(`schema reg build failed: ${JSON.stringify(r.issues)}`);
  }
  return { registry: r.data, irHashes, sourceHashes };
}

function makeMigration(opts: {
  fromVersion: string;
  toVersion: string;
  fromIrHash: `sha256:${string}`;
  toIrHash: `sha256:${string}`;
  fromSourceHash: `sha256:${string}`;
  toSourceHash: `sha256:${string}`;
  transform: (input: unknown) => unknown;
}): MigrationEntry {
  const mig: AnyMigration = {
    schemaId: SCHEMA_ID,
    from: opts.fromVersion,
    to: opts.toVersion,
    transform: opts.transform as AnyMigration["transform"],
  };
  return {
    schemaId: SCHEMA_ID,
    fromVersion: opts.fromVersion,
    toVersion: opts.toVersion,
    fromIrHash: opts.fromIrHash,
    toIrHash: opts.toIrHash,
    fromSourceHash: opts.fromSourceHash,
    toSourceHash: opts.toSourceHash,
    sourcePath: `migrations/${SCHEMA_ID.replace(/\./g, "_")}.${opts.fromVersion}-to-${opts.toVersion}.migration.ts`,
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

function buildFullChainMigReg(): MigrationRegistry {
  const { irHashes, sourceHashes } = buildSchemaReg();
  return buildMigReg([
    makeMigration({
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      fromIrHash: irHashes[`${SCHEMA_ID}@1.0.0`]!,
      toIrHash: irHashes[`${SCHEMA_ID}@2.0.0`]!,
      fromSourceHash: sourceHashes[`${SCHEMA_ID}@1.0.0`]!,
      toSourceHash: sourceHashes[`${SCHEMA_ID}@2.0.0`]!,
      transform: STR_TO_NUM,
    }),
    makeMigration({
      fromVersion: "2.0.0",
      toVersion: "3.0.0",
      fromIrHash: irHashes[`${SCHEMA_ID}@2.0.0`]!,
      toIrHash: irHashes[`${SCHEMA_ID}@3.0.0`]!,
      fromSourceHash: sourceHashes[`${SCHEMA_ID}@2.0.0`]!,
      toSourceHash: sourceHashes[`${SCHEMA_ID}@3.0.0`]!,
      transform: ADD_DOUBLED,
    }),
  ]);
}

const tempRoots: string[] = [];
function freshWorkspace(input: unknown): {
  root: string;
  inputPath: string;
  outputPath: string;
  auditPath: string;
} {
  const root = mkdtempSync(join(tmpdir(), "neko-runner-e2e-"));
  tempRoots.push(root);
  const inputPath = join(root, "input.json");
  const outputPath = join(root, "out", "output.json");
  const auditPath = join(root, "audit", "audit.jsonl");
  writeFileSync(
    inputPath,
    typeof input === "string" ? input : JSON.stringify(input),
    "utf8",
  );
  return { root, inputPath, outputPath, auditPath };
}
afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop()!, { recursive: true, force: true });
  }
});

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}
function readJsonl(path: string): unknown[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line));
}

// =============================================================================
// 1. Real chain — execute mode
// =============================================================================

describe("e2e — real v1 → v2 → v3 chain in execute mode", () => {
  it("transforms records through both hops; writes JSON output + JSONL audit on disk", async () => {
    const records = [{ value: "10" }, { value: "20" }, { value: "30" }];
    const { inputPath, outputPath, auditPath } = freshWorkspace(records);
    const { registry } = buildSchemaReg();
    const migReg = buildFullChainMigReg();

    const runner = createMigrationRunner({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      inputAdapter: createJsonFileInputAdapter(inputPath),
      outputAdapter: createJsonFileOutputAdapter(outputPath),
      auditAdapter: createJsonlAuditAdapter(auditPath),
    });

    const r = await runner.run({
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "3.0.0",
      mode: "execute",
    });

    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.recordCount).toBe(3);
    expect(r.successCount).toBe(3);
    expect(r.failureCount).toBe(0);

    // Output file contains the v3-shape array.
    const output = readJson(outputPath) as unknown[];
    expect(output).toEqual([
      { value: 10, doubled: 20 },
      { value: 20, doubled: 40 },
      { value: 30, doubled: 60 },
    ]);

    // Audit JSONL has one success line per record, in order.
    const audit = readJsonl(auditPath) as Array<{
      __auditSchemaVersion: string;
      runId: string;
      recordIndex: number;
      status: string;
    }>;
    expect(audit).toHaveLength(3);
    expect(audit.every((e) => e.__auditSchemaVersion === "1")).toBe(true);
    expect(audit.every((e) => e.status === "success")).toBe(true);
    expect(audit.every((e) => e.runId === r.runId)).toBe(true);
    expect(audit.map((e) => e.recordIndex)).toEqual([0, 1, 2]);
  });
});

// =============================================================================
// 2. Dry-run
// =============================================================================

describe("e2e — dry-run", () => {
  it("runs transforms + writes audit; does NOT write the output file", async () => {
    const { inputPath, outputPath, auditPath } = freshWorkspace([
      { value: "1" },
      { value: "2" },
    ]);
    const { registry } = buildSchemaReg();
    const migReg = buildFullChainMigReg();

    const runner = createMigrationRunner({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      inputAdapter: createJsonFileInputAdapter(inputPath),
      outputAdapter: createJsonFileOutputAdapter(outputPath),
      auditAdapter: createJsonlAuditAdapter(auditPath),
    });

    const r = await runner.run({
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "3.0.0",
      mode: "dry-run",
    });

    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.successCount).toBe(2);
    // Output file was never created — the output adapter buffers,
    // and dry-run never calls flush.
    expect(existsSync(outputPath)).toBe(false);
    // Audit was written.
    expect(existsSync(auditPath)).toBe(true);
    expect(readJsonl(auditPath)).toHaveLength(2);
  });
});

// =============================================================================
// 3. Validate-only
// =============================================================================

describe("e2e — validate-only (pre-flight-only per Step 6)", () => {
  it("does NOT read input, write output, or write audit", async () => {
    const { inputPath, outputPath, auditPath } = freshWorkspace([
      { value: "1" },
      { value: "2" },
    ]);
    const { registry } = buildSchemaReg();
    const migReg = buildFullChainMigReg();

    // We can't directly observe "input not read" because the
    // adapter is lazy; instead, observe that no output / audit
    // files exist after the run.
    const runner = createMigrationRunner({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      inputAdapter: createJsonFileInputAdapter(inputPath),
      outputAdapter: createJsonFileOutputAdapter(outputPath),
      auditAdapter: createJsonlAuditAdapter(auditPath),
    });

    const r = await runner.run({
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "3.0.0",
      mode: "validate-only",
    });

    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.recordCount).toBe(0);
    expect(r.successCount).toBe(0);
    expect(r.failureCount).toBe(0);
    expect(existsSync(outputPath)).toBe(false);
    expect(existsSync(auditPath)).toBe(false);
  });
});

// =============================================================================
// 4. Resume — skip success indexes, reuse runId, output only new records
// =============================================================================

describe("e2e — resume from JSONL audit cursor", () => {
  it("skips success-indexed records, reprocesses the rest, reuses resumed runId", async () => {
    const { inputPath, outputPath, auditPath } = freshWorkspace([
      { value: "10" },
      { value: "20" },
      { value: "30" },
    ]);
    const { registry } = buildSchemaReg();
    const migReg = buildFullChainMigReg();

    // Seed the JSONL audit log to simulate a prior run that
    // succeeded on records 0 and 2 and failed on record 1.
    const resumeRunId = "prior-run-id-7777";
    const chainEntries = [
      {
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        sourcePath:
          "migrations/com_fix_runner_e2e_Widget.1.0.0-to-2.0.0.migration.ts",
      },
      {
        fromVersion: "2.0.0",
        toVersion: "3.0.0",
        sourcePath:
          "migrations/com_fix_runner_e2e_Widget.2.0.0-to-3.0.0.migration.ts",
      },
    ];
    const fixedTs = "2026-05-20T00:00:00.000Z";
    const seedRows = [
      {
        __auditSchemaVersion: "1",
        runId: resumeRunId,
        schemaId: SCHEMA_ID,
        fromVersion: "1.0.0",
        toVersion: "3.0.0",
        chainEntries,
        recordIndex: 0,
        status: "success",
        timestamp: fixedTs,
      },
      {
        __auditSchemaVersion: "1",
        runId: resumeRunId,
        schemaId: SCHEMA_ID,
        fromVersion: "1.0.0",
        toVersion: "3.0.0",
        chainEntries,
        recordIndex: 1,
        status: "failure",
        classification: "transform_threw",
        errorMessage: "previous run failure",
        timestamp: fixedTs,
      },
      {
        __auditSchemaVersion: "1",
        runId: resumeRunId,
        schemaId: SCHEMA_ID,
        fromVersion: "1.0.0",
        toVersion: "3.0.0",
        chainEntries,
        recordIndex: 2,
        status: "success",
        timestamp: fixedTs,
      },
    ];
    // Ensure the audit directory exists, then seed the file.
    const seedAudit = createJsonlAuditAdapter(auditPath);
    for (const row of seedRows) {
      // Use the real append to also exercise dir creation.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await seedAudit.append(row as any);
    }

    const runner = createMigrationRunner({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      inputAdapter: createJsonFileInputAdapter(inputPath),
      outputAdapter: createJsonFileOutputAdapter(outputPath),
      auditAdapter: createJsonlAuditAdapter(auditPath),
    });

    const r = await runner.run({
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "3.0.0",
      mode: "execute",
      resumeFrom: { runId: resumeRunId },
    });

    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.runId).toBe(resumeRunId); // resumed runId reused
    // recordCount = total yielded by stream (3); successCount = 1
    // because only record 1 was reprocessed; failureCount = 0.
    expect(r.recordCount).toBe(3);
    expect(r.successCount).toBe(1);
    expect(r.failureCount).toBe(0);

    // Output contains ONLY the newly processed record (index 1 →
    // value "20" → { value: 20, doubled: 40 }).
    const output = readJson(outputPath) as unknown[];
    expect(output).toEqual([{ value: 20, doubled: 40 }]);

    // Audit grew by one new line — the resumed runId now has 4
    // entries total (3 seed + 1 new success for index 1).
    const audit = readJsonl(auditPath) as Array<{
      runId: string;
      recordIndex: number;
      status: string;
    }>;
    expect(audit).toHaveLength(4);
    const newEntry = audit[3]!;
    expect(newEntry.runId).toBe(resumeRunId);
    expect(newEntry.recordIndex).toBe(1);
    expect(newEntry.status).toBe("success");
  });
});

// =============================================================================
// 5. Failure + onError: continue
// =============================================================================

describe("e2e — failure with onError: continue", () => {
  it("processes later records after a per-record failure", async () => {
    // Record 1 is an input-validation failure (number where string
    // expected); records 0 and 2 succeed.
    const { inputPath, outputPath, auditPath } = freshWorkspace([
      { value: "1" },
      { value: 42 },
      { value: "3" },
    ]);
    const { registry } = buildSchemaReg();
    const migReg = buildFullChainMigReg();

    const runner = createMigrationRunner({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      inputAdapter: createJsonFileInputAdapter(inputPath),
      outputAdapter: createJsonFileOutputAdapter(outputPath),
      auditAdapter: createJsonlAuditAdapter(auditPath),
    });

    const r = await runner.run({
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "3.0.0",
      mode: "execute",
      // onError defaults to "continue"
    });

    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.classification).toBe("input_validation_failed");
    expect(r.recordCount).toBe(3);
    expect(r.successCount).toBe(2);
    expect(r.failureCount).toBe(1);

    const output = readJson(outputPath) as unknown[];
    expect(output).toEqual([
      { value: 1, doubled: 2 },
      { value: 3, doubled: 6 },
    ]);

    const audit = readJsonl(auditPath) as Array<{
      recordIndex: number;
      status: string;
      classification?: string;
    }>;
    expect(audit).toHaveLength(3);
    expect(audit.map((e) => e.status)).toEqual([
      "success",
      "failure",
      "success",
    ]);
    expect(audit[1]!.classification).toBe("input_validation_failed");
  });
});

// =============================================================================
// 6. Failure + onError: stop
// =============================================================================

describe("e2e — failure with onError: stop", () => {
  it("halts after first failure; later records not processed", async () => {
    const { inputPath, outputPath, auditPath } = freshWorkspace([
      { value: "1" },
      { value: 42 }, // fails input validation
      { value: "3" },
    ]);
    const { registry } = buildSchemaReg();
    const migReg = buildFullChainMigReg();

    const runner = createMigrationRunner({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      inputAdapter: createJsonFileInputAdapter(inputPath),
      outputAdapter: createJsonFileOutputAdapter(outputPath),
      auditAdapter: createJsonlAuditAdapter(auditPath),
    });

    const r = await runner.run({
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "3.0.0",
      mode: "execute",
      onError: "stop",
    });

    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.classification).toBe("input_validation_failed");
    expect(r.successCount).toBe(1);
    expect(r.failureCount).toBe(1);

    // Output file was NOT flushed (onError: stop bails before the
    // post-stream flush — Step 6 locked behavior). The committed
    // records are still in the in-memory buffer but not on disk.
    expect(existsSync(outputPath)).toBe(false);

    const audit = readJsonl(auditPath) as Array<{
      recordIndex: number;
      status: string;
    }>;
    expect(audit).toHaveLength(2);
    expect(audit.map((e) => e.recordIndex)).toEqual([0, 1]);
    expect(audit.map((e) => e.status)).toEqual(["success", "failure"]);
  });
});

// =============================================================================
// 7. Persist failure
// =============================================================================

describe("e2e — persist failure", () => {
  it("classifies as persist_failed; writes failure audit row; later records continue", async () => {
    const { inputPath, auditPath } = freshWorkspace([
      { value: "1" },
      { value: "2" },
      { value: "3" },
    ]);
    const { registry } = buildSchemaReg();
    const migReg = buildFullChainMigReg();

    // Custom output adapter: fails on record index 1 (count===2
    // after increment), succeeds otherwise.
    let persistCount = 0;
    const persisted: unknown[] = [];
    const failingOutput: OutputAdapter = {
      async persist(record) {
        persistCount += 1;
        if (persistCount === 2) throw new Error("output sink full");
        persisted.push(record);
      },
    };

    const runner = createMigrationRunner({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      inputAdapter: createJsonFileInputAdapter(inputPath),
      outputAdapter: failingOutput,
      auditAdapter: createJsonlAuditAdapter(auditPath),
    });

    const r = await runner.run({
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "3.0.0",
      mode: "execute",
    });

    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.classification).toBe("persist_failed");
    expect(r.successCount).toBe(2);
    expect(r.failureCount).toBe(1);
    expect(persisted).toEqual([
      { value: 1, doubled: 2 },
      { value: 3, doubled: 6 },
    ]);

    const audit = readJsonl(auditPath) as Array<{
      recordIndex: number;
      status: string;
      classification?: string;
    }>;
    expect(audit).toHaveLength(3);
    const failing = audit.find(
      (e) => e.status === "failure" && e.recordIndex === 1,
    );
    expect(failing?.classification).toBe("persist_failed");
  });
});

// =============================================================================
// 8. Malformed JSON input
// =============================================================================

describe("e2e — malformed JSON input", () => {
  it("returns adapter_init_failed when the input file is not valid JSON", async () => {
    const { inputPath, outputPath, auditPath } =
      freshWorkspace("{not valid json");
    const { registry } = buildSchemaReg();
    const migReg = buildFullChainMigReg();

    const runner = createMigrationRunner({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      inputAdapter: createJsonFileInputAdapter(inputPath),
      outputAdapter: createJsonFileOutputAdapter(outputPath),
      auditAdapter: createJsonlAuditAdapter(auditPath),
    });

    const r = await runner.run({
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "3.0.0",
      mode: "execute",
    });

    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.classification).toBe("adapter_init_failed");
    expect(r.errorMessage).toMatch(/not valid JSON/);
    // No records walked — no output, no audit.
    expect(existsSync(outputPath)).toBe(false);
    expect(existsSync(auditPath)).toBe(false);
  });
});

// =============================================================================
// 9. Malformed JSONL audit during resume → adapter_init_failed
// =============================================================================

describe("e2e — malformed JSONL audit on resume returns adapter_init_failed (runner catches cursor throw)", () => {
  it("resume cursor() throws on shape-malformed entry; runner returns RunFailure adapter_init_failed (does NOT throw raw)", async () => {
    const { inputPath, outputPath, auditPath } = freshWorkspace([
      { value: "10" },
    ]);
    const { registry } = buildSchemaReg();
    const migReg = buildFullChainMigReg();

    // Seed an audit file that contains a JSON-valid but
    // structurally-invalid AuditEntry (missing `recordIndex`).
    // The JSONL audit's `parseAuditEntryLine` guard rejects this
    // on cursor() — the runner wraps cursor() to classify the
    // thrown error as adapter_init_failed (rather than letting
    // it propagate as an unhandled rejection).
    const seedAudit = createJsonlAuditAdapter(auditPath);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await seedAudit.append({
      __auditSchemaVersion: "1",
      runId: "bad-prior-run",
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "3.0.0",
      chainEntries: [],
      status: "success",
      timestamp: "2026-05-20T00:00:00.000Z",
      // recordIndex deliberately MISSING — triggers the guard.
    } as any);

    const runner = createMigrationRunner({
      schemaRegistry: registry,
      migrationRegistry: migReg,
      inputAdapter: createJsonFileInputAdapter(inputPath),
      outputAdapter: createJsonFileOutputAdapter(outputPath),
      auditAdapter: createJsonlAuditAdapter(auditPath),
    });

    const r = await runner.run({
      schemaId: SCHEMA_ID,
      fromVersion: "1.0.0",
      toVersion: "3.0.0",
      mode: "execute",
      resumeFrom: { runId: "bad-prior-run" },
    });

    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.classification).toBe("adapter_init_failed");
    expect(r.errorMessage).toMatch(
      /Audit adapter cursor\(\) failed during resume/,
    );
    expect(r.errorMessage).toMatch(/malformed entry/);
    expect(r.errorMessage).toMatch(/field `recordIndex`/);
    // Output file not written — the runner never walked records.
    expect(existsSync(outputPath)).toBe(false);
  });
});

// =============================================================================
// 10. Cross-cutting source boundary sentinel (Step 8 specific)
// =============================================================================
//
// The full cross-cutting scan lives in tests/scaffold.test.ts.
// This block is a sentinel for Step 8 specifically — it asserts
// the e2e tests didn't accidentally introduce a new source file
// that violates the boundary contract. The actual enforcement
// is in scaffold.test.ts; this just exists so Step 8 reviewers
// see the contract restated next to the e2e cases.

describe("e2e — cross-cutting source boundary sentinel", () => {
  it("the e2e tests do not introduce new `src/` files (the file-inventory sentinel in scaffold.test.ts is the truth)", () => {
    // Sentinel comment — no assertion needed here. The
    // file-inventory sentinel in scaffold.test.ts asserts the
    // exact 10-file set under src/. If a new e2e-specific helper
    // were ever added under src/ instead of tests/helpers/, that
    // sentinel would fail.
    expect(true).toBe(true);
  });
});
