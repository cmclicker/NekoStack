# @nekostack/migrate

> Schema + data migrations with rollback strategy. Zero-downtime patterns. Backward-compatibility windows. The "evolve the database without breaking production" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Data layer |
| **Depends on** | `schema` (version declarations), `audit` (migrations audited), `cli` (`neko migrate up`); external: Prisma migrate / Drizzle Kit as substrate |
| **Used by** | every backend with a database; `import` (uses migration definitions during archive import); `backup` (snapshot before migrate) |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 8â€“14 weeks focused |

## Why this exists

Schema migrations are routine; the dangerous parts are:
- Backward compatibility during deploys (old code reads new schema).
- Data migrations that run on millions of rows.
- Rollback when something breaks halfway through.
- Migration audit (when did this column appear, by whose change?).
- Coordinating schema migration with data migration.

`migrate` wraps Prisma migrate / Drizzle Kit / raw SQL with NekoStack-conventional patterns: declared migration steps, audit on every step, rollback playbooks, zero-downtime templates.

## Scope

### In scope
- Schema migration runner (wraps Prisma migrate / Drizzle Kit).
- Data migration (row-level transforms with batching).
- Rollback strategies (forward-fix preferred; rollback supported).
- Zero-downtime migration patterns (templates).
- Migration audit.
- Pre-migration backup integration.
- Migration testing harness (run against schema fixture).
- Backward-compatibility window declarations.

### Out of scope
- Initial DDL generation (consumer's ORM).
- Database backups (`backup`).
- Game save migrations (`saves`).
- Export archive migration on import (`import`).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§25 for the full capability map.

### Owns
- Schema migration runner
- Data migration (row-level transforms)
- Migration rollback
- Zero-downtime templates
- Migration audit
- Pre-migration backup hook
- Migration testing

### Does NOT own
| Capability | Lives in |
|---|---|
| Database backups | `backup` |
| Game save data migration | `saves` |
| Archive import migration | `import` |
| Schema definition DSL | `schema` |
| ORM | external (Prisma / Drizzle) |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **Prisma Migrate** | Mature. | Schema-only; we add data-migration + audit layer. |
| **Drizzle Kit** | Modern. | Same. |
| **golang-migrate** | Mature. | Wrong language. |
| **Flyway / Liquibase** | Java enterprise. | Wrong language. |
| **Custom SQL scripts** | Common. | No audit, no rollback discipline. |

## How this fits the NekoStack

- **`schema`** is the source-of-truth for shapes; migrations transform.
- **`backup`** runs pre-migration snapshots.
- **`audit`** records migrations.
- **`import`** uses migration definitions when importing old archives.
- **`cli`** exposes `neko migrate` subcommands.

## Design philosophy

- **Forward-fix preferred.** Rollbacks are last resort; forward-compatible changes are first choice.
- **Audit every migration.** When did this run, what did it do.
- **Backup before migrate.** Pre-migration snapshot is the safety net.
- **Backward-compat windows.** Old code reads new schema for N days.
- **Test against fixture.** Migrations run in CI against schema fixtures.

## Architecture sketch

```
packages/migrate/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ runner/
â”‚   â”‚   â”œâ”€â”€ up.ts
â”‚   â”‚   â”œâ”€â”€ down.ts            # rollback
â”‚   â”‚   â””â”€â”€ status.ts
â”‚   â”œâ”€â”€ data/
â”‚   â”‚   â”œâ”€â”€ transform.ts       # row-level
â”‚   â”‚   â””â”€â”€ batch.ts
â”‚   â”œâ”€â”€ rollback/
â”‚   â”‚   â”œâ”€â”€ strategy.ts
â”‚   â”‚   â””â”€â”€ forward-fix.ts
â”‚   â”œâ”€â”€ patterns/
â”‚   â”‚   â”œâ”€â”€ zero-downtime.ts   # add-then-remove templates
â”‚   â”‚   â””â”€â”€ expand-contract.ts
â”‚   â”œâ”€â”€ audit/
â”‚   â”‚   â””â”€â”€ emit.ts
â”‚   â”œâ”€â”€ backup-hook/
â”‚   â”‚   â””â”€â”€ pre-migrate.ts
â”‚   â”œâ”€â”€ test/
â”‚   â”‚   â””â”€â”€ against-fixture.ts
â”‚   â”œâ”€â”€ adapters/
â”‚   â”‚   â”œâ”€â”€ prisma.ts
â”‚   â”‚   â””â”€â”€ drizzle.ts
â”‚   â””â”€â”€ cli.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Prisma adapter + up/down
### v0.2 â€” Data migration with batching
### v0.3 â€” Migration audit
### v0.4 â€” Pre-migrate backup hook
### v0.5 â€” Zero-downtime templates
### v0.6 â€” Drizzle adapter
### v0.7 â€” Test-against-fixture
### v1.0 â€” Stable API

## Product potential

**Internal:** Required for any product with a database.
**Open source release:** Modest â€” wraps mature substrates.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Data layer.
- **Estimated learning return:** High. Zero-downtime migration patterns, rollback strategies, expand-contract approach â€” production data engineering.
