# `scripts/`

> Repo-wide automation scripts. Run from the root of the workspace.

Per [`manifests/README.md`](../manifests/README.md), generators for cross-cutting manifests may live here or under a dedicated package. `scripts/` is the lightweight choice for small repo-infrastructure generators that have no package surface of their own.

### When to promote a script to a package

Promote into `@nekostack/registry` (or another appropriate package) when the script meets **any** of these:

- It needs types shared with consumers (importing a package's contract, exporting one of its own).
- It has multiple consumers that should each pin a version.
- It encodes domain logic that belongs to a package's stated boundary in [`BOUNDARIES.md`](../BOUNDARIES.md).
- It pulls non-trivial external dependencies that would otherwise spread to the repo root.

Line count alone is **not** a promotion trigger. A 600-line plain-Node generator with no deps, no imports, and a single consumer is fine here. A 50-line script that crosses any of the bullets above belongs in a package.

### `git tag` requirement

Generators that read git refs (currently `generate-status.mjs`) require the local clone to have the relevant tags present. Locally this is automatic. In CI:

- GitHub Actions: `actions/checkout` defaults to a shallow clone with no tags. Use `fetch-depth: 0` (full history including tags) or add an explicit `git fetch --tags --prune --no-recurse-submodules` step before `npm run status:check`.
- Other CI providers: ensure tags matching the relevant `tag_prefix` are fetched.

A status:check run against a tagless clone will silently report an empty milestone list — diagnose by running `git tag --list 'schema-v*'` and confirming it's non-empty.

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
