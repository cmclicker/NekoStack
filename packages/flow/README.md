# @nekostack/flow

> Long-running stateful workflow orchestration. State machines, sagas, durable execution, resumable flows. **Distinct from `jobs`** (which is one-shot execution) and **`rules`** (which is deterministic event-driven).

## Quick reference

| | |
|---|---|
| **Build tier** | Background processing â€” workflow layer |
| **Depends on** | `schema` (state shape), `queue` (durable execution substrate), `audit` (state transitions), `events` (event-sourced state), `errors`, `time` (workflow timeouts) |
| **Used by** | `billing` (subscription lifecycle), `compliance` (DSAR multi-step workflow), `governance` (multi-step approval flows), business workflows in `NekoSystems`, account-deletion workflow, any process that spans hours/days/multiple steps |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 12â€“20 weeks focused |

## Why this exists

Some work is one-shot ("send this email") â€” that's `jobs`. Some work is event-driven ("when X happens, fire trigger Y") â€” that's `rules`. Some work is **long-running and stateful**: "start the GDPR DSAR process: validate request â†’ wait for user confirmation â†’ run export â†’ email user â†’ wait for download confirmation â†’ close." That can span days. It can fail at any step. It must resume cleanly after process restart.

`flow` is the durable-execution layer for this. Workflows are state machines; their state is persisted; they can sleep for hours and wake up; they can compensate (saga pattern) when later steps fail.

## Scope

### In scope
- Workflow definition (state machine: states + transitions + guards).
- Durable execution (state persisted; resumable after restart).
- Saga / compensation patterns.
- Step timeouts (via `time`).
- Workflow audit (every transition).
- Replay support (event-sourced via `events`).
- Approval / human-in-the-loop flows.
- Conditional branching.
- Parallel execution branches.
- Workflow visualization (data feed; UI is consumer).

### Out of scope
- One-shot job execution (`jobs`).
- Deterministic event-driven rule firing (`rules`).
- UI flows / form wizards (`form` for forms; `actions` for UI commands).
- LLM workflow orchestration specifically (could use us; not our shape).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§34 for the full capability map.

### Owns
- Workflow definition (state machines)
- Durable execution + state persistence
- Saga / compensation logic
- Step timeouts
- Approval / human-in-the-loop integration (via `review`)
- Workflow audit
- Replay (uses `events`)
- Conditional branching + parallel execution

### Does NOT own
| Capability | Lives in |
|---|---|
| One-shot job execution | `jobs` |
| Deterministic rule firing | `rules` |
| Event sourcing primitives | `events` (we use them) |
| Queue substrate | `queue` |
| UI form / wizard state | `form` |
| Review state machine for approvals | `review` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **Temporal** | Industry-leading durable execution. | Operational complexity, separate service. |
| **Inngest** | Modern serverless workflows. | Vendor-hosted. |
| **AWS Step Functions** | Cloud-native. | AWS-coupled. |
| **xstate** | TS state-machine library. | In-process; not durable. We could use it as substrate. |
| **Custom DB-backed state** | Common. | Reinvented per product. |

## How this fits the NekoStack

- **`events`** is the source-of-truth substrate (workflow state derives from events).
- **`queue`** for step delivery.
- **`audit`** records transitions.
- **`review`** for approval steps.
- **`time`** for step timeouts.

## Design philosophy

- **Workflows are durable state machines.** State is persisted; resumable after crash.
- **Sagas over distributed transactions.** Compensation logic, not 2PC.
- **Visualization-friendly.** State machines render to diagrams.
- **Resume from any state.** Process restart should not lose workflow progress.

## Architecture sketch

```
packages/flow/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ definition/
â”‚   â”‚   â”œâ”€â”€ workflow.ts       # Workflow type
â”‚   â”‚   â”œâ”€â”€ state.ts
â”‚   â”‚   â””â”€â”€ transition.ts
â”‚   â”œâ”€â”€ execution/
â”‚   â”‚   â”œâ”€â”€ run.ts
â”‚   â”‚   â”œâ”€â”€ resume.ts
â”‚   â”‚   â””â”€â”€ persist.ts        # via events
â”‚   â”œâ”€â”€ saga/
â”‚   â”‚   â”œâ”€â”€ compensate.ts
â”‚   â”‚   â””â”€â”€ pattern.ts
â”‚   â”œâ”€â”€ timeout/
â”‚   â”‚   â””â”€â”€ step.ts
â”‚   â”œâ”€â”€ approval/
â”‚   â”‚   â””â”€â”€ review-gate.ts    # integrates with review
â”‚   â”œâ”€â”€ branching/
â”‚   â”‚   â”œâ”€â”€ conditional.ts
â”‚   â”‚   â””â”€â”€ parallel.ts
â”‚   â”œâ”€â”€ visualization/
â”‚   â”‚   â””â”€â”€ render.ts
â”‚   â””â”€â”€ cli.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” State machine + in-memory execution
### v0.2 â€” Durable execution via events
### v0.3 â€” Resume after restart
### v0.4 â€” Saga / compensation
### v0.5 â€” Step timeouts
### v0.6 â€” Approval gates (via review)
### v0.7 â€” Conditional branching + parallel
### v0.8 â€” Visualization data feed
### v1.0 â€” Stable API

## Product potential

**Internal:** Critical for any multi-step async workflow.
**Open source release:** Strong â€” durable-execution-as-a-library is undersupplied.
**Commercial:** Plausible â€” Temporal / Inngest commercialize this; library-level cheaper alternative possible.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Background processing â€” advanced.
- **Estimated learning return:** Very high. Durable execution, saga pattern, state machine design, event-sourced workflow â€” foundational distributed-systems engineering.
