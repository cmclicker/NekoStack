# @nekostack/docs

> Documentation site generator from schemas, API contracts, and code annotations. The "auto-generate the docs site" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Documentation / scaffolding |
| **Depends on** | `schema`, `api` (OpenAPI), `md`, `codex` (cross-link), `registry` (capability map), `prompts` (prompt docs) |
| **Used by** | every package's doc site; the NekoStack ecosystem doc site itself |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 8–12 weeks focused |
| **Sellable?** | Modest — Astro Starlight / Docusaurus dominate |

## Why this exists

Documentation drifts from code unless generated from it. `docs` ingests schemas / API contracts / READMEs / annotations and produces a docs site.

## Scope

### In scope
- Doc site generator (Astro Starlight as substrate, or custom).
- Schema → reference docs.
- OpenAPI → API reference.
- README aggregation across packages.
- Cross-link generation (Codex / BOUNDARIES.md refs).
- Search index integration.
- Versioned docs.

### Out of scope
- Markdown rendering (`md`).
- Wiki (`wiki`).
- CMS (`cms`).

## Boundary

### Owns
- Doc site generation
- Schema → reference
- OpenAPI → API reference
- README aggregation
- Cross-link generation
- Versioned docs

### Does NOT own
| Capability | Lives in |
|---|---|
| Markdown rendering | `md` |
| Wiki / page editing | `wiki` |
| Content lifecycle | `cms` |
| Search | `search` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **Astro Starlight** | Modern docs. | Substrate. |
| **Docusaurus** | Mature. | React-coupled. |
| **VitePress** | Modern Vue. | Vue-coupled. |
| **TypeDoc** | TS API docs. | Just types. |

## How this fits the NekoStack

- **`schema`** for reference docs.
- **`api`** for API reference.
- **`md`** for prose.
- **`codex`** for cross-links.
- **`registry`** for capability map.

## Design philosophy

- **Generated from source of truth.** Drift impossible.
- **Versioned.** Old docs available; cross-version diffs.
- **Cross-linked.** Type → schema → API → codex → wiki.

## Architecture sketch

```
packages/docs/
├── src/
│   ├── generate/
│   │   ├── from-schema.ts
│   │   ├── from-openapi.ts
│   │   └── from-readme.ts
│   ├── aggregate/
│   │   └── packages.ts
│   ├── cross-link/
│   │   ├── codex.ts
│   │   └── boundaries.ts
│   ├── versioning/
│   │   └── per-version.ts
│   ├── site/
│   │   └── starlight.ts
│   └── cli.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — README aggregation + Starlight site
### v0.2 — Schema → reference
### v0.3 — OpenAPI → API reference
### v0.4 — Cross-link generation
### v0.5 — Versioning
### v1.0 — Stable API

## Product potential

**Internal:** NekoStack docs + every product's docs.
**Open source release:** Modest.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Documentation / scaffolding.
- **Estimated learning return:** Moderate. Doc generation, cross-link automation, version management.
