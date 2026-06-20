# `@nekostack/cli` — Changelog

Per-milestone changes. Pairs with git tags (`cli-vX.Y.Z`) and [GitHub releases](https://github.com/cmclicker/NekoStack/releases). Format: newest first.

Published to npm as `@nekostack/cli` (Apache-2.0).

---

## cli-v1.0.1 — 2026-06-19

[Tag](https://github.com/cmclicker/NekoStack/releases/tag/cli-v1.0.1) · Patch fix for npm binary registration.

### Fixed

- **`bin/neko` → `bin/neko.js`** — npm's Windows ESM validator silently dropped the extensionless binary entry on publish, so `neko` was never registered as a global command after `npm install -g @nekostack/cli`. Renamed to `bin/neko.js` and updated `package.json` `"bin"` accordingly. The binary is now correctly installed on all platforms.

---

## cli-v1.0.0 — 2026-06-19

[Tag](https://github.com/cmclicker/NekoStack/releases/tag/cli-v1.0.0) · First public release.

### Shipped

- **`neko schema list [globs]`** — discover schema files in a project.
- **`neko schema diff [globs]`** — diff working schema against stored snapshots.
- **`neko schema check [globs]`** — validate schemas against `@nekostack/schema` contract rules.
- **`neko schema generate [globs]`** — generate Zod / TypeScript / JSON Schema / OpenAPI artifacts from schema IR.
- **`neko schema migrate list`** — list available migration files for a schema.
- **`neko schema migrate plan`** — plan a migration chain (pre-flight).
- **`neko schema migrate stub`** — generate a migration file stub.
- **`neko schema migrate verify`** — verify a migration chain is well-formed.
- **`neko init <name>`** — stub (v1.0); requires the NekoStack monorepo. Will be published in a future release.
- **`--json` flag** on all schema commands for machine-readable output (CI pipelines).
- **`dispatch(argv)` / `buildCli(opts)`** — programmatic API for in-process CLI testing.
- **Exit codes** — locked enum: `SUCCESS`, `USAGE_ERROR`, `LOGICAL_FAILURE`, `IO_ERROR`, `INTERNAL_ERROR`.

### Architecture

Commander-based dispatch. `dispatch()` never calls `process.exit`; only `run()` (the bin entry) does. All stdout/stderr writers are injected — fully testable in-process without spawning a subprocess.

### Test count

- 504 passing

### Still deferred

- Plugin registration system (packages contribute subcommands at runtime)
- `neko init` fully wired to published project templates
- `neko new <kind> <name>` scaffolding
- Interactive prompt UX (clack)
- `neko lint`, `neko sim`, `neko codex` (those packages not yet published)
