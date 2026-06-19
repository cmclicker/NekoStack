# @nekostack/registry

> The package metadata + canonical resource lookup + capability-to-package map. Reads `BOUNDARIES.md` at build time and exposes it as a queryable runtime registry. The "where does X live?" answer for code, not just humans.

## Quick reference

| | |
|---|---|
| **Build tier** | Meta / control plane â€” needed for capability-to-package programmatic queries |
| **Depends on** | `schema`, `graph` (registry structure can have edges), `lint` (enforces BOUNDARIES.md â†” registry consistency) |
| **Used by** | `cli` (subcommand discovery), `workspace` (package list), `lint` (boundary enforcement), `path` (package maturity in roadmap), `docs` (cross-link generation), LLM sessions answering "which package owns X?" |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 4â€“8 weeks focused |

## Why this exists

`BOUNDARIES.md` is the human-readable canonical ownership map. But code needs a programmatic version:

- "What package owns the capability `tenant.isolation-patterns`?"
- "Which packages depend on `@nekostack/schema`?"
- "What's the current maturity status of `@nekostack/rules`?"
- "What's the canonical ID format for a `Decision` record?"
- "Are there any capabilities with no owner (gaps)?"

`registry` is the runtime layer over `BOUNDARIES.md` + each package's `package.json` + each package's README front-matter. It parses these into typed records and exposes a query API. Other packages call it instead of grep-ing markdown.

The build-time invariant: `BOUNDARIES.md` is canonical; `registry` parses it; `lint` enforces that per-package README boundary sections agree with `registry`'s view. Disagreement is a CI failure.

## Scope

### In scope
- Package metadata registry (name / kind / maturity / version / dependencies).
- Capability-to-package ownership map (sourced from `BOUNDARIES.md`).
- Canonical resource ID lookup (`<namespace>:<kind>:<slug>` formats).
- Alias resolution (legacy names â†’ current names).
- Runtime module discovery (which packages are loaded).
- Package maturity status (scaffold / prototype / usable / stable / deprecated).
- Package release status (private / internal-only / OSS / commercial).
- Gap detection (capabilities with no owner; flagged in CI).
- Conflict detection (capabilities with multiple owners).

### Out of scope
- npm registry / external package management (`npm`, `pnpm`).
- `codex` entity registry (different layer â€” `codex` is for product content; registry is for system resources).
- Workspace package dependency graph computation (`workspace`).
- Governance rule definitions (`governance`).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§50 for the full capability map.

### Owns
- Package metadata registry
- Capability-to-package map (parsed from BOUNDARIES.md)
- Canonical resource ID lookup
- Alias resolution
- Runtime module discovery
- Package maturity + release status tracking
- Gap + conflict detection in BOUNDARIES.md

### Does NOT own
| Capability | Lives in |
|---|---|
| Codex (typed product entity graph) | `codex` |
| External package mgmt (npm/pnpm) | external |
| Workspace dep graph computation | `workspace` |
| Schema registry per se | `schema` (we point at it) |
| Prompt registry | `prompts` |
| Tool registry | `tools` |
| Generic graph primitives | `graph` |

## Competitors and adjacent tools

| Tool | What they do well | Where they fall short for us |
|---|---|---|
| **Backstage Software Catalog** | Mature internal-system catalog. | Heavyweight, enterprise-shaped. |
| **Nx project graph** | Monorepo dep graph. | Nx-coupled; doesn't model capability ownership. |
| **Ad-hoc `package.json` reading** | Cheap. | No capability layer, no maturity, no canonical ID lookup. |

## How this fits the NekoStack

- **BOUNDARIES.md** is canonical; `registry` parses it.
- **`lint`** uses `registry` to enforce that each package's README `Boundary` section agrees with BOUNDARIES.md.
- **`cli`** asks `registry` which packages contribute subcommands.
- **`workspace`** consumes the package metadata for monorepo views.
- **`path`** reads maturity status when reporting on roadmap.
- **`docs`** generates cross-package links from `registry`.

## Design philosophy

- **BOUNDARIES.md is the source.** Registry is a derived artifact; if they disagree, BOUNDARIES wins and we fail loudly.
- **Gaps are visible.** Capabilities with no owner produce CI errors, not warnings.
- **Conflicts are visible.** Two packages claiming the same capability produce CI errors.
- **Read-mostly.** Mutations to the canonical map happen via editing BOUNDARIES.md, not via API calls.

## Architecture sketch

```
packages/registry/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ parse/
â”‚   â”‚   â”œâ”€â”€ boundaries.ts     # BOUNDARIES.md â†’ typed records
â”‚   â”‚   â”œâ”€â”€ readme.ts         # per-package README Boundary section
â”‚   â”‚   â””â”€â”€ package-json.ts   # package.json metadata
â”‚   â”œâ”€â”€ query/
â”‚   â”‚   â”œâ”€â”€ by-capability.ts  # "who owns X?"
â”‚   â”‚   â”œâ”€â”€ by-package.ts     # "what does X own?"
â”‚   â”‚   â””â”€â”€ deps.ts           # "what depends on X?"
â”‚   â”œâ”€â”€ consistency/
â”‚   â”‚   â”œâ”€â”€ gaps.ts           # unowned capabilities
â”‚   â”‚   â”œâ”€â”€ conflicts.ts      # multi-owner capabilities
â”‚   â”‚   â””â”€â”€ drift.ts          # README â†” BOUNDARIES drift
â”‚   â”œâ”€â”€ ids/
â”‚   â”‚   â”œâ”€â”€ format.ts         # canonical ID conventions
â”‚   â”‚   â””â”€â”€ alias.ts
â”‚   â”œâ”€â”€ maturity/
â”‚   â”‚   â””â”€â”€ status.ts         # scaffold/prototype/usable/stable/deprecated
â”‚   â””â”€â”€ cli.ts                # `neko registry verify / query / status`
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” BOUNDARIES.md parser
### v0.2 â€” Query API (by capability / by package)
### v0.3 â€” Gap + conflict detection (CI integration)
### v0.4 â€” Drift detection (README â†” BOUNDARIES)
### v0.5 â€” Maturity status tracking
### v0.6 â€” Canonical ID + alias resolution
### v1.0 â€” Stable API

## Product potential

**Internal:** High â€” keeps BOUNDARIES.md honest.
**Open source release:** Marginal â€” useful only to NekoStack consumers.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Meta / control plane. Build early since downstream packages will rely on its consistency checks.
- **Estimated learning return:** Moderate. Markdown parsing, drift detection, registry-as-derived-artifact patterns, CI consistency-check authoring.
