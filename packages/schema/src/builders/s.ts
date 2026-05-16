import type { JsonValue } from "../ir/nodes.js";
import { ArraySchema } from "./array.js";
import { ObjectSchema } from "./object.js";
import {
  BooleanSchema,
  EnumSchema,
  LiteralSchema,
  NumberSchema,
  StringSchema,
} from "./primitives.js";
import type { AnySchema } from "./schema.js";
import type {
  Infer as InferType,
  Input as InputType,
  Output as OutputType,
  RawShape,
} from "../types.js";

/**
 * The `s` namespace is the public DSL surface. Builders produce IR; type
 * helpers (`s.infer`, `s.input`, `s.output`) extract static types. Keep the
 * runtime and type sides aligned — adding a new builder requires no type
 * helper change, but the existence of new IR node kinds may require it.
 */
export const s = {
  string(): StringSchema {
    return new StringSchema();
  },

  number(): NumberSchema {
    return new NumberSchema();
  },

  boolean(): BooleanSchema {
    return new BooleanSchema();
  },

  literal<T extends JsonValue>(value: T): LiteralSchema<T> {
    return new LiteralSchema<T>({ kind: "literal", value });
  },

  enum<T extends readonly [string, ...string[]] | readonly [number, ...number[]]>(
    values: T,
  ): EnumSchema<T[number]> {
    if (values.length === 0) {
      throw new Error("s.enum() requires at least one value");
    }
    return new EnumSchema<T[number]>({
      kind: "enum",
      values: values as readonly T[number][],
    });
  },

  array<E extends AnySchema>(element: E): ArraySchema<E> {
    return new ArraySchema<E>(element);
  },

  object<S extends RawShape>(shape: S): ObjectSchema<S> {
    return new ObjectSchema<S>(shape);
  },
};

// Merge a `type`-only namespace under `s` so consumers can write
// `s.infer<typeof Foo>`. The const above defines runtime members; the
// namespace below adds type-level members. TS allows this co-location.
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace s {
  export type infer<T> = InferType<T>;
  export type input<T> = InputType<T>;
  export type output<T> = OutputType<T>;
}
