/**
 * `@nekostack/schema/cli` integration barrel (Master plan Decision #10).
 *
 * This module is the **package-internal integration surface** for
 * `@nekostack/cli` to import the v0.7 registry / freshness /
 * generation primitives. It is NOT the public consumer API.
 *
 * **External consumers should NOT import from this path.** The root
 * `@nekostack/schema` import surface remains the v0.6 contract
 * (`s`, `parse`, `safeParse`, `validate`, `ParseError`, IR types,
 * generators). The names re-exported here are subject to internal
 * change; engine-swap-safety lives at the root index, not at this
 * subpath.
 *
 * **No `package.json` exports map in this commit.** Step 14 wires
 * the `"./cli"` exports field so `@nekostack/schema/cli` resolves
 * to this file. Until Step 14 lands, the CLI cannot actually
 * import from `@nekostack/schema/cli` — this file's existence is
 * the barrel content, the manifest wiring is separate.
 *
 * Re-exports only. No new functions, no new types, no behavior
 * changes. Master plan Steps 15 and 16 add the gating tests
 * (`@nekostack/schema/cli` exports the surface; root
 * `@nekostack/schema` does NOT).
 */

// ---- Pure registry primitives ----------------------------------------------

export { sourceHashFromText } from "./registry/source-hash.js";
export { parseProvenanceFromText } from "./registry/parse-provenance.js";
export { buildRegistry, findSchema } from "./registry/build-registry.js";
export { diffNodes } from "./registry/diff.js";

// ---- Handlers --------------------------------------------------------------

export { listHandler } from "./registry/handlers/list.js";
export { diffHandler } from "./registry/handlers/diff.js";
export { checkHandler } from "./registry/handlers/check.js";
export {
  generateHandler,
  suggestedPathFor,
  GENERATOR_KINDS,
} from "./registry/handlers/generate.js";

// ---- Type surface (all registry / handler public types) --------------------

export type {
  RegistrySourceEntry,
  RegistryEntry,
  Registry,
  DiffSeverity,
  DiffKind,
  DiffChange,
  FreshnessVerdict,
  GeneratorKind,
  GeneratedArtifact,
  CommittedArtifact,
  GenerateOpts,
  GenerateResult,
  CheckOpts,
  CheckResult,
  DiffOpts,
  DiffResult,
  ListOpts,
  ListResult,
} from "./registry/types.js";
