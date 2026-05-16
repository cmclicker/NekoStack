# @nekostack/notify

> Unified notification routing across email + push + in-app + SMS. Per-user channel preferences, batching, digesting, in-app notification center. The router; specific channels live in their own packages.

## Quick reference

| | |
|---|---|
| **Build tier** | SaaS layer |
| **Depends on** | `schema` (notification types), `email` (email channel), `audit` (notification dispatch audited), `time` (digest scheduling), `auth` (per-user prefs), `tenant` (tenant-scoped templates) |
| **Used by** | every product surface that notifies users: NekoVibe (puzzle reminders, achievement unlocks), Leytide (friend invites, party invites), NekoSystems (tenant + workflow notifications), `billing` (receipts, dunning), every SaaS |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 8–12 weeks focused |
| **Sellable?** | Plausible OSS — unified notification routers are surprisingly absent; commercial as part of broader SaaS platform |

## Why this exists

Every product reinvents notification logic per channel: "for this event, send email *and* push *and* in-app". The result is fragmented:

- Email logic in one file, push in another, in-app in a third.
- Per-user preferences ("don't email me at 3am") scattered.
- No unified audit of what was sent.
- Digesting (combining 10 notifications into one email) is rare.
- Cross-channel "did this notification reach the user?" is unanswerable.

`notify` is the router. You declare "user X should receive Notification Y" once; the router applies preferences, picks channels, batches if appropriate, dispatches, and audits.

## Scope

### In scope
- Notification type catalog (registered via `schema`).
- Multi-channel routing (email / push / in-app / SMS, more pluggable).
- Per-user channel preferences.
- Per-notification-type opt-in / opt-out.
- Batching / digesting (combine N notifications into one email).
- In-app notification center / inbox (data layer; UI consumes).
- Activity feed (folded in for v1; could lift to `feed` later).
- Quiet hours (timezone-aware via `time`).
- Delivery receipts.
- Unsubscribe link generation.

### Out of scope
- Email content templating + sending (`email`).
- Push protocol mechanics (Web Push primitives could be a sub-module or external).
- Chat UI (`chat`).
- Comments / annotations on notifications.

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §14 for the full capability map.

### Owns
- Multi-channel notification routing
- Per-user channel preferences
- In-app notification center / inbox (data + activity feed folded in)
- Notification batching / digesting
- Push notifications (Web Push channel sub-module)
- SMS dispatch (channel sub-module, TBD)
- Quiet hours / timezone-aware scheduling
- Delivery receipts
- Unsubscribe link generation

### Does NOT own
| Capability | Lives in |
|---|---|
| Email templating + sending mechanics | `email` |
| Chat infrastructure (real-time conversation) | `chat` |
| Webhook events to external systems | `webhooks` |
| Audit log storage | `audit` (we emit) |
| Receipt + dunning email *content* | `billing` + `email` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **Knock** | Hosted notification platform. | Vendor lock, per-MAU pricing. |
| **Courier** | Similar to Knock. | Same. |
| **Novu** | OSS notification infra. | Closer in spirit; could draw inspiration. |
| **Custom per-channel code** | Common practice. | Fragmented per product. |

## How this fits the NekoStack

- **`email`** is the email channel.
- **`audit`** records dispatch events.
- **`time`** for quiet hours and digest scheduling.
- **`auth`** provides per-user preferences.
- **`telemetry`** receives delivery receipt events.

## Design philosophy

- **Channel-agnostic at the API.** You notify users; the router picks channels based on prefs.
- **Preferences are first-class.** Quiet hours, opt-outs per type, channel preferences.
- **Digesting is built-in.** N notifications in a short window can become one email.
- **In-app inbox is the default.** Every notification has an in-app representation; channels add to it.

## Architecture sketch

```
packages/notify/
├── src/
│   ├── notification/
│   │   ├── type.ts          # Notification catalog
│   │   └── catalog.ts
│   ├── router/
│   │   ├── route.ts         # per-user prefs → channels
│   │   └── dispatch.ts
│   ├── channels/
│   │   ├── email.ts         # delegates to @nekostack/email
│   │   ├── push.ts          # Web Push
│   │   ├── in-app.ts        # in-app center
│   │   └── sms.ts           # TBD
│   ├── preferences/
│   │   ├── user-prefs.ts
│   │   └── opt-out.ts
│   ├── digest/
│   │   ├── batch.ts
│   │   └── schedule.ts
│   ├── inbox/
│   │   ├── center.ts
│   │   └── feed.ts          # activity feed folded
│   ├── quiet-hours/
│   │   └── policy.ts
│   ├── unsubscribe/
│   │   └── link.ts
│   └── cli.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Notification catalog + email channel only
### v0.2 — Web Push channel
### v0.3 — In-app inbox / activity feed
### v0.4 — Per-user preferences
### v0.5 — Digesting + batching
### v0.6 — Quiet hours
### v0.7 — Delivery receipts
### v1.0 — Stable API

## Product potential

**Internal:** Useful across every SaaS-shaped product.
**Open source release:** Plausible — Novu territory.
**Commercial:** Plausible at lower price than Knock / Courier.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** SaaS layer.
- **Estimated learning return:** Moderate-high. Multi-channel routing, batching, preference management, in-app feed design.
