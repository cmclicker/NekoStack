# @nekostack/saves

> Versioned save data + cloud sync + migration + corruption recovery. The "player progress survives schema changes and bad shutdowns" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Game systems |
| **Depends on** | `schema` (save shape), `migrate` (save migration patterns), `storage` (cloud sync destination), `crypto` (save encryption), `audit` (save mutations) |
| **Used by** | every game project: NekoBattler, NekoGacha, Leytide, future tower-defense / autobattler modes |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 6–10 weeks focused |
| **Sellable?** | Modest — game-specific niche |

## Why this exists

Save data is the most player-emotionally-charged data in any game. Lose a save → players quit. Corrupt a save → support tickets forever. Old save fails to load after update → reviews tank.

The standard problems:
- Save schemas evolve; old saves must still load.
- Browser localStorage can fill up.
- Multi-device sync needs conflict resolution.
- Corruption recovery (truncated writes, JSON parse errors).
- Save scumming (anti-cheat: hash chain on saves).

## Scope

### In scope
- Save schema definition (typed, versioned).
- Save slot management.
- Migration on load (v1 save → v2 schema).
- Cloud sync (via `storage`).
- Conflict resolution (multi-device).
- Corruption recovery (last-known-good fallback).
- Save audit (every mutation recorded).
- At-rest encryption (anti-tampering).

### Out of scope
- Game state itself (consuming game defines schema).
- Replay system (`replay`).
- Operational backup (`backup`).
- User-facing export (`export`).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §87 (in BOUNDARIES.md).

### Owns
- Versioned save schema
- Save slot management
- Migration on load
- Cloud sync
- Conflict resolution
- Corruption recovery
- Save audit
- At-rest encryption

### Does NOT own
| Capability | Lives in |
|---|---|
| Game state shape | consuming game |
| Replay | `replay` |
| Operational backup | `backup` |
| User-facing data export | `export` |
| Schema migrations (general) | `migrate` (we use patterns) |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **localStorage / IndexedDB** | Browser substrate. | No versioning, sync, recovery. |
| **idb-keyval** | IndexedDB wrapper. | Substrate. |
| **Steam Cloud / EGS Cloud** | Platform-coupled. | Vendor-specific. |
| **Custom per-game** | Common. | Reinvented per game; brittle. |

## How this fits the NekoStack

- **`schema`** defines save shape.
- **`migrate`** patterns apply.
- **`storage`** for cloud sync.
- **`crypto`** for encryption.
- **`audit`** records mutations.

## Design philosophy

- **Versioned from day one.** Saves have a version tag; migrations are first-class.
- **Last-known-good fallback.** Corruption → roll back to last valid save.
- **Multi-device sync with conflict resolution.** Two devices write the same slot → resolve, don't lose data.
- **Saves are sacred.** Mutations are atomic; partial writes recoverable.

## Architecture sketch

```
packages/saves/
├── src/
│   ├── schema/
│   │   └── version.ts
│   ├── slot/
│   │   └── manager.ts
│   ├── migrate/
│   │   └── on-load.ts
│   ├── cloud/
│   │   └── sync.ts
│   ├── conflict/
│   │   └── resolve.ts
│   ├── recovery/
│   │   └── corruption.ts
│   ├── audit/
│   │   └── mutation.ts
│   └── encrypt/
│       └── at-rest.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Versioned save schema
### v0.2 — Save slot management
### v0.3 — Migration on load
### v0.4 — Corruption recovery
### v0.5 — Cloud sync
### v0.6 — Conflict resolution
### v0.7 — At-rest encryption
### v1.0 — Stable API

## Product potential

**Internal:** Every game uses this.
**Open source release:** Modest niche.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Game systems.
- **Estimated learning return:** High. Schema versioning, conflict resolution, corruption recovery — universal data engineering.
