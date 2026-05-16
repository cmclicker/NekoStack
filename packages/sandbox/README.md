# @nekostack/sandbox

> Sandboxed command / script execution for agent tool calls. Permission allowlists, dry-run mode, output capture. The "the LLM wants to do X — let me execute it safely" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | LLM-workflow safety |
| **Depends on** | `schema`, `tools` (we execute tool calls), `permissions` (tool authorization), `governance` (forbidden actions), `audit`, `changeset` (dry-run integration) |
| **Used by** | `tools` (every tool execution), NekoSystems (LLM tool execution for tenant-facing features), Claude Code-style assistant tooling |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 8–14 weeks focused |
| **Sellable?** | Strong — agent-safety tooling is hot |

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
- Container orchestration (Docker — we may use, not orchestrate).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §42 for the full capability map.

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
├── src/
│   ├── execute/
│   │   ├── spawn.ts
│   │   └── capture.ts
│   ├── allowlist/
│   │   ├── command.ts
│   │   ├── path.ts
│   │   └── host.ts
│   ├── dry-run/
│   │   └── via-changeset.ts
│   ├── limits/
│   │   ├── timeout.ts
│   │   ├── memory.ts
│   │   └── cpu.ts
│   ├── isolation/
│   │   ├── filesystem.ts
│   │   └── network.ts
│   └── cli.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Command spawn + output capture
### v0.2 — Allowlist enforcement
### v0.3 — Dry-run mode
### v0.4 — Resource limits
### v0.5 — Filesystem isolation
### v0.6 — Network isolation
### v1.0 — Stable API

## Product potential

**Internal:** Critical for safe agent tool use.
**Open source release:** Strong — agent-safety is a real concern.
**Commercial:** Real — agent sandboxing is increasingly important.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** LLM-workflow safety.
- **Estimated learning return:** Very high. Process isolation, allowlist enforcement, resource limits — security engineering for agent systems.
