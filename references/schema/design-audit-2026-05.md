# `@nekostack/schema` — Design Audit (2026-05)

> Source: external engineering audit (ChatGPT, 2026-05-16).
>
> **Status:** Incorporated into `packages/schema/README.md`. This file preserves the source thinking that drove the revision so future maintainers can see *why* the README has its current shape.

## Audit verdict
The concept is **correct**, but the original brief was still **too clean and optimistic** for a production-grade schema package.

The strongest part is the positioning: `@nekostack/schema` is correctly treated as a **foundation primitive** with no dependencies and broad downstream consumption by `api`, `form`, `cli`, `codex`, `auth`, `config`, `events`, `telemetry`, and other packages. That dependency direction is right. The package should be built early because every other serious NekoStack module will inherit its contracts.

The weak part is that the document described **what it should generate**, but not enough about the **canonical internal representation, semantic loss, compatibility boundaries, artifact lifecycle, and conformance testing**. Those are where schema systems usually rot.

---

# 1. Biggest missing piece: canonical IR

The original brief said: define the shape once in a TS-native DSL, then generate Zod, JSON Schema, OpenAPI, and TypeScript.

That is not enough. You need an explicit **internal schema AST / IR**:

```ts
type SchemaNode =
  | StringNode
  | NumberNode
  | BooleanNode
  | DateNode
  | ObjectNode
  | ArrayNode
  | UnionNode
  | LiteralNode
  | EnumNode
  | RecursiveNode
  | RefinementNode
  | TransformNode;
```

Without a normalized IR, the DSL becomes the source of truth in name only, and every generator starts interpreting builder objects differently.

The hard rule:

> **DSL builders create IR. Generators consume IR. Runtime validators execute IR-backed generated validators.**

# 2. Refinements are under-specified

The original brief included `refinement`, but this is dangerous.

A refinement like:

```ts
s.string().refine(value => value.startsWith("NEKO_"))
```

can be emitted to Zod. It **cannot be faithfully represented** in JSON Schema or OpenAPI unless it maps to a known constraint like `pattern`.

Refinements need two classes:

**Portable constraints** — can be emitted everywhere:
```ts
s.string().min(3)
s.string().max(50)
s.string().regex(/^NEKO_/)
s.number().int().min(0)
```

**Runtime-only refinements** — can only be represented in Zod/runtime validation:
```ts
s.string().refine(customFunction)
```

Generators should emit warnings or metadata when semantic loss occurs.

# 3. Date handling is a trap

The original example used `createdAt: s.date()`. That is a bad default unless you define exactly what `date` means.

| DSL Type | Runtime Input | Serialized Output | JSON Schema |
|---|---|---|---|
| `s.date()` | `Date` object | ISO string? | impossible directly |
| `s.isoDateTime()` | string | string | `format: date-time` |
| `s.isoDate()` | string | string | `format: date` |
| `s.epochMs()` | number | number | integer |

For APIs, config files, JSON Schema, and OpenAPI, `Date` objects are usually the wrong canonical type.

# 4. Optional / nullable / default semantics need a contract table

Major source of drift. The mapping across TypeScript, Zod, JSON Schema, OpenAPI, runtime validation, generated forms, and API request/response validation must be pinned explicitly.

`optional()` and `nullable()` are different. `null` is a value; missing is the absence of a value. Conflating them is the most common source of API drift.

# 5. Migrations are too large for the first stable scope

The brief included schema versioning and migration functions in v0.5. That is valuable, but it is probably too early.

Schema migration is not just `migrate(v1, v2, fn)`. You also need: version identifiers, migration graph rules, forward-only vs bidirectional migration, idempotency, validation before/after migration, migration provenance, failed-migration behavior, downgrade policy, fixture tests per version, compatibility with persisted entities, API versioning interaction, event payload versioning interaction.

Push migrations to v0.8.

# 6. Composition needs conflict rules

`merge` semantics need explicit conflict behavior.

```ts
const A = s.object({ id: s.string() });
const B = s.object({ id: s.number() });
A.merge(B);
```

Recommended rule: `merge()` must throw on field conflicts unless the caller uses `override()`.

Production systems should not allow silent schema replacement.

# 7. Recursive schemas require stable `$id` / `$ref` strategy

The brief mentioned recursive schemas but did not define reference identity.

Required decisions: How are schema IDs generated? Are IDs globally unique? Can two packages define `User`? Does package name participate in schema identity? Are schema versions part of IDs? How are circular references emitted? Do generated files preserve reference names deterministically?

Recommended identity format: reverse-DNS with version, e.g. `com.nekostack.auth.User` at `1.0.0`. Unnamed recursive schemas must be rejected.

# 8. Error model needs stronger detail

The brief said structured errors include `code, path, expected, received, message`. Good start. Not enough.

Need stable machine-readable codes, schemaId/schemaVersion on every issue, severity field, and metadata extensibility. Do not let generators inherit raw Zod error codes directly. Normalize them.

# 9. Unknown keys need explicit behavior

Object validation must define this:

```ts
s.object({ email: s.string() })
// given { "email": "x@example.com", "admin": true }
```

Does it: (1) strip `admin`, (2) reject `admin`, (3) pass through `admin`?

This matters for security. Recommended default: **reject**, especially for API/auth/config schemas. Allow `.loose()` and `.stripUnknown()` as opt-ins.

# 10. Generated artifact lifecycle is missing

`neko schema generate` produces `.gen/` files. Stronger rules needed:

- Committed or ignored?
- Deterministic?
- Include headers (source path, schema id, version, source hash, generator version)?
- Does CI fail if generated output is stale?
- Can packages consume generated artifacts directly?
- Incremental generation?
- ESM only or CommonJS too?
- `.d.ts` separate from runtime?

Recommended: header includes `@generated`, source path, schemaId, schemaVersion, sourceHash. `neko schema check` rehashes and fails CI on staleness.

# 11. Testing plan is too shallow

The original roadmap mentioned Vitest, round-trip tests, and JSON Schema test suite. Insufficient.

Required test categories: builder unit tests, type inference tests, generator snapshot tests, runtime validation tests, JSON Schema conformance tests, OpenAPI fixture tests, Zod output execution tests, **semantic parity tests** (most important — validate same fixture against Neko runtime, generated Zod, generated JSON Schema validator, generated OpenAPI-compatible schema — failures should match), error normalization tests, recursive schema tests. Later: versioning/migration tests, fuzz/property tests.

# 12. The commercial claim is plausible but premature

The original document said commercial managed-schema-registry potential is plausible. Fair, but not useful yet.

A schema package becomes commercially interesting only when it has: registry, hosted version history, API diffing, breaking-change detection, SDK/codegen integration, schema governance, team permissions, CI integration, changelog generation, compliance export, migration tracking.

The current package is not the product. It is the primitive.

Better framing:

> `@nekostack/schema` is not the commercial product by itself. It is the technical substrate for a future registry/governance product.

# 13. Competitor comparison needs correction

The Zod comparison was slightly too dismissive.

Zod has no first-class JSON Schema/OpenAPI generation as a native feature, but the ecosystem has adapters and conversion tooling. The better critique:

> Zod can participate in multi-output workflows through adapters, but the Zod schema becomes the de facto source format, which means non-Zod semantics are second-class.

The core distinction:
- NekoStack is not "better Zod."
- NekoStack is a **schema IR and generator system** that can emit Zod as one target.

# 14. Package dependency risk

The brief said this package depends on nothing. Good architecturally, but in implementation it depends on:
- TypeScript
- Zod as peer/dev dependency for emitted validator tests
- possibly JSON Schema validator tooling for tests
- maybe no runtime deps in the core package

Required policy: classify dependencies as runtime, peer, or dev-only conformance. The package can *generate* Zod, but should not necessarily *require* Zod at runtime unless using runtime validation through generated Zod.

# 15. Recommended revised scope

- **v0.1** — Core IR + builders, primitives, object/array, named schemas, strict object behavior, metadata (id, version, description, deprecated), basic `Issue` shape, type inference tests.
- **v0.2** — TypeScript + Zod generation, generated header, deterministic formatting, snapshot tests, Zod execution tests.
- **v0.3** — JSON Schema generation (2020-12), `$id`/`$defs`/`$ref`, portable constraint mapping, semantic-loss metadata, conformance fixtures.
- **v0.4** — OpenAPI 3.1 generation, integration fixtures for `@nekostack/api`.
- **v0.5** — Composition: extend/pick/omit/partial/required, conflict-safe `merge`, explicit `override`.
- **v0.6** — Runtime validation, normalized `Issue[]`, unknown-key handling, Zod-backed execution, result type.
- **v0.7** — Registry-lite: local schema registry, schema lookup by ID/version, schema diffing, breaking-change detection.
- **v0.8+** — Migrations: registry, pre/post validation, provenance, fixture tests, failure behavior.

# Final judgment

`@nekostack/schema` is worth building, and it belongs near the front of the NekoStack sequence. But the original document was a **vision brief**, not an implementation-grade spec.

The most important corrections:

1. Add a canonical schema IR.
2. Define semantic loss rules across generators.
3. Split portable constraints from runtime-only refinements.
4. Make optional/null/default behavior explicit.
5. Define strict unknown-key behavior.
6. Add deterministic generated artifact rules.
7. Push migrations later.
8. Add schema identity/version/reference rules.
9. Strengthen test strategy around semantic parity.
10. Reframe commercial potential as future registry/governance infrastructure, not the package itself.

The high-level idea is solid. The implementation risk is not the DSL. The implementation risk is **semantic consistency across outputs**.
