# @nekostack/story

> Branching dialog + narrative scripting. Twine / Ink / Yarn territory. The substrate for interactive narrative, deduction-game cases, dialogue trees.

## Quick reference

| | |
|---|---|
| **Build tier** | Content / narrative |
| **Depends on** | `schema`, `codex` (characters/locations as entities), `rules` (story triggers), `validator` (continuity), `state` / `flow` (state machines) |
| **Used by** | Mara Kane (interactive episodes if/when), Leytide (NPC dialog + quests), deduction-game mystery cases, narrative-tool authoring |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 10â€“16 weeks focused |

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
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ dsl/
â”‚   â”‚   â”œâ”€â”€ passage.ts
â”‚   â”‚   â”œâ”€â”€ choice.ts
â”‚   â”‚   â””â”€â”€ variable.ts
â”‚   â”œâ”€â”€ branching/
â”‚   â”‚   â””â”€â”€ tree.ts
â”‚   â”œâ”€â”€ triggers/
â”‚   â”‚   â””â”€â”€ conditional.ts      # via rules
â”‚   â”œâ”€â”€ state/
â”‚   â”‚   â”œâ”€â”€ character.ts
â”‚   â”‚   â””â”€â”€ inventory.ts
â”‚   â”œâ”€â”€ substitute/
â”‚   â”‚   â””â”€â”€ render.ts
â”‚   â”œâ”€â”€ save/
â”‚   â”‚   â”œâ”€â”€ snapshot.ts
â”‚   â”‚   â””â”€â”€ restore.ts
â”‚   â”œâ”€â”€ deduction/
â”‚   â”‚   â”œâ”€â”€ clue.ts
â”‚   â”‚   â”œâ”€â”€ evidence.ts
â”‚   â”‚   â””â”€â”€ accusation.ts
â”‚   â”œâ”€â”€ locale/
â”‚   â”‚   â””â”€â”€ translate.ts        # via locale
â”‚   â””â”€â”€ cli.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Passage + choice DSL
### v0.2 â€” Branching execution
### v0.3 â€” Variable substitution
### v0.4 â€” Conditional triggers
### v0.5 â€” Save / restore
### v0.6 â€” Deduction primitives
### v0.7 â€” Localization
### v1.0 â€” Stable API

## Product potential

**Internal:** Mara Kane interactive, Leytide dialog, deduction games.
**Open source release:** Plausible â€” TS narrative library gap.
**Commercial:** Marginal.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Content / narrative.
- **Estimated learning return:** Very high. Branching narrative design, state-driven dialog, deduction-game primitives.
