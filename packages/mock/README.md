# @nekostack/mock

> Service mocking: contract-test fixtures, record-and-replay, deterministic stubs. The "tests don't talk to the real internet" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Testing depth |
| **Depends on** | `schema` (mock contract shapes), `test`, `fetch` (intercepts), `random` |
| **Used by** | every package with external dependencies during tests; `billing` (Stripe mock), `email` (Resend mock), `webhooks` (provider mocks), `prompts` (LLM mocks) |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 4–8 weeks focused |
| **Sellable?** | Low — msw / nock dominate |

## Why this exists

Tests that hit real external services are slow, flaky, and exhaust API quotas. Mocking provides fast, deterministic replacements. `mock` is the unified mock library.

## Scope

### In scope
- HTTP mocking (msw-style interceptors).
- Stripe / OpenAI / Anthropic / Resend mock patterns.
- Record-and-replay (record real responses; replay in tests).
- Contract-test fixtures (verify mock matches real API).
- LLM mock with structured responses.
- Time mock (via `test`'s fake clock).

### Out of scope
- Unit test framework (`test`).
- Property-based testing (`fuzz`).
- Performance benchmarks (`bench`).

## Boundary

### Owns
- HTTP mock interceptors
- Provider-specific mock patterns
- Record-and-replay
- Contract-test fixtures
- LLM mock responses

### Does NOT own
| Capability | Lives in |
|---|---|
| Unit testing | `test` |
| Fake clock | `test` |
| Property-based | `fuzz` |
| Real HTTP client | `fetch` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **msw** | Modern service worker mocks. | Substrate; we wrap. |
| **nock** | Mature HTTP mock. | Older. |
| **VCR-style** | Record-and-replay. | We integrate. |

## How this fits the NekoStack

- **`test`** as the framework.
- **`fetch`** interceptable.
- **`schema`** for mock-shape validation.

## Design philosophy

- **msw substrate.** Modern, network-level.
- **Record-and-replay.** Real responses become fixtures.
- **Contract tests.** Mock structures verified against real provider.

## Architecture sketch

```
packages/mock/
├── src/
│   ├── http/
│   │   └── via-msw.ts
│   ├── providers/
│   │   ├── stripe.ts
│   │   ├── openai.ts
│   │   ├── anthropic.ts
│   │   └── resend.ts
│   ├── record-replay/
│   │   ├── record.ts
│   │   └── replay.ts
│   ├── contract-test/
│   │   └── verify.ts
│   └── llm/
│       └── structured.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — msw wrapper
### v0.2 — Provider mocks (Stripe / OpenAI / Anthropic / Resend)
### v0.3 — Record-and-replay
### v0.4 — Contract tests
### v0.5 — LLM mock
### v1.0 — Stable API

## Product potential

**Internal:** Used across test suites.
**Open source release:** Marginal.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Testing depth.
- **Estimated learning return:** Moderate. Mock patterns, record-and-replay, contract testing.
