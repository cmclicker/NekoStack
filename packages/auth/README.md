# @nekostack/auth

> The policy layer. Sits on top of provider-based authentication (Auth.js, Clerk, Supabase) and owns the AccessDecision shape, not the crypto. Composes inputs from `tenant`, `permissions`, `entitlements`, and `limits` into a single decision.

## Quick reference

| | |
|---|---|
| **Build tier** | Force multiplier — build early, almost everything else depends on it |
| **Depends on** | `schema`, `telemetry`, `audit`, `tenant`, `permissions`, `entitlements`, `limits`, `crypto` (wrappers); provider libs (Auth.js / Clerk / Supabase / Firebase) |
| **Used by** | every API endpoint with auth; NekoVibe, NekoSystems, Leytide server, NekoBattler admin, future Business-OS, retail-ops, EdTech, all multi-tenant SaaS |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 12–24 weeks focused |
| **Sellable?** | **High commercial potential** — Permit.io / Aserto / Cerbos territory; schema-typed audit-integrated authz with hosted tier is a real commercial play |

## Why this exists

Authentication ("are you logged in?") is mostly a solved problem. OAuth flows, password hashing, session signing, JWT primitives — every major provider does these correctly and the cost of getting any of them wrong is account-takeover-level dangerous. **Don't reinvent that.**

Authorization ("are you allowed to do this?") is not solved. It's project-specific, schema-specific, business-rules-specific. Every product invents its own answer. Most of them are wrong in subtle ways:

- The `/stats/{userId}` endpoint is unauthenticated because the developer forgot the actor-check (we literally saw this in NekoVibe's audit).
- Admin actions are gated by a string-check on `user.role === 'admin'` and that check appears in 40 places — drift guaranteed.
- Tenant isolation is enforced by `where: { tenantId }` in queries, which is brittle (one missing where-clause leaks data across tenants).
- Feature gating is mixed in with permission gating with billing gating and nothing is documented.
- Audit is an afterthought, so the question "who deleted that thing?" can't be answered.

`@nekostack/auth` is the policy spine. It wraps a provider (Auth.js, Clerk, Supabase, Firebase, or a custom dev mode) and provides one normalized `AuthContext` — actor, tenant, roles, permissions, entitlements, session metadata — plus a typed `AccessDecision` shape that every protected operation produces. Audit events emit on every access decision automatically.

Building this yourself rather than wholesale adopting an authz platform like Casbin or OPA is justified because:
1. **The crypto isn't yours, the policy is.** Providers handle login flows; you handle "what is this user allowed to do *in your domain*."
2. **Schema-typed permissions.** Permissions are validated against `@nekostack/schema`. No string typos waiting to bite.
3. **Audit is built in, not bolted on.** Every AccessDecision emits a tamper-evident audit event via `@nekostack/audit`.
4. **One contract across every product.** Your retail-ops SaaS, your game backend, your agent platform — all use the same AuthContext shape. Learning transfers.

## Scope

### In scope
- `AuthContext` type: actor identity, tenant context, roles, permissions, entitlements, session metadata.
- `AccessDecision` type: `allowed` boolean + structured `reasonCode` + audit-required flag.
- Provider adapter contract: `AuthProvider` interface that wraps Auth.js, Clerk, Supabase, Firebase, or a local-dev mode.
- Policy engine: RBAC and ABAC primitives, policy composition.
- Permission registry: typed catalog of permissions (`grooming.schedule.write`, `champion.balance.edit`).
- Tenant scoping: automatic tenant-clause injection patterns.
- Audit emission on every protected operation.
- Middleware: `requireAuth`, `requirePermission`, `requireEntitlement`, `requireTenant` (per-framework adapters).

### Out of scope
- Password hashing, OAuth protocol internals, JWT signing — these are the provider's job. We integrate; we do not re-implement.
- 2FA / passkey *crypto*. We orchestrate the flow (challenge, verify, enrollment state) but defer to libraries for the cryptographic primitives.
- Identity verification (KYC). Different problem space.
- Federation between independent identity systems. Out of initial scope.

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §8 for the full capability map.

### Owns
- Provider adapter contract (Auth.js / Clerk / Supabase / Firebase / local-dev)
- Login flow normalization
- Session shape
- AuthContext composition (gathers inputs from tenant/permissions/entitlements/limits)
- AccessDecision orchestration + shape
- Framework middleware (Nest guards, Express middleware, Next.js handlers, Fastify hooks)
- User profile + account model (folded in unless they grow distinct)

### Does NOT own
| Capability | Lives in |
|---|---|
| Tenant identity / lifecycle / isolation | `tenant` |
| Permission catalog + role definitions / RBAC primitives | `permissions` |
| Plan-based feature gating | `entitlements` |
| Rate-limit-based gating | `limits` |
| Audit log storage + query (we emit; audit stores) | `audit` |
| Password hashing | external (bcrypt / argon2 via provider) |
| OAuth protocol internals | external (Auth.js / Clerk) |
| JWT signing internals | external (provider libs) |
| 2FA / passkey crypto primitives | external (provider libs) |
| Cryptographic primitive wrappers (encryption helpers) | `crypto` |
| Login UI | `ui` (we provide policy backbone, not screens) |

## Competitors and adjacent tools

| Tool | What they do well | Where they fall short for us |
|---|---|---|
| **Auth.js (NextAuth)** | Provider integration, session management, Next.js-native. | No policy layer. No tenant model. No audit. |
| **Clerk** | Hosted auth, beautiful UI, multi-tenant. | Vendor lock, $89/mo+ at scale, doesn't own your policy logic. |
| **Supabase Auth** | Integrated with their DB. | Policy is RLS-only; not portable across stacks. |
| **Firebase Auth** | Mobile-first, mature. | Vendor lock, policy is custom-claims-only. |
| **Auth0 / Okta** | Enterprise auth, mature. | Heavy, expensive, overkill. |
| **Casbin** | Generic authorization library with multiple models. | Generic — doesn't know your schema or audit conventions. |
| **OPA (Open Policy Agent)** | Policy-as-code, declarative. | External service, Rego DSL, heavyweight for a solo project. |
| **Oso** | TS-native authorization library. | Closer fit than Casbin/OPA. Could complement rather than compete. |

The right framing: `@nekostack/auth` **uses** Auth.js (or another provider) for login flows and **owns** everything between the session-cookie-was-validated step and the database-write step. Provider for the front gate; this package for the policy hallway.

## How this fits the NekoStack

**Depends on:**
- `@nekostack/schema` — permission catalog, AuthContext shape, AccessDecision shape.
- `@nekostack/telemetry` — emits events.
- `@nekostack/audit` — every AccessDecision creates an audit record.
- `@nekostack/entitlements` — entitlement check is part of AccessDecision.
- External providers — Auth.js / Clerk / Supabase / Firebase as adapters.

**Used by:**
- Every API endpoint that needs auth (most of them).
- **NekoVibe** — actor/tenant/permission gating on profile + economy + leaderboard mutations.
- **NekoSystems** — agent platform authorization.
- **Leytide** — server-side player action authorization.
- **NekoBattler** — admin/balance-edit gating, replay-share permissions.
- Future Business-OS / retail-ops SaaS — multi-tenant authorization.

## Design philosophy

- **One AuthContext shape.** Every request resolves to a single AuthContext. Downstream code reads from it, never from session cookies or raw tokens.
- **Provider adapters are swappable.** Switching from Auth.js to Clerk to a custom passkey flow is one adapter change, not a rewrite.
- **Permissions are typed.** The permission `grooming.schedule.write` is a known string from a generated catalog, not a free-form string.
- **AccessDecision is the audit unit.** Every protected operation produces a decision; every decision is auditable.
- **Deny-by-default.** Absence of an explicit permit means deny. No silent pass-throughs.
- **Tenant-safe by construction.** Tenant isolation is enforced at the policy layer; missing it requires explicit override.
- **No login UI in this package.** We provide the policy backbone; UI lives in `@nekostack/ui` patterns.

## Architecture sketch

```
packages/auth/
├── src/
│   ├── schemas/
│   │   ├── actor.ts
│   │   ├── tenant.ts
│   │   ├── role.ts
│   │   ├── permission.ts
│   │   ├── entitlement.ts
│   │   ├── auth-context.ts
│   │   └── access-decision.ts
│   ├── policies/
│   │   ├── rbac.ts           # role-based primitives
│   │   ├── abac.ts           # attribute-based primitives
│   │   ├── compose.ts        # policy composition
│   │   └── catalog.ts        # registered permission strings
│   ├── adapters/
│   │   ├── authjs.ts
│   │   ├── clerk.ts
│   │   ├── supabase.ts
│   │   ├── firebase.ts
│   │   └── local-dev.ts
│   ├── middleware/
│   │   ├── nest.ts           # Nest guards
│   │   ├── express.ts        # Express middleware
│   │   ├── nextjs.ts         # Next.js route handlers
│   │   └── fastify.ts
│   ├── audit/
│   │   └── emit.ts           # AccessDecision → audit event
│   ├── tenant/
│   │   └── isolate.ts        # tenant-clause injection helpers
│   └── testing/
│       └── fixtures.ts       # AuthContext factories for tests
├── tests/
└── README.md
```

Permission decoration example (Nest):

```ts
@Controller('champions')
@UseGuards(NekoAuthGuard)
export class ChampionsController {
  @Patch(':id/balance')
  @RequirePermission('champion.balance.edit')
  @RequireEntitlement('balance-editor')
  async updateBalance(/* ... */) {
    /* AccessDecision already resolved; audit already emitted */
  }
}
```

Direct decision:

```ts
const decision = await authz.decide(authContext, {
  action: 'puzzle.unpublish',
  resource: { type: 'puzzle', id: puzzleId, tenantId: orgId },
});

if (!decision.allowed) throw new ForbiddenException(decision.reasonCode);
```

## Roadmap

### v0.1 — Core schemas
- AuthContext, AccessDecision, Permission, Role, Tenant schemas.
- Permission catalog registry.

### v0.2 — Policy engine
- RBAC primitives.
- `decide()` function.

### v0.3 — Local-dev adapter
- Synthetic-user mode for development without a real provider.

### v0.4 — Real provider adapters
- Auth.js adapter (highest-priority based on NekoVibe usage).
- Clerk adapter (for projects that prefer hosted).
- Supabase adapter.
- Firebase adapter.

### v0.5 — Framework middleware
- Nest guards, Express middleware, Next.js handlers.

### v0.6 — ABAC + composition
- Attribute-based primitives.
- Policy composition (and/or).

### v0.7 — Audit integration
- Tight coupling with `@nekostack/audit`.
- Tamper-evident decision logs.

### v0.8 — Tenant isolation
- Tenant-clause injection helpers.
- Drift-detection tests (RLS-style checks).

### v1.0 — Stable contract
- Documentation site with provider-migration recipes.
- Security audit (external).

## Product potential

**Internal use:** Essential. The authorization spine of every SaaS-shaped project.

**Open source release:** Strong. The policy-layer-over-provider concept is genuinely undersupplied. Casbin and Oso exist but don't integrate with TS schema layers as tightly. MIT release could be impactful.

**Commercial product:** **High potential as a managed product.** Closest analogues: Permit.io, Aserto, Cerbos. The market is real, growing, and these companies have raised significant funding. A NekoStack-native, schema-typed, audit-emitting authorization product is a real commercial play. Of all the NekoStack packages, this is among the strongest commercial candidates.

**Estimated effort to v1.0:** 12-24 weeks of focused work. The schemas and core engine are small; provider adapters and the audit integration consume most of the time.

## Status

- **Current:** Empty placeholder. Not started.
- **Owner:** Cody (solo dev project).
- **Priority tier:** Force multiplier. Build early because nearly every product depends on it.
- **Estimated learning return:** Very high. RBAC vs ABAC theory, policy engine design, provider abstraction patterns, audit-as-first-class — all transferable and important.
