# @nekostack/import

> Symmetric to `export`. Read a versioned archive, validate against current schema, run migrations to bring old data forward, resolve conflicts, preview before commit, rollback on failure.

## Quick reference

| | |
|---|---|
| **Build tier** | SaaS layer â€” pairs with `export` |
| **Depends on** | `schema` (validation), `migrate` (data-shape migrations), `changeset` (preview + rollback), `audit` (import operations audited), `tenant` (scoped imports), `codex` (entity imports) |
| **Used by** | tenant migration flows, NekoVibe account re-import, NekoSystems workflow import, Mara Kane narrative-bible restore, any product that ships data egress and needs reverse path |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 6â€“10 weeks focused |

## Why this exists

`export` produces archives. Without a corresponding `import`, those archives are write-only. Real workflows need:

- Restore a tenant's data from a previous export.
- Migrate a tenant from one self-hosted instance to another.
- Import seed data from a fixture archive in tests.
- Re-import a user's GDPR data dump into a new account (account migration).
- Round-trip integration tests (export â†’ import â†’ verify equivalence).

Hand-rolling import per project means re-implementing validation, migration, conflict resolution, and rollback five times. `import` is the package that handles them once.

## Scope

### In scope
- Archive reader (JSON / NDJSON / CSV / Parquet, ZIP / tar packaging).
- Schema-validated row-level import.
- Cross-version migration on import (archive vN â†’ current vN+M).
- Conflict resolution policies (skip-existing / overwrite / merge / error).
- Import preview / dry-run (uses `changeset` patterns).
- Import rollback on failure.
- Tenant-scoped imports.
- Source adapters for non-NekoStack archives (Stripe data dump, external CMS, etc.).
- CLI: `neko import <archive> --dry-run`, `neko import <archive> --confirm`.

### Out of scope
- Real-time data streaming.
- ETL between live systems.
- File-upload UI.
- Schema-incompatible imports (we require migration path; we don't infer).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§28 for the full capability map.

### Owns
- Archive reader (formats + packaging)
- Schema validation during import
- Migration execution on import (uses `migrate` definitions)
- Conflict resolution policies
- Dry-run preview
- Rollback on failure
- Source adapters for external systems

### Does NOT own
| Capability | Lives in |
|---|---|
| Export archive creation | `export` |
| Operational backup / restore | `backup` |
| Game save migration | `saves` |
| Schema migrations themselves | `migrate` (we execute them; migrate defines them) |
| Changeset apply mechanics | `changeset` (we use the pattern) |
| Audit log storage | `audit` (we emit) |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **Airbyte / Fivetran** | ETL pipelines. | Wrong shape â€” live system replication, not archive import. |
| **CSV import wizards** | Common per-product. | Reinvented per project. |
| **Postgres `COPY`** | Cheap. | No validation, no migration, no schema-version awareness. |

## How this fits the NekoStack

- **`export`** symmetric pair â€” same archive format.
- **`migrate`** declares migrations; we execute them during import.
- **`changeset`** preview / apply pattern reused for safe imports.
- **`audit`** records every import operation.
- **`tenant`** scopes imports per tenant.
- **`codex`** entity imports validate via codex kinds.

## Design philosophy

- **Symmetry with export.** Every exporter has a corresponding importer that round-trips.
- **Preview first.** Dry-run is the default; `--confirm` is required to mutate.
- **Migration during import.** Old-version archives import into current schema via declared migrations.
- **Tenant isolation enforced.** Imports never leak across tenants.
- **Rollback on partial failure.** Either the whole import succeeds or none of it does.

## Architecture sketch

```
packages/import/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ reader/
â”‚   â”‚   â”œâ”€â”€ archive.ts         # ZIP / tar unpacking
â”‚   â”‚   â”œâ”€â”€ json.ts
â”‚   â”‚   â”œâ”€â”€ ndjson.ts
â”‚   â”‚   â”œâ”€â”€ csv.ts
â”‚   â”‚   â””â”€â”€ parquet.ts
â”‚   â”œâ”€â”€ validate/
â”‚   â”‚   â””â”€â”€ row.ts             # schema-validated per-row import
â”‚   â”œâ”€â”€ migrate/
â”‚   â”‚   â””â”€â”€ version.ts         # archive vN â†’ current via migrate definitions
â”‚   â”œâ”€â”€ conflict/
â”‚   â”‚   â”œâ”€â”€ skip.ts
â”‚   â”‚   â”œâ”€â”€ overwrite.ts
â”‚   â”‚   â””â”€â”€ merge.ts
â”‚   â”œâ”€â”€ preview/
â”‚   â”‚   â””â”€â”€ dry-run.ts         # uses changeset patterns
â”‚   â”œâ”€â”€ apply/
â”‚   â”‚   â”œâ”€â”€ transactional.ts
â”‚   â”‚   â””â”€â”€ rollback.ts
â”‚   â”œâ”€â”€ adapters/
â”‚   â”‚   â”œâ”€â”€ stripe-export.ts
â”‚   â”‚   â””â”€â”€ generic-csv.ts
â”‚   â””â”€â”€ cli.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Reader for JSON/NDJSON + schema validation
### v0.2 â€” Conflict resolution policies
### v0.3 â€” Migration during import
### v0.4 â€” Preview / dry-run
### v0.5 â€” Transactional apply + rollback
### v0.6 â€” External source adapters
### v1.0 â€” Stable API

## Product potential

**Internal:** Required once any product has an export and users need a return path.
**Open source release:** Strong â€” pairs with export, undersupplied niche.
**Commercial:** Plausible as part of compliance / migration tooling.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** SaaS layer. Build after `export` and `migrate`.
- **Estimated learning return:** High. Schema evolution, transactional imports, conflict resolution, rollback patterns.
