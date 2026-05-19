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
  // site. `integrity_error` lands here because `parse-provenance.ts`
  // (Step 5) is its first constructor — emitted when a generated
  // artifact's provenance block is missing, malformed, or self-
  // inconsistent (the impossible row of the two-hash matrix in
  // §"Freshness verdict — two-hash discipline"). Other v0.7 codes
  // (schema_load_failed, duplicate_schema_id, etc.) get added in
  // their respective consumer steps (CLI loader, buildRegistry, etc.).
  "integrity_error",
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
