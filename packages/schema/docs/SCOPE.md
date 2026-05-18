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
| Schema *migration execution* | future package or v0.8+ here |
| Global CLI runtime / plugin discovery | `@nekostack/cli` |
| Runtime validation *engine* (the bytecode-level matcher) | external (Zod is the v0.6 internal engine; consumers don't see it) |
| Transforms / unions / runtime refinements in v0.6 | deferred (v0.6 supports the v0.2 subset; date/union/recursiveRef/transform/runtime-refinement IR throws `UnsupportedNodeKindError` at compile time) |
| Schema registry / freshness checks (`neko schema check`) | v0.7 (`@nekostack/cli` orchestrates; consumes `irHash` from v0.2) |
| `neko schema *` CLI commands | v0.7 (`@nekostack/cli`) |

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
