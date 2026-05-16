# @nekostack/story

> Branching dialog + narrative scripting. Twine / Ink / Yarn territory. The substrate for interactive narrative, deduction-game cases, dialogue trees.

## Quick reference

| | |
|---|---|
| **Build tier** | Content / narrative |
| **Depends on** | `schema`, `codex` (characters/locations as entities), `rules` (story triggers), `validator` (continuity), `state` / `flow` (state machines) |
| **Used by** | Mara Kane (interactive episodes if/when), Leytide (NPC dialog + quests), deduction-game mystery cases, narrative-tool authoring |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 10–16 weeks focused |
| **Sellable?** | Plausible OSS — TS narrative scripting library is undersupplied |

## Why this exists

Interactive narrative needs: branching paths, character state tracking, conditional triggers, variable substitution, save / restore mid-narrative. Tools like Ink and Yarn exist but are language-specific. `story` is the TS-native equivalent.

## Scope

### In scope
- Narrative scripting DSL (passages + choices + variables).
- Branching paths.
- Conditional triggers (if / unless / once / always).
- Character state tracking.
- Inventory references (if the consuming game has one).
- Variable substitution in text.
- Save / restore mid-narrative.
- Deduction-game primitives (clue / evidence / accusation).
- Localization integration.

### Out of scope
- Game state itself (consuming game).
- Real-time multiplayer narrative (`realtime`).
- Audio playback (`audio`).
- Rich text rendering (`editor` / `md`).

## Boundary

### Owns
- Narrative scripting DSL
- Branching paths
- Conditional triggers
- Variable substitution
- Save / restore
- Deduction-game primitives (clues / evidence)

### Does NOT own
| Capability | Lives in |
|---|---|
| Characters as entities | `codex` |
| Rule engine | `rules` (we use for triggers) |
| Validation of continuity | `validator` |
| Localization | `locale` |
| Wiki rendering | `wiki` |
| Editor UI | `editor` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **Ink** | Mature narrative scripting. | Inkle's language; not TS-native. |
| **Yarn Spinner** | Game dialog tool. | Unity-coupled. |
| **Twine** | Hypertext fiction. | Older, output-shaped. |
| **Custom dialogue trees** | Common in games. | Reinvented per game. |

## How this fits the NekoStack

- **`codex`** for characters / locations.
- **`rules`** for trigger conditions.
- **`validator`** for narrative continuity.
- **`locale`** for translations.

## Design philosophy

- **Branching is first-class.** Trees, not linear scripts.
- **State-driven.** Characters and inventory affect available choices.
- **Save / restore mid-narrative.** Player progress preserved.
- **Deduction primitives.** Clues + evidence + accusations are a first-class subset.

## Architecture sketch

```
packages/story/
├── src/
│   ├── dsl/
│   │   ├── passage.ts
│   │   ├── choice.ts
│   │   └── variable.ts
│   ├── branching/
│   │   └── tree.ts
│   ├── triggers/
│   │   └── conditional.ts      # via rules
│   ├── state/
│   │   ├── character.ts
│   │   └── inventory.ts
│   ├── substitute/
│   │   └── render.ts
│   ├── save/
│   │   ├── snapshot.ts
│   │   └── restore.ts
│   ├── deduction/
│   │   ├── clue.ts
│   │   ├── evidence.ts
│   │   └── accusation.ts
│   ├── locale/
│   │   └── translate.ts        # via locale
│   └── cli.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Passage + choice DSL
### v0.2 — Branching execution
### v0.3 — Variable substitution
### v0.4 — Conditional triggers
### v0.5 — Save / restore
### v0.6 — Deduction primitives
### v0.7 — Localization
### v1.0 — Stable API

## Product potential

**Internal:** Mara Kane interactive, Leytide dialog, deduction games.
**Open source release:** Plausible — TS narrative library gap.
**Commercial:** Marginal.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Content / narrative.
- **Estimated learning return:** Very high. Branching narrative design, state-driven dialog, deduction-game primitives.
