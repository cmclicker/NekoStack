import { createHash } from "node:crypto";

/**
 * Compute the `sourceHash` of a schema source file from its raw text
 * content. Master plan Decision #7: `sourceHash` is sha256 of the
 * source file's raw UTF-8 bytes — not the AST, not a canonicalized
 * form. The point is to detect *any* source-text edit; canonicalizing
 * would mask intentional reformatting and rebuild churn.
 *
 * **Pure.** No filesystem access; the CLI is responsible for reading
 * the file and passing the text in. This is the load-bearing
 * schema/cli boundary from Master plan Decision #1.
 *
 * Output format: `sha256:<64 lowercase hex chars>`. The prefixed
 * template-literal type is the canonical form everywhere
 * `sourceHash` appears in the v0.7 surface (`RegistryEntry`,
 * `GeneratedArtifact`, `ProvenanceOptions`, etc.) so consumers can't
 * accidentally confuse raw hex with the prefixed form at the type
 * level.
 *
 * Distinct from `irHash` (`../ir/hash.ts`):
 * - `irHash`         — semantic identity (canonicalized IR)
 * - `sourceHashFromText` — source-text identity (raw bytes)
 *
 * The two-hash discipline in Master plan §"Freshness verdict" is
 * what `checkHandler` uses to classify each artifact as
 * clean / cosmetic_drift / stale / integrity_error.
 */
export function sourceHashFromText(text: string): `sha256:${string}` {
  const digest = createHash("sha256").update(text, "utf8").digest("hex");
  return `sha256:${digest}`;
}
