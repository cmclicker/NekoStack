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

/** Union of all generator option types — exported for ergonomics. */
export type GeneratorOptions =
  | TypeScriptGeneratorOptions
  | ZodGeneratorOptions;
