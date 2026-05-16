# @nekostack/seed

> Seed data + fixtures + demo content. Plausible test/demo data for any NekoStack project.

## Quick reference

| | |
|---|---|
| **Build tier** | Documentation / scaffolding |
| **Depends on** | `schema` (seed data shapes), `test` (factory primitives), `random`, `id`, `tenant` |
| **Used by** | dev environment bootstrap, demo deployments, tests, `templates` includes seeds |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 2–4 weeks focused |
| **Sellable?** | Low — small support module |

## Why this exists

Every project needs "give me a working dataset for local dev." Without seeds: empty DB, half-broken UI, no way to demo. `seed` is the convention.

Note: smaller scope than other packages. Could be a few files inside each project; lifting to a package keeps the convention consistent across the stack.

## Scope

### In scope
- Seed data factories per domain (users / tenants / champions / etc.).
- Demo-content generators (realistic-looking data).
- Multi-tenant seed (populate multiple tenants).
- Deterministic seeding (same seed → same dataset).
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
- **Deterministic.** Same seed → same dataset.

## Architecture sketch

```
packages/seed/
├── src/
│   ├── factories/
│   │   ├── users.ts
│   │   ├── tenants.ts
│   │   └── domain-specific.ts
│   ├── demo/
│   │   └── content.ts
│   ├── multi-tenant/
│   │   └── populate.ts
│   ├── deterministic/
│   │   └── seed.ts             # via random
│   └── cli.ts                  # `neko seed apply / clear`
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Basic factories (users / tenants)
### v0.2 — Domain-specific seeds per consumer
### v0.3 — Demo content
### v0.4 — Multi-tenant
### v0.5 — CLI
### v1.0 — Stable API

## Product potential

**Internal:** Dev + demo environments.
**Open source release:** Marginal.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Documentation / scaffolding — supporting.
- **Estimated learning return:** Moderate. Realistic data generation, deterministic seeding.
