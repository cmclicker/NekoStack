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

// =============================================================================
// Composition type helpers (v0.5)
//
// Per PHASE_PLAN_v0.5: names use the `*Shape` suffix to avoid shadowing TS
// built-in `Pick` / `Omit` / `Partial` / `Required` utility types.
// =============================================================================

/** `{ key: true }` subset mask over an existing shape. Used by pick/omit/partial/required. */
export type Mask<S extends RawShape> = { [K in keyof S]?: true };

/**
 * Constraint for `override`. Keys must be a subset of `keyof S`, but VALUES
 * may be any `AnySchema` — `override` exists to replace a field's schema
 * with a different one (e.g., `override({ id: s.number() })` on a previously-
 * string `id`). A `Partial<S>` constraint would force values to keep the old
 * field types and defeat the purpose.
 */
export type OverrideMask<S extends RawShape> = {
  [K in keyof S]?: AnySchema;
};

/** Merge resolution knobs — both default to `"throw"`. See `merge` overloads. */
export type MergeOptions = {
  conflict?: "throw" | "left" | "right";
  unknownKeys?: "throw" | "left" | "right";
};

// ---- extend ----

export type ExtendShape<S extends RawShape, E extends RawShape> = Identity<
  S & E
>;

// ---- pick / omit ----

export type PickShape<S extends RawShape, M extends Mask<S>> = Identity<{
  [K in keyof S as M[K] extends true ? K : never]: S[K];
}>;

export type OmitShape<S extends RawShape, M extends Mask<S>> = Identity<{
  [K in keyof S as M[K] extends true ? never : K]: S[K];
}>;

// ---- partial / required ----

/**
 * Decision #6 + #15: `partial()` sets the field's TInputKey AND TOutputKey
 * to "optional" and widens TInput/TOutput to include `undefined`. Mirrors
 * what `.optional()` does on Schema at the type level. Default-stripping
 * happens at the IR layer; it's not visible in the type because v0.1
 * `default()` already sets `_outputKey: "required"` while v0.5 `partial`
 * forces it to `"optional"`.
 */
type PartialField<F> = F extends Schema<
  infer I,
  infer O,
  ObjectKey,
  ObjectKey
>
  ? Schema<I | undefined, O | undefined, "optional", "optional">
  : never;

export type PartialShape<S extends RawShape> = {
  [K in keyof S]: PartialField<S[K]>;
};

export type PartialByShape<S extends RawShape, M extends Mask<S>> = Identity<{
  [K in keyof S]: M[K] extends true ? PartialField<S[K]> : S[K];
}>;

/**
 * Decision #8 + #15: `required()` sets both keys to "required" and excludes
 * `undefined` from TInput/TOutput. Default-stripping happens at the IR layer.
 */
type RequiredField<F> = F extends Schema<
  infer I,
  infer O,
  ObjectKey,
  ObjectKey
>
  ? Schema<Exclude<I, undefined>, Exclude<O, undefined>, "required", "required">
  : never;

export type RequiredShape<S extends RawShape> = {
  [K in keyof S]: RequiredField<S[K]>;
};

export type RequiredByShape<S extends RawShape, M extends Mask<S>> = Identity<{
  [K in keyof S]: M[K] extends true ? RequiredField<S[K]> : S[K];
}>;

// ---- merge ----

/**
 * Throw-shape: TS-level intersection of both shapes (`Identity<S & Other>`).
 * Preserves disjoint merges; lets TypeScript surface some conflicts through
 * normal intersection behavior where possible. **Runtime conflict detection
 * is the load-bearing guarantee** — consumers MUST NOT rely on
 * `MergeThrowShape` as the sole conflict detector. Use explicit
 * `conflict: "left" | "right"` on `merge` when intentionally resolving
 * overlaps; let the runtime throw catch the unintended ones.
 *
 * (Original design used a per-key conditional that mapped all overlapping
 * keys to `never`. That broke variance for `ObjectSchema<{...}>` vs.
 * `ObjectSchema<RawShape>` because `RawShape` overlaps with every key. The
 * intersection form preserves variance.)
 */
export type MergeThrowShape<S extends RawShape, Other extends RawShape> =
  Identity<S & Other>;

export type MergeLeftShape<S extends RawShape, Other extends RawShape> =
  Identity<{
    [K in keyof S | keyof Other]: K extends keyof S
      ? S[K]
      : K extends keyof Other
        ? Other[K]
        : never;
  }>;

export type MergeRightShape<S extends RawShape, Other extends RawShape> =
  Identity<{
    [K in keyof S | keyof Other]: K extends keyof Other
      ? Other[K]
      : K extends keyof S
        ? S[K]
        : never;
  }>;

// ---- override ----

export type OverrideShape<S extends RawShape, O extends OverrideMask<S>> =
  Identity<{
    [K in keyof S]: K extends keyof O
      ? O[K] extends AnySchema
        ? O[K]
        : S[K]
      : S[K];
  }>;
