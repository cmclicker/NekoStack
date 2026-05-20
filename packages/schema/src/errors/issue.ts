/**
 * Stable, machine-readable codes for validation issues. The runtime normalizes
 * raw validator errors (Zod, etc.) into this set so every NekoStack consumer
 * (form display, API responses, admin diagnostics) reads the same vocabulary.
 *
 * Adding a code is a breaking change for consumers that switch on it; removing
 * one is breaking for anyone that emits it. v1.0 freezes the set.
 */
export const ISSUE_CODES = [
  "invalid_type",
  "missing_required",
  "unknown_key",
  "too_small",
  "too_big",
  "invalid_enum",
  "invalid_literal",
  "invalid_union",
  "invalid_format",
  "custom_refinement_failed",
  "schema_version_unsupported",
  "recursive_reference_unresolved",
  // v0.7 — registry / freshness / loader codes. Added per the Master
  // plan Decision #15 change-control rule, at each code's first use
  // site:
  // - `integrity_error`     — first constructed by `parse-provenance.ts`
  //   (Step 5) for missing / malformed / self-inconsistent provenance
  //   blocks. Reused by `checkHandler` (Step 10) for the impossible
  //   row of the two-hash freshness matrix.
  // - `duplicate_schema_id` — first constructed by `build-registry.ts`
  //   (Step 6) when the same `(schemaId, schemaVersion)` pair appears
  //   in more than one `RegistrySourceEntry`.
  // - `schema_not_found` / `version_not_found` — first constructed by
  //   `handlers/check.ts` (Step 10) when a committed artifact's
  //   provenance points at a schema id (or `(id, version)` pair) that
  //   isn't in the current Registry. Distinct codes so the CLI can
  //   format orphan-by-id vs. orphan-by-version differently. Anonymous
  //   artifacts also use `schema_not_found` (with `metadata.reason =
  //   "anonymous_artifact"`) since the registry never indexes them.
  // Remaining v0.7 codes (`schema_load_failed`, plus the verdict-only
  // identifiers `stale_artifact` / `cosmetic_drift`) — the former lands
  // in the CLI loader (Step 22); the latter pair are *not* issue codes,
  // only FreshnessVerdict statuses on `checkHandler`'s success path.
  "integrity_error",
  "duplicate_schema_id",
  "schema_not_found",
  "version_not_found",
  // v0.8 — migration codes. Added per the Master plan Decision #15
  // change-control rule, at each code's first use site:
  // - `duplicate_migration` — first constructed by
  //   `migrations/build-migration-registry.ts` (Step 3) when the same
  //   `(schemaId, fromVersion, toVersion)` triple appears in more than
  //   one `MigrationSourceEntry`. Mirrors `duplicate_schema_id` from
  //   v0.7; the planner / verifier rely on the triple being unique.
  // - `migration_missing_endpoint` — first constructed by
  //   `migrations/plan-migration.ts` (Step 4) when either the from-
  //   or to-version is absent from the schema registry. Also used by
  //   Step 5's verifier when a registered migration references a
  //   schema version that has since vanished.
  // - `migration_not_found` — first constructed by `plan-migration.ts`
  //   (Step 4) when the requested transition is `breaking` and no
  //   migrations are registered for the schemaId at all.
  // - `migration_chain_broken` — first constructed by
  //   `plan-migration.ts` (Step 4) when migrations exist for the
  //   schemaId but no path bridges (from, to).
  // - `migration_ambiguous_chain` — first constructed by
  //   `plan-migration.ts` (Step 4) when two or more distinct chains
  //   reach the target. The planner refuses to pick.
  // Remaining v0.8 codes (`migration_drift`, `migration_cosmetic_drift`)
  // land at their own first-use site in Step 5 (verifier).
  "duplicate_migration",
  "migration_missing_endpoint",
  "migration_not_found",
  "migration_chain_broken",
  "migration_ambiguous_chain",
] as const;

export type IssueCode = (typeof ISSUE_CODES)[number];

export type IssuePath = ReadonlyArray<string | number>;

export interface Issue {
  code: IssueCode;
  path: IssuePath;
  message: string;
  expected?: unknown;
  received?: unknown;
  schemaId?: string;
  schemaVersion?: string;
  severity: "error" | "warning";
  metadata?: Record<string, unknown>;
}

/**
 * Result discriminator used by validate / parse. The output type can differ
 * from the input type once transforms land (v0.6+).
 */
export type Result<T> =
  | { success: true; data: T }
  | { success: false; issues: readonly Issue[] };
