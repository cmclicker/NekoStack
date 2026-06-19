# @nekostack/seed

> Seed data + fixtures + demo content. Plausible test/demo data for any NekoStack project.

## Quick reference

| | |
|---|---|
| **Build tier** | Documentation / scaffolding |
| **Depends on** | `schema` (seed data shapes), `test` (factory primitives), `random`, `id`, `tenant` |
| **Used by** | dev environment bootstrap, demo deployments, tests, `templates` includes seeds |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 2â€“4 weeks focused |

## Why this exists

Every project needs "give me a working dataset for local dev." Without seeds: empty DB, half-broken UI, no way to demo. `seed` is the convention.

Note: smaller scope than other packages. Could be a few files inside each project; lifting to a package keeps the convention consistent across the stack.

## Scope

### In scope
- Seed data factories per domain (users / tenants / champions / etc.).
- Demo-content generators (realistic-looking data).
- Multi-tenant seed (populate multiple tenants).
- Deterministic seeding (same seed â†’ same dataset).
- CLI: `neko seed apply` / `seed clear`.

### Out of scope
- Test factories (`test`).
- Migration data (`migrate`).
- Production data import (`import`).

## Boundary

### Owns
- Seed data factories per domain
- Demo content generators
- Multi-tenant seed
- Deterministic seeding
- CLI

### Does NOT own
| Capability | Lives in |
|---|---|
| Test factories | `test` (we use) |
| Migration data | `migrate` |
| Production import | `import` |
| Random primitives | `random` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **Prisma seed** | Mature. | Prisma-coupled. |
| **Custom seed scripts** | Common. | What we replace. |

## How this fits the NekoStack

- **`test`** factories are the substrate.
- **`random`** for deterministic content.
- **`tenant`** for multi-tenant seeds.
- **`templates`** ships with seeds.

## Design philosophy

- **Plausible, not random.** Real-looking names, real-looking data.
- **Multi-tenant by default.** Most products are multi-tenant; seed both.
- **Deterministic.** Same seed â†’ same dataset.

## Architecture sketch

```
packages/seed/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ factories/
â”‚   â”‚   â”œâ”€â”€ users.ts
â”‚   â”‚   â”œâ”€â”€ tenants.ts
â”‚   â”‚   â””â”€â”€ domain-specific.ts
â”‚   â”œâ”€â”€ demo/
â”‚   â”‚   â””â”€â”€ content.ts
â”‚   â”œâ”€â”€ multi-tenant/
â”‚   â”‚   â””â”€â”€ populate.ts
â”‚   â”œâ”€â”€ deterministic/
â”‚   â”‚   â””â”€â”€ seed.ts             # via random
â”‚   â””â”€â”€ cli.ts                  # `neko seed apply / clear`
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Basic factories (users / tenants)
### v0.2 â€” Domain-specific seeds per consumer
### v0.3 â€” Demo content
### v0.4 â€” Multi-tenant
### v0.5 â€” CLI
### v1.0 â€” Stable API

## Product potential

**Internal:** Dev + demo environments.
**Open source release:** Marginal.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Documentation / scaffolding â€” supporting.
- **Estimated learning return:** Moderate. Realistic data generation, deterministic seeding.
