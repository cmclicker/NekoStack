# `decisions/`

> Architectural decision records (ADRs) as file snapshots. Append-only in practice. Sibling to the `@nekostack/decision` package (the engine); this folder is the file-system source of truth.

## What lives here

Markdown files capturing significant decisions — architectural, product, process. Each file:

- Is numbered sequentially (`0001-`, `0002-`, ...).
- Has a stable status (`proposed` / `accepted` / `deprecated` / `superseded`).
- Documents context, alternatives considered, the decision, and consequences.
- Is rarely modified after acceptance (superseded by writing a new ADR, not editing the old one).

Examples:

- `decisions/0001-monorepo.md` — Use a single monorepo for NekoStack.
- `decisions/0002-schema-as-source-of-truth.md` — `@nekostack/schema` is the canonical type definition layer; all derivations downstream.
- `decisions/0003-game-ai-named-ai.md` — `@nekostack/ai` is game AI; LLM stuff lives in `prompts/tools/chat/rag/memory/eval`.
- `decisions/0014-asset-vs-package-split.md` — Asset layer and package layer governed by separate documents (ARTIFACTS.md vs BOUNDARIES.md).
- `decisions/0021-starters-not-templates.md` — Asset folder is named `starters/` to disambiguate from `@nekostack/templates` package.

Each decision file follows the format:

```markdown
# ADR 0014 — Asset vs Package Split

- **Status:** accepted (2026-05-15)
- **Supersedes:** —
- **Superseded by:** —
- **Tags:** architecture, organization

## Context

[The situation requiring a decision]

## Decision

[The chosen direction, stated clearly]

## Alternatives considered

- Option A — [why rejected]
- Option B — [why rejected]

## Consequences

[Positive + negative outcomes; what becomes easier, what becomes harder]
```

## What does NOT live here

| Type | Where it goes | Why |
|---|---|---|
| The ADR engine + storage layer | `@nekostack/decision` package | Code, not content |
| Doctrine explaining decision theory | `references/` | Explanation, not decisions |
| Hard rules NekoStack follows | `standards/` | Rules, not decision history |
| Informal learning notes | `references/` | Not formal commitments |
| A list of issues / problems to address | `manifests/` or `path` project state | Different artifact |

The distinguishing test: **is this a decision we made, with stakes and alternatives?** If yes → decision. If it's the rationale behind a rule → reference, then enforce as standard.

## Relationship to `@nekostack/decision` package

- **`decisions/` folder** = file-system source of truth. Human-authored Markdown. Version-controlled with the rest of the repo.
- **`@nekostack/decision` package** = the engine. Provides queries, dependency graphs, review-date scheduling, supersession-chain navigation. Consumes the folder.

The package can be implemented later; the folder works as-is for solo dev today.

## Naming + sharding

Most decisions are flat. The numbered prefix gives global ordering. Use kebab-case for the slug:

- `decisions/0001-monorepo.md`
- `decisions/0014-asset-vs-package-split.md`

Shard only at scale (50+ ADRs). Possible future shards: `decisions/architecture/`, `decisions/product/`, `decisions/process/`.

## How to add a decision

1. Confirm this is a decision, not a learning note. If reversible without cost, it's probably a reference.
2. Pick the next number.
3. Write the ADR following the format above. Be honest about alternatives.
4. Mark status `proposed`. (For solo-dev, the next commit usually flips to `accepted`.)
5. After acceptance, modifying is rare. To change the decision, write a new ADR that supersedes.

## Supersession

A decision is never silently revised. To change one:

1. Write a new ADR (`0042-revised-stance-on-X.md`).
2. Set the new one's `Supersedes:` to the old number.
3. Set the old one's `Superseded by:` to the new number.
4. Update any standards / references that cite the old decision.

This keeps the historical trail intact.

## See also

- [`ARTIFACTS.md`](../ARTIFACTS.md) — taxonomy.
- [`@nekostack/decision`](../packages/decision/README.md) — the engine that consumes this folder.
- [`standards/`](../standards/README.md) — for rules that may be derived from decisions.
- [`references/`](../references/README.md) — for doctrine behind decisions.
