# @nekostack/replay

> Deterministic replay from seed + actions. Recording, playback, diffing, sharing. Powers anti-cheat verification, balance debugging, spectator mode, replay sharing.

## Quick reference

| | |
|---|---|
| **Build tier** | Game systems |
| **Depends on** | `schema`, `sim` (replay reruns a sim), `rules` (deterministic), `random` (seeded), `events` (action log), `storage` (replay file storage) |
| **Used by** | NekoBattler (combat replays + anti-cheat), Leytide (player-action replay), NekoGacha (pull verification), any deterministic game |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 8–12 weeks focused |
| **Sellable?** | Plausible OSS — TS deterministic replay library is rare |

## Why this exists

Deterministic replay is the foundation of:
- **Anti-cheat:** server replays the client's actions; if the result differs from the client's, the client cheated.
- **Balance debugging:** re-run the exact game that produced this weird outcome.
- **Spectator mode:** clients see real-time game by replaying server actions.
- **Replay sharing:** "watch how I beat this fight" — the URL is just seed + actions.

Done right, a replay is small (just the seed + the actions). The whole game state regenerates from those inputs.

## Scope

### In scope
- Recording: capture seed + action sequence during a sim.
- Playback: re-run the sim from seed + actions, produce identical state.
- Diff: compare two replays.
- Replay file format (versioned).
- Compression.
- Sharing-friendly URL encoding.
- Anti-cheat replay verification.
- Spectator-mode streaming.

### Out of scope
- Sim itself (`sim`).
- Rule engine (`rules`).
- Storage (`storage` provides; we use).
- Streaming protocol (`realtime` for live streaming).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §86 (in BOUNDARIES.md).

### Owns
- Replay recording
- Replay playback
- Replay diff
- Replay file format + versioning
- Compression
- Shareable URL encoding
- Anti-cheat verification

### Does NOT own
| Capability | Lives in |
|---|---|
| Sim itself | `sim` |
| Rule engine | `rules` |
| Storage backend | `storage` |
| Live streaming transport | `realtime` |
| Game save data | `saves` |

## How this fits the NekoStack

- **`sim`** is the substrate replays run against.
- **`random`** ensures determinism.
- **`rules`** must be deterministic for replays to work.
- **`storage`** stores replay files.

## Design philosophy

- **Replay = seed + actions.** Minimal storage; whole state regenerates.
- **Determinism is mandatory.** Any non-determinism breaks replays.
- **Versioned format.** Replays survive engine updates via migration.
- **Shareable.** Replay URLs are small enough to fit in a tweet.

## Architecture sketch

```
packages/replay/
├── src/
│   ├── record/
│   │   ├── capture.ts
│   │   └── action.ts
│   ├── playback/
│   │   └── rerun.ts          # via sim
│   ├── format/
│   │   ├── encode.ts
│   │   ├── decode.ts
│   │   └── version.ts
│   ├── diff/
│   │   └── compare.ts
│   ├── compress/
│   │   └── pack.ts
│   ├── share/
│   │   └── url.ts
│   ├── anti-cheat/
│   │   └── verify.ts
│   └── cli.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Record + playback
### v0.2 — Replay format (versioned)
### v0.3 — Diff
### v0.4 — Compression
### v0.5 — Sharing URLs
### v0.6 — Anti-cheat verification
### v1.0 — Stable API

## Product potential

**Internal:** Powerful for NekoBattler, Leytide.
**Open source release:** Strong — niche is empty.
**Commercial:** Marginal.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Game systems.
- **Estimated learning return:** Very high. Determinism guarantees, replay format design, anti-cheat patterns.
