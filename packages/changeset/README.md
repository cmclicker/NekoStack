# @nekostack/changeset

> Dry-run / plan-apply / patch / rollback workflow for LLM-driven edits. The "show me what will change before doing it" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | LLM-workflow safety |
| **Depends on** | `schema`, `audit`, `governance` (apply-time gates), `review` (changeset review), `provenance` (changeset → output lineage), `history` (folded in for now: undo / diff) |
| **Used by** | `sandbox` (dry-run for filesystem operations), `import` (rollback on failure), any LLM-driven file editor (Claude Code-style), agent tool calls that mutate state |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 6–10 weeks focused |
| **Sellable?** | Strong — LLM-edit safety is a hot category |

## Why this exists

LLMs writing code / editing files / mutating data are inherently risky. The right pattern:

1. **Plan:** describe what will change (file diffs, DB ops).
2. **Preview:** human (or governance) reviews the plan.
3. **Apply:** execute the plan atomically.
4. **Rollback:** if anything fails or human rejects, revert.

This is exactly the workflow Claude Code uses. `changeset` formalizes it as a package.

## Scope

### In scope
- Changeset model (set of proposed operations: file create / modify / delete + DB ops + etc.).
- Diff generation (proposed vs current).
- Preview rendering (markdown / JSON for humans + LLMs).
- Plan validation (via `governance` gates).
- Atomic apply.
- Rollback on failure.
- History of applied changesets (folds `history` package for now).
- Review integration (via `review`).

### Out of scope
- Sandboxed execution (`sandbox`).
- Audit log storage (`audit`).
- Review state machine (`review`).
- Provenance records (`provenance`).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §42 for the full capability map.

### Owns
- Changeset model
- File diff / patch generation
- Operation list
- Preview rendering
- Plan validation gate (via governance)
- Atomic apply
- Rollback
- Patch history (folded `history`)

### Does NOT own
| Capability | Lives in |
|---|---|
| Sandboxed command execution | `sandbox` |
| Audit log | `audit` (we emit) |
| Review state | `review` (we trigger) |
| Provenance records | `provenance` (we feed) |
| Governance rules | `governance` (we call) |
| Generic file undo | folded in (could lift to `history`) |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **Claude Code edit/write pattern** | Reference. | Closed implementation; we build similar. |
| **Aider** | LLM-pair-coding tool. | Tool-shaped, not library. |
| **Cursor** | LLM IDE. | Closed. |
| **git diff / patch** | Universal. | No plan-apply lifecycle. |

## How this fits the NekoStack

- **`sandbox`** uses for dry-run filesystem ops.
- **`governance`** gates apply.
- **`review`** triggered when human review required.
- **`audit`** records every changeset.
- **`provenance`** tracks which LLM call produced the changeset.

## Design philosophy

- **Plan-first, apply-second.** Never modify without a written plan.
- **Atomic.** Either the whole changeset applies or none of it does.
- **Rollback on failure.** Partial apply → roll back.
- **Preview for human.** Markdown render of what will change.
- **Preview for LLM.** Structured JSON for the LLM to self-review before applying.

## Architecture sketch

```
packages/changeset/
├── src/
│   ├── model/
│   │   ├── changeset.ts
│   │   └── operation.ts
│   ├── diff/
│   │   ├── file.ts
│   │   └── db.ts
│   ├── preview/
│   │   ├── markdown.ts
│   │   └── json.ts
│   ├── validate/
│   │   └── via-governance.ts
│   ├── apply/
│   │   ├── atomic.ts
│   │   └── transaction.ts
│   ├── rollback/
│   │   └── revert.ts
│   ├── history/
│   │   ├── stack.ts            # undo
│   │   └── diff-compare.ts
│   └── cli.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Changeset model + diff generation
### v0.2 — Preview rendering (md + JSON)
### v0.3 — Atomic apply
### v0.4 — Rollback
### v0.5 — Governance gate integration
### v0.6 — Review integration
### v0.7 — History stack (undo)
### v1.0 — Stable API

## Product potential

**Internal:** Critical for LLM-paired dev workflows.
**Open source release:** Strong — LLM-edit safety pattern is undersupplied as a library.
**Commercial:** Real — agent / coding-assistant safety is a hot space.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** LLM-workflow safety.
- **Estimated learning return:** Very high. Plan-apply lifecycles, atomic transactions, rollback patterns, LLM-safety design.
