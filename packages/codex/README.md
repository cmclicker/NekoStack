# @nekostack/codex

> A graph-based content registry with typed entities and typed relationships. The shared knowledge layer behind games, narrative work, business systems, and AI agents.

## Why this exists

Every content-heavy project ends up rediscovering the same problem: you have *things* (characters, items, abilities, factions, locations, lessons, business units, workflows) and *relationships between them* (depends_on, counters, belongs_to, foreshadows, teaches). The naive solution is to invent your own ad-hoc structures in each project — typically nested JSON or fields-on-rows in a relational schema. Then you discover, painfully, that:

1. You can't query relationships efficiently.
2. Cross-project lookups are impossible — NekoBattler's "Cinderclaw faction" and Mara Kane's "Cinderclaw faction" are unrelated strings.
3. Cross-references silently rot — a champion references an ability that was renamed in a different file three weeks ago.
4. There's no validation that a "depends_on" target actually exists.
5. Visualizing the entity network is impossible without writing a custom export every time.

`@nekostack/codex` is the canonical answer: a typed entity graph with named entity kinds, named relationship types, schema-validated entity data, and a query layer that can traverse the graph efficiently. Projects either define their entities natively against Codex (Codex-native) or export to Codex via a manifest adapter (Codex-indexed).

Building this yourself rather than using Neo4j or a knowledge graph database is justified because:
1. **Scale is wrong for those tools.** Neo4j is designed for billions of nodes. Your projects have thousands. The operational overhead is enormous.
2. **The schema layer is yours.** Entity types are defined using `@nekostack/schema`. Codex inherits that ecosystem's typing, validation, and code generation.
3. **You learn graph data modeling.** Foreign-key thinking is everywhere. Graph thinking is rare and high-value.
4. **Embedded use-case.** Codex runs inside your apps, not as a separate service. SQLite + an in-process graph layer covers the actual scale.

## Scope

### In scope
- Entity kind definitions (TypeScript schemas via `@nekostack/schema`).
- Typed relationships with cardinality (one-to-one, one-to-many, many-to-many).
- Entity validation against schemas at insert/update time.
- Reference integrity: relationships to non-existent entities are rejected.
- Query API: lookup by id, traverse relationships, filter by predicates, fan-out queries.
- Manifest format for ingesting entities from external projects (read-only Codex-indexed mode).
- Export formats: JSON, DOT (Graphviz), Cypher-like dump for debugging.
- Versioned schemas with migration support (via `@nekostack/schema` versioning).
- Optional persistence: in-memory (fastest), SQLite-backed (durable), JSON-flat-file (human-editable).

### Out of scope
- Distributed graph queries across multiple machines.
- Multi-billion-node scale. Codex is for thousands-to-low-millions of entities.
- Full-text search on entity properties — that's `@nekostack/search`. Codex indexes by id and relationship, not free-form text.
- Real-time collaboration on entity editing — out of initial scope; could come later.
- Visualization rendering. Codex exports to formats; rendering happens in `@nekostack/canvas` or external tools (Graphviz, Obsidian Canvas, etc.).

## Competitors and adjacent tools

| Tool | What they do well | Where they fall short for us |
|---|---|---|
| **Neo4j** | Mature graph DB, Cypher query language. | Heavyweight ops, overkill for thousands-of-entities scale, separate service. |
| **Dgraph** | Distributed graph DB. | Same scale-mismatch issue. |
| **Memgraph** | In-memory graph DB. | External service, learning Cypher, no schema integration with rest of stack. |
| **JanusGraph / TigerGraph** | Enterprise graph DBs. | Vastly oversized. |
| **Apollo Federation / GraphQL** | Federated typed graph queries. | Different problem — federated query layer over services, not entity persistence. |
| **Prisma** | Type-safe ORM. | Relational-first. Relationships are FKs, not first-class typed edges. |
| **TinkerPop / Gremlin** | Graph traversal language standard. | Implementation-agnostic spec; we'd build our own implementation anyway. |
| **Ad-hoc nested JSON** | Easy to start. | Becomes the problem this package solves. |

The right framing: Codex is a **lightweight in-process typed entity graph for content-heavy applications.** Closest commercial analogue: notion-graph or roam-research's underlying data model, but for code and games rather than personal note-taking.

## How this fits the NekoStack

**Depends on:**
- `@nekostack/schema` — entity kind definitions use the schema DSL.
- `@nekostack/cli` — `neko codex` subcommands for export, validate, query.
- (Optional) `@nekostack/storage` for binary asset references on entities.

**Used by:**
- **NekoBattler** — champions, traits, abilities, items, factions, encounters.
- **Mara Kane** — characters, factions, locations, timelines, canon-rules.
- **NekoVibe** — puzzle types, clues, difficulty metadata, tags.
- **NekoGacha** — characters, banners, rarity, pull pools.
- **Leytide** — world entities (NPCs, locations, quests, items, recipes).
- **NekoSystems** — business entities, workflows, policy contracts.
- **NekoLife** — activities (already JSON-organized; could be Codex-native).

## Design philosophy

- **Entities are typed by kind.** Every entity has a kind (`Character`, `Faction`, `Ability`). Each kind has a schema. Untyped entities are rejected.
- **Relationships are typed too.** A `belongs_to_faction` edge from a Character must point at a Faction. Reference integrity is enforced.
- **Stable IDs across projects.** An entity's id is `<namespace>:<kind>:<slug>`. Cross-project references are possible without name collisions.
- **In-process, embedded.** Codex is a library, not a service. Apps embed it. SQLite or in-memory backing.
- **Query is graph-shaped.** Traversals (`character.belongs_to_faction.has_members`) are first-class. Joins are not the right abstraction.
- **Validators run at write-time.** No invalid state is reachable through the API. Loading legacy data uses a migration path that explicitly transforms.

## Architecture sketch

```
packages/codex/
├── src/
│   ├── core/
│   │   ├── kind.ts           # defineKind() — kind + schema + relationship spec
│   │   ├── entity.ts         # Entity type, id format, namespace
│   │   ├── relation.ts       # Relation type + cardinality
│   │   └── graph.ts          # Graph<T> — the registry itself
│   ├── storage/
│   │   ├── memory.ts         # in-process Map-backed
│   │   ├── sqlite.ts         # better-sqlite3 backend
│   │   └── jsonfile.ts       # human-editable JSON flat-file
│   ├── query/
│   │   ├── lookup.ts         # by id
│   │   ├── traverse.ts       # follow relationships
│   │   ├── filter.ts         # predicate-based filtering
│   │   └── path.ts           # path queries (Character → Faction → Members)
│   ├── manifest/
│   │   ├── format.ts         # codex.json manifest spec
│   │   ├── ingest.ts         # ingest external manifests
│   │   └── export.ts         # JSON, DOT, Cypher-like
│   ├── validators/
│   │   ├── schema.ts         # schema conformance
│   │   └── refs.ts           # reference integrity
│   └── cli.ts                # `neko codex export/validate/query`
├── tests/
└── README.md
```

Defining a kind:

```ts
import { defineKind, s } from '@nekostack/codex';

export const Character = defineKind('Character', {
  schema: s.object({
    name: s.string(),
    archetype: s.enum(['warrior', 'mage', 'rogue']),
    description: s.string().optional(),
  }),
  relations: {
    belongs_to_faction: { kind: 'Faction', cardinality: 'one' },
    uses_ability: { kind: 'Ability', cardinality: 'many' },
    enemies: { kind: 'Character', cardinality: 'many' },
  },
});
```

Querying:

```ts
const ember = codex.get<Character>('nekobattler:Character:ember-cat');
const faction = codex.traverse(ember).belongs_to_faction.one();
const factionMembers = codex.traverse(faction).has_members.all();
```

## Roadmap

### v0.1 — Bootstrap
- `defineKind`, in-memory graph, basic insert/get/update.
- Schema integration via `@nekostack/schema`.

### v0.2 — Relationships
- Typed relations with cardinality.
- Reference integrity validation.

### v0.3 — Query API
- Traversal API, filter predicates, path queries.

### v0.4 — Storage backends
- SQLite backing for durable persistence.
- JSON flat-file backing for human-editable graphs (small datasets).

### v0.5 — Manifests
- Manifest format for projects that aren't Codex-native.
- Ingest pipeline producing read-only indexed projections.

### v0.6 — Export
- JSON, DOT, Cypher-like.
- CLI integration (`neko codex export`).

### v0.7 — Versioning + migrations
- Schema versioning via `@nekostack/schema`.
- Migration pipelines for evolving entity shapes.

### v1.0 — Stable API
- Documentation site with tutorials per project type.
- Performance benchmarks at 10K / 100K / 1M entities.

## Product potential

**Internal use:** Very high. The unifying content layer across every content-heavy project.

**Open source release:** Strong. The "lightweight embedded graph" niche is genuinely undersupplied — most options are either heavyweight DBs (Neo4j) or note-taking apps (Obsidian, Roam, Logseq). An open-source typed embedded graph for games + content systems could attract real users. MIT or Apache.

**Commercial product:** Plausible at the **"hosted Codex for writers and worldbuilders"** angle — a SaaS where the user gets a hosted graph, web editor, collaboration, and exports. Similar in product shape to World Anvil but graph-typed. Distinct opportunity from open-source Codex; the hosted product would compete in the worldbuilding-SaaS space.

**Estimated effort to v1.0:** 8-16 weeks of focused work. The data model is straightforward; the query API and the storage layers are where real time goes.

## Status

- **Current:** Empty placeholder. Not started.
- **Owner:** Cody (solo dev project).
- **Priority tier:** Force multiplier. The most strategically important package in the stack — it changes how every content-heavy project organizes data.
- **Estimated learning return:** Very high. Graph data modeling, query language design, storage abstractions, schema-driven validation — all transferable to any future data-modeling work.
