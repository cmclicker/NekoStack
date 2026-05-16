# @nekostack/registry

> The package metadata + canonical resource lookup + capability-to-package map. Reads `BOUNDARIES.md` at build time and exposes it as a queryable runtime registry. The "where does X live?" answer for code, not just humans.

## Quick reference

| | |
|---|---|
| **Build tier** | Meta / control plane — needed for capability-to-package programmatic queries |
| **Depends on** | `schema`, `graph` (registry structure can have edges), `lint` (enforces BOUNDARIES.md ↔ registry consistency) |
| **Used by** | `cli` (subcommand discovery), `workspace` (package list), `lint` (boundary enforcement), `path` (package maturity in roadmap), `docs` (cross-link generation), LLM sessions answering "which package owns X?" |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 4–8 weeks focused |
| **Sellable?** | Low — internal plumbing. MIT release as part of stack. |

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
- Alias resolution (legacy names → current names).
- Runtime module discovery (which packages are loaded).
- Package maturity status (scaffold / prototype / usable / stable / deprecated).
- Package release status (private / internal-only / OSS / commercial).
- Gap detection (capabilities with no owner; flagged in CI).
- Conflict detection (capabilities with multiple owners).

### Out of scope
- npm registry / external package management (`npm`, `pnpm`).
- `codex` entity registry (different layer — `codex` is for product content; registry is for system resources).
- Workspace package dependency graph computation (`workspace`).
- Governance rule definitions (`governance`).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §50 for the full capability map.

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
├── src/
│   ├── parse/
│   │   ├── boundaries.ts     # BOUNDARIES.md → typed records
│   │   ├── readme.ts         # per-package README Boundary section
│   │   └── package-json.ts   # package.json metadata
│   ├── query/
│   │   ├── by-capability.ts  # "who owns X?"
│   │   ├── by-package.ts     # "what does X own?"
│   │   └── deps.ts           # "what depends on X?"
│   ├── consistency/
│   │   ├── gaps.ts           # unowned capabilities
│   │   ├── conflicts.ts      # multi-owner capabilities
│   │   └── drift.ts          # README ↔ BOUNDARIES drift
│   ├── ids/
│   │   ├── format.ts         # canonical ID conventions
│   │   └── alias.ts
│   ├── maturity/
│   │   └── status.ts         # scaffold/prototype/usable/stable/deprecated
│   └── cli.ts                # `neko registry verify / query / status`
├── tests/
└── README.md
```

## Roadmap

### v0.1 — BOUNDARIES.md parser
### v0.2 — Query API (by capability / by package)
### v0.3 — Gap + conflict detection (CI integration)
### v0.4 — Drift detection (README ↔ BOUNDARIES)
### v0.5 — Maturity status tracking
### v0.6 — Canonical ID + alias resolution
### v1.0 — Stable API

## Product potential

**Internal:** High — keeps BOUNDARIES.md honest.
**Open source release:** Marginal — useful only to NekoStack consumers.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Meta / control plane. Build early since downstream packages will rely on its consistency checks.
- **Estimated learning return:** Moderate. Markdown parsing, drift detection, registry-as-derived-artifact patterns, CI consistency-check authoring.
