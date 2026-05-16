import type {
  JsonValue,
  NodeMetadata,
  NodeModifiers,
  Refinement,
  SchemaNode,
} from "../ir/nodes.js";
import type { ObjectKey } from "../types.js";

/**
 * Base of every schema builder.
 *
 * Type parameters:
 *  - TInput:  shape `parse`/`validate` accepts (pre-default, pre-transform)
 *  - TOutput: shape `parse` returns (post-default, post-transform)
 *  - TKey:    "required" | "optional" — controls object-field absence
 *
 * The phantom `declare` fields exist purely for type inference; they emit no
 * runtime code. The single source of truth at runtime is `this.node`.
 */
export abstract class Schema<
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  TInput = unknown,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  TOutput = TInput,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  TInputKey extends ObjectKey = "required",
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  TOutputKey extends ObjectKey = TInputKey,
> {
  declare readonly _input: TInput;
  declare readonly _output: TOutput;
  declare readonly _inputKey: TInputKey;
  declare readonly _outputKey: TOutputKey;

  readonly node: SchemaNode;

  protected constructor(node: SchemaNode) {
    this.node = freeze(node);
  }

  // ---- Modifiers (applicable to every schema) ----

  optional(): Schema<
    TInput | undefined,
    TOutput | undefined,
    "optional",
    "optional"
  > {
    return this.cloneAsBase(withModifier(this.node, { optional: true }));
  }

  nullable(): Schema<TInput | null, TOutput | null, TInputKey, TOutputKey> {
    return this.cloneAsBase(withModifier(this.node, { nullable: true }));
  }

  nullish(): Schema<
    TInput | null | undefined,
    TOutput | null | undefined,
    "optional",
    "optional"
  > {
    return this.cloneAsBase(
      withModifier(this.node, { optional: true, nullable: true }),
    );
  }

  /**
   * Provide a default for missing input. Input becomes optional; output stays
   * required because the default fills `undefined` in before downstream code
   * sees it. See the absence-semantics table in the README.
   */
  default(
    value: JsonValue,
  ): Schema<
    TInput | undefined,
    Exclude<TOutput, undefined>,
    "optional",
    "required"
  > {
    return this.cloneAsBase(
      withModifier(this.node, { optional: true, default: { value } }),
    );
  }

  // ---- Metadata ----

  id(id: string): this {
    return this.cloneSelf(withMetadata(this.node, { id }));
  }

  version(version: string): this {
    return this.cloneSelf(withMetadata(this.node, { version }));
  }

  describe(description: string): this {
    return this.cloneSelf(withMetadata(this.node, { description }));
  }

  deprecated(value = true): this {
    return this.cloneSelf(withMetadata(this.node, { deprecated: value }));
  }

  // ---- Cloning hooks ----

  /**
   * Subclasses override to construct the correct concrete class. The base
   * class itself never produces instances (it's abstract), but optional /
   * nullable etc. drop down to `BaseSchema` to surface the right type params.
   */
  protected abstract clone(node: SchemaNode): this;

  protected cloneSelf(node: SchemaNode): this {
    return this.clone(node);
  }

  /**
   * Cast a clone as a Schema<TIn, TOut, TKey> for modifier returns. The
   * runtime instance is still the original subclass — we only narrow the
   * static type to drop subclass-specific methods (e.g., calling `.optional()`
   * on a StringSchema yields a base Schema with no further `.min(n)`).
   */
  protected cloneAsBase<
    I,
    O,
    IK extends ObjectKey,
    OK extends ObjectKey,
  >(node: SchemaNode): Schema<I, O, IK, OK> {
    return this.clone(node) as unknown as Schema<I, O, IK, OK>;
  }

  /** Append a refinement and clone — used by primitive subclasses. */
  protected withRefinement(refinement: Refinement): this {
    const existing = this.node.refinements ?? [];
    return this.clone({
      ...this.node,
      refinements: [...existing, refinement],
    } as SchemaNode);
  }
}

/** Erased Schema reference for generic constraints. */
export type AnySchema = Schema<any, any, ObjectKey, ObjectKey>;

// ---- Helpers ----

function withModifier(
  node: SchemaNode,
  patch: NodeModifiers,
): SchemaNode {
  return {
    ...node,
    modifiers: { ...node.modifiers, ...patch },
  } as SchemaNode;
}

function withMetadata(
  node: SchemaNode,
  patch: NodeMetadata,
): SchemaNode {
  return {
    ...node,
    metadata: { ...node.metadata, ...patch },
  } as SchemaNode;
}

/**
 * Deep-freeze in dev/test to make IR mutation immediately loud. Object.freeze
 * is shallow; we recurse through composites (fields / element / options). The
 * cost is negligible at definition time and prevents an entire class of bugs
 * where a downstream consumer mutates a shared IR node.
 */
function freeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const key of Object.keys(value as object)) {
    freeze((value as Record<string, unknown>)[key]);
  }
  return Object.freeze(value);
}
