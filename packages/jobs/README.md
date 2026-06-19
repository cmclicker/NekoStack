# @nekostack/jobs

> Scheduled and ad-hoc job execution. Worker registration, cron scheduling (via `time`), job definition. Uses `queue` as the storage substrate; uses `time` for recurrence.

## Quick reference

| | |
|---|---|
| **Build tier** | Background processing â€” execution layer |
| **Depends on** | `queue` (substrate), `time` (RRULE / cron), `schema` (job definitions), `audit`, `telemetry` (execution metrics), `errors` |
| **Used by** | every package needing scheduled work: `email` (digest scheduler), `notify` (batch digests), `billing` (Stripe reconciliation), `backup` (scheduled snapshots), `compliance` (retention enforcement runs), `telemetry` (cleanup jobs), product-side daily-puzzle generation, etc. |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 6â€“10 weeks focused |

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

A consuming product writes `defineJob` and gets scheduling, worker execution, retries, DLQ, audit, metrics â€” all wired up.

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

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§34 for the full capability map.

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

- **Jobs are definitions, not closures.** A job has a name, a schedule, a handler â€” all registerable + auditable.
- **Idempotent handlers expected.** Retries happen; handlers must tolerate.
- **Concurrency is per-job.** Some jobs run one-at-a-time (DB migrations), others fan out.

## Architecture sketch

```
packages/jobs/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ define/
â”‚   â”‚   â””â”€â”€ job.ts
â”‚   â”œâ”€â”€ worker/
â”‚   â”‚   â”œâ”€â”€ register.ts
â”‚   â”‚   â”œâ”€â”€ run.ts
â”‚   â”‚   â””â”€â”€ concurrency.ts
â”‚   â”œâ”€â”€ schedule/
â”‚   â”‚   â”œâ”€â”€ cron.ts           # via time
â”‚   â”‚   â””â”€â”€ ad-hoc.ts
â”‚   â”œâ”€â”€ audit/
â”‚   â”‚   â””â”€â”€ emit.ts
â”‚   â””â”€â”€ cli.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Job definition + ad-hoc enqueue
### v0.2 â€” Worker registration
### v0.3 â€” Cron scheduling via time
### v0.4 â€” Concurrency limits
### v0.5 â€” Audit + telemetry
### v1.0 â€” Stable API

## Product potential

**Internal:** Required for any product with scheduled work.
**Open source release:** Modest.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Background processing.
- **Estimated learning return:** Moderate. Worker pools, concurrency, scheduling.
