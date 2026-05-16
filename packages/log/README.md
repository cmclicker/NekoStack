# @nekostack/log

> Structured runtime logging. Levels, tagged context, correlation IDs, redaction, multi-sink output. **Distinct from `telemetry`** (analytics), **`audit`** (compliance), **`trace`** (spans).

## Quick reference

| | |
|---|---|
| **Build tier** | Observability |
| **Depends on** | `schema` (log record shape), `secure` (redaction), `trace` (correlation ID injection), `secrets` (secret-tagged-value scrubbing) |
| **Used by** | every backend; every package emits debug/info/warn/error/fatal |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 4–6 weeks focused |
| **Sellable?** | Low — pino / winston dominate; library-level integration |

## Why this exists

Generic logging libraries are fine substrates. NekoStack needs them wired into the broader observability stack:
- Correlation IDs auto-propagated from `trace`.
- Secret-tagged values auto-scrubbed via `secrets`.
- PII auto-scrubbed via `secure`.
- Errors auto-bridged to `errors` package.
- Logs auto-correlate with `trace` spans.

`log` is the wrapper that gets all of that right by default.

## Scope

### In scope
- Structured logger (JSON output by default; pretty in dev).
- Levels: trace / debug / info / warn / error / fatal.
- Tagged / contextual logs (child loggers with bound context).
- Correlation ID injection (from `trace`).
- Request / run / session IDs.
- Secret + PII redaction at log time.
- Multi-sink output (console / file / OTLP).
- Log-to-audit bridge for sensitive log entries.

### Out of scope
- Analytics events (`telemetry`).
- Compliance audit log (`audit`).
- Distributed tracing spans (`trace`).
- Error tracking (`errors`, though we bridge).
- Metrics (`metrics`).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §15 for the full capability map.

### Owns
- Structured logger interface
- Log levels
- Log formatting (JSON + pretty)
- Tagged / contextual logs
- Correlation / request / run IDs
- Secret + PII redaction
- Multi-sink output
- Log-to-audit bridge

### Does NOT own
| Capability | Lives in |
|---|---|
| Analytics events | `telemetry` |
| Compliance audit log | `audit` |
| Distributed tracing spans | `trace` |
| Error tracking | `errors` |
| Metrics | `metrics` |
| Health probes | `health` |
| PII detection / redaction primitives | `secure` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **pino** | Fast, mature. | Substrate; we wrap. |
| **winston** | Older mature. | Same. |
| **bunyan** | Stale. | Stale. |
| **`console.log`** | Default. | No structure. |

## How this fits the NekoStack

- **`trace`** injects correlation IDs.
- **`secure`** + **`secrets`** scrub.
- **`errors`** receives error-level logs.
- **`audit`** receives flagged sensitive logs.

## Design philosophy

- **Structured > string.** Always emit objects; format at the sink.
- **Redaction is automatic.** Secret-tagged values never appear in logs.
- **Correlation is automatic.** Span IDs propagate without manual passing.
- **Pretty in dev, JSON in prod.**

## Architecture sketch

```
packages/log/
├── src/
│   ├── logger/
│   │   ├── core.ts
│   │   ├── child.ts          # contextual child loggers
│   │   └── levels.ts
│   ├── format/
│   │   ├── json.ts
│   │   └── pretty.ts
│   ├── correlation/
│   │   └── inject.ts         # from trace
│   ├── redact/
│   │   ├── secret.ts         # via secrets
│   │   └── pii.ts            # via secure
│   ├── sinks/
│   │   ├── console.ts
│   │   ├── file.ts
│   │   └── otlp.ts
│   ├── bridge/
│   │   ├── audit.ts
│   │   └── errors.ts
│   └── cli.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Pino wrapper with NekoStack defaults
### v0.2 — Contextual child loggers
### v0.3 — Trace correlation
### v0.4 — Redaction
### v0.5 — Multi-sink
### v0.6 — Audit + error bridges
### v1.0 — Stable API

## Product potential

**Internal:** Universal.
**Open source release:** Marginal.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Observability.
- **Estimated learning return:** Moderate. Structured logging discipline, redaction patterns, sink architecture.
