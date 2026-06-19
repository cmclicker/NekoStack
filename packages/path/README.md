# @nekostack/path

> The portfolio + roadmap + active-work + next-action layer. The package the solo dev has been doing manually with memory files. Knows every project, every milestone, every dependency, every parked idea â€” and resolves "what should I work on right now?"

## Quick reference

| | |
|---|---|
| **Build tier** | Meta / control plane â€” the most strategic package. Without it, the portfolio is held in human memory and rots. |
| **Depends on** | `schema`, `codex` (each project is an entity), `graph` (dependency DAG), `time` (cadences + due dates), `workspace` (multi-project context), `review` (milestones link to review state), `decision` (milestones cite ADRs), `session` (current-session connects to roadmap) |
| **Used by** | the developer themselves (every day); Claude / LLM sessions consume this to resume coherent context; the cross-project dashboard reads from it |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 12â€“20 weeks focused |

## Why this exists

A solo developer with 8+ concurrent projects context-switches constantly. Without explicit portfolio state:

- "What was I doing on NekoBattler three weeks ago?" is unanswerable without an artifact.
- "What depends on what across projects?" requires holding the whole thing in your head.
- New ideas get lost between sessions.
- Projects rot when not touched for months â€” and worse, you forget *why* you started them.
- Claude / LLM sessions can't pick up coherent context across days, because there's nothing to read.

`path` is the load-bearing layer for managing this. Every project is a typed `Project` record with explicit state (active / paused / dormant / archived / resurrected). Every project has milestones with dependency edges in the graph layer. Ideas accumulate in an intake queue and get promoted to roadmap items. The **next-action resolver** answers "given everything you're working on, what's most actionable right now?" given current focus, blockers, dependencies, and recent activity.

This is the package the user has been simulating with memory files in this very NekoStack-bootstrap conversation. Lifting it into typed state makes it durable, queryable, and replayable across sessions.

Building this rather than using Linear / Notion / Obsidian is justified because:
1. **Solo-creator-shaped, not team-shaped.** Linear and Asana model teams; Notion has no opinion; Things/OmniFocus model individual tasks but not multi-project portfolios.
2. **Cross-project reasoning.** "Does the NekoVibe Phase 1 ship before the NekoBattler element-synergy work lands?" Generic tools can't answer.
3. **LLM-readable.** This document is consumed by LLM sessions as much as by humans. Notion's API isn't designed for that workflow; ours is.
4. **Resurrection is normal.** Solo projects sleep for months and wake up. The state model treats this as a feature, not an exception.

## Scope

### In scope
- Project portfolio model (typed `Project` records with kind, state, owner, summary).
- Lifecycle state machine: active / paused / dormant / archived / resurrected.
- Cross-project dependency graph (uses `graph` substrate).
- Roadmap milestones per project (typed records with target dates via `time`).
- Idea intake queue + promotion lifecycle (idea â†’ roadmap item / parked / discarded).
- Task decomposition (milestone â†’ tasks; tasks are leaf items).
- Next-action resolver: takes current state, returns ranked next steps with reasoning.
- WIP boundaries ("do not touch these projects right now").
- Backlog normalization patterns.
- Cross-project dashboard data feed.
- Technical-debt records folded in (rather than a separate `debt` package).
- Requirements records folded in (rather than a separate `requirements` package).

### Out of scope
- Issue / defect tracking (external â€” Linear, GitHub Issues).
- Time tracking / billable hours.
- Team-based project management (this is solo-shaped).
- Calendar / scheduling UI (calendar primitives live in `time`).
- Resource allocation across people (we're a solo-shaped tool).
- Gantt charts (out of scope; could be a future visualization).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§1 for the full capability map.

### Owns
- Project registry + lifecycle state
- Cross-project dependencies
- Roadmap milestones + their dependency edges
- Idea brainstorm queue + promotion
- Task decomposition (milestone â†’ tasks)
- Next-action resolver
- Backlog normalization
- WIP boundaries
- Project maturity lifecycle (uses `lifecycle` semantics, owned here)
- Cross-project dashboard data
- Requirements + technical-debt records (folded in)

### Does NOT own
| Capability | Lives in |
|---|---|
| Which project is currently active (workspace context) | `workspace` |
| Architectural / product decisions | `decision` |
| Review state of work items | `review` |
| Dev session records | `session` |
| Policy rules + lifecycle gates | `governance` |
| Time / calendar / RRULE primitives | `time` |
| Generic graph primitives | `graph` |
| Project as a Codex entity kind | `codex` (we register the kind there) |
| External issue tracking (Linear, GitHub) | external (we can sync, we don't replace) |

## Competitors and adjacent tools

| Tool | What they do well | Where they fall short for us |
|---|---|---|
| **Linear** | Beautiful team issue tracker, fast UX. | Team-shaped. No multi-project portfolio reasoning. Per-seat pricing. |
| **Notion** | Flexible. Strong as a knowledge base. | No opinion on structure â€” every project reinvents its own. Hard to programmatically reason over. |
| **Obsidian** | Personal knowledge base, file-based. | Not project-portfolio-shaped. No state machine, no dependency resolution. |
| **Things / OmniFocus** | GTD task managers. Polished. | Single-list paradigm. Multi-project portfolio is not the model. |
| **Trello / Jira / Asana** | Team kanban / sprint tracking. | Team-shaped, heavyweight. |
| **Logseq / Roam Research** | Outliner with graph. | Not state-machine-driven; you build your own "project state" by convention. |
| **Microsoft Project / OmniPlan** | Deep single-project planning. | Single-project, not portfolio. |
| **GitHub Projects** | Repo-coupled, modern. | Repo-coupled â€” solo developer with non-GitHub-public projects can't use as portfolio layer. |

The right framing: **Linear's UX for issues + Things' clarity for single-user + Notion's flexibility for cross-project structure + an explicit state machine for project lifecycle.** Closest in spirit to *"how a serious solo creator-dev would build their own Linear if Linear didn't exist."*

## How this fits the NekoStack

`path` is the meta layer that knows about other projects (the consuming products: NekoBattler, NekoVibe, Mara Kane, etc.) but doesn't ship inside them. It's a tool *for* the developer.

- **Codex** registers `Project` as an entity kind so cross-project entity references become possible.
- **Workspace** answers "which project am I in right now?" â€” `path` reads from workspace to scope queries.
- **Session** captures the current session's focus; `path` connects that to broader roadmap context.
- **Decision** records architectural / product decisions; milestones in `path` cite the decisions that shaped them.
- **Review** tracks the state of completed milestones.
- **Graph** is the substrate for the dependency DAG.
- **Time** provides RRULE / cadence / due-date primitives for milestones.

## Design philosophy

- **Solo-creator-first.** Not a "team Scrum tool with one user." Optimized for the workflow of a single developer with many parallel projects.
- **State is observable.** Active / paused / dormant / archived / resurrected are first-class enum values, not vibes.
- **Resurrection is normal.** Projects don't fail by being abandoned; they sleep. Waking them up is a deliberate state transition with a resume-context bundle.
- **Next-action is a query.** "What should I work on?" is a function of current state, blockers, dependencies, and recent activity â€” not a static list.
- **Cross-project visibility is the killer feature.** Solo dev with 8 projects can't reason without it.
- **LLM-readable.** Every record is structured so a fresh Claude session can resume coherent context without reading every old transcript.

## Architecture sketch

```
packages/path/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ projects/
â”‚   â”‚   â”œâ”€â”€ project.ts        # Project type, registry
â”‚   â”‚   â”œâ”€â”€ lifecycle.ts      # state transitions
â”‚   â”‚   â””â”€â”€ kinds.ts          # game / saas / narrative / utility
â”‚   â”œâ”€â”€ milestones/
â”‚   â”‚   â”œâ”€â”€ milestone.ts      # type + dependency edges
â”‚   â”‚   â””â”€â”€ progress.ts       # done/in-progress/blocked
â”‚   â”œâ”€â”€ ideas/
â”‚   â”‚   â”œâ”€â”€ intake.ts         # queue
â”‚   â”‚   â”œâ”€â”€ promote.ts        # idea â†’ milestone
â”‚   â”‚   â””â”€â”€ park.ts           # defer with rationale
â”‚   â”œâ”€â”€ tasks/
â”‚   â”‚   â””â”€â”€ task.ts           # leaf items
â”‚   â”œâ”€â”€ resolver/
â”‚   â”‚   â”œâ”€â”€ next-action.ts    # the query
â”‚   â”‚   â””â”€â”€ scoring.ts        # ranking heuristics
â”‚   â”œâ”€â”€ debt/                 # technical-debt records
â”‚   â”œâ”€â”€ requirements/         # requirement records linked to milestones
â”‚   â”œâ”€â”€ dashboard/
â”‚   â”‚   â””â”€â”€ feed.ts           # cross-project view data
â”‚   â””â”€â”€ cli.ts                # `neko path next`, `neko path status`, etc.
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

CLI shape:

```
$ neko path status              # cross-project dashboard
$ neko path next                # next-action resolver
$ neko path project list        # all projects + state
$ neko path project pause leytide --reason "waiting on realtime"
$ neko path milestone add nekovibe phase-2 --depends-on phase-1
$ neko path idea add "Add a Tower Defense mode to NekoBattler"
$ neko path idea promote <id> --to-project nekobattler
```

## Roadmap

### v0.1 â€” Project registry
- `Project` type, lifecycle states, registry storage.
- CLI: list / show / set-state.

### v0.2 â€” Milestones
- Milestone type + dependency edges (uses `graph`).
- CLI: add / show / list / set-state.

### v0.3 â€” Idea intake
- Intake queue, promotion to milestone, parking.

### v0.4 â€” Task decomposition
- Milestone â†’ tasks linkage.

### v0.5 â€” Next-action resolver
- Heuristic scoring of candidate actions.
- Explanation of *why* the action was picked.

### v0.6 â€” Cross-project dashboard
- Aggregated state across all projects.
- Data feed for `ui` surfaces.

### v0.7 â€” Resurrection workflow
- Dormant â†’ active transition with resume-context bundle (works with `session`).

### v0.8 â€” Requirements + debt records
- Linkage to milestones.

### v1.0 â€” Stable API
- Documentation site.
- LLM session-resume patterns.

## Product potential

**Internal:** Critical. The meta-layer that makes the rest of the stack coherent for a solo dev.

**Open source release:** Plausible. The space between Linear (team) and Things (personal task) is largely empty for creator-developers with multi-project portfolios. MIT release could attract real users.

**Commercial:** Real opportunity. "Linear for solo creator-developers" or "creator-developer portfolio OS" could be a viable product on its own. Not a near-term priority, but the path is real.

## Status

- **Current:** Empty placeholder. Not started.
- **Owner:** Cody (solo dev).
- **Priority tier:** Meta / control plane. **Among the first 3 packages to actually implement** â€” without it, every other package is harder to manage.
- **Estimated learning return:** Very high. Portfolio data modeling, state-machine design, dependency-graph reasoning, heuristic resolvers, LLM-readable structured state â€” all foundational meta-skills.
