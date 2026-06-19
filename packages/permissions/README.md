# @nekostack/permissions

> Permission catalog, role definitions, RBAC + ABAC primitives, capability grants. The authorization-decision-input layer lifted out of `auth`. Feeds into `auth.AccessDecision`; doesn't make the final call.

## Quick reference

| | |
|---|---|
| **Build tier** | Identity / access â€” split out of `auth` for clean ownership |
| **Depends on** | `schema` (catalog types), `audit` (permission changes audited), `tenant` (tenant-scoped role bindings), `id` (role IDs) |
| **Used by** | `auth` (feeds AccessDecision composition), `admin` (role management UI), `actions` (permission-aware commands), every API endpoint with authorization, every multi-tenant SaaS |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 8â€“12 weeks focused |

## Why this exists

Authentication is "are you logged in?" Authorization is "are you allowed to do this?" Bundling them in one package means the authorization story drifts.

Lifting `permissions` out makes:
- The **permission catalog** (typed strings like `champion.balance.edit`, `agent.create`) an explicit registered set, not free-form strings scattered across the code.
- **Role definitions** declarative (a role is a named bundle of permissions, optionally with inheritance).
- **RBAC + ABAC primitives** composable independently of login flow.
- **Resource-level permissions** ("can edit *this specific* champion") modelable.
- **Capability grants** (temporary elevation: "grant editor for 1 hour") a first-class concept.

`auth` then composes inputs from this package (along with `tenant`, `entitlements`, `limits`) into a final `AccessDecision`. This package answers "what permissions does this actor have?" â€” not "is this action allowed?"

## Scope

### In scope
- Permission catalog (typed strings, registered).
- Role definitions (a role = a bundle of permissions).
- Role hierarchy / inheritance.
- Role assignment (user â†’ role binding, optionally tenant-scoped).
- RBAC primitives (role-permission resolution).
- ABAC primitives (attribute-based predicates).
- Resource-level permissions ("can edit X *with id Y*").
- Capability grants (temporary elevation with expiry + audit).
- Permission decision input (feeds `auth.AccessDecision`).

### Out of scope
- Login flow / session (`auth`).
- AccessDecision orchestration (`auth`).
- Plan-based feature gating (`entitlements`).
- Tenant identity (`tenant`).
- Audit log storage (`audit`).
- Rate-limit-based denials (`limits`).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§10 for the full capability map.

### Owns
- Permission catalog (typed strings)
- Role definitions + inheritance
- Role assignment (with tenant scope)
- RBAC primitives
- ABAC primitives + attribute predicates
- Resource-level permissions
- Capability grants (temporary elevation)
- Permission decision input

### Does NOT own
| Capability | Lives in |
|---|---|
| Authentication / login | `auth` |
| AccessDecision composition / final allow/deny | `auth` |
| Tenant identity + lifecycle | `tenant` |
| Plan-based feature gating | `entitlements` |
| Rate / abuse limiting | `limits` |
| Audit log storage | `audit` (we emit) |
| Permission UI / management screens | `admin` (we provide data) |

## Competitors and adjacent tools

| Tool | What they do well | Where they fall short for us |
|---|---|---|
| **Casbin** | Mature, multi-model (RBAC/ABAC/RBAC-T/etc.), generic. | Generic â€” doesn't integrate with `schema` or `audit` conventions; runtime config file is its own DSL. |
| **Oso** | TS-native, principled, library + cloud. | Closer fit; we could use as substrate. Building on top vs depending on is a real choice. |
| **Cerbos** | Decoupled policy service. | Service-shaped (separate process); we want library. |
| **OPA** | Rego-based, powerful. | Heavyweight, Rego learning curve. |
| **Custom role tables** | Common practice. | Reinvented per product; permission catalog drift. |

## How this fits the NekoStack

- **`auth`** composes our outputs into AccessDecision.
- **`tenant`** scopes role bindings.
- **`schema`** validates permission catalog entries.
- **`audit`** records role assignments + grants + revocations.
- **`admin`** surfaces role management UI.
- **`actions`** can declare required permissions; we resolve.

## Design philosophy

- **Typed catalog.** Permissions are registered strings, not free-form. Typo = compile error.
- **Composable models.** RBAC and ABAC compose; pick the right one per resource.
- **Resource-level when needed.** Coarse permissions (`champion.edit`) and fine permissions (`champion.edit:<id>`) coexist.
- **Capability grants are temporary by default.** "Promote me to editor for 1 hour" â€” first-class with expiry.
- **Deny-by-default.** No permission = no access. Explicit grants required.

## Architecture sketch

```
packages/permissions/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ catalog/
â”‚   â”‚   â”œâ”€â”€ register.ts       # registerPermission(name)
â”‚   â”‚   â””â”€â”€ lookup.ts
â”‚   â”œâ”€â”€ roles/
â”‚   â”‚   â”œâ”€â”€ role.ts           # Role type + permission bundle
â”‚   â”‚   â”œâ”€â”€ hierarchy.ts
â”‚   â”‚   â””â”€â”€ assign.ts         # user-role binding (tenant-scoped)
â”‚   â”œâ”€â”€ rbac/
â”‚   â”‚   â””â”€â”€ resolve.ts        # role-permission resolution
â”‚   â”œâ”€â”€ abac/
â”‚   â”‚   â”œâ”€â”€ attribute.ts
â”‚   â”‚   â””â”€â”€ predicate.ts
â”‚   â”œâ”€â”€ resource/
â”‚   â”‚   â””â”€â”€ scoped.ts         # resource-level permissions
â”‚   â”œâ”€â”€ grants/
â”‚   â”‚   â”œâ”€â”€ grant.ts          # temporary elevation
â”‚   â”‚   â””â”€â”€ expiry.ts
â”‚   â”œâ”€â”€ decision-input/
â”‚   â”‚   â””â”€â”€ compute.ts        # output consumed by @nekostack/auth
â”‚   â””â”€â”€ cli.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Catalog + roles
### v0.2 â€” RBAC resolution
### v0.3 â€” Role hierarchy
### v0.4 â€” ABAC primitives
### v0.5 â€” Resource-level permissions
### v0.6 â€” Capability grants
### v1.0 â€” Stable API

## Product potential

**Internal:** Critical for every SaaS-shaped product.
**Open source release:** Strong â€” schema-typed permission catalog is undersupplied.
**Commercial:** Plausible â€” Cerbos / Permit.io territory; could be part of a managed-authz offering with `auth`.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Identity / access. Build alongside `auth` + `tenant`.
- **Estimated learning return:** Very high. RBAC + ABAC theory, policy engine design, capability-based grants â€” foundational and broadly applicable.
