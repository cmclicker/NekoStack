import { createHash } from "node:crypto";
import type { SchemaNode } from "./nodes.js";
import { serializeIR } from "./serialize.js";

/**
 * Stable, content-addressed hash of a SchemaNode's canonical IR. Two
 * structurally identical IRs always produce the same hash; any semantic
 * change to the IR produces a different one.
 *
 * Algorithm: `sha256(serializeIR(node))` over UTF-8 bytes, hex-encoded.
 *
 * Consumed by:
 *  - Generated-file headers (v0.2+) — proves a generated artifact was
 *    produced from a specific IR.
 *  - The v0.7 CLI freshness check — `neko schema check` re-derives the
 *    hash from current source and compares against the committed header.
 *
 * This helper deliberately does NOT compute `sourceHash`. That requires
 * knowing the source file (path + bytes), which is a CLI concern.
 */
export function irHash(node: SchemaNode): string {
  return createHash("sha256").update(serializeIR(node), "utf8").digest("hex");
}
