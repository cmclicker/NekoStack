# @nekostack/audio

> Audio engine: sprite sheets, music management, ducking, accessibility (dialogue boost / mono / subtitles), per-channel routing. The "make this game sound good" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Game systems |
| **Depends on** | `schema`, `assets` (audio sprites), `a11y` (accessibility settings) |
| **Used by** | every game with audio: NekoBattler, NekoGacha, Leytide |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 8â€“12 weeks focused |

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

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§43 (audio row).

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
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ sprite/
â”‚   â”‚   â””â”€â”€ playback.ts
â”‚   â”œâ”€â”€ music/
â”‚   â”‚   â”œâ”€â”€ crossfade.ts
â”‚   â”‚   â””â”€â”€ layered.ts
â”‚   â”œâ”€â”€ sfx/
â”‚   â”‚   â””â”€â”€ one-shot.ts
â”‚   â”œâ”€â”€ duck/
â”‚   â”‚   â””â”€â”€ auto.ts
â”‚   â”œâ”€â”€ channel/
â”‚   â”‚   â””â”€â”€ route.ts
â”‚   â”œâ”€â”€ a11y/
â”‚   â”‚   â”œâ”€â”€ boost.ts
â”‚   â”‚   â”œâ”€â”€ mono.ts
â”‚   â”‚   â””â”€â”€ reduce-freq.ts
â”‚   â”œâ”€â”€ subtitle/
â”‚   â”‚   â””â”€â”€ feed.ts
â”‚   â””â”€â”€ spatial/
â”‚       â””â”€â”€ pan.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Sprite playback + SFX
### v0.2 â€” Music with cross-fade
### v0.3 â€” Per-channel routing
### v0.4 â€” Ducking
### v0.5 â€” Accessibility (dialogue boost, mono)
### v0.6 â€” Layered music
### v0.7 â€” Spatial audio
### v1.0 â€” Stable API

## Product potential

**Internal:** Used by all games.
**Open source release:** Plausible â€” accessibility-first audio is rare.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Game systems.
- **Estimated learning return:** High. Web Audio API depth, ducking algorithms, accessibility audio considerations.
