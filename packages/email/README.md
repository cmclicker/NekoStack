# @nekostack/email

> Email-specific: templates, deliverability, bounce handling, list hygiene. The email channel that `notify` dispatches through, plus standalone use for receipts / dunning / marketing.

## Quick reference

| | |
|---|---|
| **Build tier** | SaaS layer |
| **Depends on** | `schema` (email template metadata), `audit` (sends audited), `secrets` (Resend API key), Resend SDK (or SendGrid / AWS SES adapters) |
| **Used by** | `notify` (email channel), `billing` (receipts + dunning), `auth` (verification + password reset), every product sending email |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 4â€“8 weeks focused |

## Why this exists

Every product sends emails. The recurring problems:
- Template rendering with localization (`locale` integration).
- Bounce handling (suppress further sends to bouncing addresses).
- Deliverability (SPF / DKIM / DMARC awareness â€” though setup is operational).
- Unsubscribe link generation + handling.
- List hygiene (don't email suppressed addresses).

A thin wrapper over Resend (or SES / Postmark via adapter) handles these once. NekoVibe already built much of this in its Phase 1 work; lifting into a package makes it reusable.

## Scope

### In scope
- Email template authoring (React Email / MJML / handlebars).
- Provider adapters (Resend default; SendGrid / AWS SES adapters).
- Template rendering with `locale` integration.
- Bounce / complaint handling (webhooks from provider).
- Suppression list management.
- Unsubscribe link generation + token handling.
- Audit on every send.
- Test-mode (capture sends without dispatch).

### Out of scope
- Multi-channel routing (`notify`).
- SMS (`notify` channel).
- Push (`notify` channel).
- Marketing campaign management (out of scope; we are transactional + lightweight transactional-marketing).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§14 for the full capability map.

### Owns
- Email template authoring + rendering
- Provider adapters (Resend / SendGrid / SES)
- Bounce + complaint handling
- Suppression list
- Unsubscribe link + token handling
- Test-mode capture

### Does NOT own
| Capability | Lives in |
|---|---|
| Multi-channel routing | `notify` |
| Receipt email *content / orchestration* | `billing` (uses us to send) |
| Verification / reset email *triggering* | `auth` (uses us to send) |
| Translation catalogs | `locale` |
| Audit log storage | `audit` |
| Secret loading (API keys) | `secrets` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **Resend SDK direct** | Excellent DX. | Just the substrate; templates / suppression / bounce yours. |
| **Postmark SDK direct** | Excellent transactional. | Same. |
| **SendGrid SDK** | Mature. | Same. |
| **React Email** | Template authoring. | We integrate. |
| **Custom per-product email code** | Common. | Reinvented per product. |

## How this fits the NekoStack

- **`notify`** uses us as the email channel.
- **`billing`** uses us for receipts / dunning.
- **`auth`** uses us for verification / reset.
- **`locale`** provides translations.
- **`secrets`** provides the API key.

## Design philosophy

- **Resend-first.** Default adapter; others optional.
- **React Email recommended.** Component-based templates are easier to maintain.
- **Suppression is sacred.** Once a bounce is recorded, never email that address again.
- **Test-mode by default in dev.** Don't accidentally email real users from local.

## Architecture sketch

```
packages/email/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ send/
â”‚   â”‚   â”œâ”€â”€ send.ts
â”‚   â”‚   â””â”€â”€ test-mode.ts
â”‚   â”œâ”€â”€ adapters/
â”‚   â”‚   â”œâ”€â”€ resend.ts
â”‚   â”‚   â”œâ”€â”€ sendgrid.ts
â”‚   â”‚   â””â”€â”€ ses.ts
â”‚   â”œâ”€â”€ template/
â”‚   â”‚   â”œâ”€â”€ react-email.ts
â”‚   â”‚   â””â”€â”€ render.ts
â”‚   â”œâ”€â”€ bounce/
â”‚   â”‚   â”œâ”€â”€ handler.ts
â”‚   â”‚   â””â”€â”€ webhook.ts
â”‚   â”œâ”€â”€ suppression/
â”‚   â”‚   â””â”€â”€ list.ts
â”‚   â”œâ”€â”€ unsubscribe/
â”‚   â”‚   â”œâ”€â”€ token.ts
â”‚   â”‚   â””â”€â”€ link.ts
â”‚   â””â”€â”€ cli.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Resend adapter + send
### v0.2 â€” React Email templates + locale integration
### v0.3 â€” Bounce / complaint handling
### v0.4 â€” Suppression list
### v0.5 â€” Unsubscribe tokens
### v0.6 â€” SendGrid + SES adapters
### v1.0 â€” Stable API

## Product potential

**Internal:** Required for any product with email.
**Open source release:** Modest â€” wraps a provider; thin.
**Commercial:** None â€” Resend / Postmark dominate.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** SaaS layer.
- **Estimated learning return:** Moderate. Email deliverability, bounce handling, template architecture.
