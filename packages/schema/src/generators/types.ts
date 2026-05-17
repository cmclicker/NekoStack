/**
 * Shared option types for generators.
 *
 * Each generator may extend with its own options; this file declares only
 * what is genuinely shared. v0.2 ships TS and Zod generators; future
 * generators (v0.3 JSON Schema, v0.4 OpenAPI) will likely extend.
 */

/** Options accepted by `generateTypeScript`. */
export interface TypeScriptGeneratorOptions {
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
export interface ZodGeneratorOptions {
  /**
   * Const name for the emitted Zod schema. Defaults to `"schema"` (lowercase
   * since it's a value, not a type).
   */
  constName?: string;
}

/** Options accepted by `generateJsonSchema`. */
export interface JsonSchemaGeneratorOptions {
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

/** Options accepted by `generateOpenApiSchemaComponent`. */
export interface OpenApiGeneratorOptions {
  /**
   * Reserved for v0.4+ extensions (e.g., a future `discriminator` option
   * when union builders ship). v0.4 ships with no options consumed; kept
   * here as a typed extension point so adding the first option later is
   * non-breaking.
   */
  // (no fields yet)
}

/** Union of all generator option types — exported for ergonomics. */
export type GeneratorOptions =
  | TypeScriptGeneratorOptions
  | ZodGeneratorOptions
  | JsonSchemaGeneratorOptions
  | OpenApiGeneratorOptions;
