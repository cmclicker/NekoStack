# @nekostack/docs

> Documentation site generator from schemas, API contracts, and code annotations. The "auto-generate the docs site" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Documentation / scaffolding |
| **Depends on** | `schema`, `api` (OpenAPI), `md`, `codex` (cross-link), `registry` (capability map), `prompts` (prompt docs) |
| **Used by** | every package's doc site; the NekoStack ecosystem doc site itself |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 8â€“12 weeks focused |

## Why this exists

Documentation drifts from code unless generated from it. `docs` ingests schemas / API contracts / READMEs / annotations and produces a docs site.

## Scope

### In scope
- Doc site generator (Astro Starlight as substrate, or custom).
- Schema â†’ reference docs.
- OpenAPI â†’ API reference.
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
- Schema â†’ reference
- OpenAPI â†’ API reference
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
- **Cross-linked.** Type â†’ schema â†’ API â†’ codex â†’ wiki.

## Architecture sketch

```
packages/docs/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ generate/
â”‚   â”‚   â”œâ”€â”€ from-schema.ts
â”‚   â”‚   â”œâ”€â”€ from-openapi.ts
â”‚   â”‚   â””â”€â”€ from-readme.ts
â”‚   â”œâ”€â”€ aggregate/
â”‚   â”‚   â””â”€â”€ packages.ts
â”‚   â”œâ”€â”€ cross-link/
â”‚   â”‚   â”œâ”€â”€ codex.ts
â”‚   â”‚   â””â”€â”€ boundaries.ts
â”‚   â”œâ”€â”€ versioning/
â”‚   â”‚   â””â”€â”€ per-version.ts
â”‚   â”œâ”€â”€ site/
â”‚   â”‚   â””â”€â”€ starlight.ts
â”‚   â””â”€â”€ cli.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” README aggregation + Starlight site
### v0.2 â€” Schema â†’ reference
### v0.3 â€” OpenAPI â†’ API reference
### v0.4 â€” Cross-link generation
### v0.5 â€” Versioning
### v1.0 â€” Stable API

## Product potential

**Internal:** NekoStack docs + every product's docs.
**Open source release:** Modest.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Documentation / scaffolding.
- **Estimated learning return:** Moderate. Doc generation, cross-link automation, version management.
