# @nekostack/taxonomy

> Tags / categories / hierarchies / aliases. The "how do we classify this?" layer. Powers tag clouds, filters, search facets, content navigation.

## Quick reference

| | |
|---|---|
| **Build tier** | Content / narrative |
| **Depends on** | `schema`, `codex` (entities can be tagged), `graph` (hierarchy as DAG), `search` (faceted filters consume), `audit` |
| **Used by** | `search` (faceted filters), `cms` (content tagging), `wiki` (category navigation), NekoLife (activities tagged by domain), NekoBattler (champion tags), any content-classified project |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 4â€“8 weeks focused |

## Why this exists

Every content product has tagging. Most reinvent: free-form strings vs registered taxonomy, hierarchy vs flat, aliases for synonyms, multi-tagging vs primary-tag, tag normalization. `taxonomy` provides the primitives.

## Scope

### In scope
- Taxonomy DSL (registered tag catalog + hierarchy).
- Tag normalization (lowercase / dash / trim).
- Tag hierarchy (parent-child).
- Tag aliases (synonyms map to canonical).
- Multi-tagging on entities.
- Tag-based filters.
- Tag merge / split / rename.
- Tag analytics (which tags are used).

### Out of scope
- Search (`search`).
- Entities (`codex`).
- Storage (`storage`).

## Boundary

### Owns
- Taxonomy DSL
- Tag normalization
- Tag hierarchy
- Tag aliases
- Multi-tagging
- Tag filters
- Tag merge / split / rename
- Tag analytics

### Does NOT own
| Capability | Lives in |
|---|---|
| Search | `search` (consumes facets) |
| Entities | `codex` |
| Generic graph | `graph` (we use) |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **Custom tag tables** | Universal. | What this replaces. |
| **Postgres array columns** | Cheap. | No hierarchy, aliases. |

## How this fits the NekoStack

- **`codex`** entities are tagged.
- **`search`** uses tags as facets.
- **`cms`** tags content.
- **`graph`** for hierarchy.

## Design philosophy

- **Registered > free-form.** Catalog known; typos caught.
- **Hierarchy first-class.** Parent-child tags.
- **Aliases > duplicates.** Synonyms map to canonical.

## Architecture sketch

```
packages/taxonomy/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ catalog/
â”‚   â”‚   â”œâ”€â”€ register.ts
â”‚   â”‚   â””â”€â”€ normalize.ts
â”‚   â”œâ”€â”€ hierarchy/
â”‚   â”‚   â””â”€â”€ tree.ts             # via graph
â”‚   â”œâ”€â”€ aliases/
â”‚   â”‚   â””â”€â”€ synonym.ts
â”‚   â”œâ”€â”€ multi-tag/
â”‚   â”‚   â””â”€â”€ apply.ts
â”‚   â”œâ”€â”€ filter/
â”‚   â”‚   â””â”€â”€ by-tag.ts
â”‚   â”œâ”€â”€ operations/
â”‚   â”‚   â”œâ”€â”€ merge.ts
â”‚   â”‚   â”œâ”€â”€ split.ts
â”‚   â”‚   â””â”€â”€ rename.ts
â”‚   â””â”€â”€ analytics/
â”‚       â””â”€â”€ usage.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Catalog + normalization
### v0.2 â€” Hierarchy
### v0.3 â€” Aliases
### v0.4 â€” Multi-tagging
### v0.5 â€” Filters
### v0.6 â€” Merge / split / rename
### v1.0 â€” Stable API

## Product potential

**Internal:** Used by content-heavy projects.
**Open source release:** Modest.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Content / narrative.
- **Estimated learning return:** Moderate. Taxonomy design, normalization, hierarchy patterns.
