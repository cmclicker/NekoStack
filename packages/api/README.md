# @nekostack/api

> Define the API contract once. Generate the server stubs, client SDKs, validation middleware, and docs from it. End the "TypeScript types in three places" problem at the API boundary.

## Quick reference

| | |
|---|---|
| **Build tier** | Force multiplier — build after `schema` |
| **Depends on** | `schema` (request/response shapes), `auth` (permission decoration), `telemetry` (request events), `cli` (codegen subcommands) |
| **Used by** | every backend with an HTTP API: NekoVibe, NekoSystems (FastAPI adapter would be a stretch goal), Leytide server, future SaaS |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 12–20 weeks focused |
| **Sellable?** | Strong: contract-first multi-adapter niche undersupplied (ts-rest is single-adapter, Stainless is commercial-only); managed-SDK + breaking-change CI is a real Stainless-adjacent commercial direction |

## Why this exists

The endpoint-and-its-types-drift problem is universal:

- The Nest controller declares a TS type for the request body.
- The Zod validator (if any) defines a runtime check separately.
- The React Query hook on the client redeclares the same shape for fetching.
- The OpenAPI doc — if it exists at all — is generated from one of those and is always out of date.
- Six months later, the controller accepts a new optional field, but the client doesn't know about it, the validator still rejects it, and the OpenAPI doc lies.

`@nekostack/api` makes the API contract the single source of truth. You define endpoints with `@nekostack/schema`-typed inputs and outputs. From that contract:
- Server stubs validate requests, type response handlers, and inject typed inputs.
- TypeScript client SDKs are generated with full IntelliSense.
- OpenAPI 3.1 specs are produced for tooling and docs.
- API reference documentation regenerates automatically.

This is the same pattern ts-rest and Stainless ship. The difference is integration: this package consumes `@nekostack/schema` schemas, emits to `@nekostack/docs`, integrates with `@nekostack/auth` for permission decoration, and ties into `@nekostack/telemetry` for request-level events.

Building this yourself rather than adopting tRPC, ts-rest, or Hono RPC is justified because:
1. **You learn API contract design end-to-end.** Versioning, deprecation, breaking-change detection, content negotiation, RPC vs REST tradeoffs.
2. **Schema spine reuse.** ts-rest uses Zod; we use our own schema layer (which can compile *to* Zod). No double-typing.
3. **Multi-target.** Generate Express handlers, Nest controllers, Fastify routes, Next.js Route Handlers, Cloudflare Workers, AWS Lambda — your choice.
4. **OpenAPI is first-class.** ts-rest emits OpenAPI as a side-effect; Stainless treats it as primary. We treat OpenAPI 3.1 as a first-class output, ensuring durable compatibility with the wider tooling ecosystem.

## Scope

### In scope
- Endpoint definition DSL: method, path, params, query, body, headers, response shapes per status code.
- Server adapters: Nest, Express, Fastify, Next.js Route Handlers, Hono.
- Client generation: typed fetch client with hooks (`useQuery`-compatible).
- OpenAPI 3.1 output.
- Validation middleware (request body, query, params).
- Permission/entitlement decoration via `@nekostack/auth`.
- Versioning conventions: URL versioning, header versioning, deprecation markers.
- Breaking-change detection: diff two contract versions and report deletions/renames/type-narrows.

### Out of scope
- Authentication itself (login flow). `@nekostack/auth` handles that.
- Real-time / WebSocket transport. `@nekostack/realtime` covers that.
- Webhook receiver primitives — that's `@nekostack/webhooks`.
- gRPC. Could be a future codegen target; not in v1.
- GraphQL. Different paradigm; out of scope.

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §32 for the full capability map.

### Owns
- `defineEndpoint()` contract DSL (method / path / params / query / body / responses)
- Server adapters: Nest, Express, Fastify, Next.js Route Handlers, Hono
- Typed client SDK generation (fetch + React Query hooks)
- OpenAPI 3.1 component + path emission
- API versioning conventions
- Breaking-change diff between two contracts
- Request body / query / param validation middleware

### Does NOT own
| Capability | Lives in |
|---|---|
| Login / session flow | `auth` |
| Webhook reception + dispatch | `webhooks` |
| HTTP client (retry / backoff / circuit-breaker) | `fetch` |
| Real-time / WebSocket / SSE transport | `realtime` |
| Rate limiting at the request layer | `limits` |
| Permission decoration on endpoints | `auth` (we provide the decoration hook; permissions live there) |
| gRPC | out of scope (could be a future codegen target) |
| GraphQL | out of scope (different paradigm) |
| Request-level telemetry events | `telemetry` (we emit; telemetry stores) |

## Competitors and adjacent tools

| Tool | What they do well | Where they fall short for us |
|---|---|---|
| **ts-rest** | Excellent contract-first, Zod-based, TS-native. | Tied to Zod. No first-class multi-server-adapter story. OpenAPI is secondary output. |
| **tRPC** | Excellent DX inside TS-only monorepos. | RPC-flavor — limited interop with non-TS clients, OpenAPI emission is a plugin afterthought. |
| **Hono + zod-openapi** | Modern, fast, OpenAPI-aware. | Tied to Hono; nice library but single-framework. |
| **Stainless** | Contract-first, polished SDK generation. | Commercial, vendor-coupled. Aimed at companies, not solo devs. |
| **OpenAPI Generator** | Generates clients/servers from OpenAPI. | OpenAPI-first; we want code-first contracts compiled *to* OpenAPI. |
| **NestJS + class-validator** | Mature framework with validation. | Nest-specific; types decoupled from runtime validation. |
| **Speakeasy** | OpenAPI-driven SDK generation. | OpenAPI-first; commercial. |

The right framing: this is **ts-rest's contract-first ergonomics combined with Stainless's multi-target codegen, with the schema layer being `@nekostack/schema` (which we also own).** The unique angle is full integration across the NekoStack — auth decoration, telemetry events, lint enforcement, doc generation all wire in for free.

## How this fits the NekoStack

**Depends on:**
- `@nekostack/schema` — defines request/response shapes.
- `@nekostack/auth` — permission/entitlement decoration.
- `@nekostack/telemetry` — emits request-level events.
- `@nekostack/cli` — `neko api generate` regenerates outputs.

**Used by:**
- **NekoVibe** API.
- **NekoBattler** (if/when it grows a backend beyond client-only).
- **NekoSystems** FastAPI backend (Python adapter would be a stretch goal).
- **Leytide** game server.
- Future SaaS products.

## Design philosophy

- **Contract first, code generated.** Endpoints are declared once; code is derived.
- **Schema-typed inputs and outputs.** No `any`. No unsafe casts.
- **OpenAPI 3.1 is canonical.** Even if you never look at the OpenAPI doc, generating it correctly forces you to think about content negotiation, status codes, and error shapes properly.
- **Versioning is explicit, not accidental.** A contract has a version. Breaking changes require bumping it.
- **Deprecate, don't delete.** Endpoints get a `deprecated` flag with a date and replacement reference long before removal.
- **One contract, many adapters.** The same contract becomes a Nest controller in one project and an Express middleware stack in another. The DX is the same.

## Architecture sketch

```
packages/api/
├── src/
│   ├── contract/
│   │   ├── endpoint.ts       # defineEndpoint()
│   │   ├── contract.ts       # composeContract(endpoints)
│   │   └── versioning.ts
│   ├── adapters/
│   │   ├── nest.ts
│   │   ├── express.ts
│   │   ├── fastify.ts
│   │   ├── nextjs.ts
│   │   └── hono.ts
│   ├── client/
│   │   ├── fetch.ts          # typed fetch client
│   │   └── hooks.ts          # React Query / SWR adapters
│   ├── openapi/
│   │   └── emit.ts           # contract → OpenAPI 3.1
│   ├── docs/
│   │   └── markdown.ts       # contract → reference docs
│   ├── diff/
│   │   └── breaking.ts       # compare two contracts for breaking changes
│   └── cli.ts                # `neko api generate / diff`
├── tests/
└── README.md
```

Defining a contract:

```ts
import { defineEndpoint, s } from '@nekostack/api';

export const getPuzzle = defineEndpoint({
  method: 'GET',
  path: '/puzzles/:dayKey/:gameKey',
  params: s.object({ dayKey: s.string(), gameKey: s.enum(['sudoku', 'nonogram']) }),
  query: s.object({ tier: s.enum(['easy', 'medium', 'hard']).default('medium') }),
  response: {
    200: s.object({ puzzleId: s.string().uuid(), payload: s.unknown() }),
    404: s.object({ code: s.literal('PUZZLE_NOT_FOUND') }),
  },
  meta: {
    summary: 'Fetch the canonical daily puzzle.',
    permission: 'puzzle.read',
    rateLimit: '60/min',
  },
});
```

Nest adapter (sketch):

```ts
@Controller()
export class PuzzleController {
  @Endpoint(getPuzzle)
  async getPuzzle(@Input() input: Input<typeof getPuzzle>): Promise<Output<typeof getPuzzle>> {
    /* input is fully typed: { params, query }, validated at the boundary */
  }
}
```

Client (auto-generated):

```ts
const client = createClient<typeof contract>({ baseUrl: '...' });
const puzzle = await client.getPuzzle({ params: { dayKey: '2026-05-15', gameKey: 'sudoku' } });
```

## Roadmap

### v0.1 — Bootstrap
- `defineEndpoint`, `composeContract`.
- Schema integration via `@nekostack/schema`.
- Basic Express adapter.

### v0.2 — More adapters
- Nest, Fastify, Next.js Route Handlers.

### v0.3 — OpenAPI emission
- OpenAPI 3.1 output with full metadata.

### v0.4 — Typed client
- Fetch-based client codegen.
- React Query hook adapter.

### v0.5 — Versioning + diff
- Contract versioning.
- Breaking-change detector (`neko api diff v1 v2`).

### v0.6 — Auth + telemetry integration
- `@nekostack/auth` decoration.
- Request-level telemetry emission.

### v0.7 — Doc generation
- Markdown reference docs.
- Integration with `@nekostack/docs`.

### v1.0 — Stable contract
- Documentation site.
- Migration recipes from ts-rest, Nest+Swagger, hand-rolled controllers.

## Product potential

**Internal use:** Essential. The API spine across every backend project.

**Open source release:** Strong. The contract-first-multi-adapter niche is genuinely undersupplied. ts-rest is the closest competitor and is missing multi-adapter polish. MIT release could attract real users.

**Commercial product:** Plausible as **"managed SDK generation + breaking-change CI"** — similar to Stainless. Mid-priority commercial direction.

**Estimated effort to v1.0:** 12-20 weeks of focused work. Each adapter is a meaningful chunk; client codegen quality is the hard part.

## Status

- **Current:** Empty placeholder. Not started.
- **Owner:** Cody (solo dev project).
- **Priority tier:** Force multiplier. Build after `@nekostack/schema` since it's the foundation.
- **Estimated learning return:** Very high. API contract design, code generation, OpenAPI semantics, adapter abstraction patterns — all foundational web-dev skills.
