import type { ArrayNode, SchemaNode } from "../ir/nodes.js";
import { Schema, type AnySchema } from "./schema.js";
import type { Input, Output } from "../types.js";

export class ArraySchema<E extends AnySchema> extends Schema<
  Input<E>[],
  Output<E>[],
  "required",
  "required"
> {
  constructor(
    private readonly elementSchema: E,
    node?: ArrayNode,
  ) {
    super(node ?? { kind: "array", element: elementSchema.node });
  }

  protected clone(node: SchemaNode): this {
    return new ArraySchema<E>(this.elementSchema, node as ArrayNode) as this;
  }

  get element(): E {
    return this.elementSchema;
  }

  min(items: number): ArraySchema<E> {
    return this.withRefinement({
      kind: "portable",
      name: "minItems",
      params: { value: items },
    });
  }

  max(items: number): ArraySchema<E> {
    return this.withRefinement({
      kind: "portable",
      name: "maxItems",
      params: { value: items },
    });
  }
}
