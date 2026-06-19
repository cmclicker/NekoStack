# @nekostack/id

> ID generation: UUID / ULID / nanoid / branded types / deterministic IDs / slugs / tenant-scoped IDs. The "what's the canonical ID format here?" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Utility primitives |
| **Depends on** | `schema` (branded ID types), `tenant` (tenant-scoped IDs), `crypto` (cryptographic random); external: uuid, ulid, nanoid |
| **Used by** | every package generating IDs |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 2â€“4 weeks focused |

## Why this exists

Every project generates IDs. Without a convention: some use UUID v4, some ULID, some custom prefixes, some unprefixed. Cross-project references break. `id` provides the conventions + typed wrappers.

## Scope

### In scope
- UUID v4 / v7 generation.
- ULID generation (time-sortable).
- nanoid (short, URL-safe).
- Branded TypeScript IDs (`UserId`, `TenantId` â€” compile-error if mixed).
- Deterministic IDs (content-addressable hashes).
- Slug generation from strings.
- Tenant-scoped IDs (`<tenant>:<resource>:<id>`).
- ID prefix conventions (`usr_`, `org_`, etc.).
- Validation helpers.

### Out of scope
- Cryptographic primitives (`crypto`).
- Schema definitions (`schema`).
- Tenant identity (`tenant`).

## Boundary

### Owns
- UUID / ULID / nanoid generation
- Branded TS IDs
- Deterministic / content-addressable IDs
- Slug generation
- Tenant-scoped ID convention
- ID prefix conventions
- Validation

### Does NOT own
| Capability | Lives in |
|---|---|
| Cryptographic primitives | `crypto` |
| Schema definitions | `schema` |
| Tenant identity | `tenant` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **uuid / ulid / nanoid** | Substrates. | We wrap. |
| **Stripe-style prefixed IDs** | Convention. | We codify. |
| **Custom `Math.random()` IDs** | Bad practice. | We replace. |

## How this fits the NekoStack

- Every package uses us.
- **`schema`** for branded types.
- **`tenant`** for tenant scoping.
- **`crypto`** for cryptographic random.

## Design philosophy

- **Branded types catch bugs.** `UserId` â‰  `TenantId`; compiler enforces.
- **Time-sortable when sensible.** ULID over UUID v4 for log-shaped data.
- **Prefixes are conventions.** `usr_xxx` is more debuggable than `xxx`.
- **Tenant-scoped IDs explicit.** Cross-tenant references can't collide.

## Architecture sketch

```
packages/id/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ uuid/
â”‚   â”‚   â”œâ”€â”€ v4.ts
â”‚   â”‚   â””â”€â”€ v7.ts
â”‚   â”œâ”€â”€ ulid/
â”‚   â”‚   â””â”€â”€ generate.ts
â”‚   â”œâ”€â”€ nanoid/
â”‚   â”‚   â””â”€â”€ generate.ts
â”‚   â”œâ”€â”€ branded/
â”‚   â”‚   â””â”€â”€ type.ts
â”‚   â”œâ”€â”€ deterministic/
â”‚   â”‚   â””â”€â”€ content-hash.ts     # via crypto
â”‚   â”œâ”€â”€ slug/
â”‚   â”‚   â””â”€â”€ generate.ts
â”‚   â”œâ”€â”€ tenant-scoped/
â”‚   â”‚   â””â”€â”€ format.ts           # via tenant
â”‚   â”œâ”€â”€ prefix/
â”‚   â”‚   â””â”€â”€ convention.ts
â”‚   â””â”€â”€ validate/
â”‚       â””â”€â”€ check.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” UUID / ULID / nanoid wrappers
### v0.2 â€” Branded types
### v0.3 â€” Slug generation
### v0.4 â€” Prefix conventions
### v0.5 â€” Tenant-scoped IDs
### v0.6 â€” Deterministic IDs
### v0.7 â€” Validation
### v1.0 â€” Stable API

## Product potential

**Internal:** Used everywhere.
**Open source release:** Marginal.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Utility primitives.
- **Estimated learning return:** Moderate. Branded types, time-sortable IDs, slug normalization.
