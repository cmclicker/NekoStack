import type {
  BooleanNode,
  EnumNode,
  JsonValue,
  LiteralNode,
  NumberNode,
  SchemaNode,
  StringNode,
} from "../ir/nodes.js";
import { Schema } from "./schema.js";

// ---------- string ----------

export class StringSchema extends Schema<string, string, "required", "required"> {
  constructor(node: StringNode = { kind: "string" }) {
    super(node);
  }

  protected clone(node: SchemaNode): this {
    return new StringSchema(node as StringNode) as this;
  }

  min(length: number): StringSchema {
    return this.withRefinement({
      kind: "portable",
      name: "minLength",
      params: { value: length },
    });
  }

  max(length: number): StringSchema {
    return this.withRefinement({
      kind: "portable",
      name: "maxLength",
      params: { value: length },
    });
  }

  length(length: number): StringSchema {
    return this.withRefinement({
      kind: "portable",
      name: "length",
      params: { value: length },
    });
  }

  regex(pattern: RegExp): StringSchema {
    return this.withRefinement({
      kind: "portable",
      name: "regex",
      params: { source: pattern.source, flags: pattern.flags },
    });
  }

  email(): StringSchema {
    return this.withRefinement({ kind: "portable", name: "email" });
  }

  uuid(): StringSchema {
    return this.withRefinement({ kind: "portable", name: "uuid" });
  }

  url(): StringSchema {
    return this.withRefinement({ kind: "portable", name: "url" });
  }
}

// ---------- number ----------

export class NumberSchema extends Schema<number, number, "required", "required"> {
  constructor(node: NumberNode = { kind: "number" }) {
    super(node);
  }

  protected clone(node: SchemaNode): this {
    return new NumberSchema(node as NumberNode) as this;
  }

  int(): NumberSchema {
    return this.withRefinement({ kind: "portable", name: "int" });
  }

  min(value: number): NumberSchema {
    return this.withRefinement({
      kind: "portable",
      name: "min",
      params: { value },
    });
  }

  max(value: number): NumberSchema {
    return this.withRefinement({
      kind: "portable",
      name: "max",
      params: { value },
    });
  }

  gt(value: number): NumberSchema {
    return this.withRefinement({
      kind: "portable",
      name: "gt",
      params: { value },
    });
  }

  lt(value: number): NumberSchema {
    return this.withRefinement({
      kind: "portable",
      name: "lt",
      params: { value },
    });
  }

  multipleOf(value: number): NumberSchema {
    return this.withRefinement({
      kind: "portable",
      name: "multipleOf",
      params: { value },
    });
  }
}

// ---------- boolean ----------

export class BooleanSchema extends Schema<boolean, boolean, "required", "required"> {
  constructor(node: BooleanNode = { kind: "boolean" }) {
    super(node);
  }

  protected clone(node: SchemaNode): this {
    return new BooleanSchema(node as BooleanNode) as this;
  }
}

// ---------- literal ----------

export class LiteralSchema<T extends JsonValue> extends Schema<T, T, "required", "required"> {
  constructor(node: LiteralNode<T>) {
    super(node);
  }

  protected clone(node: SchemaNode): this {
    return new LiteralSchema<T>(node as LiteralNode<T>) as this;
  }
}

// ---------- enum ----------

export class EnumSchema<
  T extends string | number,
> extends Schema<T, T, "required", "required"> {
  constructor(node: EnumNode<T>) {
    super(node);
  }

  protected clone(node: SchemaNode): this {
    return new EnumSchema<T>(node as EnumNode<T>) as this;
  }

  get values(): readonly T[] {
    return (this.node as EnumNode<T>).values;
  }
}
