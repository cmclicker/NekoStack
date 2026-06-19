# @nekostack/cli — Scope & Invariants

## What this package is

The `neko` CLI binary. Installed via `npm install -g @nekostack/cli` or `npx neko`. Dispatches schema commands through `@nekostack/schema`. Commander-based, fully testable in-process.

## Commands (v1.0)

| Command | Description |
|---|---|
| `neko schema list [globs]` | Discover schema files |
| `neko schema diff [globs]` | Diff against stored snapshots |
| `neko schema check [globs]` | Validate against schema contract rules |
| `neko schema generate [globs]` | Generate Zod / TS / JSON Schema / OpenAPI |
| `neko schema migrate list` | List available migration files |
| `neko schema migrate plan` | Plan a migration chain |
| `neko schema migrate stub` | Generate a migration file stub |
| `neko schema migrate verify` | Verify a migration chain is well-formed |
| `neko init <name>` | Scaffold a project (stub in v1.0 — requires monorepo) |

## Invariants

1. **`dispatch()` never calls `process.exit`** — only `run()` (the bin entry) does. Enforced by the test suite.
2. **Every command returns an `EXIT_CODES` value** — `SUCCESS (0)`, `USAGE_ERROR (1)`, `LOGICAL_FAILURE (2)`, `IO_ERROR (3)`, `INTERNAL_ERROR (5)`.
3. **`--json` flag** produces machine-readable output for all schema commands.
4. **Stdout/stderr writers are injected** — `buildCli(opts)` accepts `{ stdout, stderr }` so all output is capturable in tests without subprocess spawn.
5. **Test coverage: 504 tests, 19 test files.**

## What is in scope (v1.0)

- `neko schema *` command group (8 verbs)
- Commander-based argv parsing + dispatch
- JSON output mode (`--json`)
- Programmatic API (`dispatch`, `buildCli`, `EXIT_CODES`)

## What is NOT in scope (v1.0)

- Plugin system (packages registering their own subcommands) → future
- `neko init` fully wired to published project templates → future
- `neko new <kind> <name>` scaffolding → future
- `neko lint`, `neko sim`, `neko codex` → those packages not yet published
- Interactive prompt UX (clack) → future
