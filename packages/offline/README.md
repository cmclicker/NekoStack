# @nekostack/offline

> Offline-first state + sync + conflict resolution. The "this app works without internet, syncs when back online" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Cross-platform |
| **Depends on** | `schema`, `storage`, `events` (offline mutations â†’ events), `realtime` (sync transport when online), `audit` |
| **Used by** | NekoLife (already file-based; could grow offline-first), Leytide (offline crafting / inventory), NekoVibe (offline puzzle play with sync on reconnect), any mobile-shaped product |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 10â€“16 weeks focused |

## Why this exists

Network connectivity is unreliable. Apps that demand it feel broken on subway / planes / flaky wifi. Offline-first apps work locally and sync when online. The patterns:
- Local state of truth (or coequal with server).
- Mutation queue (writes buffered offline).
- Sync on reconnect (replay queue against server).
- Conflict resolution (two devices edited the same record).

## Scope

### In scope
- Local state store (IndexedDB / SQLite).
- Mutation queue (offline writes buffered).
- Sync engine (replay queue on reconnect).
- Conflict resolution policies (last-write-wins / merge / manual).
- Version vectors for distributed state.
- Sync audit.
- Sync replay (debug).

### Out of scope
- Generic real-time transport (`realtime`).
- CRDT primitives (`realtime` Yjs adapter).
- Storage backend (`storage`).
- Service worker (`pwa`).

## Boundary

### Owns
- Local state store
- Mutation queue
- Sync engine
- Conflict resolution
- Version vectors
- Sync audit

### Does NOT own
| Capability | Lives in |
|---|---|
| Real-time transport | `realtime` |
| CRDT primitives | `realtime` (Yjs adapter) |
| Storage substrate | `storage` |
| Service worker / PWA | `pwa` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **Replicache** | Mature offline-first sync. | Closer fit; commercial. |
| **PowerSync** | OSS sync engine. | Postgres-focused. |
| **ElectricSQL** | Local-first SQLite + Postgres. | Substrate-shaped. |
| **Yjs** | CRDT. | Different layer; pairs with us. |
| **Custom sync** | Common. | Brittle. |

## How this fits the NekoStack

- **`storage`** for local persistence.
- **`events`** for offline mutation log.
- **`realtime`** for sync transport when online.
- **`audit`** for sync events.

## Design philosophy

- **Local-first.** Local state is the source of truth; server is the durable replica.
- **Mutation queue is mandatory.** Writes never lost.
- **Conflict resolution explicit.** Policies declared, not implicit.

## Architecture sketch

```
packages/offline/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ store/
â”‚   â”‚   â”œâ”€â”€ indexed-db.ts
â”‚   â”‚   â””â”€â”€ sqlite.ts
â”‚   â”œâ”€â”€ queue/
â”‚   â”‚   â”œâ”€â”€ mutation.ts
â”‚   â”‚   â””â”€â”€ replay.ts
â”‚   â”œâ”€â”€ sync/
â”‚   â”‚   â”œâ”€â”€ engine.ts
â”‚   â”‚   â””â”€â”€ reconnect.ts
â”‚   â”œâ”€â”€ conflict/
â”‚   â”‚   â”œâ”€â”€ lww.ts              # last-write-wins
â”‚   â”‚   â”œâ”€â”€ merge.ts
â”‚   â”‚   â””â”€â”€ manual.ts
â”‚   â”œâ”€â”€ version-vector/
â”‚   â”‚   â””â”€â”€ vector.ts
â”‚   â””â”€â”€ audit/
â”‚       â””â”€â”€ sync-events.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Local state + IndexedDB
### v0.2 â€” Mutation queue
### v0.3 â€” Sync engine
### v0.4 â€” Conflict resolution policies
### v0.5 â€” Version vectors
### v0.6 â€” Sync audit + replay
### v1.0 â€” Stable API

## Product potential

**Internal:** Mobile-shaped products + NekoLife.
**Open source release:** Plausible â€” local-first space is hot.
**Commercial:** Real â€” Replicache commercializes.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Cross-platform.
- **Estimated learning return:** Very high. Local-first design, sync engines, conflict resolution, version vectors â€” emerging field.
