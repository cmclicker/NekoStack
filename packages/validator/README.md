# @nekostack/validator

> Cross-reference + continuity + content validation. Lint-style architecture for non-code artifacts. The "did anyone break canon?" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Content / narrative |
| **Depends on** | `schema` (validation rules), `codex` (entities to cross-validate), `audit`, `provenance` (stale-artifact detection) |
| **Used by** | Mara Kane (narrative continuity checks across 20 books), NekoBattler (champion balance + ability consistency), Leytide (world consistency), `story`, `cms` (publish-time validation), CI pipelines |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 8â€“14 weeks focused |

## Why this exists

Content has rules. A character introduced in book 3 can't appear in book 1. A champion's ability can't reference a deleted trait. A puzzle's solution must be reachable from its initial state. These aren't lintable in the code sense but they're checkable.

`validator` is the lint-style framework for content rules.

## Scope

### In scope
- Validation rule DSL.
- Rule registration + execution.
- Cross-reference integrity (entity â†’ entity links resolve).
- Narrative continuity rules (timeline, character presence, fact consistency).
- Balance rules (game-content invariants â€” uses `rules` for game-side).
- Stale-content detection (via `provenance`).
- Custom validators per content type.
- CI integration (`neko validator check`).
- Auto-fix where mechanical.

### Out of scope
- Code lint rules (`lint`).
- Runtime form validation (`form`).
- Schema validation (`schema`).
- LLM eval (`eval`).

## Boundary

### Owns
- Validation rule DSL
- Cross-reference integrity
- Narrative continuity rules
- Stale-content detection
- Custom content validators
- CI integration
- Auto-fix

### Does NOT own
| Capability | Lives in |
|---|---|
| Code lint | `lint` |
| Form validation | `form` |
| Schema validation primitives | `schema` |
| LLM evaluation | `eval` |
| Codex entities | `codex` |
| Rule engine for game logic | `rules` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **Custom check scripts** | Common. | Reinvented per project. |
| **Vale (prose linter)** | Mature. | Prose-focused, not entity-aware. |
| **markdownlint** | Mature. | Just markdown structure. |

## How this fits the NekoStack

- **`codex`** entities checked for cross-reference integrity.
- **`schema`** for validation primitives.
- **`provenance`** for stale-content detection.
- **`audit`** records validation runs.
- **`lint`** is the code counterpart; we're content.

## Design philosophy

- **Content has rules.** Continuity, balance, references â€” all checkable.
- **Rules as code.** Validators are declared, runnable, testable.
- **CI-integrated.** No PR ships content that breaks rules.
- **Auto-fix where possible.** Some rule violations have mechanical fixes.

## Architecture sketch

```
packages/validator/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ rules/
â”‚   â”‚   â”œâ”€â”€ define.ts
â”‚   â”‚   â””â”€â”€ catalog.ts
â”‚   â”œâ”€â”€ cross-reference/
â”‚   â”‚   â””â”€â”€ integrity.ts        # via codex
â”‚   â”œâ”€â”€ continuity/
â”‚   â”‚   â”œâ”€â”€ timeline.ts
â”‚   â”‚   â”œâ”€â”€ character-presence.ts
â”‚   â”‚   â””â”€â”€ fact-consistency.ts
â”‚   â”œâ”€â”€ balance/
â”‚   â”‚   â””â”€â”€ game-invariant.ts
â”‚   â”œâ”€â”€ stale/
â”‚   â”‚   â””â”€â”€ via-provenance.ts
â”‚   â”œâ”€â”€ custom/
â”‚   â”‚   â””â”€â”€ plugin.ts
â”‚   â”œâ”€â”€ ci/
â”‚   â”‚   â””â”€â”€ check.ts
â”‚   â””â”€â”€ fix/
â”‚       â””â”€â”€ auto.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Validation rule DSL
### v0.2 â€” Cross-reference integrity
### v0.3 â€” Custom validators
### v0.4 â€” Continuity rules (timeline / character-presence)
### v0.5 â€” Stale-content detection
### v0.6 â€” Auto-fix
### v0.7 â€” CI integration
### v1.0 â€” Stable API

## Product potential

**Internal:** Mara Kane especially.
**Open source release:** Plausible â€” content-validation library is undersupplied.
**Commercial:** Marginal.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Content / narrative.
- **Estimated learning return:** High. Cross-reference validation, continuity-rule design, auto-fix patterns.
