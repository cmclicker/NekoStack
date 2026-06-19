# @nekostack/queue

> Job queue substrate: retries, dead-letter queues, deduplication, locking, priority. **Distinct from `jobs`** (which executes jobs; queue is the storage + delivery substrate underneath).

## Quick reference

| | |
|---|---|
| **Build tier** | Background processing â€” substrate layer |
| **Depends on** | `schema` (job payload schemas), `audit` (job lifecycle audited), `telemetry` (queue metrics), `storage` (durable backing if not Redis); external: Redis or PostgreSQL as substrate |
| **Used by** | `jobs` (consumes us as substrate), `webhooks` (retry queue), `email` (send queue), `notify` (digest queue), `billing` (reconciliation), every package doing async work |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 6â€“10 weeks focused |

## Why this exists

`queue` and `jobs` look like the same thing but aren't:

- **`queue`** = the *storage + delivery* substrate: how jobs are persisted, claimed by workers, retried, dead-lettered.
- **`jobs`** = the *execution* layer: scheduled jobs (cron), ad-hoc jobs, worker registration, job definition.

A single project might use the same queue substrate for `jobs`, `webhooks` (retry on failed outbound dispatch), `email` (send-with-retry), `notify` (digest batching). Lifting queue out makes them all share infrastructure.

Building a queue substrate over BullMQ / pg-boss / SQS is justified because:
1. **Unified interface across backends.** Same API regardless of Redis / PostgreSQL / SQS.
2. **Schema-typed payloads.** Job inputs are validated.
3. **NekoStack-conventional retry / DLQ / dedup behavior.** Every consuming package gets the same semantics.

## Scope

### In scope
- Queue interface (enqueue, dequeue, ack, nack).
- Adapters: Redis (via BullMQ), PostgreSQL (via pg-boss), in-memory (dev/test).
- Retry policies (exponential backoff, max attempts).
- Dead-letter queue handling.
- Deduplication (by idempotency key).
- Distributed locking primitives.
- Job priority levels.
- Visibility timeout (claimed-but-not-acked re-delivery).
- Queue metrics (depth, latency, error rate).

### Out of scope
- Job execution / worker definition (`jobs`).
- Cron scheduling (`jobs` + `time`).
- Long-running stateful workflows (`flow`).
- Message broker mechanics (we wrap Redis / pg-boss / SQS; we don't reimplement them).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§34 for the full capability map.

### Owns
- Queue interface + adapter contract
- Adapters: Redis, PostgreSQL, in-memory
- Retry policies + exponential backoff
- Dead-letter queue handling
- Deduplication via idempotency key
- Distributed locking
- Job priority levels
- Visibility timeout
- Queue metrics

### Does NOT own
| Capability | Lives in |
|---|---|
| Worker registration + job execution | `jobs` |
| Cron / scheduled jobs | `jobs` + `time` |
| Long-running workflow state | `flow` |
| Webhook-specific retry | `webhooks` (uses us) |
| Message broker internals | external (Redis / pg-boss / SQS) |
| Audit log | `audit` (we emit) |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **BullMQ** | Mature Redis-based queue. | Redis-only; we wrap it as one adapter. |
| **pg-boss** | Postgres-based queue. | Postgres-only; we wrap it as one adapter. |
| **AWS SQS** | Managed. | AWS-coupled. |
| **Inngest** | Modern serverless queue + workflow. | Vendor-hosted. |
| **Celery** | Python ecosystem standard. | Wrong language. |
| **Custom `setInterval`** | Cheap. | No durability, retry, or DLQ. |

## How this fits the NekoStack

- **`jobs`** is the primary consumer (execution + scheduling layer).
- **`webhooks`** uses us for outbound retry.
- **`email`** for send-with-retry.
- **`notify`** for digest batching.
- **`billing`** for reconciliation jobs.

## Design philosophy

- **Substrate over reinvention.** We wrap BullMQ / pg-boss; we don't write a queue from scratch.
- **Same semantics across adapters.** Switching Redis â†’ PostgreSQL is a config change.
- **DLQ is mandatory.** Jobs that exhaust retries land in DLQ with full audit; never silently lost.
- **Idempotency by default.** Every enqueue accepts an idempotency key.

## Architecture sketch

```
packages/queue/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ interface/
â”‚   â”‚   â”œâ”€â”€ queue.ts          # Queue<T> abstract interface
â”‚   â”‚   â””â”€â”€ job.ts            # Job<T> envelope
â”‚   â”œâ”€â”€ adapters/
â”‚   â”‚   â”œâ”€â”€ redis.ts          # BullMQ-backed
â”‚   â”‚   â”œâ”€â”€ postgres.ts       # pg-boss-backed
â”‚   â”‚   â””â”€â”€ memory.ts         # dev/test
â”‚   â”œâ”€â”€ retry/
â”‚   â”‚   â”œâ”€â”€ policy.ts
â”‚   â”‚   â””â”€â”€ backoff.ts
â”‚   â”œâ”€â”€ dead-letter/
â”‚   â”‚   â””â”€â”€ dlq.ts
â”‚   â”œâ”€â”€ dedup/
â”‚   â”‚   â””â”€â”€ idempotency.ts
â”‚   â”œâ”€â”€ lock/
â”‚   â”‚   â””â”€â”€ distributed.ts
â”‚   â”œâ”€â”€ priority/
â”‚   â”‚   â””â”€â”€ levels.ts
â”‚   â”œâ”€â”€ metrics/
â”‚   â”‚   â””â”€â”€ emit.ts           # to telemetry
â”‚   â””â”€â”€ cli.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Interface + in-memory adapter
### v0.2 â€” Redis adapter (BullMQ)
### v0.3 â€” PostgreSQL adapter (pg-boss)
### v0.4 â€” Retry + DLQ
### v0.5 â€” Dedup + idempotency
### v0.6 â€” Priority + locking
### v0.7 â€” Metrics
### v1.0 â€” Stable API

## Product potential

**Internal:** Required for every product with async work.
**Open source release:** Modest â€” wraps mature substrates.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Background processing â€” substrate.
- **Estimated learning return:** High. Queue semantics, retry/backoff, DLQ patterns, idempotency, distributed locking â€” operational engineering core skills.
