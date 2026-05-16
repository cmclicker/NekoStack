# @nekostack/input

> Unified input abstraction: keyboard / mouse / gamepad / touch / accessibility devices. Bindings, contexts, action mapping. The "what does pressing this key do right now?" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Game systems |
| **Depends on** | `schema`, `a11y` (accessibility integration), `actions` (input → action mapping) |
| **Used by** | every game with player input: NekoBattler, NekoGacha, Leytide, NekoVibe puzzle games |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 4–8 weeks focused |
| **Sellable?** | Low — game-specific niche |

## Why this exists

Browser input handling is fragmented across DOM events, Gamepad API, touch events, pointer events. Every game reimplements binding maps, context-switching (menu vs game), accessibility devices.

`input` is the unified abstraction.

## Scope

### In scope
- Input device abstraction (keyboard / mouse / gamepad / touch).
- Action mapping (input → semantic action).
- Input contexts (menu / gameplay / paused).
- Binding configuration (player remap).
- Gamepad API wrapper.
- Touch gesture recognition.
- Accessibility device support (one-handed modes, etc.).
- Hold / double-tap / chord detection.

### Out of scope
- UI form inputs (`form`, `ui`).
- Command palette actions (`actions`).
- Game logic.

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §43 (input row).

### Owns
- Input device abstraction
- Action mapping
- Input contexts
- Binding configuration
- Gamepad / touch
- Accessibility support
- Hold / double-tap / chord

### Does NOT own
| Capability | Lives in |
|---|---|
| Form inputs | `form` |
| Command palette | `actions` |
| Accessibility primitives | `a11y` |
| Game logic | consuming games |

## How this fits the NekoStack

- **`a11y`** for accessibility integration.
- **`actions`** for command palette parity.

## Design philosophy

- **Action-mapped.** Bind keys to actions, not raw codes.
- **Context-aware.** Menu actions differ from gameplay actions.
- **Accessible.** Remappable bindings, one-handed support, alternate device modes.
- **Multi-device.** Same game playable on keyboard + gamepad + touch.

## Architecture sketch

```
packages/input/
├── src/
│   ├── devices/
│   │   ├── keyboard.ts
│   │   ├── mouse.ts
│   │   ├── gamepad.ts
│   │   └── touch.ts
│   ├── action/
│   │   ├── map.ts
│   │   └── binding.ts
│   ├── context/
│   │   └── stack.ts
│   ├── gesture/
│   │   ├── hold.ts
│   │   ├── double-tap.ts
│   │   └── chord.ts
│   └── a11y/
│       └── adapt.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Keyboard + mouse + action mapping
### v0.2 — Input contexts
### v0.3 — Gamepad
### v0.4 — Touch + gestures
### v0.5 — Binding remap
### v0.6 — Accessibility
### v1.0 — Stable API

## Product potential

**Internal:** Used by all games.
**Open source release:** Modest niche.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Game systems.
- **Estimated learning return:** Moderate. Input abstraction patterns, context stacks, accessibility considerations.
