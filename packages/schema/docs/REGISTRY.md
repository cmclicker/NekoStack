# Registry Contract

> The v0.7 registry / freshness / generation surface lives inside `@nekostack/schema` as a set of pure primitives. The CLI (`@nekostack/cli`, sequencing Steps 21–34) owns every filesystem and process concern and calls into this surface for the logic. This file is the contract; the implementations live under [`../src/registry/`](../src/registry/) and the integration barrel is [`../src/cli-integration.ts`](../src/cli-integration.ts).

## Ownership boundary (Master plan Decision #1)

The schema package is **pure**:

> No `fs.*`. No dynamic `import()`. No `process.*`. No `console.*`. Takes data in, returns data out.

The CLI is the **filesystem shell**:

| Responsibility | Owner |
|---|---|
| Discover `*.schema.{ts,js}` files | CLI |
| Read source bytes | CLI |
| Dynamic-import schema modules via `tsx` | CLI |
| Read committed artifacts from disk | CLI |
| Write regenerated artifacts to disk | CLI |
| stdout / stderr formatting | CLI |
| Exit codes | CLI |
| Build the in-memory `Registry` | schema |
| Classify diff severity | schema |
| Compute freshness verdicts | schema |
| Plan generation (emit-ready payloads) | schema |

The CLI calls `buildRegistry` once after discovery and passes the resulting `Registry` to every handler. The handlers never re-read files; the data they need is already in their `*Opts` argument. This separation is gated by [`../tests/registry/handler-purity.test.ts`](../tests/registry/handler-purity.test.ts).

## Subpath visibility (Master plan Decision #10)

The registry surface is reachable through one — and only one — path:

```text
@nekostack/schema          public v0.6 consumer API (s, parse, safeParse, …)
@nekostack/schema/cli      package-internal CLI integration API (this file)
```

Root `@nekostack/schema` does NOT export any registry / handler / freshness / generation name. The Step 16 negative gate in [`../tests/public-surface.test.ts`](../tests/public-surface.test.ts) enforces this — adding a v0.7 name to the root barrel causes that suite to fail. The positive gate in [`../tests/registry-surface.test.ts`](../tests/registry-surface.test.ts) verifies the `/cli` subpath does expose the surface. Together the two suites lock the boundary.

If a future phase ships `@nekostack/registry` as its own package, the `/cli` barrel moves there with zero impact on root consumers.

## Input shape — `RegistrySourceEntry`

One discovered schema source file after the CLI has read its bytes and dynamic-imported it:

```ts
interface RegistrySourceEntry {
  readonly sourcePath: string;          // CLI-relative source location
  readonly sourceText: string;          // exact UTF-8 bytes the CLI read
  readonly schemas: readonly AnySchema[]; // every Schema instance exported
}
```

A file may legitimately declare more than one schema. The registry indexes each named one independently. See [`../src/registry/types.ts`](../src/registry/types.ts).

## Indexed shape — `RegistryEntry`

One indexed schema. The registry stores these by `(schemaId, schemaVersion)`:

```ts
interface RegistryEntry {
  readonly schemaId: string;
  readonly schemaVersion: string | undefined;
  readonly irHash: `sha256:${string}`;
  readonly sourceHash: `sha256:${string}`;
  readonly sourcePath: string;
  readonly schema: AnySchema;
}
```

`schemaVersion` is `undefined` when the source schema omitted `.version(...)`. The internal map key for the unversioned case is the empty string `""` so the `Registry` lookup type stays uniform; the `schemaVersion` field on the entry remains `undefined`.

## Registry map shape

```ts
type Registry = ReadonlyMap<
  string,                                  // outer key: schemaId
  ReadonlyMap<string, RegistryEntry>       // inner key: schemaVersion or ""
>;
```

`buildRegistry` is the only legitimate producer of `Registry` values. Downstream callers treat them as opaque and use `findSchema` for lookup or `listHandler` for enumeration.

## Hash discipline (Master plan Decision #7 / #8)

Two distinct hashes — they capture different things and are both required for the freshness matrix.

### `sourceHash`

`sha256` of the source file's **raw UTF-8 bytes** ([`../src/registry/source-hash.ts`](../src/registry/source-hash.ts)):

```ts
sourceHashFromText(text): `sha256:${hex}`
```

Captures source identity exactly — comments, whitespace, declaration order all contribute. Same source file → same `sourceHash`, even if the resulting IR is unchanged. `buildRegistry` computes this once per `RegistrySourceEntry`; every `RegistryEntry` produced from the same source file shares the same `sourceHash` value.

### `irHash`

`sha256` of the canonical IR serialization ([`../src/ir/hash.ts`](../src/ir/hash.ts)):

```ts
irHash(schema.node): hex   // wrapped as `sha256:${hex}` on RegistryEntry
```

Captures semantic identity. Refactoring the source — renaming a helper, reordering exports, changing comments — does not change `irHash`. The v0.2+ generator-header contract documents this hash in every artifact (see [`./HEADER_FORMAT.md`](./HEADER_FORMAT.md)); v0.7 extends the header to also include `sourceHash`.

### Why both

A diff between *the registry's recorded hashes* and *the artifact's emitted hashes* tells the CLI exactly what kind of staleness it is looking at — semantic vs. cosmetic — without re-running generators. The two-hash freshness matrix below codifies that read.

## `buildRegistry` — duplicates, anonymous, unversioned

```ts
buildRegistry(entries): Result<Registry>
```

Pure. No `fs.*`, no `import()`, no `path.*`. Implementation: [`../src/registry/build-registry.ts`](../src/registry/build-registry.ts).

Rules:

- **Anonymous schemas** (no `.id()`) are silently ignored by the indexer. They remain legal per v0.1 — they just don't participate in registry lookup. The CLI emits a stderr warning per anonymous schema it sees (Master plan Decision #5); this layer is silent.
- **Unversioned schemas** (`.id()` but no `.version()`) are indexed under the empty-string inner key. The on-entry `schemaVersion` field stays `undefined`.
- **Duplicate `(schemaId, versionKey)` pairs** across the entry list are collected into one `Issue` per duplicate with code `"duplicate_schema_id"`. The function returns `Result.failure` with the issue list; it never throws. The first-seen entry is kept in the partial map so downstream code in the same call doesn't read a torn state.

The `duplicate_schema_id` Issue carries `metadata.sourcePaths`, `metadata.schemaId`, and `metadata.schemaVersion` so the CLI can render a precise message ("`X` v1.0.0 is declared in both `a.schema.ts` and `b.schema.ts`").

## `findSchema` — lookup rules

```ts
findSchema(registry, schemaId, version?): RegistryEntry | undefined
```

Implementation: [`../src/registry/build-registry.ts`](../src/registry/build-registry.ts).

| Inputs | Result |
|---|---|
| `findSchema(reg, "X", "1.0.0")` | The entry whose `schemaVersion === "1.0.0"`, or `undefined` if no such entry. |
| `findSchema(reg, "X", "")` | The unversioned entry for `X`, if one exists. The empty string is the intentional way to address an unversioned schema by exact lookup. |
| `findSchema(reg, "X")` (version omitted, both versioned and unversioned exist) | The **highest semver** entry. Versioned always wins over unversioned when at least one versioned entry exists. |
| `findSchema(reg, "X")` (version omitted, only unversioned exists) | The unversioned entry. |
| `findSchema(reg, "X", …)` with `X` not in the registry | `undefined`. |

Semver comparison is numeric on `major.minor.patch`. Non-conforming version strings fall back to `localeCompare` so the lookup never throws on a non-standard version.

## `listHandler` — enumeration

```ts
listHandler({ registry }): Result<{ entries: readonly RegistryEntry[] }>
```

Implementation: [`../src/registry/handlers/list.ts`](../src/registry/handlers/list.ts).

Deterministic order:

1. Across `schemaId`: alphabetical ascending.
2. Within one `schemaId`: versioned entries first, ascending by numeric `major.minor.patch` semver; the unversioned entry (if any) comes **last**.

Returns `success: true` with an empty array for an empty registry. `listHandler` has no failure mode — `success: false` is unreachable.

## `checkHandler` — two-hash freshness matrix

```ts
checkHandler({ registry, committedArtifacts }): Result<{ verdicts }>
```

Implementation: [`../src/registry/handlers/check.ts`](../src/registry/handlers/check.ts).

The CLI reads each artifact's bytes from disk and hands them in. The handler parses provenance ([`../src/registry/parse-provenance.ts`](../src/registry/parse-provenance.ts)), looks up the matching `RegistryEntry`, and emits one `FreshnessVerdict` per artifact.

### Verdict matrix

| Artifact `irHash` vs registry | Artifact `sourceHash` vs registry | Verdict | Meaning |
|---|---|---|---|
| matches | matches | `clean` | Artifact is current; nothing to do. |
| matches | differs | `cosmetic_drift` | Source text edited without semantic effect. CLI prints a stderr warning; CI still passes. |
| differs | differs | `stale` | Regenerate required. CLI exits 1. |
| differs | matches | `integrity_error` | The impossible row — should never happen unless the artifact was hand-edited or the recorded `sourceHash` was tampered with. CLI exits 4 and refuses to auto-regenerate. |

### v0.6 backward compatibility (Master plan Decision #8)

Artifacts emitted before Step 4 of v0.7 — `@nekostack/schema@0.6.0` and earlier — have no `sourceHash` field/line. `parseProvenanceFromText` returns `sourceHash: undefined` for those. The handler treats them as:

| Artifact `irHash` vs registry | Verdict (no `sourceHash` recorded) |
|---|---|
| matches | `clean` |
| differs | `stale` |

Absent `sourceHash` is **never** an `integrity_error` by itself — the artifact simply predates the two-hash discipline. Once the user regenerates at v0.7+, full matrix participation resumes.

### Failure paths

`checkHandler` returns `Result.failure` (and emits no verdicts for that call) on any of:

- **Malformed provenance** — `parseProvenanceFromText` returns an `integrity_error` Issue with `metadata.reason` (`unknown_format`, `missing_provenance`, `missing_field`, `malformed_hash`, `json_parse_error`, `malformed_field`). The handler forwards each issue with the artifact path attached.
- **Anonymous artifact** (provenance `schemaId === null`) — `schema_not_found` with `metadata.reason = "anonymous_artifact"`. Anonymous schemas are not indexed, so there is nothing to validate against.
- **`schemaId` not in registry** — `schema_not_found`. The user likely deleted a schema source file but forgot to delete its artifacts.
- **`schemaId` present but version missing** — `version_not_found`. Distinct from `schema_not_found` so the CLI can format orphan-by-id vs. orphan-by-version differently.

Per-artifact verdicts are returned only when **every** artifact parses and resolves cleanly. A single failure causes the whole call to fail — this matches the CLI's exit semantics (a `check` run either passes or surfaces the full issue list).

## `generateHandler` — artifact planning

```ts
generateHandler({ entries }): Result<{ artifacts: readonly GeneratedArtifact[] }>
```

Implementation: [`../src/registry/handlers/generate.ts`](../src/registry/handlers/generate.ts).

For every **named** schema in every `RegistrySourceEntry`, emits all four artifact kinds — `typescript`, `zod`, `jsonSchema`, `openApi` — as `GeneratedArtifact` payloads. The CLI is responsible for writing each payload to its `suggestedPath`; this handler never touches the filesystem.

```ts
interface GeneratedArtifact {
  readonly schemaId: string;
  readonly kind: GeneratorKind;
  readonly suggestedPath: string;
  readonly content: string;
  readonly irHash: `sha256:${string}`;
  readonly sourceHash: `sha256:${string}`;
}
```

- **Anonymous schemas** (no `.id()`) are silently skipped — they cannot participate in registry lookup downstream. The CLI warns; the handler is silent (Decision #5).
- **`sourceHash` is computed once per entry** via `sourceHashFromText(entry.sourceText)` and passed through to each generator's `ProvenanceOptions` so the emitted artifact bytes carry the source-side hash. `irHash` is computed per schema from `schema.node` and stamped on each `GeneratedArtifact`; it is **not** part of `ProvenanceOptions`.
- **Partial generation is not supported in v0.7** (Master plan Decision #6). `GenerateOpts` carries no `kinds` filter. Every named schema produces exactly four artifacts; the `check` verb expects all four to be present on disk.

## Generated-artifact path convention (Master plan Decision #6)

Locked single-schema layout — given `schemas/user.schema.ts`:

```text
schemas/user.schema.ts                            (source)
  ↓
schemas/generated/user.types.ts                   (typescript)
schemas/generated/user.zod.ts                     (zod)
schemas/generated/user.json.schema.json           (jsonSchema)
schemas/generated/user.openapi.json               (openApi)
```

The basename strips a `.schema.{ts,js,mts,cts}` suffix when present; falls back to "filename minus last extension" otherwise. Path manipulation is plain strings — no `node:path` import — so the handler stays trivially platform-agnostic. Forward slashes are the canonical separator; the CLI normalizes to platform separators on write.

`suggestedPathFor(sourcePath, kind, options?)` is exported from `@nekostack/schema/cli` so the CLI can advertise the same convention for `check`'s artifact-lookup without re-deriving the rule.

### Multi-schema source-file disambiguation

When a single source file declares **two or more** named schemas, each schema's four artifacts gain a slugged discriminator so paths don't collide:

```ts
// schemas/account.schema.ts
export const Tenant = s.object(...).id("com.x.Tenant");
export const Audit  = s.object(...).id("com.x.AuditEvent");
```

```text
schemas/generated/account.com-x-tenant.types.ts
schemas/generated/account.com-x-tenant.zod.ts
schemas/generated/account.com-x-tenant.json.schema.json
schemas/generated/account.com-x-tenant.openapi.json
schemas/generated/account.com-x-auditevent.types.ts
... (and so on)
```

Discriminator slug rule:

```text
lowercase → non-alphanumeric runs collapse to "-" → leading/trailing "-" trimmed
```

If the same `schemaId` appears at multiple versions inside one file (rare; v0.7 doesn't endorse but does tolerate), the discriminator additionally embeds the slugged version (`com-x-tenant-1-0-0`, `com-x-tenant-2-0-0`) so per-schema paths stay unique. Single-schema files never get a discriminator — the path is exactly the simple form above.

## Pure-handler gate

[`../tests/registry/handler-purity.test.ts`](../tests/registry/handler-purity.test.ts) gates the schema-side boundary. Each of the four handlers (`list`, `diff`, `check`, `generate`) plus their transitive reach is asserted to:

- Not import `node:fs` / `fs` / `fs/promises` (static file-level scan over each handler's module-graph reach).
- Not call `console.log` / `console.error` / `console.warn` / `console.info` / `console.debug` at module load or invocation time (runtime spy + static pattern).
- Not call `process.exit` / `process.abort` (runtime spy + static pattern).
- Not invoke dynamic `import()` (static pattern).

Sentinel tests verify the gate catches what it claims. Any future handler change that crosses the boundary fails this suite before it reaches review.

## Integration surface — `@nekostack/schema/cli`

The barrel ([`../src/cli-integration.ts`](../src/cli-integration.ts)) re-exports exactly the names the CLI needs:

**Runtime exports**

```text
sourceHashFromText        parseProvenanceFromText
buildRegistry             findSchema
diffNodes
listHandler  diffHandler  checkHandler  generateHandler
suggestedPathFor          GENERATOR_KINDS
```

**Type exports**

```text
RegistrySourceEntry  RegistryEntry  Registry
DiffSeverity  DiffKind  DiffChange
FreshnessVerdict
GeneratorKind  GeneratedArtifact  CommittedArtifact
GenerateOpts  GenerateResult
CheckOpts     CheckResult
DiffOpts      DiffResult
ListOpts      ListResult
```

The `package.json` `exports` map ([`../package.json`](../package.json)) wires:

```jsonc
{
  ".":     "./src/index.ts",          // v0.6 public surface
  "./cli": "./src/cli-integration.ts" // v0.7 CLI integration surface
}
```

The `/cli` subpath is **package-internal**. External consumers of `@nekostack/schema` should not import from it; names exposed there are subject to internal change between minor versions and engine-swap-safety lives at the root, not at this subpath.

## Implementation reference

| Surface | File |
|---|---|
| Types | [`../src/registry/types.ts`](../src/registry/types.ts) |
| `sourceHashFromText` | [`../src/registry/source-hash.ts`](../src/registry/source-hash.ts) |
| `parseProvenanceFromText` | [`../src/registry/parse-provenance.ts`](../src/registry/parse-provenance.ts) |
| `buildRegistry`, `findSchema` | [`../src/registry/build-registry.ts`](../src/registry/build-registry.ts) |
| `diffNodes` | [`../src/registry/diff.ts`](../src/registry/diff.ts) |
| `listHandler` | [`../src/registry/handlers/list.ts`](../src/registry/handlers/list.ts) |
| `diffHandler` | [`../src/registry/handlers/diff.ts`](../src/registry/handlers/diff.ts) |
| `checkHandler` | [`../src/registry/handlers/check.ts`](../src/registry/handlers/check.ts) |
| `generateHandler`, `suggestedPathFor`, `GENERATOR_KINDS` | [`../src/registry/handlers/generate.ts`](../src/registry/handlers/generate.ts) |
| Integration barrel | [`../src/cli-integration.ts`](../src/cli-integration.ts) |
| Master plan source of truth | [`./PHASE_PLAN_v0.7.md`](./PHASE_PLAN_v0.7.md) |
| Diff classification contract | [`./DIFF_CLASSIFICATION.md`](./DIFF_CLASSIFICATION.md) |
| Generator-header format | [`./HEADER_FORMAT.md`](./HEADER_FORMAT.md) |
