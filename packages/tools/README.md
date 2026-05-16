# @nekostack/tools

> Agent function / tool registry. Schema-validated tool definitions, sandboxed execution via `sandbox`, observability. The "what can the LLM actually do?" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | AI / LLM |
| **Depends on** | `schema` (tool input/output), `prompts` (tools registered with prompts), `sandbox` (safe execution), `audit` (tool call audit), `provenance`, `permissions` (tool authorization), `governance` (forbidden tools) |
| **Used by** | NekoSystems (agentic features inside the Business-OS SaaS), `chat` (tool-using conversations), any agentic application |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 8–14 weeks focused |
| **Sellable?** | Strong — agent tool-use is a major commercial space |

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
- Provider-format mapping (Anthropic tool format ↔ OpenAI tool format).
- Tool composition (call multiple tools, chain results).

### Out of scope
- Sandboxed execution itself (`sandbox`).
- Prompts (`prompts`).
- Conversation memory (`memory`).
- Chat UI (`chat`).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §41 for the full capability map.

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
├── src/
│   ├── define/
│   │   └── tool.ts            # defineTool({ input, output, handler, auth })
│   ├── registry/
│   │   └── catalog.ts
│   ├── authorize/
│   │   └── check.ts           # via permissions
│   ├── execute/
│   │   └── via-sandbox.ts
│   ├── format/
│   │   ├── anthropic.ts
│   │   └── openai.ts
│   ├── compose/
│   │   └── chain.ts
│   ├── audit/
│   │   └── emit.ts
│   └── cli.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Tool definition + registry
### v0.2 — Anthropic format mapping
### v0.3 — OpenAI format mapping
### v0.4 — Authorization
### v0.5 — Sandbox execution integration
### v0.6 — Audit + telemetry
### v0.7 — Composition / chaining
### v1.0 — Stable API

## Product potential

**Internal:** Critical for NekoSystems.
**Open source release:** Strong — provider-neutral tool registry is undersupplied.
**Commercial:** Real — agent platforms are a hot space.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** AI / LLM.
- **Estimated learning return:** Very high. Tool-use semantics, authorization patterns, provider format mapping — increasingly important.
