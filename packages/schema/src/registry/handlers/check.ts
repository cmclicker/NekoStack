/**
 * `checkHandler({ registry, committedArtifacts })` — freshness check
 * via the two-hash matrix from Master plan §"Freshness verdict —
 * two-hash discipline".
 *
 * Pure. No filesystem, no `import()`, no `process.*`, no `console.*`.
 * The CLI reads each artifact's bytes from disk and hands them in;
 * this function parses provenance, looks up the matching
 * `RegistryEntry`, and produces one `FreshnessVerdict` per artifact.
 * Master plan Decision #1 boundary.
 *
 * ## Two-hash matrix
 *
 * | artifact irHash | artifact sourceHash | verdict |
 * |---|---|---|
 * | matches registry | matches registry | `clean` |
 * | matches registry | **differs**      | `cosmetic_drift` |
 * | **differs**     | **differs**       | `stale` |
 * | **differs**     | matches registry  | `integrity_error` (the impossible row — should never happen unless the artifact was hand-edited or the recorded sourceHash was tampered with) |
 *
 * ## v0.6 backward compatibility (Master plan Decision #8)
 *
 * Artifacts emitted before Step 4 (`@nekostack/schema@0.6.0` and
 * earlier) have no `sourceHash` field/line. `parseProvenanceFromText`
 * returns `sourceHash: undefined` for those. Treat as:
 *
 * - `irHash` matches registry → `clean`
 * - `irHash` differs from registry → `stale`
 *
 * Absent `sourceHash` is **never** an integrity error by itself — the
 * artifact simply predates the two-hash discipline. Once the user
 * regenerates the artifact at v0.7+, full matrix participation
 * resumes.
 *
 * ## Failure paths (Result<...> failure)
 *
 * - **Malformed provenance** — `parseProvenanceFromText` already
 *   returns an `integrity_error` Issue; this handler forwards those
 *   issues with the artifact path attached.
 * - **Anonymous artifact** (provenance `schemaId === null`) —
 *   `schema_not_found` with `metadata.reason = "anonymous_artifact"`.
 *   The registry never indexes anonymous schemas (Master plan
 *   Decision #5), so there's nothing to validate against.
 * - **schemaId not in registry** — `schema_not_found`. The user
 *   likely deleted a schema source file but forgot to delete the
 *   generated artifacts.
 * - **schemaId present but version not in registry** —
 *   `version_not_found`. Distinct code so the CLI can format
 *   orphan-by-id vs. orphan-by-version differently.
 *
 * Any artifact failure surfaces as `Result.failure` for the whole
 * check call. Per-artifact verdicts are returned only when EVERY
 * artifact parses + resolves cleanly.
 */

import { findSchema } from "../build-registry.js";
import { parseProvenanceFromText } from "../parse-provenance.js";
import type { Issue, Result } from "../../errors/issue.js";
import type {
  CheckOpts,
  CheckResult,
  CommittedArtifact,
  FreshnessVerdict,
  Registry,
  RegistryEntry,
} from "../types.js";

export function checkHandler(opts: CheckOpts): CheckResult {
  const verdicts: FreshnessVerdict[] = [];
  const issues: Issue[] = [];

  for (const artifact of opts.committedArtifacts) {
    const r = classifyArtifact(artifact, opts.registry);
    if (r.kind === "verdict") {
      verdicts.push(r.verdict);
    } else {
      issues.push(...r.issues);
    }
  }

  if (issues.length > 0) {
    return { success: false, issues };
  }
  return { success: true, data: { verdicts } };
}

// =============================================================================
// Per-artifact classification
// =============================================================================

type Classification =
  | { kind: "verdict"; verdict: FreshnessVerdict }
  | { kind: "issues"; issues: readonly Issue[] };

function classifyArtifact(
  artifact: CommittedArtifact,
  registry: Registry,
): Classification {
  // 1. Parse provenance. Forward failures with the artifact path.
  const parsed = parseProvenanceFromText(artifact.content);
  if (!parsed.success) {
    return {
      kind: "issues",
      issues: parsed.issues.map((i) => ({
        ...i,
        path: [artifact.path],
        metadata: { ...(i.metadata ?? {}), artifactPath: artifact.path },
      })),
    };
  }
  const { schemaId, schemaVersion, irHash, sourceHash } = parsed.data;

  // 2. Anonymous artifact — registry never indexes anonymous schemas.
  if (schemaId === null) {
    return {
      kind: "issues",
      issues: [
        {
          code: "schema_not_found",
          path: [artifact.path],
          message: `Anonymous artifact \`${artifact.path}\` cannot be validated; registry does not index anonymous schemas.`,
          severity: "error",
          metadata: {
            reason: "anonymous_artifact",
            artifactPath: artifact.path,
          },
        },
      ],
    };
  }

  // 3. Look up the (schemaId, schemaVersion) pair in the registry.
  // Pass the version explicitly so `findSchema` does exact-match
  // rather than highest-semver fallback.
  const versionKey = schemaVersion ?? "";
  const entry = findSchema(registry, schemaId, versionKey);
  if (entry === undefined) {
    const idKnown = registry.has(schemaId);
    return {
      kind: "issues",
      issues: [
        idKnown
          ? versionNotFoundIssue(artifact, schemaId, schemaVersion)
          : schemaNotFoundIssue(artifact, schemaId, schemaVersion),
      ],
    };
  }

  // 4. Apply the two-hash matrix.
  return { kind: "verdict", verdict: verdictFor(artifact, irHash, sourceHash, entry) };
}

function verdictFor(
  artifact: CommittedArtifact,
  artifactIrHash: `sha256:${string}`,
  artifactSourceHash: `sha256:${string}` | undefined,
  entry: RegistryEntry,
): FreshnessVerdict {
  const irMatch = artifactIrHash === entry.irHash;

  // v0.6-era artifact: no sourceHash recorded.
  // - irHash match → clean
  // - irHash differ → stale
  // Never integrity_error.
  if (artifactSourceHash === undefined) {
    return {
      status: irMatch ? "clean" : "stale",
      artifactPath: artifact.path,
    };
  }

  const sourceMatch = artifactSourceHash === entry.sourceHash;
  let status: FreshnessVerdict["status"];
  if (irMatch && sourceMatch) status = "clean";
  else if (irMatch && !sourceMatch) status = "cosmetic_drift";
  else if (!irMatch && !sourceMatch) status = "stale";
  else status = "integrity_error";

  return { status, artifactPath: artifact.path };
}

// =============================================================================
// Issue constructors
// =============================================================================

function schemaNotFoundIssue(
  artifact: CommittedArtifact,
  schemaId: string,
  schemaVersion: string | null,
): Issue {
  return {
    code: "schema_not_found",
    path: [artifact.path],
    message: `Schema \`${schemaId}\` referenced by artifact \`${artifact.path}\` is not in the registry. ` +
      `The schema source may have been deleted; remove the generated artifact or restore the source.`,
    severity: "error",
    metadata: {
      artifactPath: artifact.path,
      schemaId,
      schemaVersion: schemaVersion ?? null,
    },
  };
}

function versionNotFoundIssue(
  artifact: CommittedArtifact,
  schemaId: string,
  schemaVersion: string | null,
): Issue {
  const versionLabel =
    schemaVersion === null ? "(unversioned)" : `v${schemaVersion}`;
  return {
    code: "version_not_found",
    path: [artifact.path],
    message: `Schema \`${schemaId}\` exists in the registry but version \`${versionLabel}\` (referenced by \`${artifact.path}\`) does not. ` +
      `Regenerate the artifact against the current schema versions.`,
    severity: "error",
    metadata: {
      artifactPath: artifact.path,
      schemaId,
      schemaVersion: schemaVersion ?? null,
    },
  };
}
