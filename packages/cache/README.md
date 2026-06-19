# @nekostack/cache

> Declarative multi-layer caching: memory + Redis + CDN. Invalidation strategies. Stale-while-revalidate. The second-hardest problem in CS, packaged.

## Quick reference

| | |
|---|---|
| **Build tier** | Data layer |
| **Depends on** | `schema` (cache key shape), `telemetry` (hit/miss metrics), `time` (TTLs); external: Redis |
| **Used by** | every backend with non-trivial reads: `api` (response caching), `auth` (session cache), `entitlements` (decision cache), `codex` (entity cache), `search` (query result cache), every product |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 6â€“10 weeks focused |

## Why this exists

Caching is famously hard. The two hard problems:
1. **Naming things.**
2. **Cache invalidation.**

Every product reinvents both. The typical messes:
- Multi-layer caches (memory + Redis) drift between layers.
- Invalidation is "let it expire" because actual invalidation is too hard.
- Stale-while-revalidate is never implemented because timing is fiddly.
- Cache keys are stringly-typed, prone to collisions.
- Hit/miss observability is missing, so you can't tell if the cache is helping.

`cache` handles these patterns once. Declarative API: "cache this read for 5min, invalidate on event X."

## Scope

### In scope
- Multi-layer cache (memory + Redis; CDN-tier optional via headers).
- Declarative `cached()` wrapper for functions.
- TTL + stale-while-revalidate.
- Tag-based invalidation (invalidate all entries tagged X).
- Event-driven invalidation (invalidate on event Y from `events`).
- Hit/miss/refresh metrics via `telemetry`.
- Typed cache keys (no string-key typo bugs).
- Negative caching (cache "not found").

### Out of scope
- HTTP response caching policy generation (we provide values; HTTP headers are `api`'s job).
- Browser-side cache (different layer).
- Database query result caching (consumer-side via Prisma extensions).
- CDN configuration (vendor-specific).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§24 for the full capability map.

### Owns
- Multi-layer cache (memory + Redis)
- Declarative cached() wrapper
- TTL + stale-while-revalidate
- Tag-based invalidation
- Event-driven invalidation (via `events`)
- Hit/miss metrics
- Typed cache keys
- Negative caching

### Does NOT own
| Capability | Lives in |
|---|---|
| HTTP cache headers | `api` |
| Browser caching | external |
| CDN config | vendor-specific |
| Database query caching | consumer (Prisma extensions etc.) |
| Redis itself | external substrate |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **ioredis** | Redis client. | Just substrate. |
| **lru-cache** | In-memory LRU. | One layer, no invalidation orchestration. |
| **next-cache** / framework caches | Framework-coupled. | Framework-specific. |
| **Custom cache wrapper** | Common. | Drift, no observability. |

## How this fits the NekoStack

- **`telemetry`** receives hit/miss events.
- **`time`** for TTL math.
- **`events`** for event-driven invalidation.
- **`schema`** for typed cache keys.

## Design philosophy

- **Declarative > imperative.** Wrap the function, don't manually `get` / `set`.
- **Multi-layer transparent.** Memory hits first; Redis on miss; both populated.
- **Invalidation is first-class.** Tags + events make invalidation cheap.
- **Observability built-in.** Every cache call emits telemetry.

## Architecture sketch

```
packages/cache/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ layers/
â”‚   â”‚   â”œâ”€â”€ memory.ts
â”‚   â”‚   â””â”€â”€ redis.ts
â”‚   â”œâ”€â”€ wrapper/
â”‚   â”‚   â””â”€â”€ cached.ts          # declarative wrapper
â”‚   â”œâ”€â”€ ttl/
â”‚   â”‚   â”œâ”€â”€ expiry.ts
â”‚   â”‚   â””â”€â”€ swr.ts             # stale-while-revalidate
â”‚   â”œâ”€â”€ invalidate/
â”‚   â”‚   â”œâ”€â”€ tag.ts
â”‚   â”‚   â”œâ”€â”€ event.ts           # via events package
â”‚   â”‚   â””â”€â”€ manual.ts
â”‚   â”œâ”€â”€ keys/
â”‚   â”‚   â””â”€â”€ typed.ts
â”‚   â”œâ”€â”€ metrics/
â”‚   â”‚   â””â”€â”€ emit.ts
â”‚   â””â”€â”€ cli.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Memory layer + cached() wrapper
### v0.2 â€” Redis layer
### v0.3 â€” TTL + SWR
### v0.4 â€” Tag invalidation
### v0.5 â€” Event-driven invalidation
### v0.6 â€” Typed keys
### v0.7 â€” Metrics
### v1.0 â€” Stable API

## Product potential

**Internal:** Used everywhere.
**Open source release:** Plausible â€” declarative multi-layer cache is undersupplied.
**Commercial:** Marginal.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Data layer.
- **Estimated learning return:** High. Cache coherence, invalidation strategies, SWR semantics, observability of cache effectiveness.
