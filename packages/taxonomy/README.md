# @nekostack/taxonomy

> Tags / categories / hierarchies / aliases. The "how do we classify this?" layer. Powers tag clouds, filters, search facets, content navigation.

## Quick reference

| | |
|---|---|
| **Build tier** | Content / narrative |
| **Depends on** | `schema`, `codex` (entities can be tagged), `graph` (hierarchy as DAG), `search` (faceted filters consume), `audit` |
| **Used by** | `search` (faceted filters), `cms` (content tagging), `wiki` (category navigation), NekoLife (activities tagged by domain), NekoBattler (champion tags), any content-classified project |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 4–8 weeks focused |
| **Sellable?** | Modest — taxonomy primitive niche |

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
├── src/
│   ├── catalog/
│   │   ├── register.ts
│   │   └── normalize.ts
│   ├── hierarchy/
│   │   └── tree.ts             # via graph
│   ├── aliases/
│   │   └── synonym.ts
│   ├── multi-tag/
│   │   └── apply.ts
│   ├── filter/
│   │   └── by-tag.ts
│   ├── operations/
│   │   ├── merge.ts
│   │   ├── split.ts
│   │   └── rename.ts
│   └── analytics/
│       └── usage.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Catalog + normalization
### v0.2 — Hierarchy
### v0.3 — Aliases
### v0.4 — Multi-tagging
### v0.5 — Filters
### v0.6 — Merge / split / rename
### v1.0 — Stable API

## Product potential

**Internal:** Used by content-heavy projects.
**Open source release:** Modest.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Content / narrative.
- **Estimated learning return:** Moderate. Taxonomy design, normalization, hierarchy patterns.
