# @nekostack/memory

> Agent conversation memory + persistence + summarization. Episodic, semantic, project memory. The "what should the LLM remember across sessions?" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | AI / LLM |
| **Depends on** | `schema`, `rag` (semantic memory via embeddings), `storage`, `prompts` (memory feeds into prompts), `audit` (memory mutations), `time` (expiry) |
| **Used by** | NekoSystems (LLM-feature persistence for tenant agents), `chat` (conversation history), `session` (developer-session memory is *different* — uses us conceptually but holds dev-side records) |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 8–14 weeks focused |
| **Sellable?** | Strong — agent memory is a young, important space |

## Why this exists

LLMs have no memory between calls. Production agentic systems need:
- **Episodic memory:** "what happened last conversation."
- **Semantic memory:** "facts I've learned about the user / project."
- **Project memory:** "long-lived context about a domain."
- **User preferences:** "they prefer terse responses."
- **Memory relevance scoring:** what's worth surfacing.
- **Memory expiry:** stale memory becomes wrong over time.

Naive solutions store everything; context windows explode. `memory` is the proper persistence + relevance + expiry layer.

## Scope

### In scope
- Memory record schema (episodic / semantic / preference / project).
- Storage backend.
- Relevance scoring (which memories matter for this prompt).
- Memory injection into prompts.
- Memory expiry policies.
- Memory conflict resolution (newer fact vs older).
- Memory provenance (where did this fact come from).
- Memory redaction (delete on user request).
- Memory export (DSAR).

### Out of scope
- LLM conversation transcripts in the wire (those are `chat`).
- Developer session state (`session` — distinct concept, similar shape).
- RAG primitives (`rag` — we use them).
- Auth-side user preferences (`auth` user profile).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §58 (in BOUNDARIES.md).

### Owns
- Persistent memory records
- Episodic / semantic / preference / project memory
- Relevance scoring
- Memory injection into prompts
- Expiry + conflict resolution
- Memory provenance
- Memory redaction + export

### Does NOT own
| Capability | Lives in |
|---|---|
| Dev session records | `session` (different concept) |
| Conversation history | `chat` |
| RAG retrieval primitives | `rag` (we use) |
| Auth-side user preferences | `auth` |
| Storage backend | `storage` (we use) |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **MemGPT** | Memory-focused agent framework. | Heavyweight. |
| **Mem0** | Hosted agent memory. | Vendor. |
| **Custom DB tables** | Common. | No relevance scoring, no expiry. |

## How this fits the NekoStack

- **`rag`** for semantic memory (embedding-based relevance).
- **`prompts`** for memory injection.
- **`audit`** for memory mutations.
- **`storage`** for backend.

## Design philosophy

- **Multi-shape memory.** Episodic / semantic / preference / project are distinct.
- **Relevance over recency.** Surfacing irrelevant memory wastes context.
- **Expiry mandatory.** Old facts become wrong; stale memory is worse than none.
- **Conflict resolution explicit.** Two contradictory memories → resolve, don't silently pick.

## Architecture sketch

```
packages/memory/
├── src/
│   ├── records/
│   │   ├── episodic.ts
│   │   ├── semantic.ts
│   │   ├── preference.ts
│   │   └── project.ts
│   ├── store/
│   │   └── persist.ts          # via storage
│   ├── relevance/
│   │   └── score.ts            # via rag embeddings
│   ├── inject/
│   │   └── into-prompt.ts      # via prompts
│   ├── expiry/
│   │   └── policy.ts
│   ├── conflict/
│   │   └── resolve.ts
│   ├── redact/
│   │   └── delete.ts
│   └── export/
│       └── via-export.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Memory record types + storage
### v0.2 — Relevance scoring (RAG-based)
### v0.3 — Memory injection
### v0.4 — Expiry policies
### v0.5 — Conflict resolution
### v0.6 — Redaction + export
### v1.0 — Stable API

## Product potential

**Internal:** Critical for any agentic features (NekoSystems tenant-facing agents, narrative tools, coding assistants).
**Open source release:** Strong — agent memory is a young space.
**Commercial:** Real — Mem0 commercializes; room for OSS-friendly competitor.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** AI / LLM.
- **Estimated learning return:** Very high. Memory architectures, relevance scoring, conflict resolution, expiry policies — emerging field.
