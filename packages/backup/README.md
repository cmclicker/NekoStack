# @nekostack/backup

> Operational backup, restore points, point-in-time recovery, retention, archive creation. The disaster-recovery layer. **Distinct from `export`** (user-facing data egress) and **`saves`** (per-game).

## Quick reference

| | |
|---|---|
| **Build tier** | Compliance / data governance |
| **Depends on** | `schema`, `storage` (backup destination), `compliance` (retention policies), `audit` (backup operations), `time` (schedule + retention windows), `crypto` (at-rest encryption) |
| **Used by** | every product in production; SRE / disaster-recovery procedures; `compliance` cites backup posture |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 8–14 weeks focused |
| **Sellable?** | Modest — backup tooling is crowded but ops-grade backup-as-a-library is undersupplied |

## Why this exists

The three persistence words look similar but are distinct:
- **`export`** = "give the user their data" (DSAR, account migration, user-initiated).
- **`saves`** = "this player's progress in this game" (per-game schema, frequent writes).
- **`backup`** = "if production blew up, we restore from this" (operational, snapshot-shaped, retention-policy-governed).

Conflating them leads to messes:
- Daily DB snapshot is called "backup" but doesn't satisfy point-in-time recovery requirements.
- User exports are mistaken for backups (they're not — they're filtered + transformed).
- No restore test ever runs (so the "backup" is theoretical until you need it).

`backup` is the operational disaster-recovery layer. Schedules, snapshots, retention enforcement, restore validation.

## Scope

### In scope
- Backup creation (database snapshot, file-tree snapshot, object-store snapshot).
- Restore points / snapshot catalog.
- Retention policies per backup type.
- Disaster-recovery procedures (runbooks-as-code).
- Point-in-time recovery (PITR) where supported by substrate.
- Archive creation (cold storage for old projects, archived tenants).
- Restore validation (restore-to-staging tests).
- Backup audit.
- CLI: `neko backup create / list / restore / verify`.

### Out of scope
- User-facing data export (`export`).
- Game save data (`saves`).
- Schema migrations (`migrate`).
- Cloud-vendor primitives (we wrap AWS Backup / GCP / Restic / etc.).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §26 for the full capability map.

### Owns
- Backup creation + scheduling
- Restore points / snapshot catalog
- Retention policies
- Disaster-recovery procedures
- Point-in-time recovery
- Archive creation (cold storage)
- Backup validation / restore-test
- Backup audit

### Does NOT own
| Capability | Lives in |
|---|---|
| User-facing data export | `export` |
| Game save data + per-game versioning | `saves` |
| Schema / data migrations | `migrate` |
| Compliance retention policy *definitions* | `compliance` (we enforce) |
| Encryption primitives | `crypto` |
| Storage substrate (S3 / disk / etc.) | `storage` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **AWS Backup** | Cloud-native. | AWS-coupled. |
| **Restic / Borg** | Mature backup tools. | CLI-only; not a library. |
| **pg_dump / WAL-G** | Postgres-specific. | DB-specific. |
| **Custom cron jobs** | Common. | No retention enforcement, no restore tests, drift. |

## How this fits the NekoStack

- **`compliance`** defines retention policies.
- **`audit`** records backup operations.
- **`storage`** is the destination.
- **`crypto`** for at-rest encryption.
- **`time`** schedules backups.

## Design philosophy

- **Restore tests are mandatory.** A backup you can't restore is not a backup.
- **Retention is enforced.** Old backups age out automatically.
- **Multiple tiers.** Hot (last 7 days, fast restore), warm (30 days, slower), cold archive (years, slowest).
- **Encrypted at rest.** Backups carry sensitive data; encryption is default.

## Architecture sketch

```
packages/backup/
├── src/
│   ├── create/
│   │   ├── db-snapshot.ts
│   │   ├── file-tree.ts
│   │   └── object-store.ts
│   ├── catalog/
│   │   └── snapshots.ts
│   ├── retention/
│   │   ├── policy.ts
│   │   └── enforce.ts
│   ├── restore/
│   │   ├── restore.ts
│   │   └── pitr.ts            # point-in-time recovery
│   ├── archive/
│   │   └── cold.ts
│   ├── validate/
│   │   └── restore-test.ts
│   └── cli.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — DB snapshot creation + catalog
### v0.2 — Retention enforcement
### v0.3 — Restore + validation
### v0.4 — Point-in-time recovery
### v0.5 — Archive / cold storage tier
### v0.6 — Encrypted at rest
### v1.0 — Stable API

## Product potential

**Internal:** Critical for any production system.
**Open source release:** Modest — niche.
**Commercial:** None directly; bundled into broader compliance offering.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Compliance.
- **Estimated learning return:** High. Backup architecture, retention policies, restore validation, point-in-time recovery — operational engineering skills.
