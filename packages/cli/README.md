# @nekostack/cli

> The single command you type 50 times a day across every NekoStack project. Scaffolds modules, validates schemas, regenerates code, runs sims, lints architecture, exports content graphs.

## Quick reference

| | |
|---|---|
| **Build tier** | Foundation primitive — build shortly after `schema` |
| **Depends on** | `schema` (for command input validation); plugin contracts with `codex`, `lint`, `sim`, `migrate`, `assets`, every other package that contributes subcommands |
| **Used by** | every developer, every day; CI pipelines (via `--json` mode); `templates` invokes `neko init`; `actions` consumes the command catalog |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 2–4 weeks focused |
| **Sellable?** | Low — plumbing. MIT release as part of stack; unlikely to gain independent traction |

## Why this exists

Every NekoStack project has the same recurring chores:

- Create a new module (controller + service + spec + barrel export).
- Regenerate Zod/JSON Schema/OpenAPI from `*.schema.ts` files.
- Export an entity graph from `@nekostack/codex` to JSON or DOT for visualization.
- Run a balance simulation against `@nekostack/sim`.
- Validate that all controllers in a project satisfy `@nekostack/lint` rules.
- Bootstrap a new project from a `@nekostack/templates` starter.

Without a unified CLI, every project invents its own ad-hoc scripts in `package.json`, makes them slightly differently, and the dev experience fragments. Old projects forget the conventions, new projects re-discover them.

`@nekostack/cli` is the *one tool you have on your PATH* that knows about every NekoStack package. It's the conductor. It has the same arguments and verbs across every project that imports it, so muscle memory carries over.

Building this yourself rather than using a generic CLI framework is justified because:
1. **CLI UX design is a real skill.** You learn argv parsing, interactive prompts, progress reporting, error formatting, output streaming — all surprisingly deep.
2. **The CLI knows the schemas.** `neko schema generate` validates that all schema files conform to `@nekostack/schema`'s contract before regenerating outputs. A generic CLI doesn't know about your schema convention.
3. **Plugin architecture is yours.** Every NekoStack package can register CLI subcommands. This is how the conductor pattern works.

## Scope

### In scope
- CLI binary (`neko`) installable via `npm i -g @nekostack/cli` or run via `npx neko`.
- Argument parsing, flags, subcommand registration, interactive prompts.
- Plugin system — every NekoStack package can register subcommands at runtime.
- Built-in commands: `init`, `new`, `schema generate`, `codex export`, `lint`, `bench`, `migrate`, `sim run`.
- Discovery: `neko --help` lists every available subcommand including plugin-contributed ones.
- Output formatting: pretty terminal output, JSON output (for piping), quiet mode for scripts.

### Out of scope
- Project bootstrap templates — those live in `@nekostack/templates` and are *invoked by* `neko init`, not contained in this package.
- The actual schema generators — those live in `@nekostack/schema`. The CLI is a shell.
- Linting rules themselves — those live in `@nekostack/lint`. The CLI invokes them.
- A REPL or interactive shell mode. Not needed.

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §45 for the full capability map.

### Owns
- CLI binary (`neko`) + argv parsing substrate
- Plugin registration contract (every package can contribute subcommands)
- Output formatters (pretty + `--json`)
- Interactive prompt wrappers (clack-based)
- Built-in commands: `init`, `new`, `help`, `version`
- Subcommand discovery + auto-generated help
- Destructive-operation confirmation pattern

### Does NOT own
| Capability | Lives in |
|---|---|
| Project bootstrap template content | `templates` (invoked by `neko init`) |
| Schema generators | `schema` (invoked by `neko schema generate`) |
| Codex export logic | `codex` (invoked by `neko codex export`) |
| Lint rules + rule execution | `lint` (invoked by `neko lint`) |
| Sim execution | `sim` (invoked by `neko sim run`) |
| Unified action/command catalog across CLI + UI + agents | `actions` (we are the CLI surface; `actions` is the cross-surface registry) |
| Argv parsing primitives | external (commander or yargs) |
| Interactive prompts UI | external (clack) |

## Competitors and adjacent tools

| Tool | What they do well | Where they fall short for us |
|---|---|---|
| **commander** | Mature, widely used, great argv parsing. | Just a library. No plugin discovery, no project-aware behavior. |
| **yargs** | Similar to commander, slightly different ergonomics. | Same — it's the substrate, not the conductor. |
| **clack** / **@clack/prompts** | Excellent interactive prompt UX, modern. | Just the prompt UI layer. Doesn't structure commands. |
| **oclif** | Plugin-first CLI framework. | Salesforce-style ergonomics, heavy, more than needed. |
| **Nx CLI** | Mature monorepo orchestrator. | Tied to the Nx graph and conventions, not ours. |
| **Turbo CLI** | Already in our toolchain. | Task orchestration only — doesn't know about schemas, codex, lint conventions. |

The right framing: `@nekostack/cli` is built **on top of** commander or yargs (for parsing) and clack (for prompts). It is not competing with those — it's the project-aware layer that organizes their use.

## How this fits the NekoStack

**Depends on:**
- A parsing library (commander or yargs — TBD).
- An interactive prompt library (clack).
- `@nekostack/schema` — for `neko schema generate`.
- `@nekostack/codex` — for `neko codex export`.
- `@nekostack/lint` — for `neko lint`.
- `@nekostack/sim` — for `neko sim run`.

**Used by:**
- Developers working in any NekoStack-consuming project, every day.
- CI pipelines (the JSON output mode makes it scriptable).
- `@nekostack/templates` — `neko init` is how new projects are created.

## Design philosophy

- **Discoverability over memorization.** `neko` with no args prints a categorized list. `neko <command> --help` always works.
- **Pretty by default, scriptable on flag.** Output is human-friendly unless `--json` is passed. Then it's parseable.
- **Errors point at fixes.** Every error includes a one-line "try this" suggestion when possible.
- **Plugins, not monolith.** The core CLI is small. Every NekoStack package registers its own subcommands. This is how the CLI scales to ~80 packages without becoming unmaintainable.
- **No surprise filesystem writes.** Destructive operations (`neko schema generate` overwriting files, `neko migrate up` mutating the DB) always print a plan and require `--yes` or interactive confirmation.

## Architecture sketch

```
packages/cli/
├── src/
│   ├── bin/
│   │   └── neko.ts           # entry point shebang
│   ├── core/
│   │   ├── registry.ts       # plugin registration
│   │   ├── runner.ts         # command dispatch
│   │   ├── output.ts         # pretty + JSON output formatters
│   │   └── prompts.ts        # interactive prompt wrappers
│   ├── commands/             # built-in commands
│   │   ├── init.ts
│   │   ├── new.ts
│   │   ├── help.ts
│   │   └── version.ts
│   └── plugins/              # contract for package-contributed commands
├── tests/
└── README.md
```

Usage shape:

```
$ neko schema generate              # regenerate all schemas in current project
$ neko codex export --format json   # export entity graph
$ neko lint                         # run architectural lints
$ neko sim run balance --seed 42    # run a sim by name
$ neko new controller users         # scaffold a controller module
```

Plugin contract (rough):

```ts
import { definePlugin } from '@nekostack/cli';

export default definePlugin({
  name: '@nekostack/schema',
  commands: [
    {
      name: 'schema generate',
      description: 'Regenerate schema outputs',
      flags: { force: { type: 'boolean' } },
      run: async (args) => { /* ... */ },
    },
  ],
});
```

## Roadmap

### v0.1 — Bootstrap
- `neko --help`, `neko --version`.
- Parser wired up (commander or yargs).
- Basic plugin registration mechanism.

### v0.2 — Core commands
- `neko init` (bootstrap a new project from a template).
- `neko new <kind> <name>` (scaffold a module).

### v0.3 — Schema integration
- Plugin contract finalized.
- `@nekostack/schema` plugin registers `neko schema generate`.

### v0.4 — Codex + lint integration
- `neko codex export` and `neko lint` wired up.

### v0.5 — Interactive prompts
- Clack-based prompt UX for ambiguous operations.

### v1.0 — Stable plugin API
- Plugin contract frozen.
- Documentation site with command reference auto-generated from plugin metadata.

## Product potential

**Internal use:** Essential. This is how you interact with the entire stack.

**Open source release:** Lower-priority OSS candidate. CLIs are useful primarily to those already using the ecosystem they wrap. Could be MIT-released alongside the rest of NekoStack but unlikely to gain traction independently.

**Commercial product:** No direct path. This is plumbing.

**Estimated effort to v1.0:** 2-4 weeks of focused work. The hard part is the plugin contract — get that wrong and every downstream package has to revise.

## Status

- **Current:** Empty placeholder. Not started.
- **Owner:** Cody (solo dev project).
- **Priority tier:** Foundation primitive — should be built shortly after `@nekostack/schema` so other packages can register their commands.
- **Estimated learning return:** High. CLI UX design is undertaught and very transferable to any future dev tooling work.
