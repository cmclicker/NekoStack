# @nekostack/errors

> Typed error classes + codes, error grouping, alerting, retryability classification. Sentry-alike functionality as a typed library. The "what broke and what does it mean?" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Observability |
| **Depends on** | `schema` (error shape), `log` (error logs flow here), `trace` (correlated traces), `tenant` |
| **Used by** | every backend; `api` (error response shaping), `jobs` (handler failures), every package throwing typed errors |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 6â€“10 weeks focused |

## Why this exists

Errors are typically `new Error('something failed')` â€” string-based, untyped, ungrouped. Production needs:
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

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§19 for the full capability map.

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
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ classes/
â”‚   â”‚   â”œâ”€â”€ base.ts           # NekoStackError
â”‚   â”‚   â”œâ”€â”€ code.ts           # error codes registry
â”‚   â”‚   â””â”€â”€ subclasses/
â”‚   â”œâ”€â”€ grouping/
â”‚   â”‚   â””â”€â”€ fingerprint.ts
â”‚   â”œâ”€â”€ alert/
â”‚   â”‚   â”œâ”€â”€ sentry.ts
â”‚   â”‚   â”œâ”€â”€ slack.ts
â”‚   â”‚   â””â”€â”€ pagerduty.ts
â”‚   â”œâ”€â”€ retryable/
â”‚   â”‚   â””â”€â”€ classify.ts
â”‚   â”œâ”€â”€ messages/
â”‚   â”‚   â”œâ”€â”€ user.ts
â”‚   â”‚   â””â”€â”€ internal.ts
â”‚   â”œâ”€â”€ stack/
â”‚   â”‚   â””â”€â”€ sanitize.ts
â”‚   â””â”€â”€ bridge/
â”‚       â””â”€â”€ from-log.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Base typed errors + codes
### v0.2 â€” Grouping / fingerprinting
### v0.3 â€” User-safe message rendering
### v0.4 â€” Retryability classification
### v0.5 â€” Alerting adapters
### v0.6 â€” Stack sanitization
### v0.7 â€” Log bridge
### v1.0 â€” Stable API

## Product potential

**Internal:** Universal.
**Open source release:** Plausible â€” TS-native error-tracking library is undersupplied.
**Commercial:** Sentry / Highlight dominate; tough commercial play.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Observability.
- **Estimated learning return:** High. Typed error design, fingerprinting, retryability classification â€” universally applicable.
