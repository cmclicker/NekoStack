/**
 * ZodError → readonly Issue[] normalization (Decision #12 of v0.6 plan).
 *
 * This is the contract layer between Zod's internal error vocabulary
 * and NekoStack's stable, machine-readable `IssueCode` set. Downstream
 * consumers (form display, API responses, admin diagnostics) read
 * `Issue` only — they never see a `ZodError`. Per the "engine
 * swap-safe" invariant added in v0.6: replacing the runtime engine
 * later must be a no-op for those consumers, so this mapping is the
 * load-bearing translation.
 *
 * **Mapping table (Decision #12, locked).**
 *
 *   invalid_type (received: undefined, expected != undefined) → missing_required
 *   invalid_type (other)                                      → invalid_type
 *   unrecognized_keys                                         → one unknown_key per key
 *   invalid_literal                                           → invalid_literal
 *   invalid_enum_value                                        → invalid_enum
 *   invalid_union                                             → invalid_union
 *   invalid_union_discriminator                               → invalid_union  (folded;
 *                                                                no v0.6 public surface)
 *   invalid_arguments / invalid_return_type                   → invalid_type   (function
 *                                                                schemas not in v0.6
 *                                                                scope; metadata carries
 *                                                                the original code)
 *   too_small                                                 → too_small
 *   too_big                                                   → too_big
 *   invalid_string                                            → invalid_format
 *   invalid_date                                              → invalid_type   (DateNode
 *                                                                has no v0.6 builder)
 *   custom                                                    → custom_refinement_failed
 *   anything not listed                                       → custom_refinement_failed
 *                                                                (+ metadata.source="zod",
 *                                                                 metadata.zodCode=<orig>)
 *
 * The fallback row exists so adding a new Zod code in a future Zod
 * release does not crash the normalizer; the original code is
 * preserved on `metadata.zodCode` for traceability.
 *
 * **Preserved verbatim.** `path`, `message`, `expected`, `received`
 * come straight from Zod (no re-serialization). `schemaId` /
 * `schemaVersion` come from `schema.metadata` when present.
 * `severity` is always `"error"` in v0.6.
 *
 * Internal-only. Not exported from `src/index.ts` — the public
 * surface ships `Issue` / `IssueCode` / `Result` (already in v0.1).
 */

import type { ZodError, ZodIssue } from "zod";
import type { SchemaNode } from "../ir/nodes.js";
import type { Issue } from "../errors/issue.js";

/**
 * Normalize a `ZodError` into the NekoStack issue vocabulary.
 *
 * `schema` is the top-level `SchemaNode` whose validation produced
 * the error. Its `metadata.id` / `metadata.version` (when present)
 * are stamped on every emitted issue so consumers can route by
 * schema without re-correlating.
 *
 * `unrecognized_keys` is expanded into one `unknown_key` issue per
 * offending key — Zod batches the keys on a single issue, but the
 * NekoStack contract is one issue per key so downstream UIs render
 * cleanly.
 */
export function normalizeIssues(
  error: ZodError,
  schema: SchemaNode,
): readonly Issue[] {
  const schemaId = schema.metadata?.id;
  const schemaVersion = schema.metadata?.version;
  const out: Issue[] = [];
  for (const zi of error.issues) {
    appendNormalized(out, zi, schemaId, schemaVersion);
  }
  return out;
}

function appendNormalized(
  out: Issue[],
  zi: ZodIssue,
  schemaId: string | undefined,
  schemaVersion: string | undefined,
): void {
  const base = {
    path: zi.path.slice(),
    message: zi.message,
    severity: "error" as const,
    ...(schemaId !== undefined ? { schemaId } : {}),
    ...(schemaVersion !== undefined ? { schemaVersion } : {}),
  };

  switch (zi.code) {
    case "invalid_type": {
      // "field is absent" beats "field has wrong type": Zod reports
      // a missing object property as invalid_type / received="undefined",
      // but the consumer-facing distinction is whether the value was
      // there at all. See Decision #12 first row.
      const isMissing =
        zi.received === "undefined" && zi.expected !== "undefined";
      out.push({
        ...base,
        code: isMissing ? "missing_required" : "invalid_type",
        expected: zi.expected,
        received: zi.received,
      });
      return;
    }

    case "invalid_literal": {
      out.push({
        ...base,
        code: "invalid_literal",
        expected: zi.expected,
        received: zi.received,
      });
      return;
    }

    case "unrecognized_keys": {
      // Zod batches all offending keys on a single issue; the
      // NekoStack contract emits one issue per key so a UI can
      // highlight each field independently.
      for (const key of zi.keys) {
        out.push({
          ...base,
          path: [...zi.path, key],
          code: "unknown_key",
          received: key,
        });
      }
      return;
    }

    case "invalid_enum_value": {
      out.push({
        ...base,
        code: "invalid_enum",
        expected: zi.options,
        received: zi.received,
      });
      return;
    }

    case "invalid_union":
    case "invalid_union_discriminator": {
      // Folded — v0.6 has no public discriminated-union surface.
      out.push({ ...base, code: "invalid_union" });
      return;
    }

    case "invalid_arguments":
    case "invalid_return_type": {
      // Function schemas are not in v0.6 scope. If Zod somehow emits
      // these (e.g., a downstream hand-written schema), surface as
      // invalid_type with the original code on metadata for triage.
      out.push({
        ...base,
        code: "invalid_type",
        metadata: { source: "zod", zodCode: zi.code },
      });
      return;
    }

    case "too_small": {
      out.push({
        ...base,
        code: "too_small",
        metadata: {
          minimum: zi.minimum,
          inclusive: zi.inclusive,
          ...(zi.exact !== undefined ? { exact: zi.exact } : {}),
          type: zi.type,
        },
      });
      return;
    }

    case "too_big": {
      out.push({
        ...base,
        code: "too_big",
        metadata: {
          maximum: zi.maximum,
          inclusive: zi.inclusive,
          ...(zi.exact !== undefined ? { exact: zi.exact } : {}),
          type: zi.type,
        },
      });
      return;
    }

    case "invalid_string": {
      // email / url / uuid / regex / etc. all collapse to invalid_format;
      // the specific validator name is preserved on metadata for UIs
      // that want to render a tailored hint.
      out.push({
        ...base,
        code: "invalid_format",
        metadata: { validation: zi.validation },
      });
      return;
    }

    case "invalid_date": {
      // DateNode has no v0.6 builder; fall through to invalid_type per
      // the locked table.
      out.push({ ...base, code: "invalid_type" });
      return;
    }

    case "custom": {
      out.push({ ...base, code: "custom_refinement_failed" });
      return;
    }

    default: {
      // Fallback (round-2 amendment to Decision #12): any code we
      // do not explicitly map — `invalid_intersection_types`,
      // `not_multiple_of`, `not_finite`, or any future Zod code —
      // surfaces as `custom_refinement_failed` while preserving the
      // original code on `metadata.zodCode` so it is recoverable
      // downstream. `metadata.source = "zod"` is the discriminator
      // consumers key off to decide whether to trust the field.
      const code = (zi as { code?: string }).code ?? "unknown";
      out.push({
        ...base,
        code: "custom_refinement_failed",
        metadata: { source: "zod", zodCode: code },
      });
      return;
    }
  }
}
