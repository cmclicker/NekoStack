# @nekostack/admin

> Admin dashboard starter. Drop-in surfaces for users, audit log, feature flags, entitlements, content moderation, system health. The internal-facing UI every product needs and no product wants to build twice.

## Quick reference

| | |
|---|---|
| **Build tier** | SaaS layer — build *after* underlying packages (auth, audit, flags, entitlements) so it has data to surface |
| **Depends on** | `ui`, `table`, `auth` (admin role gating + user data), `audit`, `flags`, `entitlements`, `health`, `jobs`, `tenant` |
| **Used by** | every product with admin surface area: NekoVibe (user / cosmetic / abuse admin), NekoSystems (agent / workflow), Leytide (GM admin), retail-ops, future products |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 12–20 weeks focused |
| **Sellable?** | Unlikely independent traction (Refine/React Admin/Tremor crowded); this is the package where **using Refine is a legitimate retreat** if it becomes a slog |

## Why this exists

Every product, once it has any users, needs an admin surface. The basic needs:

- **User management** — find users, view their state, suspend / unsuspend, impersonate.
- **Audit log browser** — who did what, when, with what result. Filtered, searchable.
- **Feature flags + entitlements editor** — toggle flags, change plans, override limits.
- **Content moderation queue** — flagged content, abusive reports, review actions.
- **System health** — service status, error rates, recent telemetry.
- **Job + queue monitoring** — background job status, retries, dead letters.
- **Tenant management** — for multi-tenant products, list and inspect tenants.

These are not unique per product. They are *exactly* the same across every NekoStack-shaped product, varying only in which schemas they show. A shared admin starter that auto-wires from `@nekostack/auth` users, `@nekostack/audit` records, `@nekostack/flags` toggles, etc., saves weeks per product.

This is the package where the **honest call** from the earlier conversation lives: the wheel here is **close to round** in the React Admin / Refine / Tremor ecosystem. Building this yourself is justified primarily because:
1. **Learning admin-UX patterns** — table virtualization, bulk actions, role-gated UI, audit log presentation, real-time monitoring dashboards.
2. **Auto-wiring from the rest of the stack.** Refine and React Admin don't know about NekoStack's specific shapes; ours does.
3. **No commercial-license headaches.** Some admin frameworks have non-trivial licensing.

But: if at any point this becomes a slog and Refine fits, **using Refine is a legitimate retreat**. This is the package where "don't reinvent the wheel" gets the most weight in NekoStack.

## Scope

### In scope
- Pre-built admin surfaces: Users, Audit, Flags, Entitlements, Moderation, Health, Jobs, Tenants.
- Auto-wiring from NekoStack packages: read from `@nekostack/auth`, `@nekostack/audit`, etc.
- Role-gated UI: admins see admin surfaces, sub-admins see a subset.
- Table primitives: virtualized rows, sorting, filtering, bulk actions.
- Custom surface registration: products add their own admin pages.
- Impersonation (with audit, with confirmation, with time-limited tokens).
- Read-only mode for audit-trail-only roles (compliance, support).

### Out of scope
- Customer-facing UI. That's product code.
- Marketing / analytics dashboards aimed at executives. Different shape; could come later.
- A no-code admin builder (drag-and-drop). Out of scope.
- Direct SQL query interface. Use `@nekostack/audit` or actual DB tools.

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §13 (admin sections across SaaS / observability tiers).

### Owns
- Admin shell (layout / nav / auth-gate)
- Pre-built surfaces: Users, Audit, Flags, Entitlements, Moderation, Health, Jobs, Tenants
- Auto-wiring from NekoStack packages (auth/audit/flags/entitlements feed UI)
- Role-gated UI (admin / sub-admin / compliance read-only)
- Table primitives consumption (virtualized rows, bulk actions)
- Impersonation flow (time-limited tokens + visible banner + audit)
- Custom-surface registration API

### Does NOT own
| Capability | Lives in |
|---|---|
| Customer-facing UI | consuming products |
| Component primitives (Button / Input / Dialog / etc.) | `ui` |
| Data tables themselves | `table` |
| Marketing / executive analytics dashboards | future (different shape) |
| No-code drag-and-drop admin builder | out of scope |
| Direct SQL query interface | out of scope (use audit or DB tools) |
| User authentication flow | `auth` |
| Audit log storage | `audit` |
| Flag toggle backend | `flags` |
| Entitlement state | `entitlements` |
| Customer support tooling | TBD (`support` package later) |

## Competitors and adjacent tools

| Tool | What they do well | Where they fall short for us |
|---|---|---|
| **React Admin** | Mature, comprehensive, framework-driven. | Heavy, opinionated, REST-resource model assumed. |
| **Refine** | Modern, headless, framework-flexible. | Closest competitor. Genuinely good. |
| **Forest Admin** | Auto-generated admin from DB. | Hosted/paid, vendor lock. |
| **Retool** | Drag-and-drop internal tools. | Hosted, paid per-seat. |
| **Tremor** | React dashboard components. | Charting-focused; not full admin shell. |
| **Tabler** / **AdminLTE** | HTML admin templates. | Just CSS; no framework integration. |
| **Hasura Console** | Auto-admin for Hasura GraphQL. | Hasura-coupled. |
| **Directus** | Headless CMS with admin UI. | Different shape; CMS-focused. |

The right framing: **Refine is the closest legitimate alternative.** Building our own makes sense for learning + tight stack integration; using Refine makes sense for "ship it fast and move on." Both choices are defensible.

## How this fits the NekoStack

**Depends on:**
- `@nekostack/ui` — base components.
- `@nekostack/table` — admin tables.
- `@nekostack/auth` — admin role gating + user data.
- `@nekostack/audit` — audit log surface.
- `@nekostack/flags` — flag toggle surface.
- `@nekostack/entitlements` — plan/limit surface.
- `@nekostack/health` — health probe surface.
- `@nekostack/jobs` — job monitoring surface.

**Used by:**
- Every product with administrative surface area: NekoVibe (user / cosmetic / abuse admin), NekoSystems (agent / workflow admin), retail-ops (operations admin), Leytide (GM admin), future products.

## Design philosophy

- **Auto-wired by default, customizable as needed.** Out of the box, point it at the rest of the stack and it works. Custom surfaces are extensions, not rewrites.
- **Read-mostly, write-deliberately.** Most admin work is observation; mutation actions require confirmation + audit emission.
- **Role-gated by default.** Different admin roles see different surfaces. No "everything for everyone."
- **Audit is implicit.** Every admin action emits an audit record automatically. The admin can't disable this.
- **Bulk actions matter.** Real admin work requires "select 50 users, apply action." First-class.
- **Impersonation is dangerous.** Visible badge, time-limited tokens, audit trail, optional MFA gate.

## Architecture sketch

```
packages/admin/
├── src/
│   ├── surfaces/
│   │   ├── users/
│   │   ├── audit/
│   │   ├── flags/
│   │   ├── entitlements/
│   │   ├── moderation/
│   │   ├── health/
│   │   ├── jobs/
│   │   └── tenants/
│   ├── shell/
│   │   ├── layout.tsx
│   │   ├── nav.tsx
│   │   └── auth-gate.tsx
│   ├── primitives/
│   │   ├── data-table.tsx
│   │   ├── bulk-action.tsx
│   │   └── confirm-modal.tsx
│   ├── impersonation/
│   │   ├── token.ts
│   │   └── banner.tsx
│   ├── register.ts           # add custom surfaces
│   └── theme.ts              # admin-specific theme overrides
├── tests/
└── README.md
```

Usage:

```tsx
import { AdminApp, registerSurface } from '@nekostack/admin';
import { ChampionBalanceSurface } from './admin/champion-balance';

registerSurface(ChampionBalanceSurface);

export default function Admin() {
  return <AdminApp />;
}
```

## Roadmap

### v0.1 — Shell + auth gate
- Layout, nav, role-gated routing.
- Auth integration.

### v0.2 — Users surface
- List, view, suspend.

### v0.3 — Audit surface
- Search, filter, export.

### v0.4 — Flags + entitlements
- Toggle flags, change plans, override limits.

### v0.5 — Health + jobs
- Service status, job monitoring.

### v0.6 — Moderation
- Flagged-content queue.
- Review actions.

### v0.7 — Impersonation
- Time-limited tokens, visible banner, audit.

### v0.8 — Custom surface API
- Register custom admin pages.

### v1.0 — Stable API
- Documentation site.
- Theme customization recipes.

## Product potential

**Internal use:** High. Reduces admin-build time for every consuming product.

**Open source release:** Plausible but crowded. The Refine niche is dense. MIT release as part of NekoStack is fine; unlikely to gain independent traction.

**Commercial product:** Unlikely. Admin frameworks rarely monetize directly.

**Estimated effort to v1.0:** 12-20 weeks of focused work. Per-surface scope is small; cumulative weight of ~8 production-quality surfaces is large.

## Status

- **Current:** Empty placeholder. Not started.
- **Owner:** Cody (solo dev project).
- **Priority tier:** SaaS layer. Build *after* the underlying packages (auth, audit, flags, entitlements) so it has something to surface.
- **Estimated learning return:** Moderate-to-high. Admin UX patterns are surprisingly deep. The wheel is closer to round here than elsewhere, so the learning return is lower than for foundational packages — but bulk actions, impersonation safety, audit-aware UI design are all transferable.
