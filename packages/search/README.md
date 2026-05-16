# @nekostack/search

> Full-text + faceted + fuzzy search for content-heavy projects. Wiki, codex, puzzle archives, narrative continuity, agent knowledge bases — anything searchable, here.

## Quick reference

| | |
|---|---|
| **Build tier** | Project unblocker — content-heavy projects hit search needs past ~hundreds of items |
| **Depends on** | `schema` (index schemas), `codex` (first-class indexing of Codex entities), `taxonomy` (faceted filters by tag); SQLite (via `better-sqlite3` or `@libsql/client`) |
| **Used by** | NekoBattler wiki, Mara Kane lore lookups, NekoVibe puzzle archive, Leytide world discovery, NekoSystems knowledge base, NekoLife activity catalog |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 8–12 weeks focused |
| **Sellable?** | Strong OSS (embedded niche between MiniSearch and Meilisearch is empty); not a strong commercial direction (Algolia/Meilisearch dominate) |

## Why this exists

Every content-heavy NekoStack project ends up needing search:

- **NekoBattler** wiki — 565 champions, hundreds of abilities, dozens of traits. Players need to find "all fire-type champions with on-death triggers."
- **Mara Kane** lore — characters across 20 books, factions, locations, timelines. The author needs to find "every mention of Penny Lane after chapter 14."
- **NekoVibe** puzzle archive — past puzzles by date, by tier, by completion stats.
- **NekoCodex** entity browser — query entities by tag, kind, relationship.
- **NekoSystems** tenant content search — search across business documents, workflows, policies.
- **NekoLife** activity catalog — find activities by domain, cadence, priority, time-of-day.

The default answers — Postgres LIKE, ad-hoc JavaScript array filters, "I'll just remember where it is" — fall apart past a few hundred items. The next default — adopt Elasticsearch — is a hammer for a thumbtack. Elasticsearch is a wonderful tool and a wonderful operational burden.

`@nekostack/search` is the lightweight in-process search layer: typed index definitions, full-text with proper tokenization, faceted filtering, fuzzy matching, ranked results. It runs embedded — SQLite-FTS5 or MiniSearch-style — and scales fine into the millions of documents typical for personal projects.

Building this yourself rather than running Elasticsearch, Meilisearch, or Typesense is justified because:
1. **Scale match.** Those tools are sized for production e-commerce. Your scale is personal projects.
2. **Embedded ops.** No second service to deploy, monitor, and back up. Search lives in your process or as SQLite next to your DB.
3. **Schema integration.** Indexes are defined against `@nekostack/schema` schemas and `@nekostack/codex` entity kinds. No double-typing.
4. **Learning real IR.** Tokenization, stemming, BM25 scoring, inverted indexes, faceting — all genuine information retrieval theory.

## Scope

### In scope
- Index definition: which entity kinds, which fields, which tokenizers, which facets.
- Tokenizers: whitespace, n-gram, edge-n-gram, language-specific stemming.
- Inverted index storage: SQLite FTS5 backed, optional in-memory.
- BM25 scoring with field-weight tuning.
- Faceted filtering: pre-compute counts per facet value.
- Fuzzy matching: typo tolerance via Levenshtein distance.
- Query DSL: simple string queries (`"fire type"`), boolean (`fire AND not water`), field-scoped (`name:ember*`).
- Result ranking, snippet generation, highlighting.
- Index rebuilds: incremental + full.
- Codex integration: index Codex entities directly.

### Out of scope
- Distributed search clusters. Single-process or single-SQLite-file only.
- Semantic / vector search. That's `@nekostack/rag` — the embedding-based retrieval layer.
- Real-time index updates from a stream of changes — could come, but not in v1.
- Geospatial queries. Different domain.

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §29 for the full capability map.

### Owns
- Typed index definitions against `schema`
- Tokenizers (whitespace, n-gram, edge-n-gram, stem)
- Inverted index storage (SQLite FTS5 default; memory backend optional)
- BM25 scoring with field-weight tuning
- Faceted filtering with pre-computed counts
- Fuzzy matching (Levenshtein)
- Query DSL (string, boolean, field-scoped)
- Snippet + highlight extraction
- Codex entity adapter (auto-index `codex` entities)

### Does NOT own
| Capability | Lives in |
|---|---|
| Semantic / vector search | `rag` (different retrieval shape) |
| Embedding generation | `rag` |
| RAG context-pack assembly | `rag` |
| Generic graph traversal | `graph` |
| Codex entity definitions | `codex` |
| Tag / category hierarchies | `taxonomy` (we consume tag facets) |
| Distributed multi-node search clusters | out of scope |
| Geospatial queries | out of scope |
| Real-time index updates from change streams | out of scope (v1) |

## Competitors and adjacent tools

| Tool | What they do well | Where they fall short for us |
|---|---|---|
| **Elasticsearch / OpenSearch** | Industry standard, deeply featured. | Operational burden, JVM, sized for production-scale. |
| **Meilisearch** | Modern, friendly, embedded option. | Separate service. Good but heavier than needed for personal scale. |
| **Typesense** | Similar to Meilisearch, fast. | Same — separate service. |
| **Algolia** | Hosted, polished. | Vendor lock, per-query pricing. |
| **SQLite FTS5** | Embedded, fast, free. | Just the substrate. No facets, no fuzzy, no friendly schema layer. |
| **MiniSearch** | Pure-JS embedded library. | Limited features; no FTS5-speed scaling. |
| **Lunr.js** | Older pure-JS search. | Stale, less featured than MiniSearch. |
| **Postgres pg_trgm + tsvector** | Built into Postgres. | Postgres-coupled, limited tokenizer flexibility. |

The right framing: `@nekostack/search` is **a thin TS layer over SQLite FTS5** (the default backend), with optional in-memory backend for tiny indexes and a future-friendly path to a Meilisearch backend if needed. We do not compete with Elasticsearch; we cover the embedded niche it can't.

## How this fits the NekoStack

**Depends on:**
- `@nekostack/schema` — index schemas.
- `@nekostack/codex` — first-class indexing of Codex entities.
- SQLite (via `better-sqlite3` or `@libsql/client`).

**Used by:**
- **NekoBattler** — wiki search across champions, abilities, traits, items.
- **Mara Kane** — full-text search across drafts + narrative bible.
- **NekoVibe** — past-puzzle archive browsing.
- **Leytide** — in-game item/quest/NPC discovery.
- **NekoSystems** — tenant content + knowledge-base search.
- **NekoLife** — activity catalog filtering.

## Design philosophy

- **Typed indexes.** An index is defined against a schema; documents are validated before indexing.
- **Embedded by default.** No separate process. Index sits next to your data.
- **Facets and full-text are co-equal.** Most user queries combine "search for X" and "filter to Y" — both have to be fast.
- **Tokenization is configurable.** Different fields want different tokenizers (a name field wants edge-n-gram for autocomplete; a description wants stemmed full-text).
- **Snippets and highlights are first-class.** Search UI requires them; the index produces them.

## Architecture sketch

```
packages/search/
├── src/
│   ├── index/
│   │   ├── define.ts         # defineIndex({ schema, fields, facets, ... })
│   │   ├── insert.ts
│   │   ├── update.ts
│   │   └── rebuild.ts
│   ├── backends/
│   │   ├── sqlite-fts5.ts    # default backend
│   │   └── memory.ts         # for tiny indexes / tests
│   ├── tokenize/
│   │   ├── whitespace.ts
│   │   ├── ngram.ts
│   │   ├── edge-ngram.ts
│   │   └── stem.ts
│   ├── query/
│   │   ├── parse.ts          # query string → AST
│   │   ├── execute.ts
│   │   └── rank.ts           # BM25 + field weights
│   ├── facet/
│   │   └── compute.ts
│   ├── highlight/
│   │   ├── snippet.ts
│   │   └── span.ts
│   └── codex-adapter.ts      # auto-index from Codex
├── tests/
└── README.md
```

Defining an index and querying:

```ts
import { defineIndex, s } from '@nekostack/search';

const ChampionIndex = defineIndex('champions', {
  schema: s.object({
    id: s.string(),
    name: s.string(),
    description: s.string(),
    tribe: s.string(),
    cost: s.number(),
    elements: s.array(s.string()),
  }),
  fields: {
    name: { tokenizer: 'edge-ngram', weight: 5 },
    description: { tokenizer: 'stem-en', weight: 1 },
  },
  facets: ['tribe', 'cost', 'elements'],
});

await ChampionIndex.insert({ id: '...', name: 'Ember Cat', /* ... */ });

const results = await ChampionIndex.query('ember', {
  filter: { tribe: 'Feline', elements: 'fire' },
  highlight: ['name'],
  limit: 20,
});
```

## Roadmap

### v0.1 — SQLite FTS5 backend
- `defineIndex`, insert/update/delete.
- Basic FTS5-backed query.

### v0.2 — Tokenizers
- Whitespace, n-gram, edge-n-gram, stemmed.
- Per-field tokenizer config.

### v0.3 — Facets
- Facet definition + pre-computed counts.
- Filter API.

### v0.4 — Ranking
- BM25 with configurable field weights.

### v0.5 — Fuzzy + autocomplete
- Levenshtein fuzzy matching.
- Edge-n-gram autocomplete patterns.

### v0.6 — Highlights + snippets
- Snippet extraction with context window.
- Highlight span marking for UI.

### v0.7 — Codex adapter
- Auto-index from `@nekostack/codex` entities.

### v1.0 — Stable API
- Documentation site.
- Benchmarks (query latency at 10K / 100K / 1M documents).

## Product potential

**Internal use:** High. Multiple projects need search.

**Open source release:** Strong. The embedded-search niche is undersupplied between MiniSearch (too small) and Meilisearch (too heavy). MIT release could attract real users.

**Commercial product:** Modest. Search SaaS is dominated by Algolia and Meilisearch. Not a near-term commercial focus.

**Estimated effort to v1.0:** 8-12 weeks of focused work. SQLite FTS5 is the heavy lifting; we wrap it and add the facet + ranking layer.

## Status

- **Current:** Empty placeholder. Not started.
- **Owner:** Cody (solo dev project).
- **Priority tier:** Project unblocker. Wiki/codex search becomes mandatory once content grows past a few hundred items.
- **Estimated learning return:** High. Tokenization, inverted indexes, BM25, faceting — foundational information retrieval CS.
