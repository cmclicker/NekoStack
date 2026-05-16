# @nekostack/pwa

> Progressive Web App infrastructure: manifest generation, service workers, install prompts. The "ship a web app that feels native on mobile" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Cross-platform |
| **Depends on** | `schema` (manifest), `notify` (push integration), `offline`, `audit` |
| **Used by** | NekoVibe (already has service worker work in Phase 1!), any web product wanting mobile install + offline |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 4–8 weeks focused |
| **Sellable?** | Low — vite-plugin-pwa + workbox dominate |

## Why this exists

PWAs need: manifest.json with icons + theme + display mode, service worker for offline + push, install prompts with the right UX, update flow when new service worker deploys.

NekoVibe already has `sw.js` and `ServiceWorkerRegistrar.tsx`. Lifting into a package makes every project's PWA story consistent.

## Scope

### In scope
- Manifest generation (typed via `schema`).
- Service worker registration.
- Cache strategies (network-first / cache-first / stale-while-revalidate).
- Install prompt UX (when to show, how to defer).
- Update flow (new SW available → user prompted).
- Push notification integration (via `notify`).
- Offline navigation (via `offline`).

### Out of scope
- Native shell (`shell`).
- Generic web app code.
- Service worker internals (workbox is the substrate).
- Push protocol itself (`notify`).

## Boundary

### Owns
- Manifest generation
- Service worker registration
- Cache strategies
- Install prompt UX
- Update flow

### Does NOT own
| Capability | Lives in |
|---|---|
| Native wrapping | `shell` |
| Push protocol | `notify` |
| Offline state | `offline` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **vite-plugin-pwa** | Mature Vite plugin. | Vite-coupled. |
| **workbox** | Google's SW library. | Substrate. |
| **Custom SW** | Common. | Reinvented. |

## How this fits the NekoStack

- **`notify`** for Web Push.
- **`offline`** for offline-first state.

## Design philosophy

- **workbox under the hood.**
- **Install UX deliberate.** Don't show the prompt at the wrong time.
- **Update flow is opt-in.** New SW shouldn't disrupt active sessions.

## Architecture sketch

```
packages/pwa/
├── src/
│   ├── manifest/
│   │   ├── generate.ts
│   │   └── icons.ts
│   ├── service-worker/
│   │   ├── register.ts
│   │   └── strategies/
│   │       ├── network-first.ts
│   │       ├── cache-first.ts
│   │       └── swr.ts
│   ├── install-prompt/
│   │   └── ux.ts
│   ├── update/
│   │   └── flow.ts
│   └── cli.ts                  # `neko pwa build`
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Manifest generation
### v0.2 — Service worker registration
### v0.3 — Cache strategies
### v0.4 — Install prompt
### v0.5 — Update flow
### v1.0 — Stable API

## Product potential

**Internal:** NekoVibe and any web product.
**Open source release:** Marginal.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Cross-platform.
- **Estimated learning return:** Moderate. Service worker patterns, install UX, update flows.
