/**
 * Shared option types for generators.
 *
 * Each generator may extend with its own options; this file declares only
 * what is genuinely shared. v0.2 ships TS and Zod generators; v0.3 adds
 * JSON Schema, v0.4 adds OpenAPI, v0.7 adds the cross-generator
 * `ProvenanceOptions` slice (below).
 */

/**
 * Provenance options shared by every generator (v0.7+).
 *
 * `sourceHash` is the sha256 of the originating `*.schema.ts` source
 * file's UTF-8 bytes, as produced by
 * `registry/source-hash.ts → sourceHashFromText`. The CLI passes it
 * through to each generator call when invoked via `neko schema *`;
 * direct generator calls (vitest snapshots, ad-hoc scripts) may omit it.
 *
 * **Omission behavior (Master plan Decision #8, locked):**
 * - When omitted, TS/Zod emit **no** `sourceHash:` JSDoc header line
 *   (not `null`, not `unknown` — the line is absent entirely).
 * - When omitted, JSON Schema / OpenAPI emit **no** `x-nekostack.sourceHash`
 *   field (the field is absent entirely; not `null`).
 * - Header / provenance parsers (`registry/parse-provenance.ts`, Step 5)
 *   treat absent `sourceHash` as "unknown" — v0.6-era artifacts without
 *   `sourceHash` are NOT integrity errors.
 *
 * Type discipline: the template-literal `` `sha256:${string}` `` is the
 * canonical form everywhere `sourceHash` appears on the v0.7 surface
 * (`RegistryEntry`, `GeneratedArtifact`, this option slice). A raw hex
 * string without the `sha256:` prefix is a type error at the generator
 * call site.
 */
export interface ProvenanceOptions {
  readonly sourceHash?: `sha256:${string}`;
}

/** Options accepted by `generateTypeScript`. */
export interface TypeScriptGeneratorOptions extends ProvenanceOptions {
  /**
   * Which side of the input/output split to emit. Default: "output".
   *
   *  - "output": post-default, post-transform type (matches `s.infer<T>`).
   *  - "input":  pre-default, pre-transform type (matches `s.input<T>`).
   *  - "both":   emits both `<Name>Input` and `<Name>Output` aliases.
   *
   * The input/output split is a v0.1 contract; default/transform make the
   * two sides differ. The TS generator honors it at generation time, not
   * just at the `s.*` helper level.
   */
  mode?: "input" | "output" | "both";

  /**
   * Type-alias name override. By default, the generator uses the schema's
   * `metadata.id` (last dotted segment) or `"Schema"` for anonymous schemas.
   * In `mode: "both"`, the suffixes `Input` / `Output` are appended.
   */
  typeName?: string;
}

/** Options accepted by `generateZod`. */
export interface ZodGeneratorOptions extends ProvenanceOptions {
  /**
   * Const name for the emitted Zod schema. Defaults to `"schema"` (lowercase
   * since it's a value, not a type).
   */
  constName?: string;
}

/** Options accepted by `generateJsonSchema`. */
export interface JsonSchemaGeneratorOptions extends ProvenanceOptions {
  /**
   * Optional URL base for `$id`. When provided, emitted IDs take the form
   * `${idBase}/${metadata.id}/${metadata.version}` instead of the default
   * URN form (`urn:nekostack:schema:<id>:<version>`).
   *
   * Use only when you actually host the schemas at that URL — JSON Schema
   * tooling treats URL-shaped `$id` as resolvable in some contexts.
   */
  idBase?: string;
}

/**
 * Options accepted by `generateOpenApiSchemaComponent`.
 *
 * v0.4 declared this as `Record<string, never>` to enforce a no-options
 * contract. v0.7 narrows the contract by exactly one field:
 * `ProvenanceOptions.sourceHash` is now accepted (and only that). All
 * other options — `idBase`, `discriminator`, anything not declared on
 * `ProvenanceOptions` — continue to fail at compile time, because the
 * interface declares no own members.
 *
 * Extension point preserved: adding the first OpenAPI-specific option
 * later (likely `discriminator` when union builders ship) is
 * non-breaking — `extends ProvenanceOptions` widens further without
 * removing the export.
 */
export interface OpenApiGeneratorOptions extends ProvenanceOptions {}

/** Union of all generator option types — exported for ergonomics. */
export type GeneratorOptions =
  | TypeScriptGeneratorOptions
  | ZodGeneratorOptions
  | JsonSchemaGeneratorOptions
  | OpenApiGeneratorOptions;
