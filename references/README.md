# `references/`

> Doctrine + learning notes. The personal engineering handbook. Explains *how a tooling works* and *how NekoStack uses it*. Read to learn or refresh; not copied wholesale.

## What lives here

Long-form explanatory content — not implementation, not scaffolding, not procedure. The kind of thing you'd write after reading a paper, debugging a subtle bug, or absorbing a new library so future-you (or a Claude session) doesn't have to re-discover.

Examples of canonical entries:

- `references/node/package-json.md` — field-by-field explanation of `package.json`, with NekoStack-specific conventions called out.
- `references/react/component-architecture.md` — when to use compound components vs render props vs hooks; the NekoStack take.
- `references/python/packaging.md` — `pyproject.toml`, PEP 517/518, build backends; how NekoSystems uses it.
- `references/distributed/cap-theorem.md` — what CAP actually says (and what it doesn't), with NekoStack's positioning (mostly AP, sometimes CP at audit boundary).
- `references/llm/prompt-engineering.md` — distilled prompt-engineering doctrine for the NekoStack way.

## What does NOT live here

| Type | Where it goes | Why |
|---|---|---|
| A 200-line starter Nest module | `starters/` | Scaffold, not doctrine |
| A 10-line Zod schema fragment | `snippets/` | Atom, not doctrine |
| An `.eslintrc` you can drop in | `configs/` | Drop-in config |
| A 7-item pre-release checklist | `checklists/` | Verification list |
| An "incident response" procedure | `playbooks/` | Narrative procedure |
| A working demo app | `examples/` | Demonstration |
| A formal architectural decision record | `decisions/` | Decision, not learning note |
| The rule "all PRs must have a 'why'" | `standards/` | Hard rule, not doctrine |

The distinguishing test: **references explain understanding; standards/decisions encode commitments.** A reference can be updated as understanding deepens; a standard or decision is the binding outcome.

## Naming + sharding

Sub-folders represent **tooling or domain**. Common shards:

- `references/node/` — Node / TS / npm ecosystem
- `references/react/` — React / Next.js / frontend patterns
- `references/python/` — Python tooling (NekoSystems-relevant)
- `references/distributed/` — distributed systems theory + NekoStack positioning
- `references/llm/` — LLM-related doctrine
- `references/game/` — game-design + game-systems CS topics

File names: kebab-case, descriptive nouns. `prompt-engineering.md`, not `notes-2026-05.md`.

Inside each file, prefer:

1. **One-paragraph TL;DR** at the top.
2. **The doctrine itself** (multiple sections OK).
3. **How NekoStack applies this** — the bridge from general knowledge to specific consumption.
4. **External links** — papers, blog posts, docs that informed the writeup.

## How to add a reference

1. Find the right shard (`references/<tooling>/`). Create one if no existing shard fits and the new shard will accumulate.
2. Write the entry. Don't shy from length — a reference is allowed to be a small essay.
3. If the reference describes a pattern that wants to become enforceable, *also* write the standard in `standards/`. The reference explains; the standard binds.
4. Cross-link from any package README that benefits ("See `references/llm/prompt-engineering.md` for the doctrine.").

## When references rot

References can go stale (a library evolves, a pattern is superseded). When this happens:

- Don't silently update — note the supersession date at the top.
- If the supersession is significant, write a fresh reference and link old → new.
- If the topic gains a hard rule, promote the conclusion to `standards/`.

## See also

- [`ARTIFACTS.md`](../ARTIFACTS.md) — the canonical artifact taxonomy.
- [`standards/`](../standards/README.md) — for hard rules (commitments, not explanations).
- [`decisions/`](../decisions/README.md) — for formal ADRs (commitments with provenance).
