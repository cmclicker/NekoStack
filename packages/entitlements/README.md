# @nekostack/entitlements

> Plans, feature gates, usage metering, soft and hard limits, upgrade prompts. The "what is this user / tenant allowed to do under their current plan" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | SaaS layer — critical for every monetized product |
| **Depends on** | `schema` (plan/feature definitions), `auth` (decisions feed AccessDecision), `telemetry` (usage events), `audit` (denial records), `tenant` (per-tenant plan binding) |
| **Used by** | `billing` (drives entitlement state on plan change); NekoVibe (Plus tier), NekoSystems (per-tenant plan + feature gating), future retail-ops / EdTech / business SaaS |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 8–12 weeks focused |
| **Sellable?** | **Strong commercial potential** — Stigg / LaunchDarkly Subscriptions territory; schema-typed audit-integrated entitlements with hosted tier is a real play |

## Why this exists

Authorization (`@nekostack/auth`) answers: "given this user's roles and permissions, is this action allowed?" Entitlements answers a different question: "given this tenant's current plan and usage, is this action allowed?" The two are related but distinct:

- `user.canEditChampions` — authorization. Role-based.
- `tenant.canCreateAnotherAgent` — entitlement. Plan + usage based.
- `user.canExportData` — authorization (do they have export permission?) **and** entitlement (does their plan include export?).

Without an explicit entitlements layer, this logic ends up sprinkled across the codebase:

```ts
if (plan === 'free' && agentCount >= 3) throw new Error('upgrade');
if (plan === 'pro' && exports.length >= 100) throw new Error('limit');
```

That ages badly. New plans appear; old plans grandfather; usage limits change; soft warnings vs hard caps blur; the upgrade-prompt UX drifts across surfaces.

`@nekostack/entitlements` is the single layer that owns: plan definitions, feature mapping, usage counters, limit enforcement, upgrade-prompt metadata, and grandfathering rules. Every product that has tiers uses it. Stripe integration is via `@nekostack/billing`; entitlements is the *logic* layer that bills feeds into.

Building this yourself rather than adopting Stigg, LaunchDarkly Subscriptions, or Recurly's logic is justified because:
1. **Your data, your rules.** Plans aren't stable corporate offerings; they're product decisions you'll iterate on monthly.
2. **Schema integration.** Plans and features are typed via `@nekostack/schema`. Catalog drift is impossible.
3. **No per-MAU pricing.** Entitlements-as-a-service charges per active user. Self-hosted is one database table.
4. **You own the upgrade UX.** No vendor-controlled paywall modals.

## Scope

### In scope
- Plan definitions: declarative `Plan` schema with features and limits.
- Feature catalog: typed strings (`champion.balance.edit`, `agent.create`, `export.data`).
- Usage metering: counters (per-tenant, per-feature, per-period).
- Limit policies: soft warnings, hard caps, grandfathering, overage handling.
- Gate API: `entitlements.check(tenant, feature)` returns Decision.
- Middleware: `requireEntitlement(feature)` for framework integration.
- Upgrade-prompt metadata: which plan unlocks this feature, what's the difference.
- Plan migration: when a tenant's plan changes, current usage state is updated atomically.
- Audit integration: entitlement denials emit audit events.

### Out of scope
- Payment processing. `@nekostack/billing` handles Stripe.
- Subscription lifecycle (trial start, dunning, cancellation). `@nekostack/billing` handles those.
- Feature flags (rollout / AB). Different abstraction; lives in `@nekostack/flags`.
- Per-user (vs per-tenant) entitlements. Could be added; v1 is tenant-scoped.

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §11 for the full capability map.

### Owns
- `definePlan()` declarative plan schema
- Feature catalog (typed strings like `agent.create`)
- Usage counters with period windows (daily / monthly / lifetime)
- Soft / hard limit policies + grandfathering
- Plan migration logic
- Upgrade-prompt metadata (which plan unlocks this, diff vs current)
- Entitlement decision input feeding `auth.AccessDecision`

### Does NOT own
| Capability | Lives in |
|---|---|
| Payment processing / Stripe integration | `billing` |
| Subscription lifecycle (trial / cancel / dunning) | `billing` |
| Feature flags (rollout / A/B testing, not plan-based) | `flags` |
| Rate / abuse limiting (request-level) | `limits` |
| Role-based permissions (not plan-based) | `permissions` |
| Audit log storage | `audit` |
| Multi-tenant context | `tenant` |
| Per-user (vs per-tenant) entitlements | TBD (could be added; v1 is tenant-scoped) |
| Usage event ingestion infrastructure | `telemetry` (we emit) |

## Competitors and adjacent tools

| Tool | What they do well | Where they fall short for us |
|---|---|---|
| **Stigg** | Hosted entitlements SaaS, mature. | Vendor lock, $99-$499/mo+, schema-decoupled. |
| **LaunchDarkly + Subscriptions** | Feature flagging giant with entitlements module. | Heavyweight, enterprise pricing. |
| **Lago** | Open-source metering/billing. | Mostly billing-side; entitlements layer is lighter than ours. |
| **OpenMeter** | Usage metering, open-source. | Just the meter; entitlement decisions are your problem. |
| **Stripe Entitlements (beta)** | Built into Stripe. | Tightly coupled to Stripe billing; limited semantics. |
| **Ad-hoc Postgres tables** | Cheap. | This is what the package replaces. |

The right framing: **the logic spine of plan-based feature gating, with billing feeding in and `@nekostack/auth` consuming decisions.** Stigg's product shape is the closest competitor; we are building the equivalent layer for our stack.

## How this fits the NekoStack

**Depends on:**
- `@nekostack/schema` — plan and feature definitions.
- `@nekostack/auth` — entitlement decisions become part of AccessDecision.
- `@nekostack/telemetry` — emits usage events.
- `@nekostack/audit` — denials emit audit records.

**Used by:**
- `@nekostack/billing` — plan changes drive entitlement state.
- Every SaaS-shaped product: NekoVibe (Plus tier), NekoSystems (per-tenant plan + feature gating), retail-ops, EdTech, future products.
- `@nekostack/api` — entitlement decoration on endpoints.

## Design philosophy

- **Plans are typed.** A plan is a schema instance, not a free-form JSON blob.
- **Features are strings — but typed strings.** The set of feature names is a registered catalog. No typos.
- **Decisions are structured.** `{ allowed: false, reason: 'PLAN_LIMIT_EXCEEDED', limit: 3, current: 3, upgradeAvailable: 'pro' }`.
- **Soft vs hard limits.** Soft limits warn but allow; hard limits block. Both are first-class.
- **Grandfathering is explicit.** Legacy plans with custom terms are first-class, not "oh god, hardcoded if-statement."
- **Usage is metered as it happens.** Counters update inline with the action, not via batch job that drifts.

## Architecture sketch

```
packages/entitlements/
├── src/
│   ├── plans/
│   │   ├── define.ts         # definePlan({ features, limits })
│   │   ├── catalog.ts        # registered plan catalog
│   │   └── migration.ts      # plan-change handling
│   ├── features/
│   │   ├── catalog.ts        # registered feature names
│   │   └── decorator.ts      # type-safe feature usage
│   ├── meters/
│   │   ├── counter.ts        # per-tenant per-feature counters
│   │   ├── period.ts         # daily / monthly / lifetime windows
│   │   └── reset.ts          # period rollover
│   ├── decisions/
│   │   ├── check.ts          # entitlements.check()
│   │   └── reason.ts         # structured reason codes
│   ├── middleware/
│   │   └── require.ts        # requireEntitlement guard
│   ├── upgrade/
│   │   └── prompt.ts         # which plan unlocks this, diff vs current
│   └── adapters/             # for plan-state persistence
│       ├── postgres.ts
│       └── memory.ts
├── tests/
└── README.md
```

Defining and checking:

```ts
import { definePlan, registerFeature, s } from '@nekostack/entitlements';

registerFeature('agent.create');
registerFeature('export.data');
registerFeature('champion.balance.edit');

const Free = definePlan('free', {
  features: ['agent.create', 'export.data'],
  limits: {
    'agent.create': { period: 'lifetime', cap: 3 },
    'export.data': { period: 'month', cap: 5 },
  },
});

const Pro = definePlan('pro', {
  features: ['agent.create', 'export.data', 'champion.balance.edit'],
  limits: {
    'agent.create': { period: 'lifetime', cap: 50 },
    'export.data': { period: 'month', cap: Infinity },
  },
});

// In a controller
const decision = await entitlements.check(tenant, 'agent.create');
if (!decision.allowed) throw new ForbiddenException(decision);
```

## Roadmap

### v0.1 — Plan + feature catalog
- `definePlan`, `registerFeature`.
- In-memory backend.

### v0.2 — Decision API
- `check()` with structured reasons.
- Middleware for Nest / Express / Next.js.

### v0.3 — Usage metering
- Counters with period windows.
- Period rollover.

### v0.4 — Postgres adapter
- Persistent plan-state and counter storage.

### v0.5 — Plan migrations
- Atomic plan changes with current-usage carryover.

### v0.6 — Grandfathering + custom plans
- Per-tenant plan overrides.
- Custom-plan definitions.

### v0.7 — Upgrade-prompt metadata
- "Which plan unlocks this" and "what's the diff vs current."

### v1.0 — Stable API
- Documentation site.
- Stripe integration recipes (via `@nekostack/billing`).

## Product potential

**Internal use:** Critical for every SaaS-shaped project.

**Open source release:** Strong. The space has paid tools (Stigg) and partial open-source (OpenMeter, Lago) but no clean, schema-typed, TS-native option. MIT release likely to attract real users.

**Commercial product:** **Real opportunity.** Stigg has raised significant funding. A schema-typed, audit-integrated, open-source-core entitlements platform with a hosted tier is a viable commercial play.

**Estimated effort to v1.0:** 8-12 weeks of focused work. Plan/feature/decision logic is small; metering, period handling, and grandfathering are where time goes.

## Status

- **Current:** Empty placeholder. Not started.
- **Owner:** Cody (solo dev project).
- **Priority tier:** SaaS layer. Build after `@nekostack/auth` since entitlement decisions feed into AccessDecision.
- **Estimated learning return:** High. Pricing model design, metering architectures, plan migration patterns — increasingly important commercial skills.
