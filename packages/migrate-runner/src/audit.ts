/**
 * `audit.ts` — audit primitives (v0.9 Step 5, Decision #16).
 *
 * Ships two things:
 *
 *   1. `createMemoryAuditAdapter()` — an in-memory `AuditAdapter`
 *      implementation. Default for the runner orchestrator (Step 6)
 *      when the caller doesn't supply their own audit sink. Useful
 *      stand-alone for tests, dev-mode runs, and any consumer that
 *      doesn't need durable audit storage.
 *
 *   2. `makeAuditEntry(opts)` — a small constructor helper that
 *      guarantees every audit entry carries the locked
 *      `__auditSchemaVersion: "1"` discriminator and a freshly-
 *      generated ISO-8601 timestamp (unless the caller supplies
 *      one). Centralizes entry construction so future schema-
 *      version bumps land in one place.
 *
 * The persistent JSONL file adapter lives in Step 7
 * ([`./adapters/jsonl-audit.ts`](./adapters/jsonl-audit.ts)) — NOT
 * this file. Step 5 ships in-memory only.
 *
 * **Pure with respect to side effects.** No `fs.*`, no
 * `console.*`, no `process.*`, no `migration.transform`
 * invocations. The only mutable input source is `new Date()` in
 * `makeAuditEntry` for the default timestamp; static-scan rules
 * still apply to the file.
 */

import type {
  AuditAdapter,
  AuditEntry,
  ErrorClassification,
  MemoryAuditAdapter,
} from "./types.js";

// =============================================================================
// In-memory audit adapter
// =============================================================================

/**
 * Create a fresh in-memory `AuditAdapter`. The adapter starts empty;
 * `append` snapshots each entry via a shallow `Object.freeze` so
 * caller-side mutation of the original reference does not affect
 * what the adapter holds (append-only contract).
 *
 * The returned adapter exposes `entries` — a read-only view useful
 * for tests and ad-hoc inspection. The `entries` getter is NOT
 * part of the `AuditAdapter` interface; consumers that need it
 * must type their reference as `MemoryAuditAdapter`.
 */
export function createMemoryAuditAdapter(): MemoryAuditAdapter {
  const store: AuditEntry[] = [];

  const adapter: MemoryAuditAdapter = {
    get entries(): readonly AuditEntry[] {
      return store;
    },
    async append(entry: AuditEntry): Promise<void> {
      // Shallow-freeze the snapshot. The caller's reference may
      // change after this point; ours doesn't. We don't deep-freeze
      // `before` / `after` (potentially large payloads); the
      // orchestrator is responsible for handing stable snapshots.
      const snapshot = Object.freeze({ ...entry }) as AuditEntry;
      store.push(snapshot);
    },
    async cursor(runId: string): Promise<readonly number[]> {
      const out: number[] = [];
      for (const entry of store) {
        if (entry.runId !== runId) continue;
        if (entry.status !== "success") continue;
        out.push(entry.recordIndex);
      }
      return out;
    },
  };
  return adapter;
}

// =============================================================================
// Audit entry constructor
// =============================================================================

export interface MakeAuditEntryOpts {
  readonly runId: string;
  readonly schemaId: string;
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly chainEntries: AuditEntry["chainEntries"];
  readonly recordIndex: number;
  readonly recordKey?: string;
  readonly status: "success" | "failure";
  readonly classification?: ErrorClassification;
  readonly errorMessage?: string;
  readonly before?: unknown;
  readonly after?: unknown;
  /**
   * Override the default ISO-8601 timestamp. Useful for
   * deterministic tests. Defaults to `new Date().toISOString()`.
   */
  readonly timestamp?: string;
}

/**
 * Construct an `AuditEntry` with the locked
 * `__auditSchemaVersion: "1"` discriminator and a default ISO-8601
 * timestamp. Centralizing entry creation here means a future
 * audit-schema-version bump touches exactly one file.
 *
 * The returned entry is NOT frozen. The orchestrator may want to
 * pass it through a deep-clone or transform before persisting. The
 * memory adapter's `append` freezes its own stored snapshot.
 */
export function makeAuditEntry(opts: MakeAuditEntryOpts): AuditEntry {
  const base: {
    readonly __auditSchemaVersion: "1";
    readonly runId: string;
    readonly schemaId: string;
    readonly fromVersion: string;
    readonly toVersion: string;
    readonly chainEntries: AuditEntry["chainEntries"];
    readonly recordIndex: number;
    readonly status: "success" | "failure";
    readonly timestamp: string;
  } = {
    __auditSchemaVersion: "1",
    runId: opts.runId,
    schemaId: opts.schemaId,
    fromVersion: opts.fromVersion,
    toVersion: opts.toVersion,
    chainEntries: opts.chainEntries,
    recordIndex: opts.recordIndex,
    status: opts.status,
    timestamp: opts.timestamp ?? new Date().toISOString(),
  };
  return {
    ...base,
    ...(opts.recordKey !== undefined ? { recordKey: opts.recordKey } : {}),
    ...(opts.classification !== undefined
      ? { classification: opts.classification }
      : {}),
    ...(opts.errorMessage !== undefined
      ? { errorMessage: opts.errorMessage }
      : {}),
    ...(opts.before !== undefined ? { before: opts.before } : {}),
    ...(opts.after !== undefined ? { after: opts.after } : {}),
  };
}

// =============================================================================
// Type re-exports for direct consumers
// =============================================================================

export type { AuditAdapter, AuditEntry, MemoryAuditAdapter };
