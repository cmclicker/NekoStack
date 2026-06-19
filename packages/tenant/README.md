# @nekostack/tenant

> Tenant identity, lifecycle, settings, membership, isolation patterns. The multi-tenancy primitive lifted out of `auth`. The "who is this customer and what's their boundary?" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Identity / access â€” split out of `auth` for clean ownership |
| **Depends on** | `schema` (tenant shape), `audit` (tenant-scoped audit), `id` (tenant-scoped IDs), `time` (lifecycle dates) |
| **Used by** | `auth` (composes tenant into AuthContext), `entitlements` (per-tenant plan binding), `audit` (tenant scoping), `permissions` (tenant-scoped role bindings), every multi-tenant SaaS product (NekoSystems, retail-ops, future EdTech) |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 6â€“10 weeks focused |

## Why this exists

Multi-tenancy is a distinct concept from authentication. A user logs in (auth); a user *belongs to* a tenant (this package). The data row belongs to a tenant; the audit log entry belongs to a tenant; the plan applies to a tenant. Bundling tenant into auth leads to a vague `auth` package that does too much and a `tenant` model buried where it can't be reused.

Lifting `tenant` out makes:
- Tenant lifecycle (create / suspend / delete) explicit and auditable on its own.
- Tenant isolation patterns (row-level security templates, query-clause injection helpers) reusable.
- Tenant-scoped IDs (`<tenant>:<resource>`) a first-class convention.
- Cross-package tenant context (in `audit` log scope, in `entitlements` plan binding, in `path` cross-tenant filtering) coherent.

The decision to lift it out is recorded as ADR `D-0042` (see `decision`).

## Scope

### In scope
- `Tenant` type (id / slug / status / created / settings / plan-ref).
- Tenant lifecycle state machine (active / trial / suspended / cancelled / deleted).
- Tenant settings (display name, region, locale defaults, etc.).
- Tenant membership (which users belong to which tenants, optional role binding from `permissions`).
- Tenant isolation patterns (Postgres RLS templates, query-clause injection helpers).
- Tenant-scoped ID convention (`<tenant>:<resource>:<id>`).
- Tenant plan binding (current plan + history, fed by `entitlements`).
- Tenant audit scope (audit records carry tenant context).
- Tenant export / delete workflows (calls into `export` + `audit`).

### Out of scope
- Authentication flow (`auth`).
- Permission catalog / role definitions (`permissions`).
- Plan logic itself (`entitlements`).
- Billing lifecycle (`billing`).
- Tenant signup UI (consuming products).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§9 for the full capability map.

### Owns
- Tenant identity model
- Tenant lifecycle (create/suspend/delete)
- Tenant settings
- Tenant membership
- Tenant isolation patterns (RLS templates, query-clause helpers)
- Tenant-scoped ID convention
- Tenant plan binding (paired with `entitlements`)
- Tenant audit scope (paired with `audit`)
- Tenant export / delete orchestration

### Does NOT own
| Capability | Lives in |
|---|---|
| Authentication / login flow | `auth` |
| Permission catalog + role definitions | `permissions` |
| Plan + feature-gate logic | `entitlements` |
| Subscription / Stripe billing | `billing` |
| Audit log storage | `audit` |
| Data export mechanics | `export` |
| ID generation primitives | `id` |
| Compliance evidence | `compliance` |

## Competitors and adjacent tools

| Tool | What they do well | Where they fall short for us |
|---|---|---|
| **Clerk Organizations** | Hosted multi-tenant primitive. | Vendor lock; not portable. |
| **Auth0 Organizations** | Enterprise multi-tenant. | Heavyweight, expensive. |
| **WorkOS Organizations** | B2B-shaped. | Hosted only; vendor coupling. |
| **Custom tenant table in DB** | Common practice. | Reinvented per product; no shared isolation patterns. |

## How this fits the NekoStack

- **`auth`** composes tenant context into AuthContext via this package.
- **`entitlements`** binds plans to tenants.
- **`permissions`** scopes role bindings per tenant.
- **`audit`** scopes records by tenant.
- **`billing`** maps Stripe customers to tenants.
- **`export`** runs tenant-scoped data exports for DSAR.
- **`limits`** can enforce per-tenant rate limits.

## Design philosophy

- **Tenant is the unit of isolation.** Most multi-tenant bugs come from missing `where: { tenantId }` clauses. We provide helpers that make this mistake hard.
- **Solo-shaped for SaaS-shaped products.** Even a solo dev builds multi-tenant products; the abstraction shouldn't require an enterprise org to use.
- **Lifecycle is explicit.** Suspended is a state, deleted is a state, trial is a state.
- **Per-tenant audit scope.** Audit records carry tenant context for free.

## Architecture sketch

```
packages/tenant/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ identity/
â”‚   â”‚   â”œâ”€â”€ tenant.ts         # Tenant type
â”‚   â”‚   â”œâ”€â”€ lifecycle.ts      # state machine
â”‚   â”‚   â””â”€â”€ settings.ts
â”‚   â”œâ”€â”€ membership/
â”‚   â”‚   â””â”€â”€ user-tenant.ts    # user-tenant binding (role binding lives in permissions)
â”‚   â”œâ”€â”€ isolation/
â”‚   â”‚   â”œâ”€â”€ rls.ts            # row-level-security SQL templates
â”‚   â”‚   â””â”€â”€ clause.ts         # query-clause injection helpers
â”‚   â”œâ”€â”€ ids/
â”‚   â”‚   â””â”€â”€ scoped.ts         # tenant-scoped ID convention
â”‚   â”œâ”€â”€ audit/
â”‚   â”‚   â””â”€â”€ scope.ts          # audit context helpers
â”‚   â”œâ”€â”€ lifecycle-hooks/
â”‚   â”‚   â”œâ”€â”€ suspend.ts
â”‚   â”‚   â”œâ”€â”€ delete.ts
â”‚   â”‚   â””â”€â”€ trial.ts
â”‚   â””â”€â”€ cli.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Tenant model + lifecycle
### v0.2 â€” Membership + isolation helpers
### v0.3 â€” RLS templates (Postgres-first)
### v0.4 â€” Tenant-scoped IDs
### v0.5 â€” Plan binding integration (entitlements)
### v0.6 â€” Tenant-export / delete orchestration
### v1.0 â€” Stable API

## Product potential

**Internal:** Critical for any multi-tenant product.
**Open source release:** Plausible â€” clean tenant primitive is undersupplied.
**Commercial:** Marginal â€” Clerk/Auth0/WorkOS already commercialize this.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Identity / access. Build alongside `auth` since they're tightly coupled.
- **Estimated learning return:** High. Multi-tenant isolation patterns, RLS, lifecycle state machines for organizations â€” all important SaaS engineering skills.
