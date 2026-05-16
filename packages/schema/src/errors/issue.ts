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
