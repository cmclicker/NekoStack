# @nekostack/workspace

> The multi-project context layer. Knows what projects exist locally, which one is active, where each lives on disk, what state each is in. The "where am I, what's around me" answer for every NekoStack-consuming tool and every Claude session.

## Quick reference

| | |
|---|---|
| **Build tier** | Meta / control plane — needed early for any multi-project tooling |
| **Depends on** | `schema` (workspace manifest), `graph` (intra-monorepo package deps), `lint` (consumes the dep graph for boundary enforcement), external: `simple-git` or comparable for git status |
| **Used by** | `cli` (most subcommands need to know which project is active), `path` (queries workspace for active project), `session` (current-session context), `env` (devcontainer/docker-compose are per-workspace), every developer-tooling integration |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 6–10 weeks focused |
| **Sellable?** | Low — plumbing. MIT release as part of stack. |

## Why this exists

A solo dev with `Projects/Leytide`, `Projects/NekoVibe`, `Projects/NekoBattler`, etc. needs to answer mundane-but-load-bearing questions constantly:

- "Which project am I in right now?"
- "What other projects exist on this machine?"
- "Is `NekoVibe` dirty? Has it been committed lately?"
- "What internal packages does `Leytide` depend on?"
- "Where is `NekoSystems` actually located on disk?"
- "Which project does this file belong to?"

Without an explicit workspace layer, every tool re-invents these answers. CLI subcommands guess. Path uses `process.cwd()` and hopes. Session records lose track when you switch directories. Claude sessions can't reason about cross-project state.

`workspace` is the package that owns those answers. It maintains a registry of projects (their disk locations, kinds, current state), reads git status per project, builds the intra-monorepo package dependency graph (for NekoStack itself), and provides a stable API for any other tool to query.

## Scope

### In scope
- Workspace registry (which projects exist + their disk paths).
- Project root detection from any path inside a project.
- Active-project resolver ("which project does cwd belong to?").
- Workspace switching (declare a different project as active).
- Local path alias resolution.
- Monorepo package map (for NekoStack itself + any consuming Turbo/pnpm monorepo).
- Git status reading per project (dirty count, branch, ahead/behind).
- Repo health summary per project.
- Project metadata manifest (kind, summary, owner).
- Package dependency graph computation.
- Cross-project / cross-package dashboard data feed.

### Out of scope
- Project portfolio model + state machine (that's `path`).
- Dev session state (`session`).
- Devcontainer / docker-compose declarative spec (`env`).
- Git operations beyond reading status (git mutations are deliberate, not workspace's job).
- File watching (could be added later; not v1).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §2 for the full capability map.

### Owns
- Workspace registry + project root detection
- Active project resolver
- Workspace switching
- Multi-package monorepo map
- Git status reading (read-only)
- Repo health summary
- Project metadata manifest
- Intra-monorepo package dependency graph computation

### Does NOT own
| Capability | Lives in |
|---|---|
| Project portfolio + lifecycle state | `path` |
| Dev session records | `session` |
| Devcontainer / docker-compose | `env` |
| Architectural-pattern enforcement on the dep graph | `lint` (consumes our graph) |
| Package boundary rules | `lint` |
| Generic graph primitives | `graph` |
| Git mutations (commit / push / branch) | external (we're read-only) |
| File watching | TBD (could be added) |

## Competitors and adjacent tools

| Tool | What they do well | Where they fall short for us |
|---|---|---|
| **Nx workspace** | Mature monorepo workspace model. | Nx-coupled; assumes Nx conventions. |
| **Turbo workspaces** | We use Turbo for NekoStack. | Turbo is the task runner; the workspace concept is separate. |
| **pnpm workspaces** | Substrate for monorepo deps. | We sit above; pnpm doesn't know about cross-monorepo projects. |
| **VS Code workspaces** | IDE-level concept. | IDE-specific; not programmatically queryable in our shape. |
| **`find` + `git status` shell scripts** | Cheap. | What this package replaces with a typed API. |

The right framing: **a TS-native, schema-typed, multi-project workspace registry** that doesn't assume any particular monorepo tool. Works for a flat `Projects/` directory of independent repos *and* for a Turbo monorepo with packages.

## How this fits the NekoStack

- **`cli`** queries workspace to scope subcommands ("which project am I in?").
- **`path`** keeps the portfolio state; workspace tells it which project is active right now.
- **`session`** records the current session's project context, pulled from workspace.
- **`env`** generates devcontainer / docker-compose per project; workspace knows where each project lives.
- **`lint`** consumes the package dependency graph to enforce architectural boundaries.
- **`graph`** is the substrate for the dep graph.

## Design philosophy

- **Read-only by default.** This package observes; mutations to the filesystem are explicit and live in other packages.
- **No assumption of a single monorepo.** Some users (like you) have many independent repos under `Projects/`. The workspace model covers that.
- **Cheap queries.** Git status reads are cached with TTL; the API is fast enough to call on every CLI invocation.
- **Stable disk-path discovery.** Project root detection works from any subpath via marker files (`.git`, `package.json` with a NekoStack manifest, etc.).
- **Project kind taxonomy.** `game`, `saas`, `narrative`, `utility-kit`, `library`, etc. — drives downstream tooling behavior.

## Architecture sketch

```
packages/workspace/
├── src/
│   ├── registry/
│   │   ├── workspace.ts      # Workspace type + projects[]
│   │   ├── project.ts        # Project type with path + kind + metadata
│   │   └── manifest.ts       # neko-workspace.yaml format
│   ├── discovery/
│   │   ├── root.ts           # project root from any path
│   │   ├── scan.ts           # discover projects under a directory
│   │   └── markers.ts        # which files indicate a project root
│   ├── active/
│   │   ├── resolve.ts        # active project from cwd
│   │   └── switch.ts         # explicit switching
│   ├── git/
│   │   ├── status.ts         # read-only status query
│   │   └── health.ts         # dirty count, branch, last commit
│   ├── monorepo/
│   │   ├── packages.ts       # enumerate packages
│   │   └── deps.ts           # package dependency graph (uses graph)
│   ├── dashboard/
│   │   └── feed.ts           # cross-project data
│   └── cli.ts                # `neko workspace status / list / switch`
├── tests/
└── README.md
```

CLI shape:

```
$ neko workspace status              # active project + health
$ neko workspace list                # all known projects + kind + state
$ neko workspace switch leytide      # set active project
$ neko workspace deps                # package dep graph (current monorepo)
```

## Roadmap

### v0.1 — Project root + scan
- Marker-based project root detection.
- Workspace registry from `neko-workspace.yaml` or auto-scan.

### v0.2 — Active project + switching
- cwd → active project resolution.
- Explicit switching with state persisted.

### v0.3 — Git status
- Read-only status query per project.
- Cached with TTL.

### v0.4 — Monorepo package map
- Enumerate workspace packages.
- Build dep graph using `graph` substrate.

### v0.5 — Repo health summary
- Branch / dirty / ahead-behind / last-commit-age.

### v0.6 — Dashboard data feed
- Cross-project aggregated data for UI consumers.

### v1.0 — Stable API
- Documentation site.
- Recipes for the flat-Projects-directory and Turbo-monorepo patterns.

## Product potential

**Internal:** High — multi-project tooling can't be coherent without it.

**Open source release:** Modest. The niche is small and tool-specific. MIT release as part of stack.

**Commercial:** Unlikely. Plumbing.

## Status

- **Current:** Empty placeholder. Not started.
- **Owner:** Cody (solo dev).
- **Priority tier:** Meta / control plane. Build after `path` (path defines the project model; workspace tracks disk reality).
- **Estimated learning return:** Moderate. Multi-project workspace modeling, root-detection patterns, git CLI interop, dependency graph construction — practical infrastructure skills.
