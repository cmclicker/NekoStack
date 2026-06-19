# @nekostack/mock

> Service mocking: contract-test fixtures, record-and-replay, deterministic stubs. The "tests don't talk to the real internet" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Testing depth |
| **Depends on** | `schema` (mock contract shapes), `test`, `fetch` (intercepts), `random` |
| **Used by** | every package with external dependencies during tests; `billing` (Stripe mock), `email` (Resend mock), `webhooks` (provider mocks), `prompts` (LLM mocks) |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 4â€“8 weeks focused |

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
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ http/
â”‚   â”‚   â””â”€â”€ via-msw.ts
â”‚   â”œâ”€â”€ providers/
â”‚   â”‚   â”œâ”€â”€ stripe.ts
â”‚   â”‚   â”œâ”€â”€ openai.ts
â”‚   â”‚   â”œâ”€â”€ anthropic.ts
â”‚   â”‚   â””â”€â”€ resend.ts
â”‚   â”œâ”€â”€ record-replay/
â”‚   â”‚   â”œâ”€â”€ record.ts
â”‚   â”‚   â””â”€â”€ replay.ts
â”‚   â”œâ”€â”€ contract-test/
â”‚   â”‚   â””â”€â”€ verify.ts
â”‚   â””â”€â”€ llm/
â”‚       â””â”€â”€ structured.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” msw wrapper
### v0.2 â€” Provider mocks (Stripe / OpenAI / Anthropic / Resend)
### v0.3 â€” Record-and-replay
### v0.4 â€” Contract tests
### v0.5 â€” LLM mock
### v1.0 â€” Stable API

## Product potential

**Internal:** Used across test suites.
**Open source release:** Marginal.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Testing depth.
- **Estimated learning return:** Moderate. Mock patterns, record-and-replay, contract testing.
