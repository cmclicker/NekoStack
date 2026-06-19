# @nekostack/memory

> Agent conversation memory + persistence + summarization. Episodic, semantic, project memory. The "what should the LLM remember across sessions?" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | AI / LLM |
| **Depends on** | `schema`, `rag` (semantic memory via embeddings), `storage`, `prompts` (memory feeds into prompts), `audit` (memory mutations), `time` (expiry) |
| **Used by** | NekoSystems (LLM-feature persistence for tenant agents), `chat` (conversation history), `session` (developer-session memory is *different* â€” uses us conceptually but holds dev-side records) |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 8â€“14 weeks focused |

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
- Developer session state (`session` â€” distinct concept, similar shape).
- RAG primitives (`rag` â€” we use them).
- Auth-side user preferences (`auth` user profile).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§58 (in BOUNDARIES.md).

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
- **Conflict resolution explicit.** Two contradictory memories â†’ resolve, don't silently pick.

## Architecture sketch

```
packages/memory/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ records/
â”‚   â”‚   â”œâ”€â”€ episodic.ts
â”‚   â”‚   â”œâ”€â”€ semantic.ts
â”‚   â”‚   â”œâ”€â”€ preference.ts
â”‚   â”‚   â””â”€â”€ project.ts
â”‚   â”œâ”€â”€ store/
â”‚   â”‚   â””â”€â”€ persist.ts          # via storage
â”‚   â”œâ”€â”€ relevance/
â”‚   â”‚   â””â”€â”€ score.ts            # via rag embeddings
â”‚   â”œâ”€â”€ inject/
â”‚   â”‚   â””â”€â”€ into-prompt.ts      # via prompts
â”‚   â”œâ”€â”€ expiry/
â”‚   â”‚   â””â”€â”€ policy.ts
â”‚   â”œâ”€â”€ conflict/
â”‚   â”‚   â””â”€â”€ resolve.ts
â”‚   â”œâ”€â”€ redact/
â”‚   â”‚   â””â”€â”€ delete.ts
â”‚   â””â”€â”€ export/
â”‚       â””â”€â”€ via-export.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Memory record types + storage
### v0.2 â€” Relevance scoring (RAG-based)
### v0.3 â€” Memory injection
### v0.4 â€” Expiry policies
### v0.5 â€” Conflict resolution
### v0.6 â€” Redaction + export
### v1.0 â€” Stable API

## Product potential

**Internal:** Critical for any agentic features (NekoSystems tenant-facing agents, narrative tools, coding assistants).
**Open source release:** Strong â€” agent memory is a young space.
**Commercial:** Real â€” Mem0 commercializes; room for OSS-friendly competitor.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** AI / LLM.
- **Estimated learning return:** Very high. Memory architectures, relevance scoring, conflict resolution, expiry policies â€” emerging field.
