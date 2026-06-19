# @nekostack/shell

> Tauri / Electron native wrapping patterns. Native bridges, packaging, code-signing, auto-update. The "ship a web app as a desktop / mobile native" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Cross-platform |
| **Depends on** | `schema`, `secrets` (signing certificates), `audit`; external: Tauri or Electron |
| **Used by** | NekoBattler (already has `src-tauri`!), NekoVibe (desktop wrapper), Leytide (native client option), any web project shipping native |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 8â€“14 weeks focused |

## Why this exists

NekoBattler already uses Tauri. Wrapping a web app native is more than `tauri init`: native bridges, IPC patterns, packaging per OS, code-signing, auto-update channels, deep links. `shell` provides the NekoStack-conventional patterns.

## Scope

### In scope
- Tauri adapter (primary).
- Electron adapter (alternative).
- Native â†” JS bridge patterns.
- Packaging for macOS / Windows / Linux.
- Code-signing.
- Auto-update channels (stable / beta / canary).
- Deep-link handling.
- Native menu / tray / notifications.

### Out of scope
- The web app itself.
- PWA (`pwa`).
- Mobile-specific (could come later).
- Game engine.

## Boundary

### Owns
- Tauri / Electron wrapping patterns
- Native bridges
- Packaging
- Code-signing
- Auto-update
- Deep-link handling
- Native menus / tray

### Does NOT own
| Capability | Lives in |
|---|---|
| PWA manifest / service worker | `pwa` |
| Web app itself | consuming product |
| Push notifications (web) | `notify` (Web Push) |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **Tauri** | Modern, lightweight. | Substrate; we wrap with patterns. |
| **Electron** | Mature. | Heavy; we support as adapter. |
| **NW.js** | Older. | Stale. |

## How this fits the NekoStack

- **`secrets`** for code-signing certificates.
- **`audit`** for build / sign events.
- **`deploy`** for distribution.

## Design philosophy

- **Tauri-first.** Lighter, modern; Electron is fallback.
- **Auto-update built-in.** Native apps without update are unmaintainable.
- **Code-signing not optional.** Unsigned apps trip OS warnings.

## Architecture sketch

```
packages/shell/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ tauri/
â”‚   â”‚   â”œâ”€â”€ bridge.ts
â”‚   â”‚   â””â”€â”€ config.ts
â”‚   â”œâ”€â”€ electron/
â”‚   â”‚   â””â”€â”€ adapter.ts
â”‚   â”œâ”€â”€ bridge/
â”‚   â”‚   â””â”€â”€ ipc.ts
â”‚   â”œâ”€â”€ packaging/
â”‚   â”‚   â”œâ”€â”€ macos.ts
â”‚   â”‚   â”œâ”€â”€ windows.ts
â”‚   â”‚   â””â”€â”€ linux.ts
â”‚   â”œâ”€â”€ signing/
â”‚   â”‚   â””â”€â”€ code-sign.ts
â”‚   â”œâ”€â”€ auto-update/
â”‚   â”‚   â”œâ”€â”€ channels.ts
â”‚   â”‚   â””â”€â”€ delivery.ts
â”‚   â”œâ”€â”€ deep-links/
â”‚   â”‚   â””â”€â”€ handle.ts
â”‚   â””â”€â”€ native/
â”‚       â”œâ”€â”€ menu.ts
â”‚       â””â”€â”€ tray.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Tauri adapter
### v0.2 â€” Native bridge patterns
### v0.3 â€” Packaging (macOS / Windows / Linux)
### v0.4 â€” Code-signing
### v0.5 â€” Auto-update
### v0.6 â€” Deep links
### v0.7 â€” Electron adapter
### v1.0 â€” Stable API

## Product potential

**Internal:** NekoBattler, future desktop ships.
**Open source release:** Modest.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Cross-platform.
- **Estimated learning return:** High. Native packaging, code-signing, auto-update channels.
