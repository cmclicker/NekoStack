# @nekostack/billing

> Stripe integration, subscription lifecycle, invoicing, dunning, receipts. The payment-money layer. Distinct from entitlements (which is the *logic* layer that billing feeds into).

## Quick reference

| | |
|---|---|
| **Build tier** | SaaS layer â€” build when first product is ready to monetize, not before |
| **Depends on** | `schema` (billing event shapes), `entitlements` (plan state sync), `telemetry` (billing events), `audit` (every action audited), `webhooks` (Stripe webhook receiver), `email` (receipts + dunning); Stripe SDK |
| **Used by** | NekoVibe Plus (when monetized), NekoSystems tier, future retail-ops / EdTech subscriptions |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 8â€“16 weeks focused |

## Why this exists

The moment any NekoStack product accepts money, you need:

- Customer creation and identity reconciliation (Stripe customer ID â†” tenant ID).
- Subscription creation, upgrade, downgrade, cancellation.
- Trial start / end / extension.
- Webhook reception with signature verification, idempotency, and proper retry handling.
- Failed payment flows (dunning) with grace periods and recovery emails.
- Invoice generation and downloadable receipts.
- Tax handling (Stripe Tax integration).
- Proration on plan changes.
- Refunds and credit notes.
- Reconciliation: do my entitlement records match Stripe's subscription state?

Stripe's API is excellent, but you still have to build all of that on top. Every project either reinvents it badly, gets it 70% right and lives with subtle bugs, or pays a startup-to-startup integrator like LemonSqueezy / Paddle that wraps it. Most of those integrators are great, but the lock-in is real (e.g., merchant-of-record relationships are hard to unwind).

`@nekostack/billing` is the Stripe integration layer for the NekoStack. It handles the webhook lifecycle, syncs subscription state into our database, and emits events that `@nekostack/entitlements` listens to. Building it once means every NekoStack product that monetizes uses the same lifecycle and the same UX.

Building this yourself rather than using LemonSqueezy, Paddle, or Lago is justified because:
1. **Stripe is best-in-class for direct integration.** Avoiding it usually trades simplicity for inflexibility.
2. **Merchant-of-record control.** With LemonSqueezy/Paddle, *they* are the merchant of record. With Stripe direct, you are.
3. **Entitlement integration.** A direct Stripe wrapper can emit events into our exact entitlements model without translation.
4. **Learning the Stripe API end-to-end.** Subscription lifecycle, webhook patterns, idempotency â€” all transferable.

## Scope

### In scope
- Stripe customer / subscription / payment-method management.
- Plan price-id mapping (Stripe price IDs â†” NekoStack plan names).
- Subscription lifecycle: create, upgrade, downgrade, cancel, reactivate.
- Trial start / end / extend.
- Webhook receiver: signature verification, idempotency, replay handling.
- Stripe Tax integration.
- Proration calculation on plan changes.
- Refund / credit-note creation.
- Invoice retrieval and PDF download.
- Reconciliation job: detect drift between Stripe state and local state.
- Customer portal redirect helpers.

### Out of scope
- Direct ACH / wire / crypto payments. Stripe handles cards + bank-account flows; other rails are out.
- Merchant-of-record functionality. We assume direct Stripe integration; not LemonSqueezy-style.
- Sales-tax calculation for non-Stripe-Tax jurisdictions. If you operate outside Stripe Tax coverage, you need additional tooling.
- Quoting / sales-rep workflows. Different shape.

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§12 for the full capability map.

### Owns
- Stripe customer / subscription / price / payment-method management
- Stripe webhook reception (via `webhooks` substrate) with verification + idempotency
- Subscription lifecycle (create / upgrade / downgrade / cancel / reactivate)
- Trial start / end / extension
- Stripe Tax integration
- Proration on plan changes
- Refunds / credit notes
- Invoice retrieval + PDF download
- Customer portal redirect helpers
- Reconciliation job (Stripe â†” local state drift detection)
- Plan price-id â†” NekoStack plan mapping

### Does NOT own
| Capability | Lives in |
|---|---|
| Plan logic + feature gating + usage limits | `entitlements` |
| Webhook receiver infrastructure | `webhooks` (we register handlers) |
| Email templating / sending | `email` |
| Direct ACH / wire / crypto payments | external (Stripe handles cards + bank) |
| Merchant-of-record functionality (LemonSqueezy-style) | external (out of scope) |
| Sales-rep / quoting workflows | out of scope |
| Sales-tax for non-Stripe-Tax jurisdictions | TBD (additional tooling required) |
| Audit log storage | `audit` |

## Competitors and adjacent tools

| Tool | What they do well | Where they fall short for us |
|---|---|---|
| **Stripe Checkout / Billing** | The substrate. Best-in-class payment APIs. | Just the API â€” no integration layer. |
| **LemonSqueezy** | Easy DX, merchant-of-record. | Merchant lock-in, lower limits, vendor coupling. |
| **Paddle** | Merchant of record, mature. | Same â€” vendor coupling, less flexible. |
| **Lago** | Open-source billing engine. | Heavy, more than needed. Strong for usage-based pricing. |
| **Stripe-only direct** | What every developer ends up writing. | Repetitive boilerplate; we systematize it. |
| **Chargebee / Recurly** | Mature subscription platforms. | Enterprise-priced, heavy. |

The right framing: **a well-structured TS layer on top of Stripe's direct API**, emitting events into `@nekostack/entitlements`, with all the integration plumbing (webhooks, idempotency, reconciliation) handled correctly.

## How this fits the NekoStack

**Depends on:**
- `@nekostack/schema` â€” billing event schemas.
- `@nekostack/entitlements` â€” plan state changes drive entitlement state.
- `@nekostack/telemetry` â€” billing events emit telemetry.
- `@nekostack/audit` â€” every billing action is audited.
- `@nekostack/webhooks` â€” webhook receiver infrastructure.
- `@nekostack/email` â€” receipt and dunning emails.
- Stripe SDK (external).

**Used by:**
- Any product that monetizes: NekoVibe Plus, NekoSystems tier, future retail-ops / EdTech subscriptions.

## Design philosophy

- **Stripe is the source of truth for money.** Our database mirrors; we don't authoritatively own money state.
- **Webhooks are reliable.** Idempotency keys, signature verification, replay-safe.
- **Every action is auditable.** Subscription created, plan changed, refund issued â€” all in the audit log.
- **Reconciliation is automatic.** A nightly job detects drift between Stripe state and local state; alerts when something doesn't match.
- **Customer portal first.** Don't reinvent the subscription-management UI; redirect to Stripe's hosted portal where possible.
- **Trial logic is explicit.** Trial-ending warnings, conversion prompts, post-trial entitlement changes â€” all declared, not inferred.

## Architecture sketch

```
packages/billing/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ stripe/
â”‚   â”‚   â”œâ”€â”€ client.ts         # configured Stripe SDK
â”‚   â”‚   â”œâ”€â”€ customer.ts
â”‚   â”‚   â”œâ”€â”€ subscription.ts
â”‚   â”‚   â”œâ”€â”€ price.ts
â”‚   â”‚   â””â”€â”€ invoice.ts
â”‚   â”œâ”€â”€ webhooks/
â”‚   â”‚   â”œâ”€â”€ receiver.ts       # Stripe webhook endpoint
â”‚   â”‚   â”œâ”€â”€ verify.ts         # signature verification
â”‚   â”‚   â”œâ”€â”€ idempotency.ts
â”‚   â”‚   â””â”€â”€ handlers/         # one per event type
â”‚   â”œâ”€â”€ lifecycle/
â”‚   â”‚   â”œâ”€â”€ create.ts
â”‚   â”‚   â”œâ”€â”€ upgrade.ts
â”‚   â”‚   â”œâ”€â”€ cancel.ts
â”‚   â”‚   â””â”€â”€ trial.ts
â”‚   â”œâ”€â”€ reconcile/
â”‚   â”‚   â””â”€â”€ job.ts            # nightly drift detector
â”‚   â”œâ”€â”€ portal/
â”‚   â”‚   â””â”€â”€ redirect.ts       # customer portal
â”‚   â”œâ”€â”€ plan-mapping/
â”‚   â”‚   â””â”€â”€ map.ts            # Stripe price ID â†” NekoStack plan
â”‚   â””â”€â”€ events/
â”‚       â””â”€â”€ emit.ts           # billing events â†’ @nekostack/telemetry
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

Webhook handler (sketch):

```ts
import { billingWebhook } from '@nekostack/billing';

app.post('/stripe/webhook', billingWebhook({
  secret: config.stripe.webhookSecret,
  onSubscriptionCreated: async (event) => {
    const plan = mapStripePriceToPlan(event.data.priceId);
    await entitlements.setPlan(event.data.customerId, plan);
    await audit.record('subscription.created', { ... });
  },
  onSubscriptionUpdated: async (event) => { /* ... */ },
  onPaymentFailed: async (event) => { /* trigger dunning email */ },
}));
```

## Roadmap

### v0.1 â€” Stripe client wrapper
- Configured SDK with retry logic.
- Customer / subscription / price helpers.

### v0.2 â€” Webhook receiver
- Signature verification.
- Idempotency.
- Handler registration API.

### v0.3 â€” Lifecycle helpers
- Subscription create / upgrade / downgrade / cancel.
- Trial start / end / extend.

### v0.4 â€” Plan mapping + entitlement bridge
- Stripe price ID â†” NekoStack plan registry.
- Event emission to `@nekostack/entitlements`.

### v0.5 â€” Tax + proration
- Stripe Tax integration.
- Proration helpers.

### v0.6 â€” Reconciliation
- Nightly drift detection job.
- Alert + remediation patterns.

### v0.7 â€” Customer portal
- Redirect helpers.
- Return-URL handling.

### v0.8 â€” Dunning + email integration
- Failed-payment flows.
- Receipt + invoice emails.

### v1.0 â€” Stable API
- Documentation site.
- Stripe Test Mode recipes for every flow.

## Product potential

**Internal use:** Critical for any product that monetizes.

**Open source release:** Plausible. The space has Lago (heavier, usage-billing focused) but no clean "Stripe + entitlements + webhooks done right" TS library. MIT release.


**Estimated effort to v1.0:** 8-16 weeks of focused work. Stripe API is large; correctness of webhook handling and reconciliation is critical and time-consuming.

## Status

- **Current:** Empty placeholder. Not started.
- **Owner:** Cody (solo dev project).
- **Priority tier:** SaaS layer. Build when the first product is ready to monetize, not before â€” premature optimization otherwise.
- **Estimated learning return:** High. Subscription billing is a deep domain; the patterns transfer to every commercial product.
