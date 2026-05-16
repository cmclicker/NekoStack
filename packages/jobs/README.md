# @nekostack/jobs

> Scheduled and ad-hoc job execution. Worker registration, cron scheduling (via `time`), job definition. Uses `queue` as the storage substrate; uses `time` for recurrence.

## Quick reference

| | |
|---|---|
| **Build tier** | Background processing — execution layer |
| **Depends on** | `queue` (substrate), `time` (RRULE / cron), `schema` (job definitions), `audit`, `telemetry` (execution metrics), `errors` |
| **Used by** | every package needing scheduled work: `email` (digest scheduler), `notify` (batch digests), `billing` (Stripe reconciliation), `backup` (scheduled snapshots), `compliance` (retention enforcement runs), `telemetry` (cleanup jobs), product-side daily-puzzle generation, etc. |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 6–10 weeks focused |
| **Sellable?** | Modest — BullMQ Pro / Inngest territory |

## Why this exists

`queue` is the substrate. `jobs` is the developer-facing API:

```ts
defineJob('email.daily-digest', {
  schedule: 'FREQ=DAILY;BYHOUR=8',  // via time
  handler: async (ctx) => { /* ... */ },
  retries: 3,
  priority: 'normal',
});
```

A consuming product writes `defineJob` and gets scheduling, worker execution, retries, DLQ, audit, metrics — all wired up.

## Scope

### In scope
- Job definition DSL.
- Worker registration (which jobs this process handles).
- Cron scheduling via `time` RRULE.
- Ad-hoc enqueue (`jobs.run('name', input)`).
- Job execution with retry / DLQ via `queue`.
- Concurrency limits per job.
- Audit on every execution.
- Telemetry on duration / success / failure.
- CLI: `neko jobs list / run / status / retry-dlq`.

### Out of scope
- Queue substrate (`queue`).
- Time / RRULE primitives (`time`).
- Long-running stateful workflow (`flow`).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §34 for the full capability map.

### Owns
- Job definition + worker registration
- Cron scheduling (uses `time` for RRULE)
- Ad-hoc job enqueue
- Concurrency limits per job
- Audit / telemetry of executions
- CLI for job management

### Does NOT own
| Capability | Lives in |
|---|---|
| Queue storage / delivery | `queue` |
| Date / RRULE / cadence primitives | `time` |
| Long-running stateful workflow | `flow` |
| Webhook-specific retry queues | `webhooks` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **BullMQ** | Combined queue + worker. | We split queue + jobs; BullMQ does both. |
| **Inngest** | Serverless durable execution. | Vendor-hosted. |
| **Temporal** | Workflow orchestration. | Closer to `flow` than `jobs`. |
| **node-cron** | Cron in Node. | No durability, no DLQ, in-process only. |

## How this fits the NekoStack

- **`queue`** is the durable substrate.
- **`time`** provides RRULE primitives.
- **`audit`** records executions.
- **`telemetry`** receives metrics.
- **`errors`** captures handler failures.

## Design philosophy

- **Jobs are definitions, not closures.** A job has a name, a schedule, a handler — all registerable + auditable.
- **Idempotent handlers expected.** Retries happen; handlers must tolerate.
- **Concurrency is per-job.** Some jobs run one-at-a-time (DB migrations), others fan out.

## Architecture sketch

```
packages/jobs/
├── src/
│   ├── define/
│   │   └── job.ts
│   ├── worker/
│   │   ├── register.ts
│   │   ├── run.ts
│   │   └── concurrency.ts
│   ├── schedule/
│   │   ├── cron.ts           # via time
│   │   └── ad-hoc.ts
│   ├── audit/
│   │   └── emit.ts
│   └── cli.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Job definition + ad-hoc enqueue
### v0.2 — Worker registration
### v0.3 — Cron scheduling via time
### v0.4 — Concurrency limits
### v0.5 — Audit + telemetry
### v1.0 — Stable API

## Product potential

**Internal:** Required for any product with scheduled work.
**Open source release:** Modest.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Background processing.
- **Estimated learning return:** Moderate. Worker pools, concurrency, scheduling.
