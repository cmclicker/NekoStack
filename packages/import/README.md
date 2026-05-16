# @nekostack/import

> Symmetric to `export`. Read a versioned archive, validate against current schema, run migrations to bring old data forward, resolve conflicts, preview before commit, rollback on failure.

## Quick reference

| | |
|---|---|
| **Build tier** | SaaS layer — pairs with `export` |
| **Depends on** | `schema` (validation), `migrate` (data-shape migrations), `changeset` (preview + rollback), `audit` (import operations audited), `tenant` (scoped imports), `codex` (entity imports) |
| **Used by** | tenant migration flows, NekoVibe account re-import, NekoSystems workflow import, Mara Kane narrative-bible restore, any product that ships data egress and needs reverse path |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 6–10 weeks focused |
| **Sellable?** | Plausible OSS — symmetric data tooling is undersupplied; pairs naturally with export sellable positioning |

## Why this exists

`export` produces archives. Without a corresponding `import`, those archives are write-only. Real workflows need:

- Restore a tenant's data from a previous export.
- Migrate a tenant from one self-hosted instance to another.
- Import seed data from a fixture archive in tests.
- Re-import a user's GDPR data dump into a new account (account migration).
- Round-trip integration tests (export → import → verify equivalence).

Hand-rolling import per project means re-implementing validation, migration, conflict resolution, and rollback five times. `import` is the package that handles them once.

## Scope

### In scope
- Archive reader (JSON / NDJSON / CSV / Parquet, ZIP / tar packaging).
- Schema-validated row-level import.
- Cross-version migration on import (archive vN → current vN+M).
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

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §28 for the full capability map.

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
| **Airbyte / Fivetran** | ETL pipelines. | Wrong shape — live system replication, not archive import. |
| **CSV import wizards** | Common per-product. | Reinvented per project. |
| **Postgres `COPY`** | Cheap. | No validation, no migration, no schema-version awareness. |

## How this fits the NekoStack

- **`export`** symmetric pair — same archive format.
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
├── src/
│   ├── reader/
│   │   ├── archive.ts         # ZIP / tar unpacking
│   │   ├── json.ts
│   │   ├── ndjson.ts
│   │   ├── csv.ts
│   │   └── parquet.ts
│   ├── validate/
│   │   └── row.ts             # schema-validated per-row import
│   ├── migrate/
│   │   └── version.ts         # archive vN → current via migrate definitions
│   ├── conflict/
│   │   ├── skip.ts
│   │   ├── overwrite.ts
│   │   └── merge.ts
│   ├── preview/
│   │   └── dry-run.ts         # uses changeset patterns
│   ├── apply/
│   │   ├── transactional.ts
│   │   └── rollback.ts
│   ├── adapters/
│   │   ├── stripe-export.ts
│   │   └── generic-csv.ts
│   └── cli.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Reader for JSON/NDJSON + schema validation
### v0.2 — Conflict resolution policies
### v0.3 — Migration during import
### v0.4 — Preview / dry-run
### v0.5 — Transactional apply + rollback
### v0.6 — External source adapters
### v1.0 — Stable API

## Product potential

**Internal:** Required once any product has an export and users need a return path.
**Open source release:** Strong — pairs with export, undersupplied niche.
**Commercial:** Plausible as part of compliance / migration tooling.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** SaaS layer. Build after `export` and `migrate`.
- **Estimated learning return:** High. Schema evolution, transactional imports, conflict resolution, rollback patterns.
