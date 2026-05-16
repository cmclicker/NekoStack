# @nekostack/health

> Health endpoint shape, readiness vs liveness, dependency checks, status-page feed. The "is this service actually working right now?" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Observability |
| **Depends on** | `schema` (health shape), `metrics` (some checks use metrics), `cache` (Redis ping), `storage` (S3 reachability) |
| **Used by** | load balancers (liveness), orchestrators (readiness), monitoring tools (status), `admin` health surface, `env` healthcheck gates |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 3–5 weeks focused |
| **Sellable?** | Low — niche, but well-defined |

## Why this exists

Most projects have a `/health` endpoint that returns `200 OK` always — useless. Real health needs:
- **Liveness** ("process is up") vs **readiness** ("process can serve requests").
- **Dependency checks** (DB reachable, Redis reachable, S3 reachable).
- **Status page data** (which subsystems are degraded).
- **Graceful shutdown** (readiness flips off before liveness).

NekoVibe already implemented a `/health` endpoint we documented; lifting into a package makes it reusable.

## Scope

### In scope
- Liveness vs readiness endpoints.
- Dependency health checks (DB / Redis / S3 / external HTTP / etc.).
- Status aggregation (overall = green/yellow/red).
- Graceful-shutdown coordination.
- Status-page data feed.
- Framework adapters.

### Out of scope
- Metrics (`metrics`).
- Logs (`log`).
- Tracing (`trace`).
- Errors (`errors`).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §20 for the full capability map.

### Owns
- `/health` and `/ready` endpoint shape
- Readiness vs liveness semantics
- Dependency health checks
- Status aggregation
- Graceful-shutdown coordination
- Status-page data feed

### Does NOT own
| Capability | Lives in |
|---|---|
| Metrics | `metrics` |
| Logs | `log` |
| Tracing | `trace` |
| Errors | `errors` |
| Audit | `audit` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **Custom /health endpoint** | Common. | Often unsubstantive. |
| **terminus** | Nest-coupled. | Framework-specific. |
| **Cloud probes (AWS / GCP)** | Cloud-side. | Need our endpoint to call. |

## How this fits the NekoStack

- **`metrics`** values feed some checks.
- **`env`** uses our endpoint for healthcheck gates.
- **`admin`** shows status data.

## Design philosophy

- **Liveness vs readiness is meaningful.** Liveness is "process is up." Readiness is "I can serve traffic." Different probes.
- **Dependencies are checked, not assumed.** DB / Redis / S3 reachability is real.
- **Graceful shutdown.** Readiness flips off N seconds before the process stops; load balancers stop sending traffic.

## Architecture sketch

```
packages/health/
├── src/
│   ├── endpoints/
│   │   ├── liveness.ts
│   │   └── readiness.ts
│   ├── checks/
│   │   ├── db.ts
│   │   ├── redis.ts
│   │   ├── s3.ts
│   │   └── http.ts
│   ├── aggregate/
│   │   └── status.ts
│   ├── shutdown/
│   │   └── graceful.ts
│   ├── status-page/
│   │   └── feed.ts
│   └── adapters/
│       ├── nest.ts
│       └── express.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Liveness + readiness endpoints
### v0.2 — Dependency checks (DB / Redis / S3 / HTTP)
### v0.3 — Status aggregation
### v0.4 — Graceful shutdown
### v0.5 — Status-page feed
### v1.0 — Stable API

## Product potential

**Internal:** Universal.
**Open source release:** Marginal.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Observability.
- **Estimated learning return:** Moderate. Liveness/readiness distinction, dependency checks, graceful shutdown patterns.
