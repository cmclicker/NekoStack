# @nekostack/audit

> Tamper-evident audit log infrastructure. Append-only, hash-chained, queryable. The compliance-grade record of "who did what, when." Distinct from `log` (debug), `telemetry` (analytics), `trace` (spans), `events` (event sourcing).

## Quick reference

| | |
|---|---|
| **Build tier** | Observability â€” compliance-grade |
| **Depends on** | `schema` (audit record shape), `crypto` (hash chain), `tenant` (tenant scope), `time`, `storage` (durable log storage) |
| **Used by** | `auth` (AccessDecision audits), `permissions` (role changes), `entitlements` (denials), `flags` (changes), `billing` (subscription changes), `governance` (waivers), `actions` (action audit), `secrets` (access audit), `import` / `export` (data movement audit), every sensitive operation |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 8â€“12 weeks focused |

## Why this exists

Audit is not logging. Audit answers: "show me the immutable, hash-chained, queryable record of every authority-bearing action in the last 7 years that affected user X, with cryptographic proof nothing was deleted or modified."

Logging is for engineers debugging. Audit is for: compliance auditors, legal discovery, security incident investigation, regulatory request response, user-facing "show me my activity" features.

The right shape for audit is fundamentally different from logging:
- **Append-only** (no UPDATE / DELETE).
- **Hash-chained** (tamper-evident: changing any prior record breaks the chain).
- **Retention-policy-governed** (years, not days).
- **Schema-typed** (every event has a known shape).
- **Tenant-scoped** (query by tenant, never cross-leak).

## Scope

### In scope
- Audit event records (typed via `schema`).
- Append-only storage (`storage` substrate).
- Hash-chain tamper evidence.
- Retention policies (per-tenant, per-event-type).
- Tenant-scoped audit query.
- Subject-scoped query ("everything about user X").
- Audit feed for end users (their own activity).
- Export of audit records (via `export`).
- Sink: receives events from auth, permissions, entitlements, flags, billing, governance, actions, secrets, import, export.

### Out of scope
- Runtime debug logging (`log`).
- Product analytics events (`telemetry`).
- Distributed tracing spans (`trace`).
- Event sourcing as source-of-truth (`events`).
- Performance metrics (`metrics`).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§21 for the full capability map.

### Owns
- Audit event records
- Append-only log storage
- Hash-chain tamper evidence
- Audit retention (policies cooperate with `compliance`)
- Audit query / browse
- Tenant-scoped + subject-scoped queries

### Does NOT own
| Capability | Lives in |
|---|---|
| Runtime debug logging | `log` |
| Product analytics events | `telemetry` |
| Distributed tracing | `trace` |
| Error tracking | `errors` |
| Performance metrics | `metrics` |
| Health probes | `health` |
| Event sourcing source-of-truth | `events` |
| Compliance evidence collection | `compliance` (uses us) |
| Retention policy *definition* (vs enforcement) | `compliance` |
| Hash / signature primitives | `crypto` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **AWS CloudTrail** | Cloud-native audit. | AWS-coupled, infra-level. |
| **Datadog Audit** | Observability platform. | Enterprise pricing, not compliance-grade by default. |
| **Custom audit table** | Common practice. | No hash chain, no tamper evidence, drift. |
| **Cerbos audit log** | Authorization-focused. | Just for authorization decisions. |

## How this fits the NekoStack

- Receives events from many other packages (sink role).
- **`compliance`** sets retention policies.
- **`storage`** is the durable substrate.
- **`crypto`** provides hash primitives.
- **`tenant`** scopes records.

## Design philosophy

- **Append-only or it didn't happen.** No UPDATE / DELETE paths in the API.
- **Hash chain is non-negotiable.** Every record references the previous record's hash; the chain proves no tampering.
- **Typed events.** Audit records aren't free-form `{}` blobs.
- **Tenant isolation is enforced at the storage layer.**
- **Retention is policy-driven.** Different event types have different retention requirements.

## Architecture sketch

```
packages/audit/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ record/
â”‚   â”‚   â”œâ”€â”€ event.ts          # AuditEvent type
â”‚   â”‚   â””â”€â”€ catalog.ts        # registered event kinds
â”‚   â”œâ”€â”€ chain/
â”‚   â”‚   â”œâ”€â”€ hash.ts           # SHA-256 chaining
â”‚   â”‚   â””â”€â”€ verify.ts         # chain integrity check
â”‚   â”œâ”€â”€ storage/
â”‚   â”‚   â”œâ”€â”€ append.ts         # append-only writes
â”‚   â”‚   â””â”€â”€ adapter.ts        # SQLite / Postgres / S3
â”‚   â”œâ”€â”€ query/
â”‚   â”‚   â”œâ”€â”€ by-tenant.ts
â”‚   â”‚   â”œâ”€â”€ by-subject.ts
â”‚   â”‚   â”œâ”€â”€ by-actor.ts
â”‚   â”‚   â””â”€â”€ by-time.ts
â”‚   â”œâ”€â”€ retention/
â”‚   â”‚   â”œâ”€â”€ policy.ts
â”‚   â”‚   â””â”€â”€ enforce.ts        # delete expired records
â”‚   â”œâ”€â”€ export/
â”‚   â”‚   â””â”€â”€ via-export.ts     # integration with @nekostack/export
â”‚   â””â”€â”€ cli.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Audit event schema + append
### v0.2 â€” Hash chain
### v0.3 â€” Query API (tenant / subject / actor / time)
### v0.4 â€” Retention enforcement
### v0.5 â€” Verification (`audit verify` reports chain integrity)
### v0.6 â€” Export integration
### v1.0 â€” Stable API

## Product potential

**Internal:** Critical for any product with compliance / regulatory exposure.
**Open source release:** Plausible â€” tamper-evident audit library is undersupplied.
**Commercial:** Real â€” compliance tooling is a growing market.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Observability / compliance.
- **Estimated learning return:** Very high. Append-only log design, hash chains, retention enforcement, audit query patterns â€” foundational compliance + security engineering.
