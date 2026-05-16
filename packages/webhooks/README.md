# @nekostack/webhooks

> Webhook receiver + dispatcher with signature verification, idempotency, retry queues. The substrate for Stripe / GitHub / generic third-party callbacks. Distinct from `realtime` (persistent connections) and `api` (request-response).

## Quick reference

| | |
|---|---|
| **Build tier** | SaaS layer |
| **Depends on** | `schema` (webhook payload schemas), `audit` (deliveries audited), `crypto` (signature verification), `queue` (retry queue), `secrets` (webhook signing secrets), `fetch` (outbound dispatch) |
| **Used by** | `billing` (Stripe webhooks), any product receiving callbacks from third parties; outbound: any product calling consumer webhooks |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 4–8 weeks focused |
| **Sellable?** | Modest — Svix / Hookdeck commercialize this; library-level integration value |

## Why this exists

Webhooks are deceptively hard:
- **Inbound** verification (HMAC signatures must match), idempotency (the same event arrives twice), replay protection (don't process events from 6 months ago).
- **Outbound** delivery: target endpoint slow → retry with backoff, target fails 10x → dead-letter, signature generation, replay protection on consumer side.

Hand-rolling per product means each gets it wrong differently. `webhooks` solves it once.

## Scope

### In scope
- Inbound: signature verification (HMAC-SHA256), idempotency cache, replay protection.
- Handler registration API.
- Outbound: dispatcher with retry queue + dead-letter.
- Signature generation for outbound.
- Webhook subscription management (which consumers should get which events).
- Audit on delivery + failure.

### Out of scope
- Webhook UI for end users.
- Real-time / WebSocket transport (`realtime`).
- Job queue substrate (`queue` — we use it).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §32 for the full capability map.

### Owns
- Inbound webhook reception + verification
- Idempotency cache
- Outbound dispatch + retry
- Signature generation / verification
- Subscription management (which consumers, which events)

### Does NOT own
| Capability | Lives in |
|---|---|
| Real-time persistent connections | `realtime` |
| Job queue primitives | `queue` |
| HMAC / signing primitives | `crypto` |
| Audit log | `audit` |
| Stripe-specific webhook handling | `billing` (uses us) |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **Svix** | Hosted outbound webhooks. | Vendor lock. |
| **Hookdeck** | Hosted webhook infra. | Same. |
| **Custom Express handlers** | Common. | Reinvented per product. |

## How this fits the NekoStack

- **`billing`** registers Stripe webhook handlers via us.
- **`queue`** is the retry substrate.
- **`crypto`** for HMAC.
- **`audit`** records all dispatches.

## Design philosophy

- **Idempotency is mandatory.** Every webhook event has an idempotency key; replays are dropped.
- **Retries with exponential backoff.** Outbound dispatch retries up to N times.
- **Dead-letter audited.** When retries exhaust, the event lands in DLQ with full audit.
- **Signature verification is non-negotiable for inbound.** Reject anything without a valid signature.

## Architecture sketch

```
packages/webhooks/
├── src/
│   ├── inbound/
│   │   ├── receive.ts
│   │   ├── verify.ts         # HMAC
│   │   ├── idempotency.ts
│   │   └── replay-protect.ts
│   ├── outbound/
│   │   ├── dispatch.ts
│   │   ├── retry.ts
│   │   ├── dead-letter.ts
│   │   └── sign.ts
│   ├── subscriptions/
│   │   └── manage.ts
│   ├── handlers/
│   │   └── register.ts
│   └── cli.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Inbound receive + verify + idempotency
### v0.2 — Handler registration
### v0.3 — Outbound dispatch + signing
### v0.4 — Retry queue + dead-letter
### v0.5 — Subscription management
### v1.0 — Stable API

## Product potential

**Internal:** Useful across SaaS + integration work.
**Open source release:** Plausible — Svix-alike.
**Commercial:** Svix / Hookdeck dominate; tough commercial play.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** SaaS layer.
- **Estimated learning return:** High. Signature schemes, idempotency, retry with backoff, dead-letter patterns.
