# @nekostack/export

> Versioned data export, GDPR DSAR (data subject access request) scaffold. The "give me my data" layer every product needs eventually and never thinks about until they're asked for it. Distinct from `backup` (operational disaster-recovery) and `saves` (per-game).

## Quick reference

| | |
|---|---|
| **Build tier** | SaaS layer â€” build before any product reaches production-with-paying-customers |
| **Depends on** | `schema` (exporter schemas), `codex` (Codex entities have natural exporter shape), `audit` (every export audited), `auth` (permission-gated), `cli` (export subcommands), `compliance` (retention + redaction policies) |
| **Used by** | NekoVibe (account export), NekoSystems (tenant / workflow data export), retail-ops, EdTech, Mara Kane (narrative bible snapshots), any product handling user data |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 8â€“12 weeks focused |

## Why this exists

Sooner or later, every product gets asked: "Can I have a copy of my data?" That request comes from:

- **A power user** who wants to archive or migrate.
- **A regulator** under GDPR Article 15 (right of access) or CCPA equivalents.
- **An enterprise customer** doing due diligence.
- **You yourself** wanting a backup before a risky migration.
- **A churned customer** who deserves a clean exit.

If you haven't planned for it, you scramble to write a one-off script that approximates the right answer. Every time. With drift. Often with missing fields.

`@nekostack/export` is the proper way to handle this from day one. You declare exporters per data domain. Each exporter knows the entity shape, the privacy posture (what's user data vs system data), the format options (JSON, CSV, Parquet, NDJSON), and the version. The framework handles streaming, chunking, file generation, and packaging.

The same machinery handles the *reverse* â€” versioned imports with validation and migration. A user export from v1 of your schema can be imported into v2 with declared migration steps.

Building this yourself rather than using something like Airbyte / Singer is justified because:
1. **Those are ETL tools.** Your problem isn't moving data between systems; it's giving a user their data.
2. **Schema integration.** Exports are typed against `@nekostack/schema` and validated.
3. **GDPR posture.** What counts as "the user's data" is product-specific; a generic ETL tool can't make that call.
4. **Self-contained, no service dependency.** No external pipeline to deploy.

## Scope

### In scope
- Exporter definition per data domain: query, transform, format.
- Output formats: JSON, NDJSON, CSV, Parquet (streaming).
- Streaming output for large datasets (no full-buffer in memory).
- Packaging: ZIP / tar with manifest, schema version, generation timestamp.
- DSAR helpers: "all data for user X" multi-domain export.
- Import side: read an exported archive, validate against current schema, run migrations.
- Versioning: each exporter declares its schema version; archives include version metadata.
- Migration registry: `from_v1_to_v2(record)` functions for schema evolution.
- Tenant-scoped exports for multi-tenant systems.
- CLI integration: `neko export user <id>`, `neko export tenant <id>`.

### Out of scope
- Real-time data streaming (Kafka, etc.). Batch only.
- Cross-system ETL. We export *out of* a NekoStack product; we don't replicate between systems.
- Encryption at rest. Could integrate with `@nekostack/crypto` for export-archive encryption later.
- Long-term retention storage. We produce archives; storing them is your problem.

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§27 for the full capability map.

### Owns
- Per-domain exporter definitions
- DSAR multi-domain orchestration ("all data for user X")
- Streaming output (no full-buffer in memory)
- Versioned archive format with manifest
- Output formats (JSON / NDJSON / CSV / Parquet)
- Tenant-scoped exports
- ZIP / tar packaging
- Schema version metadata on archives

### Does NOT own
| Capability | Lives in |
|---|---|
| Importing previously-exported archives | `import` (symmetric package) |
| Operational backup / disaster recovery / point-in-time | `backup` |
| Per-game save data | `saves` |
| Real-time data streaming (Kafka, etc.) | out of scope (batch only) |
| Cross-system ETL (Airbyte-style) | out of scope (we export *out of* a product) |
| Encryption-at-rest for archives | future (would integrate with `crypto`) |
| Long-term retention storage | `compliance` (retention policy) + `backup` (storage) |
| Compliance evidence collection | `compliance` |
| Audit log of export operations | `audit` (we emit) |

## Competitors and adjacent tools

| Tool | What they do well | Where they fall short for us |
|---|---|---|
| **Airbyte / Fivetran / Stitch** | ETL pipelines. | Wrong shape â€” these move data between systems on schedule, not "user requests their data." |
| **Singer.io** | Open-source ETL spec. | Same shape issue. |
| **Hasura / PostgREST** | Read APIs over Postgres. | Real-time read, not bulk export with versioning. |
| **GDPR-specific tools** (OneTrust, DataGrail) | Compliance-side workflow + audit. | Enterprise pricing, focused on legal workflow, not the technical export. |
| **Ad-hoc Postgres `COPY` + scripts** | Common practice. | What this package replaces. |
| **CSV libraries / Parquet libraries** | The substrates. | We orchestrate them. |

The right framing: **a versioned export framework** specifically for "export the user's / tenant's data in a clean, importable, versioned archive." Closer in shape to Discourse's user export feature than to Airbyte.

## How this fits the NekoStack

**Depends on:**
- `@nekostack/schema` â€” exporter schemas, version declarations.
- `@nekostack/codex` â€” Codex entities have natural exporter shape.
- `@nekostack/audit` â€” every export emits an audit record.
- `@nekostack/auth` â€” exports require explicit permission.
- `@nekostack/cli` â€” `neko export` subcommands.

**Used by:**
- Any product that operates on user data: NekoVibe (account export), NekoSystems (tenant / workflow data export), retail-ops (operational data export), EdTech (progress export), Mara Kane (narrative bible snapshots).

## Design philosophy

- **Exports are typed and versioned.** No untyped CSV dumps. Every archive carries a manifest.
- **Streaming, not buffered.** A 10GB export shouldn't OOM the process.
- **DSAR by default.** "Give me all data about user X" is the standard request; the framework makes it easy.
- **Imports round-trip.** Every export must be importable into a clean instance (modulo migration).
- **Tenant isolation.** Multi-tenant exports never leak across tenants.
- **Audit everything.** Export creation is a sensitive operation; every export is logged.

## Architecture sketch

```
packages/export/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ exporter/
â”‚   â”‚   â”œâ”€â”€ define.ts         # defineExporter()
â”‚   â”‚   â”œâ”€â”€ query.ts          # data source query
â”‚   â”‚   â””â”€â”€ transform.ts      # row-level transformation
â”‚   â”œâ”€â”€ format/
â”‚   â”‚   â”œâ”€â”€ json.ts
â”‚   â”‚   â”œâ”€â”€ ndjson.ts
â”‚   â”‚   â”œâ”€â”€ csv.ts
â”‚   â”‚   â””â”€â”€ parquet.ts
â”‚   â”œâ”€â”€ streaming/
â”‚   â”‚   â”œâ”€â”€ chunk.ts
â”‚   â”‚   â””â”€â”€ pipeline.ts
â”‚   â”œâ”€â”€ archive/
â”‚   â”‚   â”œâ”€â”€ zip.ts
â”‚   â”‚   â”œâ”€â”€ tar.ts
â”‚   â”‚   â””â”€â”€ manifest.ts
â”‚   â”œâ”€â”€ dsar/
â”‚   â”‚   â””â”€â”€ all-data.ts       # "everything about this user" orchestrator
â”‚   â”œâ”€â”€ import/
â”‚   â”‚   â”œâ”€â”€ reader.ts
â”‚   â”‚   â”œâ”€â”€ validator.ts
â”‚   â”‚   â””â”€â”€ migrate.ts
â”‚   â”œâ”€â”€ versioning/
â”‚   â”‚   â””â”€â”€ migration.ts
â”‚   â””â”€â”€ cli.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

Defining an exporter:

```ts
import { defineExporter, s } from '@nekostack/export';

export const ProfileExporter = defineExporter({
  name: 'profile',
  schemaVersion: 1,
  schema: s.object({ /* ... */ }),
  query: (ctx) => db.profile.findMany({ where: { userId: ctx.userId } }),
});

// DSAR
const archive = await exports.allForUser(userId, {
  exporters: ['profile', 'attempts', 'audit', 'crates', 'preferences'],
  format: 'json',
  package: 'zip',
});
```

## Roadmap

### v0.1 â€” Exporter definition + JSON
- `defineExporter`, simple JSON output.
- In-memory packaging.

### v0.2 â€” Streaming
- Streaming pipeline (no full-buffer).
- NDJSON, CSV outputs.

### v0.3 â€” Archive packaging
- ZIP and tar with manifest.
- Schema version metadata.

### v0.4 â€” DSAR orchestration
- Multi-exporter assembly.
- User-scoped + tenant-scoped helpers.

### v0.5 â€” Parquet output
- Streaming Parquet generation.

### v0.6 â€” Import side
- Archive reader.
- Schema-validated row-level import.

### v0.7 â€” Migrations
- `from_vN_to_vN+1` declaration + execution.

### v0.8 â€” Audit + auth integration
- Every export emits audit; permissions enforced.

### v1.0 â€” Stable API
- Documentation site with GDPR recipes.

## Product potential

**Internal use:** Underrated but valuable. Every product needs this eventually.

**Open source release:** Strong. The "user data export framework for TS apps" niche is genuinely empty. Most products write one-off scripts. MIT release could attract real users, especially with GDPR pressure.


**Estimated effort to v1.0:** 8-12 weeks of focused work. Streaming pipelines and Parquet output consume the most time.

## Status

- **Current:** Empty placeholder. Not started.
- **Owner:** Cody (solo dev project).
- **Priority tier:** SaaS layer. Build before any product reaches production-with-paying-customers status; afterward, regulators don't wait.
- **Estimated learning return:** High. Schema evolution, streaming pipelines, format conversion, compliance-shaped design â€” all valuable.
