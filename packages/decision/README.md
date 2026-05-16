# @nekostack/decision

> Architectural and product decision records (ADRs) as first-class typed entities. Why did we pick this approach? What did we reject? When does the decision expire and need re-review? Decisions, rationale, and dependency between decisions — not buried in commit messages or chat history.

## Quick reference

| | |
|---|---|
| **Build tier** | Meta / control plane — load-bearing for solo dev with multi-year projects |
| **Depends on** | `schema` (decision shape), `codex` (decisions as entities), `graph` (decision dependency DAG), `time` (review dates), `path` (decisions link to milestones), `provenance` (decisions cite source) |
| **Used by** | `path` (milestones cite decisions), `governance` (policies cite decisions as rationale), `review` (decision approval), Claude sessions reading historical context, future-you returning to a project |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 6–10 weeks focused |
| **Sellable?** | Plausible — ADRs-as-code is undersupplied; commercial "decision intelligence" angle exists but niche |

## Why this exists

Solo dev with a multi-year portfolio makes thousands of decisions. The big ones (which DB, which framework, which architectural pattern) get remembered. The medium ones (why is this `as Prisma.InputJsonValue` vs `as unknown as Prisma.InputJsonValue`? why did we put `permissions` in its own package instead of inside `auth`?) get forgotten within months.

Two months later, you revisit a project and re-make the same decision (often differently this time, creating a contradiction). Six months later, an LLM session asks "should we extract permissions from auth?" and you have no record of why you split it in the first place.

`decision` is the package that owns these records. Every architectural / product decision is a typed entity with:
- The decision itself ("split permissions out of auth").
- The context that drove it (specific incident, requirement, constraint).
- The alternatives considered + why they were rejected.
- The dependencies on prior decisions.
- A review date (when should this be re-evaluated?).
- Supersession chain (this decision replaces decision #42).

Building this rather than using a `docs/adr/` folder with markdown is justified because:
1. **Typed records, not free-form prose.** "Status" is an enum, "supersedes" is a typed reference, "review date" is a real date.
2. **Queryable.** "Show me all decisions about the auth layer that are status:accepted and have a review date this quarter."
3. **Graph-aware.** A decision can depend on others; the graph is navigable.
4. **LLM-readable.** Claude sessions can ingest the decision corpus to understand "why is the code shaped this way?" without reading every PR.

## Scope

### In scope
- Decision record DSL (typed structure: title / status / context / decision / alternatives / consequences / supersedes / supersededBy / reviewDate).
- Decision lifecycle states: proposed / accepted / deprecated / superseded / rejected.
- Decision dependency graph (uses `graph` substrate).
- Decision review-date scheduling.
- Supersession chain handling.
- Linkage from decisions to milestones (`path`), policies (`governance`), code regions (`provenance`).
- CLI: `neko decision new`, `neko decision list`, `neko decision review`.
- Decision search + filter by status / topic / age.

### Out of scope
- Comments / discussion threads on decisions (those live in `review`).
- Voting / multi-stakeholder approval (this is solo-shaped).
- Decision implementation tracking (that's `path` milestones citing decisions).
- Generic markdown / wiki rendering (`md` / `wiki`).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §4 for the full capability map.

### Owns
- Architectural decision records (ADRs)
- Product decision records
- Decision dependency graph
- Decision lifecycle states + supersession
- Decision rationale preservation
- Decision review-date scheduling
- "Why not the alternative?" tracking
- Decision provenance (linked to `provenance`)

### Does NOT own
| Capability | Lives in |
|---|---|
| Comments / threaded discussion | `review` |
| Approval workflow (multi-step review) | `review` |
| Generic graph primitives | `graph` |
| Markdown rendering for decision pages | `md` (we provide structured data; md renders) |
| Wiki page surface for decisions | `wiki` |
| Codex entity kind for decisions | `codex` (we register the kind there) |
| Time / review-date scheduling primitives | `time` |
| Source-code citation lineage | `provenance` |
| Audit log of decision changes | `audit` |

## Competitors and adjacent tools

| Tool | What they do well | Where they fall short for us |
|---|---|---|
| **adr-tools / adr-cli** | Lightweight CLI for markdown ADRs. | Markdown-only; no graph, no review dates, no typed queries. |
| **Backstage Tech Docs / ADRs** | Mature, enterprise. | Backstage-coupled, heavy ops. |
| **Log4brains** | ADR-focused static site generator. | Generation tool, not a typed-record system. |
| **Notion / Confluence pages** | Flexible. | Free-form, drift, no graph, no LLM-friendly query. |
| **GitHub Discussions / issues** | Threaded. | Not decision-shaped; rationale rots. |
| **Custom `docs/adr/` markdown** | Common practice. | What this package replaces with structure. |

The right framing: **adr-tools' ergonomics + Backstage's structure + LLM-readable typed records + a dependency graph.** Closest analogue: imagine if every architectural decision in your codebase was a typed entity in `codex` — that's this.

## How this fits the NekoStack

- **`codex`** registers `Decision` as an entity kind.
- **`graph`** is the substrate for the dependency DAG.
- **`time`** schedules review dates.
- **`path`** milestones cite decisions ("this milestone implements decision #42").
- **`governance`** policies cite decisions as rationale.
- **`review`** is triggered when a decision needs human approval.
- **`provenance`** links decisions to the code regions implementing them.
- **`audit`** records every status change.

## Design philosophy

- **Typed > free-form.** A decision is a structured record, not free prose with implicit fields.
- **Alternatives are first-class.** "What did we consider and reject?" is as important as "what did we pick?" Don't lose that context.
- **Supersession over deletion.** Decisions don't get deleted; they get superseded with a pointer to the new one.
- **Review dates matter.** Decisions made in 2024 may not be true in 2026. Scheduling a review date keeps the corpus fresh.
- **Cite the context.** Every decision links to the specific incident / requirement / constraint that drove it. Future-you needs this.
- **LLM-readable.** Decisions are queryable by LLM sessions for context, without overwhelming context windows.

## Architecture sketch

```
packages/decision/
├── src/
│   ├── record/
│   │   ├── decision.ts       # Decision type
│   │   ├── lifecycle.ts      # status enum + transitions
│   │   └── supersession.ts   # chain handling
│   ├── graph/
│   │   ├── depends-on.ts     # decision-to-decision edges
│   │   └── traverse.ts       # via @nekostack/graph
│   ├── review/
│   │   ├── schedule.ts       # review-date assignment
│   │   └── due.ts            # which decisions are due for review
│   ├── linkage/
│   │   ├── milestone.ts      # path integration
│   │   ├── policy.ts         # governance integration
│   │   └── provenance.ts     # code-region linkage
│   ├── search/
│   │   └── query.ts          # by status, topic, age
│   └── cli.ts                # `neko decision new / list / review`
├── tests/
└── README.md
```

Example decision:

```ts
import { defineDecision } from '@nekostack/decision';

export const splitPermissionsFromAuth = defineDecision({
  id: 'D-0042',
  title: 'Split @nekostack/permissions out of @nekostack/auth',
  status: 'accepted',
  context: 'BOUNDARIES.md audit (D-0040) revealed permission catalog + RBAC primitives are distinct from login flow.',
  decision: 'Create @nekostack/permissions as a sibling to @nekostack/auth. auth composes inputs from permissions into AccessDecision.',
  alternatives: [
    { name: 'Keep permissions inside auth as submodule', rejection: 'Buries a distinct capability; harder to reuse permission catalog standalone.' },
    { name: 'Use Casbin instead', rejection: 'Generic; doesn\'t integrate with @nekostack/schema or audit conventions.' },
  ],
  consequences: [
    'auth becomes orchestration layer rather than monolith.',
    'permissions can be released independently as OSS.',
    'Slight increase in cross-package coordination.',
  ],
  dependsOn: ['D-0040'],
  reviewDate: '2026-11-15',
});
```

## Roadmap

### v0.1 — Decision record DSL
- Type + lifecycle states + persistence.

### v0.2 — Supersession + dependencies
- Chain handling.
- Graph integration.

### v0.3 — Review dates
- Scheduling + due-list query.

### v0.4 — Linkage
- To milestones (`path`).
- To policies (`governance`).
- To code regions (`provenance`).

### v0.5 — Search + filter
- By status, topic, age, area.

### v0.6 — CLI + structured output
- `neko decision new` wizard.
- JSON output for LLM consumption.

### v0.7 — Markdown rendering
- Decisions rendered for `wiki` / `docs` consumption.

### v1.0 — Stable API
- Documentation site.
- LLM session-context patterns.

## Product potential

**Internal:** High — every multi-year project needs this to avoid re-litigating decisions every six months.

**Open source release:** Plausible. ADRs-as-code is genuinely undersupplied; most projects either skip ADRs or write free-form markdown that rots.

**Commercial:** Marginal. "Decision intelligence" is a real category but enterprise-focused.

## Status

- **Current:** Empty placeholder. Not started.
- **Owner:** Cody (solo dev).
- **Priority tier:** Meta / control plane. Build after `path` and `codex` since decisions are typed entities citing milestones.
- **Estimated learning return:** High. ADR design patterns, decision lifecycle, supersession-vs-versioning models, LLM-readable typed records — all transferable.
