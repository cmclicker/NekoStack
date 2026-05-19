/**
 * `loadCommittedArtifacts(generatedDir)` — CLI-side committed-artifact
 * reader for the `check` command (v0.7 Step 24).
 *
 * Walks `generatedDir` for the four locked NekoStack artifact-name
 * suffixes (Master plan Decision #6) and reads each one's bytes as
 * UTF-8 text. Returns one {@link CommittedArtifact} per file. The
 * schema-side `checkHandler` then parses each artifact's provenance
 * block and applies the two-hash freshness matrix; this loader only
 * handles the filesystem read.
 *
 *   <generatedDir>/<basename>.types.ts          ← TS output
 *   <generatedDir>/<basename>.zod.ts            ← Zod source
 *   <generatedDir>/<basename>.json.schema.json  ← JSON Schema
 *   <generatedDir>/<basename>.openapi.json      ← OpenAPI 3.1 component
 *
 * Multi-schema source files add a discriminator slug between the
 * basename and the artifact suffix (e.g. `account.com-x-tenant.types.ts`).
 * The glob patterns below match the full set without re-deriving the
 * discriminator rule — any file whose name ends in one of the four
 * suffixes is treated as a candidate artifact.
 *
 * Behavior:
 *
 *   - Default behavior reads every artifact under the dir, recursively.
 *   - If the directory does not exist, returns `[]` — the schema-side
 *     `checkHandler` treats "no artifacts" as a no-op verdict, which
 *     is the right shape for a fresh workspace before its first
 *     `neko schema generate` run.
 *   - Per-artifact paths returned to the caller are
 *     {@link generatedDir}-relative, forward-slash-normalized, for
 *     stable display across platforms (same convention as the walker
 *     in `walk-workspace.ts`).
 *
 * No `console.*`, no `process.exit`, no stdout/stderr writes — static-
 * scan asserted by [`../../tests/loaders/read-artifacts.test.ts`](../../tests/loaders/read-artifacts.test.ts).
 *
 * This module does NOT:
 *   - Parse artifact provenance (schema-side `parseProvenanceFromText`).
 *   - Compute freshness verdicts (schema-side `checkHandler`).
 *   - Write artifacts to disk (Step 32's `generate.ts` command).
 *   - Decide exit codes (Step 25/26).
 */

import { readFile, stat } from "node:fs/promises";
import { glob } from "node:fs/promises";
import { isAbsolute, resolve, sep } from "node:path";
import type { CommittedArtifact } from "@nekostack/schema/cli";

export type { CommittedArtifact };

/**
 * Artifact-name suffixes matched by the locked v0.7 path convention.
 * Exported so downstream code (Step 31's `check.ts` dispatch) can
 * advertise the same list without re-deriving it. Listed in the same
 * order as `GENERATOR_KINDS` on the schema side: `typescript`, `zod`,
 * `jsonSchema`, `openApi`.
 */
export const ARTIFACT_SUFFIXES = [
  ".types.ts",
  ".zod.ts",
  ".json.schema.json",
  ".openapi.json",
] as const;

const ARTIFACT_GLOB = `**/*{${ARTIFACT_SUFFIXES.join(",")}}`;

export async function loadCommittedArtifacts(
  generatedDir: string,
): Promise<readonly CommittedArtifact[]> {
  const dirAbs = isAbsolute(generatedDir)
    ? generatedDir
    : resolve(generatedDir);

  // Missing-or-not-a-directory → no artifacts. The check verb's right
  // shape on a fresh workspace is "no verdicts, no error" — let the
  // schema-side handler decide whether that means clean or stale.
  if (!(await isDirectory(dirAbs))) return [];

  const relativeRaw: string[] = [];
  for await (const p of glob(ARTIFACT_GLOB, { cwd: dirAbs })) {
    relativeRaw.push(p);
  }

  // Deterministic ordering — alphabetical on forward-slash-normalized
  // relative paths. Same convention as `walk-workspace.ts`.
  const relative = relativeRaw
    .map((p) => p.split(sep).join("/"))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const out: CommittedArtifact[] = [];
  for (const rel of relative) {
    const abs = resolve(dirAbs, rel);
    const content = await readFile(abs, "utf8");
    out.push({ path: rel, content });
  }
  return out;
}

// =============================================================================
// Helpers
// =============================================================================

async function isDirectory(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}
