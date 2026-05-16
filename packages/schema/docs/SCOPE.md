# @nekostack/schema — Scope

Authoritative for what this package owns. If a capability is not listed under "Owned," it is somebody else's responsibility — see [`../../../BOUNDARIES.md`](../../../BOUNDARIES.md) for the full capability map.

## Owned

- Canonical IR (`SchemaNode` AST) — the contract every generator must consume
- Schema authoring DSL (`s.string()`, `s.object()`, …)
- Schema metadata: id, version, description, deprecated
- Schema modifiers: optional, nullable, nullish, default
- Object unknown-key policy: strict (default), stripUnknown, passthrough
- Type inference (`s.infer`, `s.input`, `s.output`)
- Issue model + normalized `IssueCode` vocabulary
- Result type for future parse/validate
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
| Runtime validation *library implementation* | external (Zod — we will *generate*, not reimplement) |

## v0.1-specific scope

v0.1 ships:
- IR types
- DSL builders for: string, number, boolean, literal, enum, array, object
- Modifiers + metadata
- Strict-by-default object policy stored *in IR* (no runtime enforcement yet)
- Canonical serialization
- Issue / Result types (no parser uses them yet)
- Tests covering everything above

v0.1 **does not** ship:
- Zod / TS / JSON Schema / OpenAPI generators
- A runtime parse / validate engine (no unknown-key rejection at runtime, no default application, no transform execution)
- Schema registry
- Schema diffing / breaking-change detection
- Migrations
- CLI handlers
- Hashing (only canonical serialization, which is its prerequisite)

If something on the "does not ship" list appears in code, the scope was crossed and the PR should be rejected.
