# @nekostack/backup

> Operational backup, restore points, point-in-time recovery, retention, archive creation. The disaster-recovery layer. **Distinct from `export`** (user-facing data egress) and **`saves`** (per-game).

## Quick reference

| | |
|---|---|
| **Build tier** | Compliance / data governance |
| **Depends on** | `schema`, `storage` (backup destination), `compliance` (retention policies), `audit` (backup operations), `time` (schedule + retention windows), `crypto` (at-rest encryption) |
| **Used by** | every product in production; SRE / disaster-recovery procedures; `compliance` cites backup posture |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 8â€“14 weeks focused |

## Why this exists

The three persistence words look similar but are distinct:
- **`export`** = "give the user their data" (DSAR, account migration, user-initiated).
- **`saves`** = "this player's progress in this game" (per-game schema, frequent writes).
- **`backup`** = "if production blew up, we restore from this" (operational, snapshot-shaped, retention-policy-governed).

Conflating them leads to messes:
- Daily DB snapshot is called "backup" but doesn't satisfy point-in-time recovery requirements.
- User exports are mistaken for backups (they're not â€” they're filtered + transformed).
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

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§26 for the full capability map.

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
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ create/
â”‚   â”‚   â”œâ”€â”€ db-snapshot.ts
â”‚   â”‚   â”œâ”€â”€ file-tree.ts
â”‚   â”‚   â””â”€â”€ object-store.ts
â”‚   â”œâ”€â”€ catalog/
â”‚   â”‚   â””â”€â”€ snapshots.ts
â”‚   â”œâ”€â”€ retention/
â”‚   â”‚   â”œâ”€â”€ policy.ts
â”‚   â”‚   â””â”€â”€ enforce.ts
â”‚   â”œâ”€â”€ restore/
â”‚   â”‚   â”œâ”€â”€ restore.ts
â”‚   â”‚   â””â”€â”€ pitr.ts            # point-in-time recovery
â”‚   â”œâ”€â”€ archive/
â”‚   â”‚   â””â”€â”€ cold.ts
â”‚   â”œâ”€â”€ validate/
â”‚   â”‚   â””â”€â”€ restore-test.ts
â”‚   â””â”€â”€ cli.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” DB snapshot creation + catalog
### v0.2 â€” Retention enforcement
### v0.3 â€” Restore + validation
### v0.4 â€” Point-in-time recovery
### v0.5 â€” Archive / cold storage tier
### v0.6 â€” Encrypted at rest
### v1.0 â€” Stable API

## Product potential

**Internal:** Critical for any production system.
**Open source release:** Modest â€” niche.
**Commercial:** None directly; bundled into broader compliance offering.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Compliance.
- **Estimated learning return:** High. Backup architecture, retention policies, restore validation, point-in-time recovery â€” operational engineering skills.
