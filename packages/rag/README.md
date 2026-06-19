# @nekostack/rag

> Retrieval-augmented generation. Embedding generation + vector store + retrieval + reranking + context-pack assembly. The "give the LLM the right information" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | AI / LLM |
| **Depends on** | `schema`, `codex` (entity graph as a retrieval source), `search` (text-search complement), `storage` (embedding store), `prompts` (context fed into prompts), `eval` (retrieval evals) |
| **Used by** | NekoSystems (RAG over tenant content for customer-support agents + business workflows), `chat` (RAG-augmented conversations), narrative tools (lore retrieval), any LLM-using project needing context beyond context-window |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 12â€“20 weeks focused |

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
- Full-text search infrastructure (`search` â€” we use it).
- Embedding-model hosting (use provider).
- Chat UI (`chat`).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§30, Â§59 for the full capability map.

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
- **Provider-swappable embeddings.** OpenAI / Voyage / local â€” switchable.

## Architecture sketch

```
packages/rag/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ embed/
â”‚   â”‚   â”œâ”€â”€ generate.ts        # via prompts (provider)
â”‚   â”‚   â””â”€â”€ batch.ts
â”‚   â”œâ”€â”€ store/
â”‚   â”‚   â”œâ”€â”€ pgvector.ts
â”‚   â”‚   â”œâ”€â”€ chroma.ts
â”‚   â”‚   â”œâ”€â”€ qdrant.ts
â”‚   â”‚   â””â”€â”€ memory.ts
â”‚   â”œâ”€â”€ chunk/
â”‚   â”‚   â”œâ”€â”€ token-aware.ts
â”‚   â”‚   â””â”€â”€ sliding-window.ts
â”‚   â”œâ”€â”€ retrieve/
â”‚   â”‚   â”œâ”€â”€ dense.ts
â”‚   â”‚   â”œâ”€â”€ sparse.ts           # via search
â”‚   â”‚   â””â”€â”€ hybrid.ts
â”‚   â”œâ”€â”€ rerank/
â”‚   â”‚   â””â”€â”€ score.ts
â”‚   â”œâ”€â”€ context/
â”‚   â”‚   â””â”€â”€ assemble.ts
â”‚   â”œâ”€â”€ citation/
â”‚   â”‚   â””â”€â”€ track.ts
â”‚   â””â”€â”€ eval/
â”‚       â””â”€â”€ retrieval.ts        # via eval
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Embedding + in-memory store
### v0.2 â€” Token-aware chunking
### v0.3 â€” Dense retrieval
### v0.4 â€” pgvector adapter
### v0.5 â€” Hybrid retrieval
### v0.6 â€” Reranking
### v0.7 â€” Context-pack assembly
### v0.8 â€” Citation tracking
### v0.9 â€” Retrieval eval
### v1.0 â€” Stable API

## Product potential

**Internal:** Powers NekoSystems tenant-content retrieval for in-SaaS agents, narrative-tool lore retrieval.
**Open source release:** Strong â€” TS-native RAG library is undersupplied.
**Commercial:** Real â€” RAG-ops is hot (LlamaIndex commercial offerings).

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** AI / LLM.
- **Estimated learning return:** Very high. Embeddings, vector search, hybrid retrieval, reranking, context assembly â€” increasingly core skills.
