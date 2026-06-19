# @nekostack/chat

> Chat interface infrastructure: conversation state, thread model, assistant + tool messages, streaming. The UI substrate for AI chat surfaces.

## Quick reference

| | |
|---|---|
| **Build tier** | AI / LLM |
| **Depends on** | `schema`, `prompts`, `tools`, `memory`, `ui`, `realtime` (streaming), `audit` |
| **Used by** | NekoSystems (tenant-facing chat surfaces, customer-support agents), in-app help, narrative co-author UIs |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 10â€“16 weeks focused |

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
- Chat platform (Slack-style multi-user) â€” different shape.
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
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ state/
â”‚   â”‚   â””â”€â”€ conversation.ts
â”‚   â”œâ”€â”€ thread/
â”‚   â”‚   â”œâ”€â”€ linear.ts
â”‚   â”‚   â””â”€â”€ branch.ts
â”‚   â”œâ”€â”€ messages/
â”‚   â”‚   â”œâ”€â”€ user.ts
â”‚   â”‚   â”œâ”€â”€ assistant.ts
â”‚   â”‚   â”œâ”€â”€ system.ts
â”‚   â”‚   â”œâ”€â”€ tool-call.ts
â”‚   â”‚   â””â”€â”€ tool-result.ts
â”‚   â”œâ”€â”€ streaming/
â”‚   â”‚   â””â”€â”€ render.ts           # via realtime
â”‚   â”œâ”€â”€ actions/
â”‚   â”‚   â”œâ”€â”€ regenerate.ts
â”‚   â”‚   â”œâ”€â”€ edit.ts
â”‚   â”‚   â””â”€â”€ branch.ts
â”‚   â”œâ”€â”€ persist/
â”‚   â”‚   â””â”€â”€ via-memory.ts
â”‚   â”œâ”€â”€ components/
â”‚   â”‚   â”œâ”€â”€ MessageList.tsx
â”‚   â”‚   â”œâ”€â”€ Message.tsx
â”‚   â”‚   â”œâ”€â”€ ToolCall.tsx
â”‚   â”‚   â””â”€â”€ Composer.tsx
â”‚   â””â”€â”€ cli.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Conversation state + linear thread
### v0.2 â€” Streaming rendering
### v0.3 â€” Tool-call rendering
### v0.4 â€” Regenerate / edit
### v0.5 â€” Branching threads
### v0.6 â€” Memory persistence
### v0.7 â€” React components
### v1.0 â€” Stable API

## Product potential

**Internal:** Critical for NekoSystems chat surfaces.
**Open source release:** Modest â€” Vercel AI SDK fills similar niche.
**Commercial:** Marginal.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** AI / LLM.
- **Estimated learning return:** High. Conversation state machines, streaming UIs, branching threads, tool-call UX.
