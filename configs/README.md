# `configs/`

> Canonical config presets. Reusable tool configs (ESLint, Prettier, TS, etc.) as standalone files. Drop-in **complete**, not fragments.

## What lives here

Files that **are** a tool's config — meant to be referenced (`extends`) or copied wholesale into a new project. No further composition required.

Examples:

- `configs/typescript/node-strict.json` — strict TS config for Node packages.
- `configs/typescript/react-strict.json` — strict TS config for React apps.
- `configs/eslint/base.cjs` — base ESLint config (extended by other presets).
- `configs/eslint/react-strict.cjs` — React-focused ESLint config.
- `configs/eslint/nest-strict.cjs` — NestJS-focused ESLint config.
- `configs/prettier/default.json` — canonical Prettier config.
- `configs/gitignore/node.gitignore` — canonical `.gitignore` for Node projects.
- `configs/editorconfig/default.editorconfig` — canonical EditorConfig.

These files don't need editing to use; they are the artifact, complete.

## What does NOT live here

| Type | Where it goes | Why |
|---|---|---|
| A `tsconfig` fragment (single compiler option) | `snippets/node/tsconfig/` | Fragment, not complete |
| The runtime config validation library | `@nekostack/config` package | Code, not file |
| A full project scaffold including configs | `starters/` | Multi-file scaffold |
| The ESLint plugin / custom rules | `@nekostack/lint` package | Code, not config |
| Documentation explaining what the config does | `references/` | Doctrine |

The distinguishing test: **is this file enough on its own to be the actual config for a tool?** If yes → `configs/`. If it needs another file to compose with → `snippets/`. If it runs / has tests → `packages/`.

## Naming + sharding

Shard by **tool**, not by tooling ecosystem:

- `configs/typescript/` — `tsconfig.json` presets
- `configs/eslint/` — ESLint configs
- `configs/prettier/` — Prettier configs
- `configs/gitignore/` — `.gitignore` presets
- `configs/editorconfig/` — EditorConfig presets
- `configs/dockerignore/` — `.dockerignore` presets
- `configs/turbo/` — `turbo.json` presets
- `configs/vitest/` — Vitest config presets

A config is owned by the tool it configures. `tsconfig.json` always lives under `configs/typescript/`, never under `configs/node/`.

File names: describe the variant (`node-strict.json`, `react-loose.json`). Keep the original tool's expected extension (`.json`, `.cjs`, `.mjs`, `.toml`).

## How to add a config

1. Find the tool's shard. Create one if no existing shard fits.
2. Write the config as a complete, drop-in file.
3. Add a header comment (or sibling `README.md` for the shard) explaining:
   - When to use this variant.
   - What it extends or composes with.
   - Known compatibility constraints.
4. If multiple variants share a base, declare the inheritance (`extends`) so they compose cleanly.

## Relationship to `@nekostack/lint`

`configs/eslint/*.cjs` are the **shareable ESLint configs** that NekoStack publishes. The `@nekostack/lint` package owns the *custom rules*; `configs/eslint/` owns the *config presets that consume those rules*.

Consumers `extends: '@nekostack/eslint-config/strict'` — which resolves to a file in this folder, which imports rules from `@nekostack/lint`.

## See also

- [`ARTIFACTS.md`](../ARTIFACTS.md) — taxonomy.
- [`snippets/`](../snippets/README.md) — for config *fragments*.
- [`@nekostack/lint`](../packages/lint/README.md) — for the ESLint rule plugin.
- [`@nekostack/config`](../packages/config/README.md) — for runtime config validation (different concept entirely).
