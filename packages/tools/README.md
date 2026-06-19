# @nekostack/tools

> Agent function / tool registry. Schema-validated tool definitions, sandboxed execution via `sandbox`, observability. The "what can the LLM actually do?" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | AI / LLM |
| **Depends on** | `schema` (tool input/output), `prompts` (tools registered with prompts), `sandbox` (safe execution), `audit` (tool call audit), `provenance`, `permissions` (tool authorization), `governance` (forbidden tools) |
| **Used by** | NekoSystems (agentic features inside the Business-OS SaaS), `chat` (tool-using conversations), any agentic application |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 8â€“14 weeks focused |

## Why this exists

Modern LLMs do tool-calling: "search for X", "open this file", "execute this command", "fetch this URL". Each tool needs:
- A schema (input shape, output shape).
- Authorization (which agents can call which tools).
- Sandboxed execution (filesystem / network / process boundaries).
- Audit (every tool call recorded).
- Observability (which tools are used, how often, latency).

`tools` is the registry + execution layer.

## Scope

### In scope
- Tool definition DSL (input schema, output schema, handler, authorization).
- Tool registry.
- Tool authorization (which agent can call which tool).
- Sandboxed execution via `sandbox`.
- Tool-call audit + telemetry.
- Tool result validation.
- Provider-format mapping (Anthropic tool format â†” OpenAI tool format).
- Tool composition (call multiple tools, chain results).

### Out of scope
- Sandboxed execution itself (`sandbox`).
- Prompts (`prompts`).
- Conversation memory (`memory`).
- Chat UI (`chat`).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§41 for the full capability map.

### Owns
- Tool definition DSL
- Tool registry
- Tool authorization
- Provider-format mapping
- Tool-call audit
- Tool composition

### Does NOT own
| Capability | Lives in |
|---|---|
| Sandboxed execution | `sandbox` |
| Prompts | `prompts` |
| Conversation memory | `memory` |
| Chat UI | `chat` |
| Permission catalog | `permissions` |
| Forbidden-tool policies | `governance` |
| Generic action registry (CLI + UI + agents) | `actions` (we plug in) |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **LangChain Tools** | Comprehensive. | Heavyweight. |
| **OpenAI / Anthropic tool-calling APIs** | Substrate. | We unify across providers. |
| **CrewAI tools** | Mature for crews. | Crew-framework-specific; we generalize. |
| **Custom per-product** | Common. | Reinvented. |

## How this fits the NekoStack

- **`schema`** for tool I/O.
- **`prompts`** registers tool catalog with LLM calls.
- **`sandbox`** executes risky tools safely.
- **`permissions`** + **`governance`** authorize.
- **`audit`** records every call.
- **`actions`** unifies command catalogs.

## Design philosophy

- **Tools are typed functions.** Schema in, schema out.
- **Authorization mandatory.** No tool calls without explicit permission.
- **Sandboxed by default.** Risky tools never run in main process.
- **Provider-agnostic format.** Tool catalog is provider-neutral.

## Architecture sketch

```
packages/tools/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ define/
â”‚   â”‚   â””â”€â”€ tool.ts            # defineTool({ input, output, handler, auth })
â”‚   â”œâ”€â”€ registry/
â”‚   â”‚   â””â”€â”€ catalog.ts
â”‚   â”œâ”€â”€ authorize/
â”‚   â”‚   â””â”€â”€ check.ts           # via permissions
â”‚   â”œâ”€â”€ execute/
â”‚   â”‚   â””â”€â”€ via-sandbox.ts
â”‚   â”œâ”€â”€ format/
â”‚   â”‚   â”œâ”€â”€ anthropic.ts
â”‚   â”‚   â””â”€â”€ openai.ts
â”‚   â”œâ”€â”€ compose/
â”‚   â”‚   â””â”€â”€ chain.ts
â”‚   â”œâ”€â”€ audit/
â”‚   â”‚   â””â”€â”€ emit.ts
â”‚   â””â”€â”€ cli.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Tool definition + registry
### v0.2 â€” Anthropic format mapping
### v0.3 â€” OpenAI format mapping
### v0.4 â€” Authorization
### v0.5 â€” Sandbox execution integration
### v0.6 â€” Audit + telemetry
### v0.7 â€” Composition / chaining
### v1.0 â€” Stable API

## Product potential

**Internal:** Critical for NekoSystems.
**Open source release:** Strong â€” provider-neutral tool registry is undersupplied.
**Commercial:** Real â€” agent platforms are a hot space.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** AI / LLM.
- **Estimated learning return:** Very high. Tool-use semantics, authorization patterns, provider format mapping â€” increasingly important.
