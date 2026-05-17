# `scripts/`

> Repo-wide automation scripts. Run from the root of the workspace.

Per [`manifests/README.md`](../manifests/README.md), generators for cross-cutting manifests may live here or under a dedicated package. `scripts/` is the lightweight choice for small generators with no shared types — when a generator grows past ~300 lines or needs types shared with consumers, promote it under `@nekostack/registry`.

## Conventions

- **Plain `.mjs` is the default.** No transpile, no devDep. If a script needs TypeScript types (because it consumes a package's contract), promote it to a package instead.
- **Each script is invocable via `npm run`.** Wire the script through root `package.json` so the canonical interface is the script name, not the file path.
- **Generators expose two subcommands:** `generate` (write outputs) and `check` (exit nonzero on drift). The `check` form is what CI runs.
- **Inputs are explicit.** Generators read declared input files; they do not scrape arbitrary repo state.

## Current scripts

| Script | Subcommands | Inputs | Outputs |
|---|---|---|---|
| `generate-status.mjs` | `generate`, `check` | `manifests/workspace.config.json`, per-package `ROADMAP.md` + `CHANGELOG.md`, `git tag`, top-level `PRODUCT_THESIS.md` | `manifests/workspace-status.json`, `docs/STATUS.md` |

## See also

- [`manifests/README.md`](../manifests/README.md) — what gets generated and why.
- [`ARTIFACTS.md`](../ARTIFACTS.md) — `scripts/` is not in the artifact taxonomy because it's machinery, not content. The outputs it produces (`manifests/*`, `docs/*`) are.
