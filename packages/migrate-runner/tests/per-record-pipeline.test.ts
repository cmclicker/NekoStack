/**
 * Step 4 — per-record pipeline gate.
 *
 * Exercises `runRecordPipeline(opts)` against in-memory schemas +
 * chains. The pipeline IS the one runner-side caller of
 * `migration.transform(...)`, so test fixtures use real (non-poison)
 * transforms here — unlike the pre-flight tests where every
 * fixture's transform was a poison.
 *
 * Scenarios:
 *   1.  one-hop success
 *   2.  multi-hop success — transforms compose in order
 *   3.  input validation failure → input_validation_failed, no
 *       transform called
 *   4.  transform throws → transform_threw at the failing index
 *   5.  later transforms not invoked once an earlier transform fails
 *   6.  transform exceeds wall-clock budget → transform_timeout
 *       (post-hoc classification — the slow transform DID run to
 *       completion; the runner does not preempt it)
 *   7.  output validation failure after transform → output_validation_failed
 *   8.  source schema missing → input_validation_failed with
 *       synthesized `schema_not_found` issue
 *   9.  destination schema missing → output_validation_failed with
 *       synthesized `schema_not_found` issue
 *  10.  transform called exactly once per chain entry on success
 *  11.  no persistence / no audit / no console side effects
 *       (the function is pure; nothing leaks outside the return value)
 *  12.  public-entry runtime export gate
 *  13.  static-scan boundary on per-record-pipeline.ts:
 *       - `.transform(` is allowed in EXACTLY this file
 *       - `console.*`, `process.*`, `fs` imports remain banned
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
import { runRecordPipeline } from "../src/per-record-pipeline.js";
import { runRecordPipeline as publicRunRecordPipeline } from "../src/index.js";
import type { NonEmptyChain } from "../src/types.js";

// =============================================================================
// Fixture helpers
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
    // The whole point of this file is to invoke this function — it
    // is a real transform, not a poison.
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

function chainOf(...entries: MigrationEntry[]): NonEmptyChain {
  if (entries.length === 0) {
    throw new Error("test bug: chainOf requires ≥ 1 entry");
  }
  return entries as unknown as NonEmptyChain;
}

const SCHEMA_ID = "com.fix.runner.PipelineFixture";

// v1: { value: string }, v2: { value: number }, v3: { value: number, doubled: number }.
const v1 = s
  .object({ value: s.string() })
  .id(SCHEMA_ID)
  .version("1.0.0");
const v2 = s
  .object({ value: s.number() })
  .id(SCHEMA_ID)
  .version("2.0.0");
const v3 = s
  .object({ value: s.number(), doubled: s.number() })
  .id(SCHEMA_ID)
  .version("3.0.0");

const STR_TO_NUM = (input: unknown) => {
  const r = input as { value: string };
  return { value: Number(r.value) };
};
const ADD_DOUBLED = (input: unknown) => {
  const r = input as { value: number };
  return { value: r.value, doubled: r.value * 2 };
};

// =============================================================================
// 1. one-hop success
// =============================================================================

describe("runRecordPipeline — one-hop success", () => {
  it("validates input, calls transform, validates output, returns success", () => {
    const { registry, irHashes, sourceHashes } = buildSchemaReg([
      { id: SCHEMA_ID, version: "1.0.0", schema: v1 },
      { id: SCHEMA_ID, version: "2.0.0", schema: v2 },
    ]);
    const chain = chainOf(
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
    );

    const r = runRecordPipeline({
      schemaRegistry: registry,
      chain,
      input: { value: "42" },
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.output).toEqual({ value: 42 });
  });
});

// =============================================================================
// 2. multi-hop success — transforms compose in order
// =============================================================================

describe("runRecordPipeline — multi-hop success", () => {
  it("composes transforms in the chain's order (v1 → v2 → v3)", () => {
    const { registry, irHashes, sourceHashes } = buildSchemaReg([
      { id: SCHEMA_ID, version: "1.0.0", schema: v1 },
      { id: SCHEMA_ID, version: "2.0.0", schema: v2 },
      { id: SCHEMA_ID, version: "3.0.0", schema: v3 },
    ]);
    const chain = chainOf(
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
      makeMigration({
        schemaId: SCHEMA_ID,
        fromVersion: "2.0.0",
        toVersion: "3.0.0",
        fromIrHash: irHashes[`${SCHEMA_ID}@2.0.0`]!,
        toIrHash: irHashes[`${SCHEMA_ID}@3.0.0`]!,
        fromSourceHash: sourceHashes[`${SCHEMA_ID}@2.0.0`]!,
        toSourceHash: sourceHashes[`${SCHEMA_ID}@3.0.0`]!,
        transform: ADD_DOUBLED,
      }),
    );

    const r = runRecordPipeline({
      schemaRegistry: registry,
      chain,
      input: { value: "5" },
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.output).toEqual({ value: 5, doubled: 10 });
  });
});

// =============================================================================
// 3. input validation failure — transform NOT called
// =============================================================================

describe("runRecordPipeline — input validation failure", () => {
  it("returns input_validation_failed with chainIndex -1; transform is never called", () => {
    const { registry, irHashes, sourceHashes } = buildSchemaReg([
      { id: SCHEMA_ID, version: "1.0.0", schema: v1 },
      { id: SCHEMA_ID, version: "2.0.0", schema: v2 },
    ]);
    let transformCalls = 0;
    const chain = chainOf(
      makeMigration({
        schemaId: SCHEMA_ID,
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        fromIrHash: irHashes[`${SCHEMA_ID}@1.0.0`]!,
        toIrHash: irHashes[`${SCHEMA_ID}@2.0.0`]!,
        fromSourceHash: sourceHashes[`${SCHEMA_ID}@1.0.0`]!,
        toSourceHash: sourceHashes[`${SCHEMA_ID}@2.0.0`]!,
        transform: (input) => {
          transformCalls += 1;
          return STR_TO_NUM(input);
        },
      }),
    );

    // `value` is a number — source schema requires string.
    const r = runRecordPipeline({
      schemaRegistry: registry,
      chain,
      input: { value: 42 },
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.classification).toBe("input_validation_failed");
    expect(r.chainIndex).toBe(-1);
    expect(r.issues.length).toBeGreaterThan(0);
    expect(transformCalls).toBe(0);
  });
});

// =============================================================================
// 4 + 5. transform throws → transform_threw; later transforms not invoked
// =============================================================================

describe("runRecordPipeline — transform throws", () => {
  it("returns transform_threw with chainIndex pointing at the failing hop", () => {
    const { registry, irHashes, sourceHashes } = buildSchemaReg([
      { id: SCHEMA_ID, version: "1.0.0", schema: v1 },
      { id: SCHEMA_ID, version: "2.0.0", schema: v2 },
    ]);
    const chain = chainOf(
      makeMigration({
        schemaId: SCHEMA_ID,
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        fromIrHash: irHashes[`${SCHEMA_ID}@1.0.0`]!,
        toIrHash: irHashes[`${SCHEMA_ID}@2.0.0`]!,
        fromSourceHash: sourceHashes[`${SCHEMA_ID}@1.0.0`]!,
        toSourceHash: sourceHashes[`${SCHEMA_ID}@2.0.0`]!,
        transform: () => {
          throw new Error("synthetic transform failure");
        },
      }),
    );

    const r = runRecordPipeline({
      schemaRegistry: registry,
      chain,
      input: { value: "42" },
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.classification).toBe("transform_threw");
    expect(r.chainIndex).toBe(0);
    expect(r.errorMessage).toContain("synthetic transform failure");
    expect(r.issues).toEqual([]);
  });

  it("later transforms are NOT invoked when an earlier transform throws", () => {
    const { registry, irHashes, sourceHashes } = buildSchemaReg([
      { id: SCHEMA_ID, version: "1.0.0", schema: v1 },
      { id: SCHEMA_ID, version: "2.0.0", schema: v2 },
      { id: SCHEMA_ID, version: "3.0.0", schema: v3 },
    ]);
    let secondCalled = false;
    const chain = chainOf(
      makeMigration({
        schemaId: SCHEMA_ID,
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        fromIrHash: irHashes[`${SCHEMA_ID}@1.0.0`]!,
        toIrHash: irHashes[`${SCHEMA_ID}@2.0.0`]!,
        fromSourceHash: sourceHashes[`${SCHEMA_ID}@1.0.0`]!,
        toSourceHash: sourceHashes[`${SCHEMA_ID}@2.0.0`]!,
        transform: () => {
          throw new Error("first hop intentionally fails");
        },
      }),
      makeMigration({
        schemaId: SCHEMA_ID,
        fromVersion: "2.0.0",
        toVersion: "3.0.0",
        fromIrHash: irHashes[`${SCHEMA_ID}@2.0.0`]!,
        toIrHash: irHashes[`${SCHEMA_ID}@3.0.0`]!,
        fromSourceHash: sourceHashes[`${SCHEMA_ID}@2.0.0`]!,
        toSourceHash: sourceHashes[`${SCHEMA_ID}@3.0.0`]!,
        transform: (input) => {
          secondCalled = true;
          return ADD_DOUBLED(input);
        },
      }),
    );

    runRecordPipeline({
      schemaRegistry: registry,
      chain,
      input: { value: "5" },
    });
    expect(secondCalled).toBe(false);
  });
});

// =============================================================================
// 6. transform timeout — post-hoc wall-clock classification
// =============================================================================

describe("runRecordPipeline — transform timeout (post-hoc)", () => {
  it("classifies the record as transform_timeout when sync transform exceeds the wall-clock budget", () => {
    const { registry, irHashes, sourceHashes } = buildSchemaReg([
      { id: SCHEMA_ID, version: "1.0.0", schema: v1 },
      { id: SCHEMA_ID, version: "2.0.0", schema: v2 },
    ]);
    // The transform runs to COMPLETION (busy-wait ~30ms). The
    // pipeline does NOT preempt; it measures elapsed time AFTER
    // control returns and classifies post-hoc.
    const SLOW_TRANSFORM = (input: unknown) => {
      const end = Date.now() + 30;
      // Busy-wait — synchronous; nothing can interrupt this.
      while (Date.now() < end) {
        // Intentional CPU spin.
      }
      return STR_TO_NUM(input);
    };
    const chain = chainOf(
      makeMigration({
        schemaId: SCHEMA_ID,
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        fromIrHash: irHashes[`${SCHEMA_ID}@1.0.0`]!,
        toIrHash: irHashes[`${SCHEMA_ID}@2.0.0`]!,
        fromSourceHash: sourceHashes[`${SCHEMA_ID}@1.0.0`]!,
        toSourceHash: sourceHashes[`${SCHEMA_ID}@2.0.0`]!,
        transform: SLOW_TRANSFORM,
      }),
    );

    const r = runRecordPipeline({
      schemaRegistry: registry,
      chain,
      input: { value: "1" },
      transformTimeoutMs: 5,
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.classification).toBe("transform_timeout");
    expect(r.chainIndex).toBe(0);
    expect(r.errorMessage).toContain("5ms");
    expect(r.errorMessage).toContain("post-hoc");
  });

  it("does NOT fire when the transform fits within the budget", () => {
    const { registry, irHashes, sourceHashes } = buildSchemaReg([
      { id: SCHEMA_ID, version: "1.0.0", schema: v1 },
      { id: SCHEMA_ID, version: "2.0.0", schema: v2 },
    ]);
    const chain = chainOf(
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
    );

    const r = runRecordPipeline({
      schemaRegistry: registry,
      chain,
      input: { value: "7" },
      transformTimeoutMs: 5000, // generous
    });
    expect(r.success).toBe(true);
  });

  it("does NOT fire when transformTimeoutMs is omitted (no budget)", () => {
    const { registry, irHashes, sourceHashes } = buildSchemaReg([
      { id: SCHEMA_ID, version: "1.0.0", schema: v1 },
      { id: SCHEMA_ID, version: "2.0.0", schema: v2 },
    ]);
    const chain = chainOf(
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
    );

    const r = runRecordPipeline({
      schemaRegistry: registry,
      chain,
      input: { value: "11" },
    });
    expect(r.success).toBe(true);
  });
});

// =============================================================================
// 7. output validation failure after transform
// =============================================================================

describe("runRecordPipeline — output validation failure", () => {
  it("returns output_validation_failed when the transformed value rejects the destination schema", () => {
    const { registry, irHashes, sourceHashes } = buildSchemaReg([
      { id: SCHEMA_ID, version: "1.0.0", schema: v1 },
      { id: SCHEMA_ID, version: "2.0.0", schema: v2 },
    ]);
    // Transform returns an OBJECT but with `value: string` — fails
    // v2 (which requires `value: number`).
    const BAD_TRANSFORM = (input: unknown) => {
      const r = input as { value: string };
      return { value: r.value };
    };
    const chain = chainOf(
      makeMigration({
        schemaId: SCHEMA_ID,
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        fromIrHash: irHashes[`${SCHEMA_ID}@1.0.0`]!,
        toIrHash: irHashes[`${SCHEMA_ID}@2.0.0`]!,
        fromSourceHash: sourceHashes[`${SCHEMA_ID}@1.0.0`]!,
        toSourceHash: sourceHashes[`${SCHEMA_ID}@2.0.0`]!,
        transform: BAD_TRANSFORM,
      }),
    );

    const r = runRecordPipeline({
      schemaRegistry: registry,
      chain,
      input: { value: "42" },
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.classification).toBe("output_validation_failed");
    expect(r.chainIndex).toBe(1); // = chain.length
    expect(r.issues.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// 8. source schema missing
// =============================================================================

describe("runRecordPipeline — source schema missing", () => {
  it("returns input_validation_failed with synthesized schema_not_found", () => {
    // Registry has v2 but NOT v1. Chain claims fromVersion v1.0.0.
    const { registry, irHashes, sourceHashes } = buildSchemaReg([
      { id: SCHEMA_ID, version: "2.0.0", schema: v2 },
    ]);
    const chain = chainOf(
      makeMigration({
        schemaId: SCHEMA_ID,
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        fromIrHash: `sha256:${"0".repeat(64)}` as `sha256:${string}`,
        toIrHash: irHashes[`${SCHEMA_ID}@2.0.0`]!,
        fromSourceHash: `sha256:${"0".repeat(64)}` as `sha256:${string}`,
        toSourceHash: sourceHashes[`${SCHEMA_ID}@2.0.0`]!,
        transform: STR_TO_NUM,
      }),
    );

    const r = runRecordPipeline({
      schemaRegistry: registry,
      chain,
      input: { value: "42" },
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.classification).toBe("input_validation_failed");
    expect(r.chainIndex).toBe(-1);
    expect(r.issues.some((i) => i.code === "schema_not_found")).toBe(true);
  });
});

// =============================================================================
// 9. destination schema missing
// =============================================================================

describe("runRecordPipeline — destination schema missing", () => {
  it("returns output_validation_failed with synthesized schema_not_found", () => {
    // Registry has v1 but NOT v2. Chain claims toVersion v2.0.0.
    const { registry, irHashes, sourceHashes } = buildSchemaReg([
      { id: SCHEMA_ID, version: "1.0.0", schema: v1 },
    ]);
    const chain = chainOf(
      makeMigration({
        schemaId: SCHEMA_ID,
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        fromIrHash: irHashes[`${SCHEMA_ID}@1.0.0`]!,
        toIrHash: `sha256:${"0".repeat(64)}` as `sha256:${string}`,
        fromSourceHash: sourceHashes[`${SCHEMA_ID}@1.0.0`]!,
        toSourceHash: `sha256:${"0".repeat(64)}` as `sha256:${string}`,
        transform: STR_TO_NUM,
      }),
    );

    const r = runRecordPipeline({
      schemaRegistry: registry,
      chain,
      input: { value: "42" },
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.classification).toBe("output_validation_failed");
    expect(r.chainIndex).toBe(1);
    expect(r.issues.some((i) => i.code === "schema_not_found")).toBe(true);
  });
});

// =============================================================================
// 10. transform called exactly once per chain entry on success
// =============================================================================

describe("runRecordPipeline — call-count discipline", () => {
  it("each transform is invoked exactly once per record on the happy path", () => {
    const { registry, irHashes, sourceHashes } = buildSchemaReg([
      { id: SCHEMA_ID, version: "1.0.0", schema: v1 },
      { id: SCHEMA_ID, version: "2.0.0", schema: v2 },
      { id: SCHEMA_ID, version: "3.0.0", schema: v3 },
    ]);
    const counts = { first: 0, second: 0 };
    const chain = chainOf(
      makeMigration({
        schemaId: SCHEMA_ID,
        fromVersion: "1.0.0",
        toVersion: "2.0.0",
        fromIrHash: irHashes[`${SCHEMA_ID}@1.0.0`]!,
        toIrHash: irHashes[`${SCHEMA_ID}@2.0.0`]!,
        fromSourceHash: sourceHashes[`${SCHEMA_ID}@1.0.0`]!,
        toSourceHash: sourceHashes[`${SCHEMA_ID}@2.0.0`]!,
        transform: (input) => {
          counts.first += 1;
          return STR_TO_NUM(input);
        },
      }),
      makeMigration({
        schemaId: SCHEMA_ID,
        fromVersion: "2.0.0",
        toVersion: "3.0.0",
        fromIrHash: irHashes[`${SCHEMA_ID}@2.0.0`]!,
        toIrHash: irHashes[`${SCHEMA_ID}@3.0.0`]!,
        fromSourceHash: sourceHashes[`${SCHEMA_ID}@2.0.0`]!,
        toSourceHash: sourceHashes[`${SCHEMA_ID}@3.0.0`]!,
        transform: (input) => {
          counts.second += 1;
          return ADD_DOUBLED(input);
        },
      }),
    );

    const r = runRecordPipeline({
      schemaRegistry: registry,
      chain,
      input: { value: "3" },
    });
    expect(r.success).toBe(true);
    expect(counts.first).toBe(1);
    expect(counts.second).toBe(1);
  });
});

// =============================================================================
// 11. No persistence / no audit / no console side effects
// =============================================================================
//
// The pipeline is pure data-in / data-out — there is no
// outputAdapter slot, no auditAdapter slot, and no place for it
// to write anywhere. The strongest assertion at runtime is:
// running the pipeline never throws, never returns a side-channel
// effect, and the call site sees only the returned object. Wrap
// every IO-sink prototype with a poison and confirm none fire.

describe("runRecordPipeline — purity (no persistence / no audit / no console side effects)", () => {
  it("does not invoke any output adapter (there is no slot to invoke)", () => {
    // `PerRecordPipelineOpts` has no outputAdapter / auditAdapter
    // field. The type-level gate in types.test-d.ts confirms it.
    // Here we just confirm a happy-path run returns the value and
    // doesn't fire any console method. We poison `console.log`
    // for the duration of the test and expect it not to fire.
    const calls: string[] = [];
    const origLog = console.log;
    const origError = console.error;
    const origWarn = console.warn;
    const origInfo = console.info;
    const origDebug = console.debug;
    console.log = (...args) => {
      calls.push(`log:${args.join(" ")}`);
    };
    console.error = (...args) => {
      calls.push(`error:${args.join(" ")}`);
    };
    console.warn = (...args) => {
      calls.push(`warn:${args.join(" ")}`);
    };
    console.info = (...args) => {
      calls.push(`info:${args.join(" ")}`);
    };
    console.debug = (...args) => {
      calls.push(`debug:${args.join(" ")}`);
    };

    try {
      const { registry, irHashes, sourceHashes } = buildSchemaReg([
        { id: SCHEMA_ID, version: "1.0.0", schema: v1 },
        { id: SCHEMA_ID, version: "2.0.0", schema: v2 },
      ]);
      const chain = chainOf(
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
      );
      runRecordPipeline({
        schemaRegistry: registry,
        chain,
        input: { value: "42" },
      });
    } finally {
      console.log = origLog;
      console.error = origError;
      console.warn = origWarn;
      console.info = origInfo;
      console.debug = origDebug;
    }

    expect(calls).toEqual([]);
  });
});

// =============================================================================
// 12. Public-entry runtime export gate
// =============================================================================

describe("runRecordPipeline — public-entry runtime export gate", () => {
  it("`@nekostack/migrate-runner`'s package entry re-exports `runRecordPipeline` identity-preserved", () => {
    expect(publicRunRecordPipeline).toBe(runRecordPipeline);
  });

  it("`runRecordPipeline` is a function at runtime", () => {
    expect(typeof publicRunRecordPipeline).toBe("function");
  });
});

// =============================================================================
// 13. Static-scan boundary
// =============================================================================
//
// THIS is the file that holds the only `.transform(` call in the
// runner package. The boundary contract is:
//
//   - `.transform(` is ALLOWED in per-record-pipeline.ts (this is
//     where it lives, by design)
//   - `console.*`, `process.exit/abort`, `process.std{out,err}.write`,
//     and `node:fs` imports remain BANNED
//
// The cross-cutting Step 9 scan will assert "`.transform(` lives
// ONLY in per-record-pipeline.ts and nowhere else under src/". For
// Step 4 the per-file scan covers this file's local rules; the
// pre-flight scan covers pre-flight.ts; the scaffold scan covers
// src/index.ts.

describe("runRecordPipeline — Step 4 source discipline (static scan)", () => {
  const SRC = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "src",
      "per-record-pipeline.ts",
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
    // `node:fs` / `fs` imports are banned — the pipeline is pure
    // data-in / data-out; filesystem access lives in adapters.
    { name: "fs import", pattern: /\bfrom\s+["'](?:node:)?fs(?:\/|["'])/ },
  ];

  it.each(FORBIDDEN)(
    "per-record-pipeline source contains no `$name`",
    ({ pattern }) => {
      expect(STRIPPED).not.toMatch(pattern);
    },
  );

  it("`.transform(` IS allowed in per-record-pipeline.ts (and only here)", () => {
    // Sanity-check that this file does call `.transform(` — if
    // someone refactored the chain walk into a different file, this
    // test would flag the regression. The cross-cutting Step 9 scan
    // (when it lands) will enforce the "only here" half.
    expect(STRIPPED).toMatch(/\.transform\s*\(/);
  });
});
