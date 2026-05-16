# @nekostack/flags

> Feature flags: rollouts, kill switches, percentage targeting, A/B experiments. **Distinct from entitlements** (which is plan-based gating). Both are gating, but for different reasons.

## Quick reference

| | |
|---|---|
| **Build tier** | SaaS layer |
| **Depends on** | `schema` (flag definitions), `audit` (flag changes audited), `telemetry` (flag-evaluation events for experiments), `tenant` (tenant-targeted flags), `auth` (user-targeted flags) |
| **Used by** | every product surface where a feature is rolling out, being A/B tested, or has a kill switch; `admin` for flag toggling UI |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 6–10 weeks focused |
| **Sellable?** | Plausible OSS (LaunchDarkly / Unleash territory); commercial niche dominated by LaunchDarkly but room for cheaper self-hostable |

## Why this exists

Flags answer "is feature X turned on for this user/tenant right now?" Entitlements answer "does this user/tenant's plan include feature X?" Both gate features, but the lifecycles are completely different:

- **Flags** are dev-managed, short-lived (rollout → fully on → removed), can be killed instantly, often targeted at percentage of users.
- **Entitlements** are product-management-managed, long-lived (the plan), tied to billing.

Bundling them leads to confused code: "is this a billing question or a rollout question?" Splitting them makes both clearer.

## Scope

### In scope
- Flag definitions (boolean + multivariate).
- Targeting rules (percentage, user ID, tenant ID, attribute predicates).
- Rollout strategies (gradual, canary, percentage-based).
- Kill switches (instant-off).
- A/B / multi-arm experiments with consistent user assignment.
- Stale-flag detection (CI warning when flag has been 100%-on for N days).
- Audit on flag changes.
- Evaluation events emit to `telemetry` (for experiment analysis).
- CLI + admin UI integration.

### Out of scope
- Plan-based gating (`entitlements`).
- Rate / abuse limits (`limits`).
- Role-based access (`permissions`).
- Experiment statistical analysis (we emit events; analysis is consumer-side via `telemetry`).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §77 (boundary clarifications section in BOUNDARIES.md).

### Owns
- Flag definitions + multivariate values
- Targeting rule DSL
- Rollout strategies
- Kill switches
- Experiment assignment with consistent hashing
- Stale-flag detection
- Flag change audit
- Evaluation event emission

### Does NOT own
| Capability | Lives in |
|---|---|
| Plan-based feature gating | `entitlements` |
| Rate / abuse limiting | `limits` |
| Role-based permissions | `permissions` |
| Experiment statistical analysis | consumer (uses `telemetry` events) |
| Per-user preferences | `auth` (account model) |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **LaunchDarkly** | Mature, enterprise. | Expensive, vendor lock. |
| **Unleash** | OSS self-hostable. | Service-shaped (separate process). |
| **PostHog feature flags** | Bundled with analytics. | PostHog-coupled. |
| **Flagsmith** | OSS + hosted. | Service-shaped. |
| **GrowthBook** | OSS, A/B-focused. | Closer in spirit. |
| **Custom env var toggles** | Cheap. | No rollout, no targeting, no audit. |

## How this fits the NekoStack

- **`audit`** records every flag change.
- **`telemetry`** receives evaluation events for experiment analysis.
- **`admin`** surfaces flag toggle UI.
- **`tenant`** enables tenant-scoped targeting.
- **`auth`** provides user attributes for targeting.

## Design philosophy

- **Flags are temporary.** Old flags are debt. Stale-detection flags them after N days at 100%.
- **Targeting is composable.** Percentage + attribute + tenant — combine cleanly.
- **Experiments are assignment-stable.** Same user → same arm across visits (consistent hashing).
- **Audit every change.** Flipping a flag is a real action; record it.

## Architecture sketch

```
packages/flags/
├── src/
│   ├── definition/
│   │   ├── flag.ts          # Flag type
│   │   └── catalog.ts
│   ├── targeting/
│   │   ├── percentage.ts
│   │   ├── attribute.ts
│   │   └── compose.ts
│   ├── rollout/
│   │   ├── gradual.ts
│   │   └── canary.ts
│   ├── kill/
│   │   └── switch.ts
│   ├── experiments/
│   │   ├── assignment.ts    # consistent hashing
│   │   └── arms.ts
│   ├── stale/
│   │   └── detect.ts        # CI warning
│   ├── audit/
│   │   └── emit.ts
│   └── cli.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Flag definition + evaluation
### v0.2 — Targeting rules (percentage + attribute)
### v0.3 — Kill switches
### v0.4 — Experiments with consistent assignment
### v0.5 — Stale-flag detection
### v0.6 — Admin UI integration
### v1.0 — Stable API

## Product potential

**Internal:** Useful for safe rollouts.
**Open source release:** Plausible — Unleash / GrowthBook territory.
**Commercial:** LaunchDarkly dominates; tough commercial play.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** SaaS layer.
- **Estimated learning return:** Moderate. Targeting algorithms, consistent hashing for experiments, stale detection.
