# OpenAPI 3.1 Mapping Contract

> How `generateOpenApiSchemaComponent` translates a `SchemaNode` into an **OpenAPI 3.1 Schema Object** that lives under `components.schemas.<Name>`. This file documents the **deltas from JSON Schema** — the rest of the mapping is shared with [`JSON_SCHEMA_MAPPING.md`](./JSON_SCHEMA_MAPPING.md) via the internal [`src/generators/schema-fragment.ts`](../src/generators/schema-fragment.ts) module.

## Why this doc is short

OpenAPI 3.1 explicitly aligns its Schema Object with **JSON Schema draft 2020-12** — the spec calls it a superset. Everything in `JSON_SCHEMA_MAPPING.md` (absence semantics, object policy, refinement mapping, throw contract, `x-nekostack-*` extensions) applies unchanged to OpenAPI 3.1 component schemas because the same shared fragment emitter produces them.

This doc only records what's **different**.

## Output unit

`generateOpenApiSchemaComponent(node)` returns a **single component schema** — the value that would live at `components.schemas.<Name>` in a full OpenAPI document. Composing it into paths / operations / responses / requestBodies / etc. is the consumer's job (or `@nekostack/api`'s when that package exists).

**Not in scope for v0.4:**
- Full OpenAPI documents
- Other component types (responses, parameters, requestBodies, examples, headers, securitySchemes, links, callbacks, pathItems)
- OpenAPI 3.0 target (3.0 uses `nullable: true`; 3.1 uses `type: ["x", "null"]` — v0.4 ships 3.1 only)

## Differences from JSON Schema output

| | JSON Schema (`generateJsonSchema`) | OpenAPI 3.1 component (`generateOpenApiSchemaComponent`) |
|---|---|---|
| `$schema` | `"https://json-schema.org/draft/2020-12/schema"` | **omitted** — OpenAPI 3.1 documents declare the dialect once at the document root via `jsonSchemaDialect`; components inherit it |
| `$id` | URN by default; URL via `options.idBase` | **omitted** — component identity is the position in the document (`#/components/schemas/<Name>`) |
| `x-nekostack.generator` | `"jsonSchema"` | `"openApi"` |
| `irHash` in provenance | sha256 of canonical IR | **identical** (same node → same hash, proven by test) |
| Output bytes | canonical JSON + trailing newline | canonical JSON + trailing newline (same convention) |

That's it. Everything else — `type`, `properties`, `required`, `additionalProperties`, `default`, `pattern`, `format`, `enum`, `const`, `description`, `deprecated`, the `x-nekostack-strip` extension, the `x-nekostack-default-applied-by` extension, all portable refinement keyword mappings — is shared via `emitSchemaFragment` and produces the same bytes.

## Why the shared fragment

Decision #3 of the v0.4 plan flipped the original "parallel implementation" direction to a shared `emitSchemaFragment`. Rationale: duplicating the v0.3 mapping in a separate `openapi.ts` would create a drift vector. Bug fixes would have to land twice; behavior could silently diverge across the two generators despite OpenAPI 3.1 explicitly being a superset of JSON Schema draft 2020-12.

The wrappers (`json-schema.ts`, `openapi.ts`) own only what genuinely differs: root document structure, `$schema` / `$id` decisions, and the `generator` field value in provenance. Anything related to IR translation lives in `schema-fragment.ts` and is exercised by both generators' test suites.

## Throw contract

Identical to JSON Schema (same `kind` values; the `generator` field flips to `"openApi"`):

| Case | `kind` | `generator` |
|---|---|---|
| IR kind `date` / `union` / `recursiveRef` / `transform` | the kind name | `"openApi"` |
| Runtime refinement | `"runtimeRefinement"` | `"openApi"` |
| `regex` with non-empty flags | `"regexFlags"` | `"openApi"` |

Tests assert on `code` / `kind` / `generator` per the v0.2 stable-error contract.

## Round-trip validation

[`../tests/generators/openapi-redocly.test.ts`](../tests/generators/openapi-redocly.test.ts) composes every emitted component schema into a synthetic OpenAPI 3.1 document and validates via `@redocly/openapi-core`. Catches spec/tooling issues that mere JSON validity wouldn't surface.

Per the v0.4 plan's fallback clause: if `@redocly/openapi-core`'s programmatic API turns out to be impractical, tests may switch to spawning the Redocly CLI instead. The validation requirement — compose into synthetic doc, assert clean — does not change.

The OpenAPI Specification is authoritative; Redocly is the actively-maintained validation tool we delegate to.

## When this doc gets longer

When v0.5+ adds OpenAPI-specific behaviors:
- `discriminator` keyword (needs union builders + a discriminator field selector).
- `example` / `externalDocs` / `xml` keywords (need IR-level support).
- OpenAPI 3.0 target as a generator option (if a real consumer needs it).
- Per-server / per-path schema variants.

Each gets a section here. Until then, the JSON_SCHEMA_MAPPING.md mapping table is the authoritative reference; this doc records only the table-of-deltas above.
