import type { Schema, AnySchema } from "./builders/schema.js";

/**
 * Marks how a schema participates in object composition.
 *  - "required": object field is `key: T`
 *  - "optional": object field is `key?: T`
 *
 * Input and output keys are tracked separately because `.default()` accepts a
 * missing input but produces a required output. See the absence-semantics
 * table in the package README.
 */
export type ObjectKey = "required" | "optional";

/** Standard "prettify intersection" trick to make hover types readable. */
export type Identity<T> = { [K in keyof T]: T[K] } & {};

// ---- Single-schema inference ----

export type Input<S> =
  S extends Schema<infer I, unknown, ObjectKey, ObjectKey> ? I : never;

export type Output<S> =
  S extends Schema<unknown, infer O, ObjectKey, ObjectKey> ? O : never;

/** `s.infer<T>` resolves to the *output* type — same default as Zod. */
export type Infer<S> = Output<S>;

// ---- Object inference ----

export type RawShape = Record<string, AnySchema>;

type OptionalInputKeys<S extends RawShape> = {
  [K in keyof S]: S[K] extends Schema<unknown, unknown, "optional", ObjectKey>
    ? K
    : never;
}[keyof S];

type RequiredInputKeys<S extends RawShape> = Exclude<
  keyof S,
  OptionalInputKeys<S>
>;

type OptionalOutputKeys<S extends RawShape> = {
  [K in keyof S]: S[K] extends Schema<unknown, unknown, ObjectKey, "optional">
    ? K
    : never;
}[keyof S];

type RequiredOutputKeys<S extends RawShape> = Exclude<
  keyof S,
  OptionalOutputKeys<S>
>;

export type InferObjectInput<S extends RawShape> = Identity<
  { [K in RequiredInputKeys<S>]: Input<S[K]> } & {
    [K in OptionalInputKeys<S>]?: Input<S[K]>;
  }
>;

export type InferObjectOutput<S extends RawShape> = Identity<
  { [K in RequiredOutputKeys<S>]: Output<S[K]> } & {
    [K in OptionalOutputKeys<S>]?: Output<S[K]>;
  }
>;
