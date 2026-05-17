/**
 * Single source of truth for the generator-version string embedded in every
 * generated-file header. Bumped with the package version.
 *
 * Decision #5 in PHASE_PLAN_v0.2: one string for all generators (TS and Zod
 * share the same version), not per-generator. When this string changes,
 * generated artifacts produced by an older version are stale and CI should
 * re-emit them.
 */
export const GENERATOR_VERSION = "@nekostack/schema@0.5.0" as const;
