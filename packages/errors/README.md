# @nekostack/errors

> Typed error classes + codes, error grouping, alerting, retryability classification. Sentry-alike functionality as a typed library. The "what broke and what does it mean?" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Observability |
| **Depends on** | `schema` (error shape), `log` (error logs flow here), `trace` (correlated traces), `tenant` |
| **Used by** | every backend; `api` (error response shaping), `jobs` (handler failures), every package throwing typed errors |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 6–10 weeks focused |
| **Sellable?** | Modest — Sentry dominates but TS-native library angle exists |

## Why this exists

Errors are typically `new Error('something failed')` — string-based, untyped, ungrouped. Production needs:
- **Typed errors** with codes (so client code can branch).
- **Error grouping** (1000 instances of the same error = 1 group).
- **User-safe vs internal messages** (the user sees "Please try again"; logs see the stack).
- **Retryability** (is this transient? should I retry?).
- **Severity** (is this CRITICAL or just NOTICE?).
- **Alerting** (page someone on critical errors).

## Scope

### In scope
- Typed error classes with `code` + `severity` + `retryable` + `userMessage`.
- Error grouping (fingerprinting + dedup).
- Alerting integration (Sentry / Slack / PagerDuty via adapters).
- Retryability classification.
- User-safe message rendering.
- Stack capture + sanitization.
- Frame stripping (don't expose internal paths).
- Bridge from `log` (error-level logs become error records).

### Out of scope
- Logs (`log`).
- Telemetry events (`telemetry`).
- Audit (`audit`).
- Health (`health`).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §19 for the full capability map.

### Owns
- Typed error classes / codes
- Error grouping / fingerprinting
- Alerting integration
- Retryability classification
- User-safe vs internal messages
- Stack sanitization
- Error log bridge

### Does NOT own
| Capability | Lives in |
|---|---|
| Logs | `log` |
| Telemetry | `telemetry` |
| Audit | `audit` |
| Health probes | `health` |
| Metrics | `metrics` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **Sentry** | Industry standard. | Hosted, paid at scale. |
| **Highlight.io** | Open-source alternative. | Service-shaped. |
| **Custom `Error` subclasses** | Cheap. | No grouping, no alerting. |

## How this fits the NekoStack

- **`log`** routes error-level entries to us.
- **`trace`** correlates errors with spans.
- **`api`** renders user-safe responses from us.
- **`jobs`** classifies handler failures via us.

## Design philosophy

- **Typed errors > strings.** Subclasses with `code` are the norm.
- **User vs internal split.** Two messages per error.
- **Grouping by fingerprint.** Stack-based fingerprint dedups similar errors.
- **Retryability is explicit.** `transient: true` lets handlers know.

## Architecture sketch

```
packages/errors/
├── src/
│   ├── classes/
│   │   ├── base.ts           # NekoStackError
│   │   ├── code.ts           # error codes registry
│   │   └── subclasses/
│   ├── grouping/
│   │   └── fingerprint.ts
│   ├── alert/
│   │   ├── sentry.ts
│   │   ├── slack.ts
│   │   └── pagerduty.ts
│   ├── retryable/
│   │   └── classify.ts
│   ├── messages/
│   │   ├── user.ts
│   │   └── internal.ts
│   ├── stack/
│   │   └── sanitize.ts
│   └── bridge/
│       └── from-log.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Base typed errors + codes
### v0.2 — Grouping / fingerprinting
### v0.3 — User-safe message rendering
### v0.4 — Retryability classification
### v0.5 — Alerting adapters
### v0.6 — Stack sanitization
### v0.7 — Log bridge
### v1.0 — Stable API

## Product potential

**Internal:** Universal.
**Open source release:** Plausible — TS-native error-tracking library is undersupplied.
**Commercial:** Sentry / Highlight dominate; tough commercial play.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Observability.
- **Estimated learning return:** High. Typed error design, fingerprinting, retryability classification — universally applicable.
