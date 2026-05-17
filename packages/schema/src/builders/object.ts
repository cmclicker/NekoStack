import type {
  NodeModifiers,
  ObjectNode,
  SchemaNode,
  UnknownKeysPolicy,
} from "../ir/nodes.js";
import { Schema, type AnySchema } from "./schema.js";
import type {
  ExtendShape,
  InferObjectInput,
  InferObjectOutput,
  Mask,
  MergeLeftShape,
  MergeOptions,
  MergeRightShape,
  MergeThrowShape,
  OmitShape,
  OverrideMask,
  OverrideShape,
  PartialByShape,
  PartialShape,
  PickShape,
  RawShape,
  RequiredByShape,
  RequiredShape,
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

  // ===========================================================================
  // Composition operators (v0.5) — see docs/COMPOSITION.md for the contract.
  //
  // All operators:
  //  - return a NEW ObjectSchema (no mutation)
  //  - drop top-level metadata (id / version / description / deprecated) —
  //    callers must re-tag the composed result
  //  - preserve field-level metadata
  //  - fail loudly on collisions / unknown keys / missing keys
  // ===========================================================================

  /**
   * Add new fields to this object. Decision #1: throws if any key in the
   * extension already exists in the base. To deliberately replace a field,
   * use {@link override}.
   */
  extend<E extends RawShape>(extension: E): ObjectSchema<ExtendShape<S, E>> {
    const collisions = Object.keys(extension).filter((k) => k in this.shape);
    if (collisions.length > 0) {
      throw new Error(
        `ObjectSchema.extend: key${collisions.length === 1 ? "" : "s"} already exists in base — ${formatKeys(collisions)}. Use .override() to replace deliberately, or .merge() with an explicit conflict policy.`,
      );
    }
    const newShape = { ...this.shape, ...extension } as ExtendShape<S, E>;
    return composedObject(newShape, currentUnknownKeys(this.node));
  }

  /**
   * Keep only the named keys. Decision #5: throws on any key not in the base.
   */
  pick<M extends Mask<S>>(keys: M): ObjectSchema<PickShape<S, M>> {
    assertMaskKeysInShape("pick", keys, this.shape);
    const newShape: RawShape = {};
    for (const key of Object.keys(keys)) {
      if (keys[key as keyof M] === true) {
        newShape[key] = this.shape[key]!;
      }
    }
    return composedObject(
      newShape as PickShape<S, M>,
      currentUnknownKeys(this.node),
    );
  }

  /**
   * Drop the named keys. Decision #5: throws on any key not in the base.
   */
  omit<M extends Mask<S>>(keys: M): ObjectSchema<OmitShape<S, M>> {
    assertMaskKeysInShape("omit", keys, this.shape);
    const newShape: RawShape = {};
    for (const key of Object.keys(this.shape)) {
      if (keys[key as keyof M] !== true) {
        newShape[key] = this.shape[key]!;
      }
    }
    return composedObject(
      newShape as OmitShape<S, M>,
      currentUnknownKeys(this.node),
    );
  }

  /**
   * Make fields optional. Decision #6 + #9: strips `default` from affected
   * fields (symmetric with {@link required}). Defaults are explicitly NOT
   * preserved — a partial schema should not silently inject defaults into a
   * PATCH/update payload.
   */
  partial(): ObjectSchema<PartialShape<S>>;
  partial<M extends Mask<S>>(keys: M): ObjectSchema<PartialByShape<S, M>>;
  partial<M extends Mask<S>>(
    keys?: M,
  ): ObjectSchema<PartialShape<S>> | ObjectSchema<PartialByShape<S, M>> {
    if (keys !== undefined) assertMaskKeysInShape("partial", keys, this.shape);
    const newShape: RawShape = {};
    for (const key of Object.keys(this.shape)) {
      const affected = keys === undefined || keys[key as keyof M] === true;
      newShape[key] = affected
        ? makePartial(this.shape[key]!)
        : this.shape[key]!;
    }
    return composedObject(
      newShape as PartialShape<S>,
      currentUnknownKeys(this.node),
    );
  }

  /**
   * Make fields required. Decision #8 + #9: strips both `optional` AND
   * `default` from affected fields (symmetric with {@link partial}).
   */
  required(): ObjectSchema<RequiredShape<S>>;
  required<M extends Mask<S>>(keys: M): ObjectSchema<RequiredByShape<S, M>>;
  required<M extends Mask<S>>(
    keys?: M,
  ): ObjectSchema<RequiredShape<S>> | ObjectSchema<RequiredByShape<S, M>> {
    if (keys !== undefined) assertMaskKeysInShape("required", keys, this.shape);
    const newShape: RawShape = {};
    for (const key of Object.keys(this.shape)) {
      const affected = keys === undefined || keys[key as keyof M] === true;
      newShape[key] = affected
        ? makeRequired(this.shape[key]!)
        : this.shape[key]!;
    }
    return composedObject(
      newShape as RequiredShape<S>,
      currentUnknownKeys(this.node),
    );
  }

  /**
   * Combine two object schemas. Decision #3 + #13: conflicts in fields OR
   * in unknown-key policy throw by default; resolve explicitly with the
   * `conflict` / `unknownKeys` options.
   */
  merge<Other extends RawShape>(
    other: ObjectSchema<Other>,
    options?: MergeOptions & { conflict?: "throw" },
  ): ObjectSchema<MergeThrowShape<S, Other>>;
  merge<Other extends RawShape>(
    other: ObjectSchema<Other>,
    options: MergeOptions & { conflict: "left" },
  ): ObjectSchema<MergeLeftShape<S, Other>>;
  merge<Other extends RawShape>(
    other: ObjectSchema<Other>,
    options: MergeOptions & { conflict: "right" },
  ): ObjectSchema<MergeRightShape<S, Other>>;
  // Implementation signature — wider than any single overload because the
  // narrowed return types from the overloads (MergeThrowShape /
  // MergeLeftShape / MergeRightShape) aren't assignable to each other under
  // ObjectSchema's private-field-induced invariance. `any` here is the
  // pragmatic escape; callers only see the typed overloads.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  merge<Other extends RawShape>(
    other: ObjectSchema<Other>,
    options: MergeOptions = {},
  ): any {
    const conflictPolicy = options.conflict ?? "throw";
    const unknownPolicy = options.unknownKeys ?? "throw";
    const otherShape = other.fields;

    // Field-level resolution
    const newShape: RawShape = { ...this.shape };
    const fieldCollisions: string[] = [];
    for (const key of Object.keys(otherShape)) {
      if (key in this.shape) {
        if (conflictPolicy === "throw") {
          fieldCollisions.push(key);
        } else if (conflictPolicy === "right") {
          newShape[key] = otherShape[key]!;
        }
        // "left" → keep existing
      } else {
        newShape[key] = otherShape[key]!;
      }
    }
    if (fieldCollisions.length > 0) {
      throw new Error(
        `ObjectSchema.merge: field${fieldCollisions.length === 1 ? "" : "s"} ${formatKeys(fieldCollisions)} ${fieldCollisions.length === 1 ? "exists" : "exist"} in both operands. Pass { conflict: "left" } or { conflict: "right" } to resolve.`,
      );
    }

    // unknownKeys resolution
    const leftPolicy = currentUnknownKeys(this.node);
    const rightPolicy = currentUnknownKeys(other.node);
    let resolvedPolicy: UnknownKeysPolicy;
    if (leftPolicy === rightPolicy) {
      resolvedPolicy = leftPolicy;
    } else if (unknownPolicy === "throw") {
      throw new Error(
        `ObjectSchema.merge: unknownKeys policies differ — left is "${leftPolicy}", right is "${rightPolicy}". Pass { unknownKeys: "left" } or { unknownKeys: "right" } to resolve.`,
      );
    } else if (unknownPolicy === "left") {
      resolvedPolicy = leftPolicy;
    } else {
      resolvedPolicy = rightPolicy;
    }

    return composedObject(newShape, resolvedPolicy);
  }

  /**
   * Replace existing fields' schemas. Decision #2: throws if any key in the
   * override is NOT in the base. To add new fields, use {@link extend}.
   */
  override<O extends OverrideMask<S>>(
    overrides: O,
  ): ObjectSchema<OverrideShape<S, O>> {
    const unknown = Object.keys(overrides).filter((k) => !(k in this.shape));
    if (unknown.length > 0) {
      throw new Error(
        `ObjectSchema.override: key${unknown.length === 1 ? "" : "s"} ${formatKeys(unknown)} ${unknown.length === 1 ? "does" : "do"} not exist in base. Use .extend() to add new fields.`,
      );
    }
    const newShape: RawShape = { ...this.shape };
    for (const key of Object.keys(overrides)) {
      const replacement = overrides[key as keyof O];
      if (replacement !== undefined) {
        newShape[key] = replacement as AnySchema;
      }
    }
    return composedObject(
      newShape as OverrideShape<S, O>,
      currentUnknownKeys(this.node),
    );
  }
}

// ===========================================================================
// helpers
// ===========================================================================

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

function currentUnknownKeys(node: SchemaNode): UnknownKeysPolicy {
  return (node as ObjectNode).unknownKeys;
}

function formatKeys(keys: string[]): string {
  return keys.map((k) => `'${k}'`).join(", ");
}

function assertMaskKeysInShape<S extends RawShape>(
  op: "pick" | "omit" | "partial" | "required",
  mask: Mask<S>,
  shape: S,
): void {
  const unknown = Object.keys(mask).filter((k) => !(k in shape));
  if (unknown.length > 0) {
    throw new Error(
      `ObjectSchema.${op}: key${unknown.length === 1 ? "" : "s"} ${formatKeys(unknown)} ${unknown.length === 1 ? "does" : "do"} not exist in base shape.`,
    );
  }
}

/**
 * Construct a composed ObjectSchema. Decision #11: drops all top-level
 * metadata so consumers re-tag explicitly via `.id()` / `.version()` /
 * `.describe()`.
 */
function composedObject<S extends RawShape>(
  shape: S,
  unknownKeys: UnknownKeysPolicy,
): ObjectSchema<S> {
  const fields: Record<string, SchemaNode> = {};
  for (const key of Object.keys(shape)) {
    fields[key] = (shape[key] as AnySchema).node;
  }
  const node: ObjectNode = {
    kind: "object",
    fields,
    unknownKeys,
  };
  return new ObjectSchema<S>(shape, node);
}

// ===========================================================================
// Field-level mutators for partial / required (operate on an AnySchema
// instance by producing a new instance with adjusted modifiers + node).
// ===========================================================================

/**
 * Build a partial version of a field: sets optional, strips default.
 * Reaches in via the field's `node` and a new clone with adjusted modifiers.
 * The underlying Schema subclass's `clone` builds the correct instance type.
 */
function makePartial(field: AnySchema): AnySchema {
  const oldMods: NodeModifiers = field.node.modifiers ?? {};
  // Strip default; set optional (always true for partial).
  const newMods: NodeModifiers = {
    ...oldMods,
    optional: true,
  };
  delete newMods.default;
  // Use the type-system escape hatch: clone is protected, but we own the
  // composition flow and need to reach in to swap modifiers cleanly.
  const newNode = withModifiers(field.node, newMods);
  return cloneField(field, newNode);
}

function makeRequired(field: AnySchema): AnySchema {
  const oldMods: NodeModifiers = field.node.modifiers ?? {};
  const newMods: NodeModifiers = { ...oldMods };
  delete newMods.optional;
  delete newMods.default;
  const newNode = withModifiers(field.node, newMods);
  return cloneField(field, newNode);
}

function withModifiers(node: SchemaNode, modifiers: NodeModifiers): SchemaNode {
  const next = { ...node, modifiers } as SchemaNode;
  // If the modifiers object is now empty, drop the key to match v0.1's
  // "modifiers undefined when none set" convention. Keeps IR canonical.
  if (Object.keys(modifiers).length === 0) {
    delete (next as { modifiers?: NodeModifiers }).modifiers;
  }
  return next;
}

/**
 * Type-system gymnastic: Schema's `clone` is protected. We bridge via an
 * exposed helper on Schema. (Defined as a static-ish utility colocated here
 * to keep composition concerns visible in one place.)
 */
function cloneField(field: AnySchema, node: SchemaNode): AnySchema {
  // The Schema base exposes a public-ish escape via constructor on the
  // subclass, but the cleanest portable path is to re-construct from the
  // same field's `clone`. Cast to access the protected method.
  type WithClone = AnySchema & { clone(n: SchemaNode): AnySchema };
  return (field as WithClone).clone(node);
}
