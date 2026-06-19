# @nekostack/actions

> Unified action / command registry across CLI + UI + agents. Permission-aware, audited, undoable. The "what's the canonical name for this operation?" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Utility primitives |
| **Depends on** | `schema` (action input/output), `permissions`, `audit`, `cli` (CLI surface), `ui` (command palette surface), `tools` (agent surface), `changeset` (undoable actions) |
| **Used by** | `cli` (subcommands as actions), `ui` (command palette), `tools` (LLM tool registry parity), `admin` (bulk actions), any product action |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 6â€“10 weeks focused |

## Why this exists

The same operation ("delete this champion") might be invoked from CLI (`neko champion delete`), UI command palette (Cmd+K â†’ "Delete champion"), keyboard shortcut, or LLM tool call. Without a unified registry, each surface re-declares. `actions` is the unification.

## Scope

### In scope
- Action registry (typed input + output + handler).
- CLI binding (subcommand registration).
- UI command-palette binding.
- Keyboard shortcut binding.
- LLM tool-call binding (via `tools`).
- Permission-aware execution.
- Audit on every invocation.
- Undoable actions (via `changeset`).
- Action discovery (`neko actions list`).

### Out of scope
- CLI argv parsing (`cli`).
- Command palette UI (`ui`).
- Permission catalog (`permissions`).
- Tool registry for LLM (`tools` â€” we parallel).

## Boundary

### Owns
- Action registry
- Multi-surface binding (CLI + UI + agent)
- Permission-aware execution
- Audit emission
- Undoable action pattern
- Keyboard shortcut binding

### Does NOT own
| Capability | Lives in |
|---|---|
| CLI parsing | `cli` |
| Command palette UI | `ui` |
| Permissions | `permissions` |
| LLM tool registry | `tools` |
| Changeset apply | `changeset` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **cmdk** | React command palette. | UI substrate. |
| **Custom per-surface** | Common. | Multi-surface drift. |

## How this fits the NekoStack

- **`cli`** mounts actions as subcommands.
- **`ui`** mounts as command palette entries.
- **`tools`** mirrors as LLM tools.
- **`permissions`** gates.
- **`audit`** records.
- **`changeset`** for undo.

## Design philosophy

- **One name, multiple surfaces.** "delete champion" works from CLI, palette, agent, hotkey.
- **Permission-aware.** Same action, same authorization.
- **Audit unified.** No matter where invoked, action call recorded.
- **Undo where sensible.** Mutations have undo.

## Architecture sketch

```
packages/actions/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ registry/
â”‚   â”‚   â””â”€â”€ catalog.ts
â”‚   â”œâ”€â”€ binding/
â”‚   â”‚   â”œâ”€â”€ cli.ts
â”‚   â”‚   â”œâ”€â”€ ui.ts
â”‚   â”‚   â”œâ”€â”€ shortcut.ts
â”‚   â”‚   â””â”€â”€ tool.ts
â”‚   â”œâ”€â”€ execute/
â”‚   â”‚   â””â”€â”€ invoke.ts
â”‚   â”œâ”€â”€ permission/
â”‚   â”‚   â””â”€â”€ gate.ts             # via permissions
â”‚   â”œâ”€â”€ audit/
â”‚   â”‚   â””â”€â”€ emit.ts
â”‚   â””â”€â”€ undoable/
â”‚       â””â”€â”€ via-changeset.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Action registry
### v0.2 â€” CLI binding
### v0.3 â€” UI command palette binding
### v0.4 â€” Keyboard shortcuts
### v0.5 â€” Tool-call binding (LLM)
### v0.6 â€” Permission + audit
### v0.7 â€” Undoable actions
### v1.0 â€” Stable API

## Product potential

**Internal:** Used everywhere.
**Open source release:** Modest.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Utility primitives.
- **Estimated learning return:** High. Multi-surface command architecture, permission integration, undo patterns.
