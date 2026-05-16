# @nekostack/validator

> Cross-reference + continuity + content validation. Lint-style architecture for non-code artifacts. The "did anyone break canon?" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Content / narrative |
| **Depends on** | `schema` (validation rules), `codex` (entities to cross-validate), `audit`, `provenance` (stale-artifact detection) |
| **Used by** | Mara Kane (narrative continuity checks across 20 books), NekoBattler (champion balance + ability consistency), Leytide (world consistency), `story`, `cms` (publish-time validation), CI pipelines |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 8–14 weeks focused |
| **Sellable?** | Plausible OSS — content-validation library is undersupplied |

## Why this exists

Content has rules. A character introduced in book 3 can't appear in book 1. A champion's ability can't reference a deleted trait. A puzzle's solution must be reachable from its initial state. These aren't lintable in the code sense but they're checkable.

`validator` is the lint-style framework for content rules.

## Scope

### In scope
- Validation rule DSL.
- Rule registration + execution.
- Cross-reference integrity (entity → entity links resolve).
- Narrative continuity rules (timeline, character presence, fact consistency).
- Balance rules (game-content invariants — uses `rules` for game-side).
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

- **Content has rules.** Continuity, balance, references — all checkable.
- **Rules as code.** Validators are declared, runnable, testable.
- **CI-integrated.** No PR ships content that breaks rules.
- **Auto-fix where possible.** Some rule violations have mechanical fixes.

## Architecture sketch

```
packages/validator/
├── src/
│   ├── rules/
│   │   ├── define.ts
│   │   └── catalog.ts
│   ├── cross-reference/
│   │   └── integrity.ts        # via codex
│   ├── continuity/
│   │   ├── timeline.ts
│   │   ├── character-presence.ts
│   │   └── fact-consistency.ts
│   ├── balance/
│   │   └── game-invariant.ts
│   ├── stale/
│   │   └── via-provenance.ts
│   ├── custom/
│   │   └── plugin.ts
│   ├── ci/
│   │   └── check.ts
│   └── fix/
│       └── auto.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Validation rule DSL
### v0.2 — Cross-reference integrity
### v0.3 — Custom validators
### v0.4 — Continuity rules (timeline / character-presence)
### v0.5 — Stale-content detection
### v0.6 — Auto-fix
### v0.7 — CI integration
### v1.0 — Stable API

## Product potential

**Internal:** Mara Kane especially.
**Open source release:** Plausible — content-validation library is undersupplied.
**Commercial:** Marginal.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Content / narrative.
- **Estimated learning return:** High. Cross-reference validation, continuity-rule design, auto-fix patterns.
