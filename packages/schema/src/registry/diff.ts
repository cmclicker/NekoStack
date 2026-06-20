/**
 * Schema diff classifier (Master plan Step 7).
 *
 * `diffNodes(before, after)` walks two `SchemaNode` trees and emits a
 * list of `DiffChange`s with severity per the locked Master plan
 * Decision #12 table. The **input-acceptance compatibility** lens is
 * primary: severity reflects whether the new schema accepts every
 * input the old one did (additive) or rejects some (breaking).
 * Output-side caveats are reflected in `kind` / `message` where they
 * matter (`default_removed`, etc.) but do not split the severity.
 *
 * **Pure.** No registry lookup, no `Issue[]` surface, no filesystem.
 * The function returns `readonly DiffChange[]`; an empty array means
 * the schemas are equivalent. `worstSeverity` aggregation lives in
 * `diffHandler` (Step 9).
 *
 * Unsupported IR kinds (`date`, `union`, `recursiveRef`, `transform`)
 * throw `UnsupportedNodeKindError({ generator: "diff", kind })` per
 * Master plan Decision #14 — same fail-loud discipline as the v0.3 /
 * v0.6 generators.
 */

import type {
  ArrayNode,
  EnumNode,
  JsonValue,
  LiteralNode,
  NodeMetadata,
  NodeModifiers,
  ObjectNode,
  PortableRefinement,
  Refinement,
  SchemaNode,
} from "../ir/nodes.js";
import type { IssuePath } from "../errors/issue.js";
import type { DiffChange, DiffSeverity } from "./types.js";
import { UnsupportedNodeKindError } from "../generators/errors.js";

const SUPPORTED_KINDS: ReadonlySet<string> = new Set([
  "string",
  "number",
  "boolean",
  "literal",
  "enum",
  "array",
  "object",
]);

export function diffNodes(
  before: SchemaNode,
  after: SchemaNode,
): readonly DiffChange[] {
  ensureSupported(before);
  ensureSupported(after);
  return walk(before, after, []);
}

// =============================================================================
// Walker
// =============================================================================

function walk(
  before: SchemaNode,
  after: SchemaNode,
  path: IssuePath,
): DiffChange[] {
  const out: DiffChange[] = [];

  // Top-level kind mismatch: cannot meaningfully diff further.
  if (before.kind !== after.kind) {
    out.push({
      severity: "breaking",
      path,
      kind: "type_changed",
      before: before.kind,
      after: after.kind,
      message: `Type changed from \`${before.kind}\` to \`${after.kind}\``,
    });
    return out;
  }

  // Same-kind: diff each axis independently.
  out.push(...diffMetadata(before.metadata, after.metadata, path));
  out.push(...diffDefault(before.modifiers, after.modifiers, path));
  out.push(...diffAbsence(before.modifiers, after.modifiers, path));
  out.push(...diffRefinements(before.refinements, after.refinements, path));

  switch (before.kind) {
    case "object":
      out.push(...diffObject(before as ObjectNode, after as ObjectNode, path));
      break;
    case "array":
      out.push(
        ...walk(
          (before as ArrayNode).element,
          (after as ArrayNode).element,
          [...path, "[]"],
        ),
      );
      break;
    case "enum":
      out.push(...diffEnum(before as EnumNode, after as EnumNode, path));
      break;
    case "literal":
      out.push(
        ...diffLiteral(before as LiteralNode, after as LiteralNode, path),
      );
      break;
    case "string":
    case "number":
    case "boolean":
      // No kind-specific data beyond modifiers + refinements.
      break;
    default:
      // Should not be reachable — ensureSupported() gated unsupported
      // kinds at the entry point. Belt-and-suspenders.
      throw new UnsupportedNodeKindError({
        kind: (before as { kind: string }).kind,
        generator: "diff",
      });
  }
  return out;
}

// =============================================================================
// Metadata (cosmetic)
// =============================================================================

function diffMetadata(
  before: NodeMetadata | undefined,
  after: NodeMetadata | undefined,
  path: IssuePath,
): DiffChange[] {
  const out: DiffChange[] = [];
  const b = before ?? {};
  const a = after ?? {};

  if (b.version !== a.version) {
    out.push({
      severity: "cosmetic",
      path,
      kind: "schema_version_changed",
      before: b.version ?? null,
      after: a.version ?? null,
      message: `schemaVersion changed from \`${b.version ?? "null"}\` to \`${a.version ?? "null"}\``,
    });
  }
  if (b.description !== a.description) {
    out.push({
      severity: "cosmetic",
      path,
      kind: "metadata_changed",
      before: b.description ?? null,
      after: a.description ?? null,
      message: "Description changed",
    });
  }
  if ((b.deprecated ?? false) !== (a.deprecated ?? false)) {
    out.push({
      severity: "cosmetic",
      path,
      kind: "metadata_changed",
      before: b.deprecated ?? false,
      after: a.deprecated ?? false,
      message: `Deprecated flag changed to ${a.deprecated ?? false}`,
    });
  }
  if (b.id !== a.id) {
    out.push({
      severity: "cosmetic",
      path,
      kind: "metadata_changed",
      before: b.id ?? null,
      after: a.id ?? null,
      message: `schemaId changed from \`${b.id ?? "null"}\` to \`${a.id ?? "null"}\``,
    });
  }
  return out;
}

// =============================================================================
// Default add / remove / value-change
// =============================================================================

function diffDefault(
  before: NodeModifiers | undefined,
  after: NodeModifiers | undefined,
  path: IssuePath,
): DiffChange[] {
  const beforeDefault = before?.default;
  const afterDefault = after?.default;

  if (beforeDefault === undefined && afterDefault === undefined) return [];

  if (beforeDefault === undefined && afterDefault !== undefined) {
    return [
      {
        severity: "additive",
        path,
        kind: "default_added",
        after: afterDefault.value,
        message: `Default added (value: ${formatValue(afterDefault.value)})`,
      },
    ];
  }
  if (beforeDefault !== undefined && afterDefault === undefined) {
    return [
      {
        severity: "breaking",
        path,
        kind: "default_removed",
        before: beforeDefault.value,
        message: `Default removed (was: ${formatValue(beforeDefault.value)})`,
      },
    ];
  }
  // Both have a default — compare values.
  // Guard for TypeScript narrowing; both branches above return early for undefined cases.
  if (beforeDefault === undefined || afterDefault === undefined) return [];
  if (!jsonEqual(beforeDefault.value, afterDefault.value)) {
    return [
      {
        severity: "breaking",
        path,
        kind: "default_value_changed",
        before: beforeDefault.value,
        after: afterDefault.value,
        message: `Default value changed from ${formatValue(beforeDefault.value)} to ${formatValue(afterDefault.value)}`,
      },
    ];
  }
  return [];
}

// =============================================================================
// Absence modifiers (optional / nullable / nullish), independent of default
// =============================================================================

type AbsenceState = "required" | "optional" | "nullable" | "nullish";

function diffAbsence(
  before: NodeModifiers | undefined,
  after: NodeModifiers | undefined,
  path: IssuePath,
): DiffChange[] {
  // The `optional` flag set as a side effect of `default()` is masked
  // here — default add/remove is the change being tracked, not the
  // implicit optional flip. Per Decision #12, "Add default to existing
  // required field" is one row, additive — not two rows.
  const beforeState = absenceStateOf(before);
  const afterState = absenceStateOf(after);
  if (beforeState === afterState) return [];

  return [
    {
      severity: absenceSeverity(beforeState, afterState),
      path,
      kind: "absence_modifier_changed",
      before: beforeState,
      after: afterState,
      message: `Absence modifier changed: ${beforeState} → ${afterState}`,
    },
  ];
}

function absenceStateOf(mod: NodeModifiers | undefined): AbsenceState {
  // Mask optional-by-default; that's tracked by the default axis.
  const opt = mod?.optional === true && mod?.default === undefined;
  const nul = mod?.nullable === true;
  if (opt && nul) return "nullish";
  if (opt) return "optional";
  if (nul) return "nullable";
  return "required";
}

/**
 * Transition severity per the v0.7 input-acceptance lens. The new
 * state's accepted set vs. the old: superset → additive, otherwise
 * breaking. No-op (same state) is handled upstream.
 */
function absenceSeverity(
  from: AbsenceState,
  to: AbsenceState,
): DiffSeverity {
  // Required is the smallest accepted set; nullish is the largest.
  // Anything that drops a previously-accepted shape is breaking.
  const SUPERSET: Record<AbsenceState, ReadonlySet<AbsenceState>> = {
    required: new Set(["required"]),
    optional: new Set(["required", "optional"]),
    nullable: new Set(["required", "nullable"]),
    nullish: new Set(["required", "optional", "nullable", "nullish"]),
  };
  return SUPERSET[to].has(from) ? "additive" : "breaking";
}

// =============================================================================
// Refinements
// =============================================================================

function diffRefinements(
  before: readonly Refinement[] | undefined,
  after: readonly Refinement[] | undefined,
  path: IssuePath,
): DiffChange[] {
  const beforeRefs = (before ?? []).filter(isPortable);
  const afterRefs = (after ?? []).filter(isPortable);

  const beforeByName = new Map<string, PortableRefinement>();
  for (const r of beforeRefs) beforeByName.set(r.name, r);
  const afterByName = new Map<string, PortableRefinement>();
  for (const r of afterRefs) afterByName.set(r.name, r);

  const out: DiffChange[] = [];

  // Refinements present in `before` but not in `after` → loosened →
  // additive.
  for (const [name, r] of beforeByName) {
    if (!afterByName.has(name)) {
      out.push({
        severity: "additive",
        path,
        kind: "refinement_changed",
        before: r,
        message: `Refinement \`${name}\` removed (loosened)`,
      });
    }
  }
  // Refinements present in `after` but not in `before` → tightened →
  // breaking.
  for (const [name, r] of afterByName) {
    if (!beforeByName.has(name)) {
      out.push({
        severity: "breaking",
        path,
        kind: "refinement_changed",
        after: r,
        message: `Refinement \`${name}\` added (tightened)`,
      });
    }
  }
  // Refinements present in both with different params.
  for (const [name, beforeR] of beforeByName) {
    const afterR = afterByName.get(name);
    if (afterR === undefined) continue;
    if (!jsonEqual(beforeR.params ?? {}, afterR.params ?? {})) {
      out.push({
        severity: refinementParamSeverity(name, beforeR, afterR),
        path,
        kind: "refinement_changed",
        before: beforeR,
        after: afterR,
        message: `Refinement \`${name}\` parameters changed`,
      });
    }
  }

  // If no changes detected so far, check for reorder (same set,
  // different order). Cosmetic.
  if (out.length === 0) {
    const beforeOrder = beforeRefs.map((r) => r.name).join(",");
    const afterOrder = afterRefs.map((r) => r.name).join(",");
    if (
      beforeOrder !== afterOrder &&
      [...beforeRefs.map((r) => r.name)].sort().join(",") ===
        [...afterRefs.map((r) => r.name)].sort().join(",")
    ) {
      out.push({
        severity: "cosmetic",
        path,
        kind: "refinements_reordered",
        before: beforeOrder,
        after: afterOrder,
        message: "Refinements reordered (same set, different order)",
      });
    }
  }

  return out;
}

function isPortable(r: Refinement): r is PortableRefinement {
  return r.kind === "portable";
}

/**
 * For a refinement that exists on both sides with different params,
 * decide whether the change tightens (breaking) or loosens (additive)
 * the accepted set. Numeric bounds have a defined direction; literal-
 * matching refinements (`regex`, `length`, `multipleOf`) are
 * conservatively breaking on any value change.
 */
function refinementParamSeverity(
  name: string,
  before: PortableRefinement,
  after: PortableRefinement,
): DiffSeverity {
  const beforeValue = before.params?.value;
  const afterValue = after.params?.value;
  if (typeof beforeValue !== "number" || typeof afterValue !== "number") {
    return "breaking";
  }
  switch (name) {
    case "minLength":
    case "min":
    case "minItems":
    case "gt":
      return afterValue > beforeValue ? "breaking" : "additive";
    case "maxLength":
    case "max":
    case "maxItems":
    case "lt":
      return afterValue < beforeValue ? "breaking" : "additive";
    case "length":
    case "multipleOf":
    case "regex":
    default:
      return "breaking";
  }
}

// =============================================================================
// Object: fields + unknownKeys policy
// =============================================================================

function diffObject(
  before: ObjectNode,
  after: ObjectNode,
  path: IssuePath,
): DiffChange[] {
  const out: DiffChange[] = [];

  // Unknown-keys policy
  if (before.unknownKeys !== after.unknownKeys) {
    out.push({
      severity: unknownKeysSeverity(before.unknownKeys, after.unknownKeys),
      path,
      kind: "unknown_keys_changed",
      before: before.unknownKeys,
      after: after.unknownKeys,
      message: `unknownKeys policy changed: ${before.unknownKeys} → ${after.unknownKeys}`,
    });
  }

  // Field-level diff
  const beforeKeys = Object.keys(before.fields);
  const afterKeys = Object.keys(after.fields);
  const allKeys = new Set([...beforeKeys, ...afterKeys]);

  for (const key of allKeys) {
    const beforeField = before.fields[key];
    const afterField = after.fields[key];
    const childPath: IssuePath = [...path, key];

    if (beforeField === undefined && afterField !== undefined) {
      // Field added — severity depends on the new field's modifiers.
      out.push({
        severity: newFieldSeverity(afterField),
        path: childPath,
        kind: "field_added",
        after: afterField,
        message: `Field \`${key}\` added (${absenceStateOf(afterField.modifiers)}${afterField.modifiers?.default !== undefined ? ", default-bearing" : ""})`,
      });
      continue;
    }
    if (beforeField !== undefined && afterField === undefined) {
      out.push({
        severity: "breaking",
        path: childPath,
        kind: "field_removed",
        before: beforeField,
        message: `Field \`${key}\` removed`,
      });
      continue;
    }
    if (beforeField !== undefined && afterField !== undefined) {
      out.push(...walk(beforeField, afterField, childPath));
    }
  }

  return out;
}

/**
 * Per Master plan Decision #12: adding a new field's severity depends
 * on whether that field accepts the *absence* of the value (i.e., old
 * inputs lacking the key still validate).
 */
function newFieldSeverity(node: SchemaNode): DiffSeverity {
  const mod = node.modifiers;
  const hasDefault = mod?.default !== undefined;
  const isOptional = mod?.optional === true;
  const isNullable = mod?.nullable === true;

  // additive: input-optional (the key may be absent and the schema
  // still validates).
  if (hasDefault) return "additive";
  if (isOptional && isNullable) return "additive"; // nullish
  if (isOptional) return "additive";
  // breaking: nullable-only is required-but-may-be-null (old inputs
  // lacking the key fail); required is the same fail mode.
  if (isNullable) return "breaking";
  return "breaking";
}

function unknownKeysSeverity(
  before: ObjectNode["unknownKeys"],
  after: ObjectNode["unknownKeys"],
): DiffSeverity {
  // strict accepts the smallest set (no unknown keys).
  // passthrough / stripUnknown both accept arbitrary unknown keys.
  // For input-acceptance: strict → passthrough/stripUnknown grows the
  // accepted set (additive); the reverse shrinks it (breaking).
  // passthrough ↔ stripUnknown both accept the same input set (the
  // output behavior differs — preserve vs. drop — but at the
  // input-acceptance lens this is cosmetic).
  if (before === "strict" && after !== "strict") return "additive";
  if (after === "strict" && before !== "strict") return "breaking";
  return "cosmetic";
}

// =============================================================================
// Enum
// =============================================================================

function diffEnum(
  before: EnumNode,
  after: EnumNode,
  path: IssuePath,
): DiffChange[] {
  const out: DiffChange[] = [];
  const beforeSet = new Set(before.values.map((v) => JSON.stringify(v)));
  const afterSet = new Set(after.values.map((v) => JSON.stringify(v)));

  for (const v of after.values) {
    if (!beforeSet.has(JSON.stringify(v))) {
      out.push({
        severity: "additive",
        path,
        kind: "enum_value_added",
        after: v,
        message: `Enum value added: ${formatValue(v)}`,
      });
    }
  }
  for (const v of before.values) {
    if (!afterSet.has(JSON.stringify(v))) {
      out.push({
        severity: "breaking",
        path,
        kind: "enum_value_removed",
        before: v,
        message: `Enum value removed: ${formatValue(v)}`,
      });
    }
  }
  return out;
}

// =============================================================================
// Literal
// =============================================================================

function diffLiteral(
  before: LiteralNode,
  after: LiteralNode,
  path: IssuePath,
): DiffChange[] {
  if (jsonEqual(before.value, after.value)) return [];
  return [
    {
      severity: "breaking",
      path,
      kind: "literal_changed",
      before: before.value,
      after: after.value,
      message: `Literal changed from ${formatValue(before.value)} to ${formatValue(after.value)}`,
    },
  ];
}

// =============================================================================
// Helpers
// =============================================================================

function ensureSupported(node: SchemaNode): void {
  if (!SUPPORTED_KINDS.has(node.kind)) {
    throw new UnsupportedNodeKindError({
      kind: node.kind,
      generator: "diff",
    });
  }
}

function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function formatValue(v: JsonValue | unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
