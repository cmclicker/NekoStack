# @nekostack/rag

> Retrieval-augmented generation. Embedding generation + vector store + retrieval + reranking + context-pack assembly. The "give the LLM the right information" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | AI / LLM |
| **Depends on** | `schema`, `codex` (entity graph as a retrieval source), `search` (text-search complement), `storage` (embedding store), `prompts` (context fed into prompts), `eval` (retrieval evals) |
| **Used by** | NekoSystems (agent retrieval over docs), `chat` (RAG-augmented conversations), narrative tools (lore retrieval), any LLM-using project needing context beyond context-window |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 12–20 weeks focused |
| **Sellable?** | Strong — RAG-ops tooling is hot |

## Why this exists

LLMs have limited context windows. RAG bridges that: retrieve relevant docs, stuff them into the context, let the LLM reason. Done badly, RAG is "stuff random snippets in and hope." Done well, RAG is: chunked source docs + embeddings + hybrid retrieval (dense + sparse) + reranking + citation tracking + eval of retrieval quality.

`rag` is the proper RAG pipeline.

## Scope

### In scope
- Embedding generation (provider-abstracted via `prompts`).
- Vector store (pgvector / Chroma / Qdrant / in-memory).
- Document chunking (token-aware).
- Hybrid retrieval (dense + sparse via `search`).
- Reranking (rerank top-k retrieval results).
- Context-pack assembly (compose retrieval results into prompt context).
- Citation tracking (which source informed which output).
- Retrieval evaluation (precision / recall).

### Out of scope
- Prompt management (`prompts`).
- Full-text search infrastructure (`search` — we use it).
- Embedding-model hosting (use provider).
- Chat UI (`chat`).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §30, §59 for the full capability map.

### Owns
- Embedding generation
- Vector store
- Document chunking
- Hybrid retrieval (dense + sparse)
- Reranking
- Context-pack assembly
- Citation tracking
- Retrieval evaluation

### Does NOT own
| Capability | Lives in |
|---|---|
| Prompt templates | `prompts` |
| Full-text indexing | `search` |
| Codex entity graph | `codex` |
| Storage backend | `storage` (we use) |
| Chat UI | `chat` |
| LLM eval suites | `eval` (we contribute retrieval evals) |
| Citation provenance integration | `provenance` (we feed) |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **LangChain RAG** | Comprehensive. | Heavyweight. |
| **LlamaIndex** | RAG-focused. | Python-first; we want TS. |
| **pgvector** | Postgres vector ext. | Substrate. |
| **Chroma / Qdrant / Weaviate** | Vector DBs. | Substrate. |
| **Custom RAG code** | Common. | Reinvented per project. |

## How this fits the NekoStack

- **`codex`** as a structured-retrieval source (entity graph).
- **`search`** for sparse (BM25) retrieval.
- **`storage`** for embedding store backend.
- **`prompts`** for embedding generation calls.
- **`eval`** for retrieval evaluation.
- **`provenance`** for citation tracking.

## Design philosophy

- **Hybrid retrieval by default.** Dense (semantic) + sparse (keyword); reranked.
- **Citations are first-class.** Every output cites which source informed it.
- **Eval-driven.** Retrieval quality is measured, not assumed.
- **Provider-swappable embeddings.** OpenAI / Voyage / local — switchable.

## Architecture sketch

```
packages/rag/
├── src/
│   ├── embed/
│   │   ├── generate.ts        # via prompts (provider)
│   │   └── batch.ts
│   ├── store/
│   │   ├── pgvector.ts
│   │   ├── chroma.ts
│   │   ├── qdrant.ts
│   │   └── memory.ts
│   ├── chunk/
│   │   ├── token-aware.ts
│   │   └── sliding-window.ts
│   ├── retrieve/
│   │   ├── dense.ts
│   │   ├── sparse.ts           # via search
│   │   └── hybrid.ts
│   ├── rerank/
│   │   └── score.ts
│   ├── context/
│   │   └── assemble.ts
│   ├── citation/
│   │   └── track.ts
│   └── eval/
│       └── retrieval.ts        # via eval
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Embedding + in-memory store
### v0.2 — Token-aware chunking
### v0.3 — Dense retrieval
### v0.4 — pgvector adapter
### v0.5 — Hybrid retrieval
### v0.6 — Reranking
### v0.7 — Context-pack assembly
### v0.8 — Citation tracking
### v0.9 — Retrieval eval
### v1.0 — Stable API

## Product potential

**Internal:** Powers NekoSystems agent context, narrative-tool lore retrieval.
**Open source release:** Strong — TS-native RAG library is undersupplied.
**Commercial:** Real — RAG-ops is hot (LlamaIndex commercial offerings).

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** AI / LLM.
- **Estimated learning return:** Very high. Embeddings, vector search, hybrid retrieval, reranking, context assembly — increasingly core skills.
