# @nekostack/wiki

> Wiki engine: knowledge pages, cross-linking, history, hierarchy. The page-rendering layer for game lore (NekoBattler wiki), narrative codex browsing (Mara Kane), tenant knowledge bases (NekoSystems).

## Quick reference

| | |
|---|---|
| **Build tier** | Content / narrative |
| **Depends on** | `schema`, `cms` (content lifecycle), `md`, `codex` (entity references), `search`, `ui`, `audit` |
| **Used by** | NekoBattler (champion wiki — already partially exists), Mara Kane (narrative codex browsing), NekoSystems (tenant knowledge / customer-facing docs), Leytide (in-game help), any product with reference content |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 10–16 weeks focused |
| **Sellable?** | Modest — Confluence / Notion dominate; game-wiki niche less crowded |

## Why this exists

Wikis are everywhere in content-rich projects. NekoBattler already has wiki pages for champions. Mara Kane's lore is wiki-shaped. NekoSystems tenant knowledge bases (FAQs, runbooks, customer-facing docs) are wiki-shaped. Without a shared engine, each reinvents page rendering, cross-linking, search, history.

## Scope

### In scope
- Page rendering (via `md` + `editor` for authoring).
- Cross-page linking with broken-link detection.
- Page hierarchy (parent / child).
- Page history (versioned via `cms`).
- Entity-to-page links (Codex entity → wiki page).
- Search integration (via `search`).
- Tags / categories (via `taxonomy`).
- Recent-changes feed.
- Watchlists (notify on page change via `notify`).

### Out of scope
- Content lifecycle (`cms`).
- Markdown parsing (`md`).
- Codex entities (`codex`).
- Comments / discussion (`review` for now).

## Boundary

### Owns
- Wiki page rendering
- Cross-page linking + broken-link detection
- Page hierarchy
- Entity-to-page linking
- Recent-changes feed
- Watchlists

### Does NOT own
| Capability | Lives in |
|---|---|
| Content lifecycle | `cms` |
| Markdown processing | `md` |
| Codex entities | `codex` |
| Search | `search` |
| Tags / taxonomies | `taxonomy` |
| Notifications | `notify` |
| Comments / discussion | `review` (folded for now) |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **MediaWiki** | The wiki standard. | PHP-heavy, ops burden. |
| **Notion** | Modern wiki-alike. | SaaS, not embeddable. |
| **Outline** | OSS knowledge base. | Heavyweight. |
| **TiddlyWiki** | File-based. | Old-school. |
| **Custom per-product** | Common. | Reinvented. |

## How this fits the NekoStack

- **`cms`** handles content lifecycle.
- **`md`** renders content.
- **`codex`** entities link to wiki pages.
- **`search`** indexes wiki content.
- **`taxonomy`** for tags.

## Design philosophy

- **Cross-linked by default.** Page links are typed; broken links flagged.
- **Hierarchy explicit.** Pages have parents; navigation reflects structure.
- **Entity-aware.** Codex entity → its wiki page is a one-click navigation.
- **Search is first-class.** Wiki without search is read-only docs.

## Architecture sketch

```
packages/wiki/
├── src/
│   ├── page/
│   │   ├── render.tsx          # via md
│   │   └── hierarchy.ts
│   ├── linking/
│   │   ├── cross-page.ts
│   │   └── broken-detect.ts
│   ├── entity/
│   │   └── codex-link.ts
│   ├── history/
│   │   └── via-cms.ts
│   ├── search/
│   │   └── via-search.ts
│   ├── recent-changes/
│   │   └── feed.ts
│   ├── watchlist/
│   │   └── via-notify.ts
│   └── cli.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Page rendering + hierarchy
### v0.2 — Cross-linking + broken-link detection
### v0.3 — Codex entity linking
### v0.4 — Search integration
### v0.5 — Recent changes
### v0.6 — Watchlists
### v1.0 — Stable API

## Product potential

**Internal:** NekoBattler wiki, Mara Kane codex, NekoSystems knowledge.
**Open source release:** Modest — game-wiki niche less crowded than general wiki.
**Commercial:** Marginal.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Content / narrative.
- **Estimated learning return:** High. Cross-linking semantics, hierarchy navigation, entity-aware wiki design.
