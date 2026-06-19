# @nekostack/cli

> The `neko` command for NekoStack projects. Schema validation, code generation, and migration management from a single binary.

## Quick reference

| | |
|---|---|
| **Install** | `npm install -g @nekostack/cli` or `npx neko` |
| **Peer dep** | `@nekostack/schema ^1.0.0` |
| **Status** | **v1.0 — released.** Schema command group complete. 504 tests. |

## Install

```bash
npm install -g @nekostack/cli
# or run without installing:
npx neko schema check ./schemas/**/*
```

## Commands (v1.0)

### Schema validation & generation

```bash
neko schema list [globs]       # discover schema files
neko schema check [globs]      # validate against @nekostack/schema rules
neko schema diff [globs]       # diff working schemas against stored snapshots
neko schema generate [globs]   # generate Zod / TypeScript / JSON Schema / OpenAPI
```

### Migration management

```bash
neko schema migrate list       # list available migration files for a schema
neko schema migrate plan       # plan a migration chain (pre-flight)
neko schema migrate stub       # generate a migration file stub
neko schema migrate verify     # verify a migration chain is well-formed
```

### Machine-readable output

All schema commands support `--json` for CI pipelines:

```bash
neko schema check ./schemas/**/* --json
```

## Programmatic API

`dispatch()` and `buildCli()` are exported for in-process testing:

```ts
import { dispatch, EXIT_CODES } from '@nekostack/cli';

const code = await dispatch(['schema', 'check', './schemas/**/*']);
if (code !== EXIT_CODES.SUCCESS) process.exit(code);
```

## Exit codes

| Code | Meaning |
|---|---|
| `0` (SUCCESS) | Command completed successfully |
| `1` (USAGE_ERROR) | Bad arguments or unknown command |
| `2` (LOGICAL_FAILURE) | Command ran but result was a failure |
| `3` (IO_ERROR) | File read/write error |
| `5` (INTERNAL_ERROR) | Unexpected internal error |

## Scope

### In scope (v1.0)
- `neko schema *` command group (8 verbs)
- Commander-based argv parsing
- JSON output mode (`--json`)
- Programmatic dispatch API

### Deferred to future releases
- `neko init <name>` — fully wired to published project templates
- `neko new <kind> <name>` — module scaffolding
- Plugin system — packages registering subcommands at runtime
- `neko lint`, `neko sim`, `neko codex` — those packages not yet published
- Interactive prompt UX

## Why this exists

Every NekoStack project has the same recurring chores: validate schemas before committing, regenerate Zod/TypeScript/OpenAPI after a schema change, plan migrations before executing them. Without a unified CLI, every project invents its own ad-hoc scripts.

`neko` is the one command that knows about the schema layer. Same verbs, same flags, same exit codes across every project.
