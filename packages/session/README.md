# @nekostack/session

> Dev session records, handoff summaries, resume-context bundles. The package that answers "what was I doing?" when you come back to a project after weeks. Especially load-bearing for LLM-paired development across multiple chat sessions.

## Quick reference

| | |
|---|---|
| **Build tier** | Meta / control plane — essential for cross-session continuity in solo LLM-paired work |
| **Depends on** | `schema`, `workspace` (current project context), `path` (linkage to roadmap), `decision` (decisions made in session), `review` (reviews triggered in session), `provenance` (artifact lineage), `changeset` (changesets in session), `time` |
| **Used by** | the developer at the start of each work session; Claude / LLM session-resume flows; cross-session continuity across days/weeks/months |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 6–10 weeks focused |
| **Sellable?** | Plausible: "session memory for LLM-paired dev workflows" is genuinely novel and undersupplied |

## Why this exists

A solo dev with 8 projects and LLM-paired work sessions has a brutal continuity problem: each Claude session starts cold. The developer remembers the rough shape ("I was working on NekoBattler's elements synergy"), but the LLM doesn't — and the developer doesn't remember details after a week.

The naive solution is to dump chat transcripts. That doesn't scale. Even within a single session, the meaningful state is buried under tool calls and reasoning.

`session` is the package that captures **structured session state** — not the full chat, but the durable artifacts: goal, project touched, files modified, decisions made, reviews triggered, changesets applied, blockers hit, next steps. At session end, the agent produces a typed `SessionRecord`. At session resume, the new agent reads it and reconstructs context in ~one tool call.

This is precisely the gap that this entire NekoStack-bootstrap conversation has been demonstrating — manually doing the work that this package would automate.

## Scope

### In scope
- `SessionRecord` type (goal / project / files-touched / decisions / reviews / changesets / blockers / next-steps).
- Session lifecycle (start / in-progress / paused / closed).
- Auto-capture from `path`, `decision`, `review`, `changeset`, `provenance` events during a session.
- Resume-context bundle generator (what a new agent needs to read).
- "What was I doing?" query.
- Project-cooldown handling (long-paused project → resume prompts).
- Session-to-roadmap linkage (session feeds back into `path`).
- Context-switch audit (when did you switch projects, why).

### Out of scope
- Full chat transcript storage (out of scope; users have their own chat history).
- LLM model memory mechanics (`memory` package).
- Generic activity feed (`notify`).
- Real-time collaboration on session state (single-user).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §6 for the full capability map.

### Owns
- `SessionRecord` type + lifecycle
- Session goal + project + files-touched summary
- Decisions-made-in-session log (links to `decision`)
- Reviews-triggered-in-session log (links to `review`)
- Changesets-in-session log (links to `changeset`)
- Next-steps + blockers capture
- Resume-context bundle generation
- Project-cooldown / resurrection prompts
- Session-to-roadmap linkage (feeds `path`)

### Does NOT own
| Capability | Lives in |
|---|---|
| LLM conversation memory / context window mgmt | `memory` |
| Single-chat conversation history | `chat` |
| Workspace registry (which project is active) | `workspace` |
| Decision records themselves | `decision` |
| Review state | `review` |
| Changeset records | `changeset` |
| Artifact lineage / generated-by metadata | `provenance` |
| Project portfolio state | `path` |

## Competitors and adjacent tools

| Tool | What they do well | Where they fall short for us |
|---|---|---|
| **Manual session notes (markdown files)** | Cheap. | Drift, no structure, not LLM-readable. |
| **Claude / ChatGPT chat history** | Captures the full conversation. | Too much noise; not structured; lost across sessions. |
| **Linear / GitHub Issues** | Issue-shaped. | Not session-shaped. Doesn't capture multi-issue cross-project sessions. |
| **Devin / Cursor session memory** | Closer in spirit, vendor-specific. | Vendor-locked; not portable across tools. |

## How this fits the NekoStack

- **`workspace`** tells session which project is active.
- **`path`** receives session-end summaries to update roadmap state.
- **`decision`**, **`review`**, **`changeset`** records get auto-linked into the SessionRecord.
- **`provenance`** captures which artifacts the session produced.
- A new Claude session calls `session.resume(lastSessionId)` to get a typed context bundle in one read.

## Design philosophy

- **Structured > free-form.** The SessionRecord is typed, queryable, and short enough to fit in a context window.
- **Auto-capture > manual notes.** Most of the record is built automatically from events in other packages.
- **Session is a checkpoint.** The end-of-session summary is the durable artifact; the chat history is the volatile substrate.
- **Resume is one call.** A new agent should reconstruct prior context with a single `session.resume()` call, not by reading a transcript.
- **Cross-session is the killer feature.** Working on one project once is easy. Picking up after three months is where this earns its keep.

## Architecture sketch

```
packages/session/
├── src/
│   ├── record/
│   │   ├── session.ts        # SessionRecord type
│   │   ├── lifecycle.ts      # state machine
│   │   └── capture.ts        # auto-capture from events
│   ├── resume/
│   │   ├── bundle.ts         # resume-context bundle generator
│   │   └── prompts.ts        # what to prompt the new agent with
│   ├── cooldown/
│   │   └── resurrection.ts   # long-paused project handling
│   ├── linkage/
│   │   ├── path.ts           # feeds path roadmap
│   │   ├── decision.ts
│   │   ├── review.ts
│   │   ├── changeset.ts
│   │   └── provenance.ts
│   └── cli.ts                # `neko session start / end / resume`
├── tests/
└── README.md
```

## Roadmap

### v0.1 — SessionRecord + lifecycle
### v0.2 — Auto-capture from path/decision/review/changeset events
### v0.3 — Resume-context bundle generator
### v0.4 — Cross-project context-switch audit
### v0.5 — Project cooldown + resurrection prompts
### v0.6 — LLM resume integration (prompts package consumes)
### v1.0 — Stable API + LLM-resume recipes

## Product potential

**Internal:** Critical. The structural fix for "what was I doing?"

**Open source release:** Strong. "Session memory for LLM-paired dev" is a real and growing problem. MIT release likely useful.

**Commercial:** Plausible as part of a broader LLM-paired dev productivity tool.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Meta / control plane. Build alongside `path` since they're tightly coupled.
- **Estimated learning return:** Very high. Cross-session state design, resume-context bundling, LLM-readable structured state, event-driven auto-capture — all novel and transferable.
