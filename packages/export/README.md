# @nekostack/export

> Versioned data export, GDPR DSAR (data subject access request) scaffold, point-in-time backups, import validation. The "give me my data" layer every product needs eventually and never thinks about until they're asked for it.

## Why this exists

Sooner or later, every product gets asked: "Can I have a copy of my data?" That request comes from:

- **A power user** who wants to archive or migrate.
- **A regulator** under GDPR Article 15 (right of access) or CCPA equivalents.
- **An enterprise customer** doing due diligence.
- **You yourself** wanting a backup before a risky migration.
- **A churned customer** who deserves a clean exit.

If you haven't planned for it, you scramble to write a one-off script that approximates the right answer. Every time. With drift. Often with missing fields.

`@nekostack/export` is the proper way to handle this from day one. You declare exporters per data domain. Each exporter knows the entity shape, the privacy posture (what's user data vs system data), the format options (JSON, CSV, Parquet, NDJSON), and the version. The framework handles streaming, chunking, file generation, and packaging.

The same machinery handles the *reverse* — versioned imports with validation and migration. A user export from v1 of your schema can be imported into v2 with declared migration steps.

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

## Competitors and adjacent tools

| Tool | What they do well | Where they fall short for us |
|---|---|---|
| **Airbyte / Fivetran / Stitch** | ETL pipelines. | Wrong shape — these move data between systems on schedule, not "user requests their data." |
| **Singer.io** | Open-source ETL spec. | Same shape issue. |
| **Hasura / PostgREST** | Read APIs over Postgres. | Real-time read, not bulk export with versioning. |
| **GDPR-specific tools** (OneTrust, DataGrail) | Compliance-side workflow + audit. | Enterprise pricing, focused on legal workflow, not the technical export. |
| **Ad-hoc Postgres `COPY` + scripts** | Common practice. | What this package replaces. |
| **CSV libraries / Parquet libraries** | The substrates. | We orchestrate them. |

The right framing: **a versioned export framework** specifically for "export the user's / tenant's data in a clean, importable, versioned archive." Closer in shape to Discourse's user export feature than to Airbyte.

## How this fits the NekoStack

**Depends on:**
- `@nekostack/schema` — exporter schemas, version declarations.
- `@nekostack/codex` — Codex entities have natural exporter shape.
- `@nekostack/audit` — every export emits an audit record.
- `@nekostack/auth` — exports require explicit permission.
- `@nekostack/cli` — `neko export` subcommands.

**Used by:**
- Any product that operates on user data: NekoVibe (account export), NekoSystems (agent / workflow export), retail-ops (operational data export), EdTech (progress export), Mara Kane (narrative bible snapshots).

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
├── src/
│   ├── exporter/
│   │   ├── define.ts         # defineExporter()
│   │   ├── query.ts          # data source query
│   │   └── transform.ts      # row-level transformation
│   ├── format/
│   │   ├── json.ts
│   │   ├── ndjson.ts
│   │   ├── csv.ts
│   │   └── parquet.ts
│   ├── streaming/
│   │   ├── chunk.ts
│   │   └── pipeline.ts
│   ├── archive/
│   │   ├── zip.ts
│   │   ├── tar.ts
│   │   └── manifest.ts
│   ├── dsar/
│   │   └── all-data.ts       # "everything about this user" orchestrator
│   ├── import/
│   │   ├── reader.ts
│   │   ├── validator.ts
│   │   └── migrate.ts
│   ├── versioning/
│   │   └── migration.ts
│   └── cli.ts
├── tests/
└── README.md
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

### v0.1 — Exporter definition + JSON
- `defineExporter`, simple JSON output.
- In-memory packaging.

### v0.2 — Streaming
- Streaming pipeline (no full-buffer).
- NDJSON, CSV outputs.

### v0.3 — Archive packaging
- ZIP and tar with manifest.
- Schema version metadata.

### v0.4 — DSAR orchestration
- Multi-exporter assembly.
- User-scoped + tenant-scoped helpers.

### v0.5 — Parquet output
- Streaming Parquet generation.

### v0.6 — Import side
- Archive reader.
- Schema-validated row-level import.

### v0.7 — Migrations
- `from_vN_to_vN+1` declaration + execution.

### v0.8 — Audit + auth integration
- Every export emits audit; permissions enforced.

### v1.0 — Stable API
- Documentation site with GDPR recipes.

## Product potential

**Internal use:** Underrated but valuable. Every product needs this eventually.

**Open source release:** Strong. The "user data export framework for TS apps" niche is genuinely empty. Most products write one-off scripts. MIT release could attract real users, especially with GDPR pressure.

**Commercial product:** Plausible as a **"hosted compliance + export"** product (OneTrust competitor at SMB price). Real opportunity given regulatory pressure.

**Estimated effort to v1.0:** 8-12 weeks of focused work. Streaming pipelines and Parquet output consume the most time.

## Status

- **Current:** Empty placeholder. Not started.
- **Owner:** Cody (solo dev project).
- **Priority tier:** SaaS layer. Build before any product reaches production-with-paying-customers status; afterward, regulators don't wait.
- **Estimated learning return:** High. Schema evolution, streaming pipelines, format conversion, compliance-shaped design — all valuable.
