# @nekostack/audio

> Audio engine: sprite sheets, music management, ducking, accessibility (dialogue boost / mono / subtitles), per-channel routing. The "make this game sound good" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Game systems |
| **Depends on** | `schema`, `assets` (audio sprites), `a11y` (accessibility settings) |
| **Used by** | every game with audio: NekoBattler, NekoGacha, Leytide |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 8–12 weeks focused |
| **Sellable?** | Modest — Howler.js exists, but accessibility-first audio is rare |

## Why this exists

Web Audio API is powerful but fiddly. Every game project ends up with race conditions, music that doesn't fade, SFX that don't overlap right, no accessibility considerations.

`audio` wraps Web Audio with NekoStack-conventional behavior plus accessibility built-in.

## Scope

### In scope
- Audio sprite playback (audio sheets via `assets`).
- Music management (cross-fade, loop, layered tracks).
- SFX (one-shot, multi-instance).
- Ducking (lower music when dialogue plays).
- Per-channel volume + routing (master / music / sfx / dialogue / ambience).
- Accessibility: dialogue boost, mono downmix, reduced-frequency mode.
- Subtitles integration (data feed; UI is consumer).
- 3D spatial audio (panning + distance).

### Out of scope
- Audio asset pipeline (`assets`).
- Voice / video real-time (`realtime`).
- Music composition (out of scope).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §43 (audio row).

### Owns
- Audio sprite playback
- Music management (cross-fade, layered)
- SFX
- Ducking
- Per-channel routing
- Accessibility (boost / mono / reduced-freq)
- Subtitles data feed
- 3D spatial audio

### Does NOT own
| Capability | Lives in |
|---|---|
| Audio asset pipeline (sprite generation) | `assets` |
| Voice / video real-time | `realtime` |
| Music composition | out of scope |
| Accessibility primitives | `a11y` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **Howler.js** | Mature web audio wrapper. | No accessibility focus, no per-channel routing. |
| **Tone.js** | Music-focused. | Music creation; we're playback. |
| **Web Audio API direct** | Substrate. | Verbose. |

## How this fits the NekoStack

- **`assets`** generates the audio sprites.
- **`a11y`** drives accessibility settings.

## Design philosophy

- **Accessibility built-in.** Dialogue boost, mono downmix are first-class.
- **Per-channel routing.** Players can adjust music/SFX/dialogue independently.
- **Ducking automatic.** Music drops when dialogue plays.
- **Sprite-based for performance.** Many short SFX in one file.

## Architecture sketch

```
packages/audio/
├── src/
│   ├── sprite/
│   │   └── playback.ts
│   ├── music/
│   │   ├── crossfade.ts
│   │   └── layered.ts
│   ├── sfx/
│   │   └── one-shot.ts
│   ├── duck/
│   │   └── auto.ts
│   ├── channel/
│   │   └── route.ts
│   ├── a11y/
│   │   ├── boost.ts
│   │   ├── mono.ts
│   │   └── reduce-freq.ts
│   ├── subtitle/
│   │   └── feed.ts
│   └── spatial/
│       └── pan.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Sprite playback + SFX
### v0.2 — Music with cross-fade
### v0.3 — Per-channel routing
### v0.4 — Ducking
### v0.5 — Accessibility (dialogue boost, mono)
### v0.6 — Layered music
### v0.7 — Spatial audio
### v1.0 — Stable API

## Product potential

**Internal:** Used by all games.
**Open source release:** Plausible — accessibility-first audio is rare.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Game systems.
- **Estimated learning return:** High. Web Audio API depth, ducking algorithms, accessibility audio considerations.
