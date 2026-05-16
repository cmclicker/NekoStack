# `snippets/`

> Small reusable code/config atoms. Copy-into-project fragments too small to be a package. Single files or tiny clusters. Lives here until promoted to a package or starter.

## What lives here

The granular layer. Snippets are:

- Small (typically < ~50 lines, sometimes a tight cluster of two or three files).
- Self-contained (no NekoStack package import required to use).
- Copy-and-adapt friendly (the user pastes and modifies; we don't track derivatives).

Examples:

- `snippets/node/tsconfig/node-strict.json` — strict TS config fragment, copy into a `tsconfig.json`'s `compilerOptions`.
- `snippets/node/safe-write-file.ts` — atomic-write-with-rename helper, 30 lines.
- `snippets/react/accessible-modal.tsx` — focus-trap modal component, 80 lines.
- `snippets/python/pyproject-strict.toml` — strict Python project config fragment.
- `snippets/llm/structured-output-prompt.md` — small reusable prompt fragment (note: full prompts go in `prompts/`).

## What does NOT live here

| Type | Where it goes | Why |
|---|---|---|
| A full starter folder tree | `starters/` | Multi-file, scaffold-shaped |
| A complete drop-in `.eslintrc` | `configs/` | Standalone config, not a fragment |
| A function that should be importable as a library | `packages/` | If it runs and others import, it's a package |
| Long-form explanation of *why* this pattern | `references/` | Doctrine, not the snippet itself |
| A complete working demo app | `examples/` | Too large for a snippet |

The distinguishing tests:

- **Snippet vs starter** — size + multi-file shape. Snippets are atoms; starters are scaffolds.
- **Snippet vs config** — completeness. A snippet is a *fragment* of a config; a config is *drop-in complete*.
- **Snippet vs package** — does it run as imported code? If yes → package. If it's pasted-and-adapted → snippet.

## Naming + sharding

Shard by **tooling or domain** at the first level:

- `snippets/node/` — Node / TS snippets
- `snippets/react/` — React snippets
- `snippets/python/` — Python snippets
- `snippets/llm/` — prompt fragments + LLM-side utilities
- `snippets/sql/` — SQL fragments

Inside a shard, second-level shards by **tool** when natural:

- `snippets/node/tsconfig/` — tsconfig fragments
- `snippets/node/jest/` — Jest fragments
- `snippets/node/vite/` — Vite fragments

File names: kebab-case + the file's natural extension. `safe-write-file.ts`, `accessible-modal.tsx`, `node-strict.json`.

## How to add a snippet

1. Pick the right shard.
2. Write the file. Keep it small.
3. Add a brief comment header explaining what it does, what it requires, when to use it.
4. If the snippet has multiple variants (e.g., a strict vs lenient version), use suffix: `node-strict.json` / `node-lenient.json`.
5. Don't add tests — snippets are for copying. If something needs tests, it's a package.

## Promotion path

A snippet should be promoted when:

- It's pasted into 3+ projects, and they all want to update together.
- It grows past ~50 lines and starts to have its own internal structure.
- Consumers want to depend on it as imported code.

Promotion targets:

- → `packages/<name>` if it should be imported.
- → `starters/<shard>/<name>/` if it grew into a scaffold.
- → `configs/<tool>/<name>` if it became a complete drop-in.

When promoting, leave a stub at the old location pointing to the new home (or delete the snippet entirely and note the promotion in a commit message).

## See also

- [`ARTIFACTS.md`](../ARTIFACTS.md) — taxonomy.
- [`starters/`](../starters/README.md) — for full scaffolds.
- [`configs/`](../configs/README.md) — for drop-in configs.
- [`packages/`](../packages/) — for code that runs.
