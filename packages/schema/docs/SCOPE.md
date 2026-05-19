# @nekostack/schema — Scope

Authoritative for what this package owns. If a capability is not listed under "Owned," it is somebody else's responsibility — see [`../../../BOUNDARIES.md`](../../../BOUNDARIES.md) for the full capability map.

## Owned

- Canonical IR (`SchemaNode` AST) — the contract every generator must consume
- Schema authoring DSL (`s.string()`, `s.object()`, …)
- Schema metadata: id, version, description, deprecated
- Schema modifiers: optional, nullable, nullish, default
- Object unknown-key policy: strict (default), stripUnknown, passthrough
- Type inference (`s.infer`, `s.input`, `s.output`)
- **Runtime validation API (v0.6+):** `parse` / `safeParse` / `validate`
- **Runtime unknown-key enforcement (v0.6+):** strict / passthrough / stripUnknown execute at runtime, not just at generation time
- **Issue model + normalized `IssueCode` vocabulary** — consumer-facing error contract (Zod errors are normalized through this layer; downstream code sees `Issue`, never `ZodError`)
- **`ParseError`** (thrown only by `parse`; `safeParse` / `validate` return `Result`)
- **Result type** consumed by `safeParse` / `validate`
- Canonical IR serialization (sorted keys, undefined-stripped) — foundation for `irHash`
- **`sourceHash` provenance (v0.7+):** `sourceHashFromText(text)` and the `ProvenanceOptions.sourceHash` slice on every generator. The slice is **optional** — generators omit the `sourceHash` line/extension when the option is absent, so all pre-v0.7 callers continue to produce byte-identical output.
- **Registry-lite primitives (v0.7+, integration-subpath only — see boundary note below):** `buildRegistry`, `findSchema`, `parseProvenanceFromText`, `diffNodes`, the four pure handlers (`listHandler`, `diffHandler`, `checkHandler`, `generateHandler`), `suggestedPathFor`, `GENERATOR_KINDS`, and the supporting type surface. Reachable through `@nekostack/schema/cli` only; root `@nekostack/schema` does not export any of these. Documented in [`REGISTRY.md`](./REGISTRY.md).
- **Diff classification (v0.7+):** the locked breaking / additive / cosmetic table + `worstSeverity` aggregation. Pure data-in / data-out; never touches the filesystem. Documented in [`DIFF_CLASSIFICATION.md`](./DIFF_CLASSIFICATION.md).
- **Freshness verdict logic (v0.7+):** the two-hash matrix (`clean` / `cosmetic_drift` / `stale` / `integrity_error`) — pure classification given a registry and pre-read artifact bytes. The CLI owns the filesystem reads; this package owns the verdict.

## Not owned

| Capability | Lives in |
|---|---|
| API routing / request-response boundary validation | `@nekostack/api` |
| Form rendering + state management | `@nekostack/form` |
| Database schema definition + DDL | `@nekostack/migrate` |
| OpenAPI route descriptions | `@nekostack/api` |
| Runtime telemetry / event payloads | `@nekostack/telemetry`, `@nekostack/events` |
| Auth policy / access decisions | `@nekostack/auth` |
| Cross-record / continuity validation | `@nekostack/validator` |
| App-level validation flows | application code |
| Branded ID primitives (UUID/ULID brands) | `@nekostack/id` |
| Schema *migration execution* | v0.8+ (deferred; v0.7 does not propose or apply migrations) |
| Global CLI runtime / plugin discovery | `@nekostack/cli` |
| Filesystem reads / writes (source discovery, artifact reads, regenerated-artifact writes) | `@nekostack/cli` (Master plan Decision #1 — schema is pure) |
| Dynamic schema loading via `tsx` | `@nekostack/cli` |
| stdout / stderr formatting + CLI exit codes | `@nekostack/cli` |
| `neko schema *` CLI commands (`list` / `diff` / `check` / `generate`) | `@nekostack/cli` (v0.7 — consumes the registry primitives exposed under `@nekostack/schema/cli`) |
| Runtime validation *engine* (the bytecode-level matcher) | external (Zod is the v0.6 internal engine; consumers don't see it) |
| Transforms / unions / runtime refinements in v0.6 / v0.7 | deferred (v0.6 / v0.7 support the v0.2 subset; date/union/recursiveRef/transform/runtime-refinement IR throws `UnsupportedNodeKindError` at compile time and at diff time) |

## v0.6-specific scope

v0.6 ships (in addition to everything v0.1–v0.5 already shipped):
- `parse(schema, input): s.output<S>` — throws `ParseError` on failure
- `safeParse(schema, input): Result<s.output<S>>` — non-throwing Result variant
- `validate(schema, input): Result<s.input<S>>` — structural check; no default fill, no transforms; portable refinements still run
- `ParseError extends Error` (frozen defensive issue copy; `code = "parse_failed"`)
- Issue normalization layer translating Zod issues into the v0.1 `IssueCode` vocabulary (Decision #12)
- Compile cache keyed by `SchemaNode` identity
- Validate-only IR variant transform (defaults stripped, default-bearing fields flipped to optional)
- Four-oracle semantic-parity test matrix (Decision #19)
- OpenAPI spec-validity carry-forward (Decision #19a) tied to runtime fixture shapes

v0.6 explicitly **does not** ship:
- Date / union / recursiveRef / transform IR support (still throws `UnsupportedNodeKindError` at compile time)
- Runtime refinements (custom predicates) — IR shape declared, but builders and runtime execution remain deferred; the runtime fails loudly when one appears in IR
- Method-style API (`schema.parse(input)`) — free functions only in v0.6
- `ValidateError` companion to `ParseError` — `validate` returns `Result` only
- Schema registry / freshness / diffing — v0.7
- Schema-version negotiation — v0.7
- Locale / i18n of error messages
- CLI commands — v0.7 (`@nekostack/cli` consumes the runtime)

If something on the "does not ship" list appears in code, the scope was crossed and the PR should be rejected.

## v0.7-specific scope (in progress — see [`ROADMAP.md`](./ROADMAP.md))

v0.7 ships (schema-side) — *additive* over v0.6, no public-surface breakage at root `@nekostack/schema`:

- `sourceHash` provenance slice on every generator (optional; opt-in via `ProvenanceOptions.sourceHash`).
- `parseProvenanceFromText` — read the JSDoc-header or `x-nekostack` provenance off a committed artifact.
- Registry primitives — `buildRegistry`, `findSchema` — pure, `Result<Registry>` failure path, never throws.
- Diff classifier — `diffNodes` + the `worstSeverity` aggregation in `diffHandler`. Locked Decision #12 table; see [`DIFF_CLASSIFICATION.md`](./DIFF_CLASSIFICATION.md).
- Four pure handlers — `list`, `diff`, `check`, `generate`. Data-in / data-out, gated by [`../tests/registry/handler-purity.test.ts`](../tests/registry/handler-purity.test.ts).
- Integration subpath — `@nekostack/schema/cli` exposes the v0.7 surface for `@nekostack/cli` only. Root `@nekostack/schema` retains the v0.6 contract unchanged. See [`REGISTRY.md`](./REGISTRY.md).

v0.7 explicitly **does not** ship (this package):

- Filesystem I/O of any kind — owned by `@nekostack/cli` (Master plan Decision #1).
- Schema-file discovery, dynamic `import()` of schemas via `tsx` — `@nekostack/cli`.
- stdout / stderr formatting, exit-code mapping — `@nekostack/cli`.
- `neko schema *` commands themselves — `@nekostack/cli` (companion plan steps 21–34).
- Partial generation (subset of artifact kinds) — Master plan Decision #6 locks all-or-nothing per schema.
- Migration proposal / generation / application — deferred to v0.8+.
