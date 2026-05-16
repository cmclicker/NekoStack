# @nekostack/chat

> Chat interface infrastructure: conversation state, thread model, assistant + tool messages, streaming. The UI substrate for AI chat surfaces.

## Quick reference

| | |
|---|---|
| **Build tier** | AI / LLM |
| **Depends on** | `schema`, `prompts`, `tools`, `memory`, `ui`, `realtime` (streaming), `audit` |
| **Used by** | NekoSystems (tenant-facing chat surfaces, customer-support agents), in-app help, narrative co-author UIs |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 10–16 weeks focused |
| **Sellable?** | Modest — Vercel AI SDK dominates UI; chat UI niche |

## Why this exists

AI chat UIs share patterns: streaming responses, tool-call rendering, conversation history, regenerate / edit / branch, message threading. Every project reinvents. `chat` provides the substrate.

## Scope

### In scope
- Conversation state machine.
- Thread model (linear + branching).
- Message types (user / assistant / system / tool-call / tool-result).
- Streaming response rendering.
- Regenerate / edit / branch messages.
- Conversation persistence via `memory`.
- Tool-call UI rendering.
- Markdown / code rendering via `md`.

### Out of scope
- LLM provider (`prompts`).
- Tool registry (`tools`).
- Memory (`memory`).
- Chat platform (Slack-style multi-user) — different shape.
- Real-time multi-user collaboration (`realtime` for streaming, but not multi-user chat).

## Boundary

### Owns
- Conversation state machine
- Thread model
- Message type taxonomy
- Streaming rendering
- Regenerate / edit / branch
- Tool-call UI
- Chat-specific React components

### Does NOT own
| Capability | Lives in |
|---|---|
| Prompt management | `prompts` |
| Tool registry | `tools` |
| Memory persistence | `memory` |
| Markdown rendering | `md` |
| Real-time transport | `realtime` (we use for streaming) |
| UI primitives | `ui` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **Vercel AI SDK** | Excellent React chat hooks. | Framework-coupled; closer fit; we may use as substrate. |
| **Anthropic / OpenAI playground** | Reference UIs. | Not portable. |
| **Custom chat components** | Common. | Reinvented per product. |

## How this fits the NekoStack

- **`prompts`** for LLM calls.
- **`tools`** for tool-call rendering.
- **`memory`** for persistence.
- **`realtime`** for streaming.
- **`ui`** + **`md`** for rendering.

## Design philosophy

- **Streaming-first.** All responses render incrementally.
- **Branching threads.** Regenerate produces a sibling, not a replacement.
- **Tool calls are visible.** When the agent calls a tool, the UI shows it.
- **Edit + regenerate.** Users can rewrite their own messages and re-run.

## Architecture sketch

```
packages/chat/
├── src/
│   ├── state/
│   │   └── conversation.ts
│   ├── thread/
│   │   ├── linear.ts
│   │   └── branch.ts
│   ├── messages/
│   │   ├── user.ts
│   │   ├── assistant.ts
│   │   ├── system.ts
│   │   ├── tool-call.ts
│   │   └── tool-result.ts
│   ├── streaming/
│   │   └── render.ts           # via realtime
│   ├── actions/
│   │   ├── regenerate.ts
│   │   ├── edit.ts
│   │   └── branch.ts
│   ├── persist/
│   │   └── via-memory.ts
│   ├── components/
│   │   ├── MessageList.tsx
│   │   ├── Message.tsx
│   │   ├── ToolCall.tsx
│   │   └── Composer.tsx
│   └── cli.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Conversation state + linear thread
### v0.2 — Streaming rendering
### v0.3 — Tool-call rendering
### v0.4 — Regenerate / edit
### v0.5 — Branching threads
### v0.6 — Memory persistence
### v0.7 — React components
### v1.0 — Stable API

## Product potential

**Internal:** Critical for NekoSystems chat surfaces.
**Open source release:** Modest — Vercel AI SDK fills similar niche.
**Commercial:** Marginal.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** AI / LLM.
- **Estimated learning return:** High. Conversation state machines, streaming UIs, branching threads, tool-call UX.
