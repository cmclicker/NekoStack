# @nekostack/review

> Review request lifecycle, approval state, reviewer notes, follow-up tracking. The package that owns "is this work actually ready to ship, and has a human signed off?" â€” distinct from `decision` (the ADRs) and `audit` (the log of what happened).

## Quick reference

| | |
|---|---|
| **Build tier** | Meta / control plane â€” load-bearing once any work requires human approval before proceeding |
| **Depends on** | `schema`, `audit` (review actions emit), `governance` (gates trigger review requirements), `path` (milestones link to reviews), `decision` (decisions need approval review), `changeset` (LLM-driven changesets need review before apply) |
| **Used by** | every state transition with a human-approval gate; LLM sessions check review state before proceeding past gates |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 6â€“10 weeks focused |

## Why this exists

In a solo workflow with LLM-paired development, the "review" question is sharper than in a team context. The LLM produces a changeset; before it applies, a human (you) needs to look at it. The LLM proposes a decision; before it lands, the human accepts or rejects. A milestone transitions to `done`; before that's official, a review confirms acceptance criteria.

Without an explicit review layer, all of this happens informally in chat history â€” which means:
- "Did I approve that?" is unanswerable.
- Rework loops are invisible.
- Stale reviews (proposed weeks ago, never touched) rot silently.
- Follow-ups ("I said this was OK but I want to revisit X later") are forgotten.

`review` is the typed-state layer for all of this. Every reviewable artifact (changeset / decision / milestone / content draft) can have a `Review` attached, with state transitioning through `requested â†’ in-progress â†’ approved | rejected â†’ follow-up-required â†’ closed`.

## Scope

### In scope
- Review request lifecycle states.
- Approval / rejection records with reviewer notes.
- Rework loops (rejected â†’ re-submitted â†’ reviewed again).
- Acceptance evidence (links to test results, screenshots, replays).
- "Needs human review before proceeding" markers attached to work items.
- LLM self-review output capture (when the agent reviews its own work first).
- Stale-review detection (no activity in N days).
- Unresolved feedback tracker.
- Follow-up records (deferred review items).
- Comments / threaded discussion on reviews (folded in for now; could lift to `comments` later).

### Out of scope
- The artifact being reviewed (decisions live in `decision`, changesets in `changeset`, milestones in `path`).
- Multi-approver workflows (this is solo-shaped â€” single approver, but with explicit state).
- Audit log storage (`audit`).
- Generic comment threads on non-review content.

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§5 for the full capability map.

### Owns
- Review request lifecycle + state machine
- Approval / rejection records
- Rework loops
- Reviewer notes
- Acceptance evidence
- "Needs human review" markers
- LLM self-review output capture
- Stale-review detection
- Follow-up tracker
- Comments / discussion threads (folded for v1)

### Does NOT own
| Capability | Lives in |
|---|---|
| Decision records (ADRs) | `decision` |
| Governance rule definitions | `governance` (we are triggered by them) |
| Audit log storage | `audit` (we emit) |
| Milestone state | `path` |
| Changeset apply mechanics | `changeset` |
| Generic content comments / annotations | TBD (`comments` package later if it lifts out) |

## Competitors and adjacent tools

| Tool | What they do well | Where they fall short for us |
|---|---|---|
| **GitHub PR reviews** | Mature, integrated. | PR-coupled; doesn't cover decisions / milestones / non-code artifacts. |
| **Gerrit** | Granular review tooling. | Heavyweight, code-only. |
| **Notion / Linear comments** | Threaded. | Free-form; not a typed review-state machine. |
| **Custom checkboxes in docs** | Cheap. | What this package replaces with structure. |

## How this fits the NekoStack

- **`governance`** declares gates that require review.
- **`path`** milestones get reviews before transitioning to `done`.
- **`decision`** records get approval reviews before status flips to `accepted`.
- **`changeset`** edits get reviews before `apply`.
- **`audit`** records every review action.

## Design philosophy

- **Typed state, not implicit.** "Approved" is a state, not a vibe.
- **Solo-shaped.** Single reviewer (you), but the rigor of multi-step state still applies.
- **Stale reviews rot loudly.** A review sitting for >N days surfaces in `path` dashboard.
- **Follow-ups don't disappear.** Deferring is a first-class action, not abandonment.
- **LLM self-review is captured.** When an agent reviews its own work first, that output is recorded as input to the human review.

## Architecture sketch

```
packages/review/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ request/
â”‚   â”‚   â”œâ”€â”€ review.ts         # Review type + state machine
â”‚   â”‚   â””â”€â”€ target.ts         # what's being reviewed (decision/changeset/milestone/content)
â”‚   â”œâ”€â”€ workflow/
â”‚   â”‚   â”œâ”€â”€ transitions.ts    # requested â†’ in-progress â†’ approved/rejected â†’ ...
â”‚   â”‚   â””â”€â”€ rework.ts
â”‚   â”œâ”€â”€ notes/
â”‚   â”‚   â””â”€â”€ note.ts           # reviewer notes
â”‚   â”œâ”€â”€ evidence/
â”‚   â”‚   â””â”€â”€ attach.ts         # links to test results, replays, screenshots
â”‚   â”œâ”€â”€ stale/
â”‚   â”‚   â””â”€â”€ detect.ts         # N-day inactivity check
â”‚   â”œâ”€â”€ followup/
â”‚   â”‚   â””â”€â”€ defer.ts
â”‚   â”œâ”€â”€ llm-self-review/
â”‚   â”‚   â””â”€â”€ capture.ts        # capture agent's self-review output
â”‚   â””â”€â”€ cli.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Review request + state machine
### v0.2 â€” Linkage to decision/changeset/milestone targets
### v0.3 â€” Stale detection + dashboard data
### v0.4 â€” Follow-up tracker
### v0.5 â€” LLM self-review capture
### v0.6 â€” Comments / discussion threads
### v1.0 â€” Stable API + documentation

## Product potential

**Internal:** High for LLM-paired solo workflows.
**Open source release:** Niche.
**Commercial:** Unlikely.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Meta / control plane. Build after `path` + `decision` so there are targets to attach reviews to.
- **Estimated learning return:** Moderate. Review state machine, stale-detection patterns, LLM self-review capture â€” useful for any human-in-the-loop AI workflow.
