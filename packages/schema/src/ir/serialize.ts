import type { SchemaNode } from "./nodes.js";

/**
 * Canonical JSON serialization of a SchemaNode: keys are sorted alphabetically
 * at every level so two structurally identical IRs always produce byte-identical
 * output. This is the input to `irHash` (computed in a later phase).
 */
export function serializeIR(node: SchemaNode): string {
  return JSON.stringify(canonicalize(node));
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as object).sort()) {
    const v = (value as Record<string, unknown>)[key];
    if (v === undefined) continue;
    out[key] = canonicalize(v);
  }
  return out;
}
