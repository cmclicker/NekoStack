import { z } from 'zod';
import type { Secret } from './secret.js';

// =============================================================================
// Internal field representation
// =============================================================================

export interface FieldMeta {
  readonly secret: boolean;
  readonly envVar: string | undefined;
  readonly isOptional: boolean;
  readonly defaultValue: unknown;
  readonly hasDefault: boolean;
}

export interface AnyFieldBuilder {
  readonly _type: 'field';
  readonly _meta: FieldMeta;
  buildZod(): z.ZodTypeAny;
}

// =============================================================================
// Type-level inference helpers
// =============================================================================

// Phantom type approach: declare properties that are never set at runtime
// but allow TypeScript to infer T and S via conditional types in InferShape<>.
// The `declare` keyword emits no JS — values are always undefined at runtime.

export type InferFieldOutput<F> =
  F extends StringFieldBuilder<infer T, true> ? Secret<T> :
  F extends StringFieldBuilder<infer T, false> ? T :
  F extends NumberFieldBuilder<infer T, true> ? Secret<T> :
  F extends NumberFieldBuilder<infer T, false> ? T :
  F extends BooleanFieldBuilder<infer T, true> ? Secret<T> :
  F extends BooleanFieldBuilder<infer T, false> ? T :
  F extends EnumFieldBuilder<infer V, infer T, true> ? Secret<T> :
  F extends EnumFieldBuilder<infer V, infer T, false> ? T :
  F extends ArrayFieldBuilder<infer T, true> ? Secret<T[]> :
  F extends ArrayFieldBuilder<infer T, false> ? T[] :
  never;

// Recursive shape inference
export type InferShape<Shape> = {
  [K in keyof Shape]: Shape[K] extends AnyFieldBuilder
    ? InferFieldOutput<Shape[K]>
    : Shape[K] extends Record<string, unknown>
    ? InferShape<Shape[K]>
    : never;
};

// =============================================================================
// StringFieldBuilder
// =============================================================================

interface StringConstraints {
  minLength?: number;
  maxLength?: number;
  url?: boolean;
}

export class StringFieldBuilder<T extends string | undefined = string, S extends boolean = false>
  implements AnyFieldBuilder
{
  declare readonly _phantom_value: T;
  declare readonly _phantom_secret: S;
  readonly _type = 'field' as const;

  constructor(
    private readonly _constraints: StringConstraints,
    private readonly _isSecret: S,
    private readonly _envVarOverride: string | undefined,
    private readonly _isOptional: boolean,
    private readonly _defaultValue: string | undefined,
    private readonly _hasDefault: boolean,
  ) {}

  get _meta(): FieldMeta {
    return {
      secret: this._isSecret,
      envVar: this._envVarOverride,
      isOptional: this._isOptional,
      defaultValue: this._defaultValue,
      hasDefault: this._hasDefault,
    };
  }

  buildZod(): z.ZodTypeAny {
    let schema: z.ZodString = z.string();
    if (this._constraints.minLength !== undefined) schema = schema.min(this._constraints.minLength);
    if (this._constraints.maxLength !== undefined) schema = schema.max(this._constraints.maxLength);
    if (this._constraints.url) schema = schema.url();
    if (this._hasDefault && this._defaultValue !== undefined) return schema.default(this._defaultValue);
    if (this._isOptional) return schema.optional();
    return schema;
  }

  minLength(n: number): StringFieldBuilder<T, S> {
    return new StringFieldBuilder<T, S>({ ...this._constraints, minLength: n }, this._isSecret, this._envVarOverride, this._isOptional, this._defaultValue, this._hasDefault);
  }

  maxLength(n: number): StringFieldBuilder<T, S> {
    return new StringFieldBuilder<T, S>({ ...this._constraints, maxLength: n }, this._isSecret, this._envVarOverride, this._isOptional, this._defaultValue, this._hasDefault);
  }

  url(): StringFieldBuilder<T, S> {
    return new StringFieldBuilder<T, S>({ ...this._constraints, url: true }, this._isSecret, this._envVarOverride, this._isOptional, this._defaultValue, this._hasDefault);
  }

  secret(): StringFieldBuilder<T, true> {
    return new StringFieldBuilder<T, true>(this._constraints, true, this._envVarOverride, this._isOptional, this._defaultValue, this._hasDefault);
  }

  env(name: string): StringFieldBuilder<T, S> {
    return new StringFieldBuilder<T, S>(this._constraints, this._isSecret, name, this._isOptional, this._defaultValue, this._hasDefault);
  }

  optional(): StringFieldBuilder<string | undefined, S> {
    return new StringFieldBuilder<string | undefined, S>(this._constraints, this._isSecret, this._envVarOverride, true, undefined, false);
  }

  default(value: string): StringFieldBuilder<string, S> {
    return new StringFieldBuilder<string, S>(this._constraints, this._isSecret, this._envVarOverride, false, value, true);
  }
}

// =============================================================================
// NumberFieldBuilder
// =============================================================================

interface NumberConstraints {
  min?: number;
  max?: number;
  int?: boolean;
}

export class NumberFieldBuilder<T extends number | undefined = number, S extends boolean = false>
  implements AnyFieldBuilder
{
  declare readonly _phantom_value: T;
  declare readonly _phantom_secret: S;
  readonly _type = 'field' as const;

  constructor(
    private readonly _constraints: NumberConstraints,
    private readonly _isSecret: S,
    private readonly _envVarOverride: string | undefined,
    private readonly _isOptional: boolean,
    private readonly _defaultValue: number | undefined,
    private readonly _hasDefault: boolean,
  ) {}

  get _meta(): FieldMeta {
    return {
      secret: this._isSecret,
      envVar: this._envVarOverride,
      isOptional: this._isOptional,
      defaultValue: this._defaultValue,
      hasDefault: this._hasDefault,
    };
  }

  buildZod(): z.ZodTypeAny {
    let schema: z.ZodNumber = z.coerce.number();
    if (this._constraints.int) schema = schema.int();
    if (this._constraints.min !== undefined) schema = schema.min(this._constraints.min);
    if (this._constraints.max !== undefined) schema = schema.max(this._constraints.max);
    if (this._hasDefault && this._defaultValue !== undefined) return schema.default(this._defaultValue);
    if (this._isOptional) return schema.optional();
    return schema;
  }

  int(): NumberFieldBuilder<T, S> {
    return new NumberFieldBuilder<T, S>({ ...this._constraints, int: true }, this._isSecret, this._envVarOverride, this._isOptional, this._defaultValue, this._hasDefault);
  }

  min(n: number): NumberFieldBuilder<T, S> {
    return new NumberFieldBuilder<T, S>({ ...this._constraints, min: n }, this._isSecret, this._envVarOverride, this._isOptional, this._defaultValue, this._hasDefault);
  }

  max(n: number): NumberFieldBuilder<T, S> {
    return new NumberFieldBuilder<T, S>({ ...this._constraints, max: n }, this._isSecret, this._envVarOverride, this._isOptional, this._defaultValue, this._hasDefault);
  }

  secret(): NumberFieldBuilder<T, true> {
    return new NumberFieldBuilder<T, true>(this._constraints, true, this._envVarOverride, this._isOptional, this._defaultValue, this._hasDefault);
  }

  env(name: string): NumberFieldBuilder<T, S> {
    return new NumberFieldBuilder<T, S>(this._constraints, this._isSecret, name, this._isOptional, this._defaultValue, this._hasDefault);
  }

  optional(): NumberFieldBuilder<number | undefined, S> {
    return new NumberFieldBuilder<number | undefined, S>(this._constraints, this._isSecret, this._envVarOverride, true, undefined, false);
  }

  default(value: number): NumberFieldBuilder<number, S> {
    return new NumberFieldBuilder<number, S>(this._constraints, this._isSecret, this._envVarOverride, false, value, true);
  }
}

// =============================================================================
// BooleanFieldBuilder
// =============================================================================

export class BooleanFieldBuilder<T extends boolean | undefined = boolean, S extends boolean = false>
  implements AnyFieldBuilder
{
  declare readonly _phantom_value: T;
  declare readonly _phantom_secret: S;
  readonly _type = 'field' as const;

  constructor(
    private readonly _isSecret: S,
    private readonly _envVarOverride: string | undefined,
    private readonly _isOptional: boolean,
    private readonly _defaultValue: boolean | undefined,
    private readonly _hasDefault: boolean,
  ) {}

  get _meta(): FieldMeta {
    return {
      secret: this._isSecret,
      envVar: this._envVarOverride,
      isOptional: this._isOptional,
      defaultValue: this._defaultValue,
      hasDefault: this._hasDefault,
    };
  }

  buildZod(): z.ZodTypeAny {
    // Coerce accepts 'true', 'false', '1', '0', 1, 0 from env
    const schema = z.coerce.boolean();
    if (this._hasDefault && this._defaultValue !== undefined) return schema.default(this._defaultValue);
    if (this._isOptional) return schema.optional();
    return schema;
  }

  secret(): BooleanFieldBuilder<T, true> {
    return new BooleanFieldBuilder<T, true>(true, this._envVarOverride, this._isOptional, this._defaultValue, this._hasDefault);
  }

  env(name: string): BooleanFieldBuilder<T, S> {
    return new BooleanFieldBuilder<T, S>(this._isSecret, name, this._isOptional, this._defaultValue, this._hasDefault);
  }

  optional(): BooleanFieldBuilder<boolean | undefined, S> {
    return new BooleanFieldBuilder<boolean | undefined, S>(this._isSecret, this._envVarOverride, true, undefined, false);
  }

  default(value: boolean): BooleanFieldBuilder<boolean, S> {
    return new BooleanFieldBuilder<boolean, S>(this._isSecret, this._envVarOverride, false, value, true);
  }
}

// =============================================================================
// EnumFieldBuilder
// =============================================================================

export class EnumFieldBuilder<V extends string, T extends V | undefined = V, S extends boolean = false>
  implements AnyFieldBuilder
{
  declare readonly _phantom_value: T;
  declare readonly _phantom_secret: S;
  readonly _type = 'field' as const;

  constructor(
    private readonly _values: readonly [V, ...V[]],
    private readonly _isSecret: S,
    private readonly _envVarOverride: string | undefined,
    private readonly _isOptional: boolean,
    private readonly _defaultValue: V | undefined,
    private readonly _hasDefault: boolean,
  ) {}

  get _meta(): FieldMeta {
    return {
      secret: this._isSecret,
      envVar: this._envVarOverride,
      isOptional: this._isOptional,
      defaultValue: this._defaultValue,
      hasDefault: this._hasDefault,
    };
  }

  buildZod(): z.ZodTypeAny {
    const schema = z.enum(this._values);
    if (this._hasDefault && this._defaultValue !== undefined) return schema.default(this._defaultValue);
    if (this._isOptional) return schema.optional();
    return schema;
  }

  secret(): EnumFieldBuilder<V, T, true> {
    return new EnumFieldBuilder<V, T, true>(this._values, true, this._envVarOverride, this._isOptional, this._defaultValue, this._hasDefault);
  }

  env(name: string): EnumFieldBuilder<V, T, S> {
    return new EnumFieldBuilder<V, T, S>(this._values, this._isSecret, name, this._isOptional, this._defaultValue, this._hasDefault);
  }

  optional(): EnumFieldBuilder<V, V | undefined, S> {
    return new EnumFieldBuilder<V, V | undefined, S>(this._values, this._isSecret, this._envVarOverride, true, undefined, false);
  }

  default(value: V): EnumFieldBuilder<V, V, S> {
    return new EnumFieldBuilder<V, V, S>(this._values, this._isSecret, this._envVarOverride, false, value, true);
  }
}

// =============================================================================
// ArrayFieldBuilder
// =============================================================================

export class ArrayFieldBuilder<T, S extends boolean = false>
  implements AnyFieldBuilder
{
  declare readonly _phantom_value: T[];
  declare readonly _phantom_secret: S;
  readonly _type = 'field' as const;

  constructor(
    private readonly _itemBuilder: AnyFieldBuilder,
    private readonly _isSecret: S,
    private readonly _envVarOverride: string | undefined,
    private readonly _defaultValue: T[] | undefined,
    private readonly _hasDefault: boolean,
  ) {}

  get _meta(): FieldMeta {
    return {
      secret: this._isSecret,
      envVar: this._envVarOverride,
      isOptional: false,
      defaultValue: this._defaultValue,
      hasDefault: this._hasDefault,
    };
  }

  buildZod(): z.ZodTypeAny {
    const schema = z.array(this._itemBuilder.buildZod());
    if (this._hasDefault && this._defaultValue !== undefined) return schema.default(this._defaultValue);
    return schema;
  }

  secret(): ArrayFieldBuilder<T, true> {
    return new ArrayFieldBuilder<T, true>(this._itemBuilder, true, this._envVarOverride, this._defaultValue, this._hasDefault);
  }

  env(name: string): ArrayFieldBuilder<T, S> {
    return new ArrayFieldBuilder<T, S>(this._itemBuilder, this._isSecret, name, this._defaultValue, this._hasDefault);
  }

  default(value: T[]): ArrayFieldBuilder<T, S> {
    return new ArrayFieldBuilder<T, S>(this._itemBuilder, this._isSecret, this._envVarOverride, value, true);
  }
}

// =============================================================================
// c.* namespace — public field builder entrypoints
// =============================================================================

export const c = {
  string(): StringFieldBuilder<string, false> {
    return new StringFieldBuilder<string, false>({}, false, undefined, false, undefined, false);
  },

  number(): NumberFieldBuilder<number, false> {
    return new NumberFieldBuilder<number, false>({}, false, undefined, false, undefined, false);
  },

  boolean(): BooleanFieldBuilder<boolean, false> {
    return new BooleanFieldBuilder<boolean, false>(false, undefined, false, undefined, false);
  },

  enum<V extends string>(values: readonly [V, ...V[]]): EnumFieldBuilder<V, V, false> {
    return new EnumFieldBuilder<V, V, false>(values, false, undefined, false, undefined, false);
  },

  array<B extends AnyFieldBuilder>(item: B): ArrayFieldBuilder<InferFieldOutput<B>, false> {
    return new ArrayFieldBuilder(item, false, undefined, undefined, false);
  },
};
