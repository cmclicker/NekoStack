# @nekostack/migrate

> Schema + data migrations with rollback strategy. Zero-downtime patterns. Backward-compatibility windows. The "evolve the database without breaking production" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Data layer |
| **Depends on** | `schema` (version declarations), `audit` (migrations audited), `cli` (`neko migrate up`); external: Prisma migrate / Drizzle Kit as substrate |
| **Used by** | every backend with a database; `import` (uses migration definitions during archive import); `backup` (snapshot before migrate) |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 8–14 weeks focused |
| **Sellable?** | Modest — Prisma / Drizzle handle this; integration angle |

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

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §25 for the full capability map.

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
├── src/
│   ├── runner/
│   │   ├── up.ts
│   │   ├── down.ts            # rollback
│   │   └── status.ts
│   ├── data/
│   │   ├── transform.ts       # row-level
│   │   └── batch.ts
│   ├── rollback/
│   │   ├── strategy.ts
│   │   └── forward-fix.ts
│   ├── patterns/
│   │   ├── zero-downtime.ts   # add-then-remove templates
│   │   └── expand-contract.ts
│   ├── audit/
│   │   └── emit.ts
│   ├── backup-hook/
│   │   └── pre-migrate.ts
│   ├── test/
│   │   └── against-fixture.ts
│   ├── adapters/
│   │   ├── prisma.ts
│   │   └── drizzle.ts
│   └── cli.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Prisma adapter + up/down
### v0.2 — Data migration with batching
### v0.3 — Migration audit
### v0.4 — Pre-migrate backup hook
### v0.5 — Zero-downtime templates
### v0.6 — Drizzle adapter
### v0.7 — Test-against-fixture
### v1.0 — Stable API

## Product potential

**Internal:** Required for any product with a database.
**Open source release:** Modest — wraps mature substrates.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Data layer.
- **Estimated learning return:** High. Zero-downtime migration patterns, rollback strategies, expand-contract approach — production data engineering.
