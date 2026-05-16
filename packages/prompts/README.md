# @nekostack/prompts

> Prompt template management, versioning, provider abstraction (Anthropic / OpenAI / local / etc.), structured output schemas, safety constraints. The "LLM is a typed function with a versioned contract" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | AI / LLM |
| **Depends on** | `schema` (output validation), `audit` (LLM invocations), `provenance` (generated-output tracking), `governance` (LLM behavior constraints), `telemetry` (cost + latency), `secrets` (provider API keys) |
| **Used by** | NekoSystems (LLM-driven features inside the Business-OS SaaS — customer support, workflow assistants), every product touching LLMs, `tools` (provider routing), `chat`, `rag` (RAG prompts), `eval` (prompt regression tests) |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 8–14 weeks focused |
| **Sellable?** | **Strong** — prompt-ops tooling is undersupplied; commercial as part of LLM-platform offering |

## Why this exists

LLM calls in production look like database queries: they have inputs (prompt template + variables), outputs (typed structure), versions (the prompt changes), evaluations (does this prompt still work after I edited it?), costs (per-call token usage), and provider abstraction (Anthropic vs OpenAI vs local).

Without a `prompts` package, every project re-invents:
- String concatenation for prompts (drift, no version).
- `JSON.parse` of model output (no validation).
- Provider-coupled code (switching costs).
- No record of "which prompt produced this output."

`prompts` is the LLM-call typed-function layer.

## Scope

### In scope
- Prompt template DSL (typed variables, schema-validated inputs).
- Prompt versioning (semver-style; old versions remain callable).
- Prompt registry (catalog of named prompts).
- Provider abstraction (Anthropic / OpenAI / local via Ollama / etc.).
- Model routing (different models for different tasks).
- Structured output schemas (response validated via `schema`).
- LLM behavior constraints (from `governance`: must-read-before-write, no-placeholder, etc.) rendered into prompts.
- Refusal handling (model declines; what now?).
- Token + cost tracking via `telemetry`.
- Prompt-to-output provenance via `provenance`.

### Out of scope
- Tool / function-calling registry (`tools`).
- Conversation history / memory (`memory`).
- Chat UI (`chat`).
- Retrieval / RAG (`rag`).
- LLM eval suites (`eval`).
- Sandboxed tool execution (`sandbox`).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §41 for the full capability map.

### Owns
- Prompt template DSL
- Prompt versioning + registry
- Model provider abstraction
- Model routing
- Structured output validation
- LLM behavior constraint rendering
- Refusal handling
- Cost / token tracking emission

### Does NOT own
| Capability | Lives in |
|---|---|
| Game AI (FSM / BT / GOAP) | `ai` (different concept entirely) |
| Tool / function registry | `tools` |
| Conversation memory | `memory` |
| Chat UI | `chat` |
| RAG retrieval | `rag` |
| LLM evals | `eval` |
| Sandboxed tool execution | `sandbox` |
| Provenance records | `provenance` (we emit) |
| Audit log | `audit` (we emit) |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **LangChain** | Comprehensive LLM framework. | Heavyweight, opinionated, vendor-mixed; we want lighter + typed. |
| **LiteLLM** | Provider abstraction. | Just the routing layer. |
| **Anthropic SDK / OpenAI SDK** | Provider clients. | Substrate; we wrap. |
| **PromptLayer / Helicone** | Prompt observability SaaS. | Hosted; vendor-coupled. |
| **Vercel AI SDK** | Modern, Next.js-coupled. | Closer fit; framework-coupled. |
| **Custom string templates** | Common. | What this replaces. |

## How this fits the NekoStack

- **`schema`** validates outputs.
- **`audit`** records LLM calls.
- **`provenance`** tracks generated artifacts.
- **`governance`** declares LLM constraints; we render them.
- **`telemetry`** for cost / latency.
- **`secrets`** for API keys.
- **`tools`** for tool/function-calling.
- **`memory`** for conversation persistence.
- **`chat`** as the UI surface.

## Design philosophy

- **LLM is a typed function.** Inputs typed, outputs typed.
- **Versioning is mandatory.** Edit a prompt → bump version. Old version still callable.
- **Provider-swappable.** Anthropic → OpenAI → local is a config change.
- **Refusal handling.** Models say no; the package surfaces that explicitly.
- **Cost is observed.** Token usage emitted to telemetry per call.

## Architecture sketch

```
packages/prompts/
├── src/
│   ├── template/
│   │   ├── define.ts          # definePrompt({ inputs, version, ... })
│   │   ├── render.ts          # template + vars → string
│   │   └── catalog.ts
│   ├── version/
│   │   └── semver.ts
│   ├── provider/
│   │   ├── anthropic.ts
│   │   ├── openai.ts
│   │   ├── ollama.ts          # local
│   │   └── route.ts
│   ├── output/
│   │   ├── validate.ts        # via schema
│   │   └── parse.ts
│   ├── constraints/
│   │   └── render.ts          # from governance
│   ├── refusal/
│   │   └── handle.ts
│   ├── cost/
│   │   └── track.ts           # to telemetry
│   ├── provenance/
│   │   └── emit.ts            # to provenance
│   └── cli.ts                 # `neko prompts list / test / version`
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Template DSL + render
### v0.2 — Anthropic provider
### v0.3 — Output schema validation
### v0.4 — Versioning + catalog
### v0.5 — OpenAI + Ollama providers
### v0.6 — Model routing
### v0.7 — Behavior constraint rendering (from governance)
### v0.8 — Cost tracking + provenance emission
### v1.0 — Stable API

## Product potential

**Internal:** Critical for NekoSystems + any LLM-using product.
**Open source release:** Strong — typed prompt-ops library is undersupplied.
**Commercial:** Real — prompt-ops SaaS (PromptLayer / Helicone) is a category.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** AI / LLM.
- **Estimated learning return:** Very high. Prompt-engineering as code, structured output validation, provider abstraction, cost optimization — increasingly important skills.
