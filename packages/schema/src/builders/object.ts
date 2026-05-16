import type {
  ObjectNode,
  SchemaNode,
  UnknownKeysPolicy,
} from "../ir/nodes.js";
import { Schema, type AnySchema } from "./schema.js";
import type {
  InferObjectInput,
  InferObjectOutput,
  RawShape,
} from "../types.js";

export class ObjectSchema<S extends RawShape> extends Schema<
  InferObjectInput<S>,
  InferObjectOutput<S>,
  "required",
  "required"
> {
  constructor(
    private readonly shape: S,
    node?: ObjectNode,
  ) {
    super(
      node ?? {
        kind: "object",
        fields: mapShapeToFields(shape),
        unknownKeys: "strict",
      },
    );
  }

  protected clone(node: SchemaNode): this {
    return new ObjectSchema<S>(this.shape, node as ObjectNode) as this;
  }

  /** Access the original shape map (preserves subclass-specific methods). */
  get fields(): Readonly<S> {
    return this.shape;
  }

  // ---- Unknown-key policy (strict is the default) ----

  strict(): ObjectSchema<S> {
    return this.withUnknownKeys("strict");
  }

  stripUnknown(): ObjectSchema<S> {
    return this.withUnknownKeys("stripUnknown");
  }

  passthrough(): ObjectSchema<S> {
    return this.withUnknownKeys("passthrough");
  }

  private withUnknownKeys(policy: UnknownKeysPolicy): ObjectSchema<S> {
    const current = this.node as ObjectNode;
    return new ObjectSchema<S>(this.shape, {
      ...current,
      unknownKeys: policy,
    });
  }
}

function mapShapeToFields<S extends RawShape>(
  shape: S,
): Readonly<Record<string, SchemaNode>> {
  const out: Record<string, SchemaNode> = {};
  for (const key of Object.keys(shape)) {
    const field = shape[key] as AnySchema;
    out[key] = field.node;
  }
  return out;
}
