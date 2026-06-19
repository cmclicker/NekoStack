# @nekostack/sandbox

> Sandboxed command / script execution for agent tool calls. Permission allowlists, dry-run mode, output capture. The "the LLM wants to do X â€” let me execute it safely" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | LLM-workflow safety |
| **Depends on** | `schema`, `tools` (we execute tool calls), `permissions` (tool authorization), `governance` (forbidden actions), `audit`, `changeset` (dry-run integration) |
| **Used by** | `tools` (every tool execution), NekoSystems (LLM tool execution for tenant-facing features), Claude Code-style assistant tooling |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 8â€“14 weeks focused |

## Why this exists

When an LLM agent wants to "run npm install" or "delete this file," the consequences land on real systems. Sandboxing is the safety boundary. Multiple layers:

- **Permission allowlists.** Which commands / paths / network endpoints are allowed.
- **Dry-run mode.** Show what *would* happen without doing it.
- **Output capture.** Stdin / stdout / stderr / exit code structured.
- **Resource limits.** Time / memory / network.
- **Filesystem isolation.** Touch only declared paths.
- **Network isolation.** Reach only declared hosts.

## Scope

### In scope
- Command execution sandbox (process spawn with restrictions).
- Permission allowlist enforcement.
- Dry-run mode (uses `changeset` for filesystem changes).
- Resource limits (timeout / memory / CPU).
- Filesystem isolation (chroot-style or path-allowlist).
- Network isolation (allowed hosts).
- Output capture (structured).
- Tool execution backend for `tools`.

### Out of scope
- Tool registry (`tools`).
- Permission catalog (`permissions`).
- Changeset apply mechanics (`changeset`).
- Container orchestration (Docker â€” we may use, not orchestrate).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§42 for the full capability map.

### Owns
- Command execution sandbox
- Permission allowlist enforcement
- Dry-run mode
- Resource limits
- Filesystem isolation
- Network isolation
- Output capture

### Does NOT own
| Capability | Lives in |
|---|---|
| Tool registry | `tools` (we execute) |
| Permission catalog | `permissions` |
| Changeset apply | `changeset` (we use for dry-run) |
| Audit log | `audit` (we emit) |
| Container orchestration | external (Docker / Firecracker) |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **Docker** | Containerization. | Heavyweight per-call. |
| **Firecracker** | Microvms. | Heavyweight setup. |
| **bubblewrap / firejail** | Linux sandboxing. | Linux-only. |
| **vm2 / isolated-vm** | Node VM sandbox. | JS-only. |
| **Claude Code sandbox** | Reference. | Closed implementation; we build similar. |

## How this fits the NekoStack

- **`tools`** routes tool calls through us.
- **`permissions`** enforces.
- **`changeset`** provides dry-run for filesystem changes.
- **`audit`** records every execution.

## Design philosophy

- **Deny-by-default.** Nothing allowed without explicit permission.
- **Dry-run is the safe default.** Always preview before apply.
- **Resource limits are mandatory.** No agent runs unbounded compute.
- **Capture everything.** Output structured for audit + LLM inspection.

## Architecture sketch

```
packages/sandbox/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ execute/
â”‚   â”‚   â”œâ”€â”€ spawn.ts
â”‚   â”‚   â””â”€â”€ capture.ts
â”‚   â”œâ”€â”€ allowlist/
â”‚   â”‚   â”œâ”€â”€ command.ts
â”‚   â”‚   â”œâ”€â”€ path.ts
â”‚   â”‚   â””â”€â”€ host.ts
â”‚   â”œâ”€â”€ dry-run/
â”‚   â”‚   â””â”€â”€ via-changeset.ts
â”‚   â”œâ”€â”€ limits/
â”‚   â”‚   â”œâ”€â”€ timeout.ts
â”‚   â”‚   â”œâ”€â”€ memory.ts
â”‚   â”‚   â””â”€â”€ cpu.ts
â”‚   â”œâ”€â”€ isolation/
â”‚   â”‚   â”œâ”€â”€ filesystem.ts
â”‚   â”‚   â””â”€â”€ network.ts
â”‚   â””â”€â”€ cli.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Command spawn + output capture
### v0.2 â€” Allowlist enforcement
### v0.3 â€” Dry-run mode
### v0.4 â€” Resource limits
### v0.5 â€” Filesystem isolation
### v0.6 â€” Network isolation
### v1.0 â€” Stable API

## Product potential

**Internal:** Critical for safe agent tool use.
**Open source release:** Strong â€” agent-safety is a real concern.
**Commercial:** Real â€” agent sandboxing is increasingly important.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** LLM-workflow safety.
- **Estimated learning return:** Very high. Process isolation, allowlist enforcement, resource limits â€” security engineering for agent systems.
