# `starters/`

> Scaffold-ready starting structures. What a new project begins as. Consumed by `@nekostack/templates` (the engine) or copied by hand.

## What lives here

Self-contained folder trees that represent a working starting point. Each starter is a directory you could literally `cp -r` into a new project location and start working from.

Examples:

- `starters/node/node-ts-cli/` — Node + TS + commander CLI starter.
- `starters/react/react-dashboard/` — React dashboard app with NekoStack UI + theme integration.
- `starters/fullstack/react-node-api/` — Web frontend + Nest API + Prisma + Postgres.
- `starters/game/canvas-game/` — Canvas-based game shell with assets pipeline.
- `starters/agent/crew-agent/` — CrewAI agent shell with prompts + tools integration.

Each starter contains real files (`package.json`, `tsconfig.json`, source stubs, README, scripts) — not placeholders. The intent is "you could ship this empty starter and it would build."

## What does NOT live here

| Type | Where it goes | Why |
|---|---|---|
| The template **engine** (code that scaffolds) | `packages/templates` | Engine vs data |
| A 10-line snippet (single file or tiny cluster) | `snippets/` | Too small; starters are full trees |
| A reusable `.eslintrc` | `configs/` | Drop-in config, not a starter |
| A completed working demo (not a starting point) | `examples/` | Demos are read; starters are forked |
| Doctrine about scaffolding patterns | `references/` | Learning, not scaffolding |

The distinguishing test: **starters are empty enough to be customized; examples are complete enough to be studied.** Both are real files; the intent differs.

## Naming + sharding

Sub-folders represent **tooling or shape**:

- `starters/node/` — Node-only projects (CLIs, libraries, services without frontend)
- `starters/react/` — React-only projects (SPAs, dashboards)
- `starters/fullstack/` — combined frontend + backend
- `starters/game/` — game shells
- `starters/agent/` — agent / LLM project shells
- `starters/python/` — Python projects (NekoSystems-style)

Inside a shard, each starter is its own folder: `starters/node/node-ts-cli/`. Use kebab-case.

Each starter folder should contain:

1. **`README.md`** explaining what this starter is, what it includes, what to customize first.
2. **A working file tree** — `package.json`, configs, source stubs.
3. **A `template.config.json` (or similar)** — for `@nekostack/templates` to consume: variable substitution rules, post-init hooks.

## How to add a starter

1. Identify the gap: does an existing starter come close? If yes, parameterize the existing one. If no, add a new one.
2. Build the starter in place. Don't symlink from a working project; copy the *minimum* working files.
3. Validate: can you run `cp -r starters/<shard>/<name>/ /tmp/test-project && cd /tmp/test-project && npm install && npm run build`? If not, the starter is incomplete.
4. Add `template.config.json` so `@nekostack/templates` can consume it.
5. Cross-link from `@nekostack/templates` README.

## Promotion path

If multiple starters share substantial structure (e.g., three React starters that share a `src/lib/` shape), extract the common pieces:

- Shared snippets → `snippets/`
- Shared configs → `configs/`
- Shared documentation → `references/`

The starter then references the shared assets rather than duplicating. This keeps starters small and maintainable.

## See also

- [`ARTIFACTS.md`](../ARTIFACTS.md) — taxonomy.
- [`@nekostack/templates`](../packages/templates/README.md) — the engine that consumes starters.
- [`snippets/`](../snippets/README.md) — small fragments (sometimes the right level instead of a full starter).
- [`examples/`](../examples/README.md) — completed demos (not starting points).
