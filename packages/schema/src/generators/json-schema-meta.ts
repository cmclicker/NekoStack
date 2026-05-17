/**
 * Codified `x-nekostack-*` extension keys used by the JSON Schema generator.
 *
 * These are the contract; any new extension key the generator emits must
 * land here first. Stringly-typed extensions in the generator body would
 * make typos and drift easy — the constants make both the spelling and the
 * meaning grep-able.
 *
 * See [`docs/JSON_SCHEMA_MAPPING.md`](../../docs/JSON_SCHEMA_MAPPING.md) for
 * the per-key contract: when each is emitted, what it means, and what
 * NekoStack-aware consumers should do with it.
 */
export const JSON_SCHEMA_EXTENSIONS = {
  /**
   * Top-level provenance object: `{ generator, generatorVersion, irHash,
   * schemaId, schemaVersion }`. Replaces the v0.2-style JSDoc header since
   * JSON has no comment syntax.
   */
  provenance: "x-nekostack",

  /**
   * Tag on a node carrying `default()`: signals that JSON Schema validators
   * will NOT apply the default (it's annotation only); the NekoStack runtime
   * (or the generated Zod) is responsible. Value is the literal string
   * `"runtime"`.
   */
  defaultAppliedBy: "x-nekostack-default-applied-by",

  /**
   * Tag on an object whose unknown-key policy is `stripUnknown`: signals
   * that the schema accepts unknown keys (`additionalProperties: true`)
   * and that NekoStack-aware runtime/CLI consumers should strip them.
   * JSON Schema cannot express mutation; this is the bridge.
   */
  strip: "x-nekostack-strip",
} as const;

export type JsonSchemaExtensionKey =
  (typeof JSON_SCHEMA_EXTENSIONS)[keyof typeof JSON_SCHEMA_EXTENSIONS];
