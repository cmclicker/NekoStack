# `manifests/`

> Cross-cutting machine-readable indexes. Generated or hand-maintained files that tools and agents consume to navigate the stack.

## What lives here

JSON / YAML / structured-Markdown files designed to be **read by machines** (tools, agents) more than by humans. Each manifest is a structured view across the stack — not implementation, not doctrine, but an index.

Examples:

- `manifests/packages.json` — Index of all 107 packages with name, tier, status, key dependencies. Generated from per-package `package.json` + README front matter.
- `manifests/capabilities.json` — Index of all capabilities → owning packages, derived from `BOUNDARIES.md`.
- `manifests/dependency-graph.json` — Machine-readable form of `DEPENDENCY-GRAPH.md` (DAG edges, build order).
- `manifests/standards.json` — Index of standards (name, enforced-by, status).
- `manifests/decisions.json` — Index of ADRs (number, status, tags, supersession chain).
- `manifests/<package>.mind.md` — Per-package "memory map" for an agent: what to load when working on this package.

The format is whatever the consumer needs — JSON, YAML, or structured markdown. The constraint is that the file is machine-friendly first, human-friendly second.

## What does NOT live here

| Type | Where it goes | Why |
|---|---|---|
| Human-authored Markdown doctrine | `references/` | Read by humans, not machines |
| Implementation that generates manifests | `@nekostack/registry` package | Code, not content |
| Schema validation manifests | `@nekostack/schema` package surface | Code |
| OpenAPI / API contract files | each package's `contracts/` | Package-local |

The distinguishing test: **is this designed to be consumed by tools or agents at scale?** If yes → manifests. If primarily for humans → references / standards / decisions.

## Naming + sharding

Most manifests are flat. Shard by **consumer** if a category grows:

- `manifests/agent/` — manifests specifically for LLM agents (memory maps, capability summaries)
- `manifests/build/` — manifests for build / CI tools

File names: kebab-case, descriptive. Use `.json` or `.yaml` for structured data; use `.md` only when the manifest is human-readable but structured (like `<package>.mind.md`).

## How to add a manifest

1. Identify the consumer. Who reads this? A tool? An agent? A CI script? A human?
2. If consumer is "humans-only" → reconsider; probably belongs in `references/`.
3. If consumer is machine-side → pick a structured format (JSON / YAML / structured-Markdown).
4. Decide: hand-maintained vs generated.
   - Hand-maintained — write it directly. Note "manually maintained — update when X changes."
   - Generated — write a script (in `scripts/` or a package) that produces it. Note "generated from X by Y at <timestamp>."
5. Document the schema. Either inline at the top, or by reference to `@nekostack/schema`.

## Generated vs hand-maintained

For small or stable manifests (< 100 entries, rarely changes), hand-maintained is fine.

For large or churning manifests (the 107-package index), generation is essential. Establish:

- A source of truth (e.g., per-package READMEs + BOUNDARIES.md).
- A script that derives the manifest.
- A CI check that fails if the manifest drifts from sources.

`@nekostack/registry` (when implemented) will own the generation logic.

## See also

- [`ARTIFACTS.md`](../ARTIFACTS.md) — taxonomy.
- [`@nekostack/registry`](../packages/registry/README.md) — the engine that derives manifests from canonical sources.
- [`BOUNDARIES.md`](../BOUNDARIES.md) — capability ownership; source for `capabilities.json`.
- [`DEPENDENCY-GRAPH.md`](../DEPENDENCY-GRAPH.md) — human-readable form of `dependency-graph.json`.
