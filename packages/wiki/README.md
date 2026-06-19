# @nekostack/wiki

> Wiki engine: knowledge pages, cross-linking, history, hierarchy. The page-rendering layer for game lore (NekoBattler wiki), narrative codex browsing (Mara Kane), tenant knowledge bases (NekoSystems).

## Quick reference

| | |
|---|---|
| **Build tier** | Content / narrative |
| **Depends on** | `schema`, `cms` (content lifecycle), `md`, `codex` (entity references), `search`, `ui`, `audit` |
| **Used by** | NekoBattler (champion wiki â€” already partially exists), Mara Kane (narrative codex browsing), NekoSystems (tenant knowledge / customer-facing docs), Leytide (in-game help), any product with reference content |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 10â€“16 weeks focused |

## Why this exists

Wikis are everywhere in content-rich projects. NekoBattler already has wiki pages for champions. Mara Kane's lore is wiki-shaped. NekoSystems tenant knowledge bases (FAQs, runbooks, customer-facing docs) are wiki-shaped. Without a shared engine, each reinvents page rendering, cross-linking, search, history.

## Scope

### In scope
- Page rendering (via `md` + `editor` for authoring).
- Cross-page linking with broken-link detection.
- Page hierarchy (parent / child).
- Page history (versioned via `cms`).
- Entity-to-page links (Codex entity â†’ wiki page).
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
- **Entity-aware.** Codex entity â†’ its wiki page is a one-click navigation.
- **Search is first-class.** Wiki without search is read-only docs.

## Architecture sketch

```
packages/wiki/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ page/
â”‚   â”‚   â”œâ”€â”€ render.tsx          # via md
â”‚   â”‚   â””â”€â”€ hierarchy.ts
â”‚   â”œâ”€â”€ linking/
â”‚   â”‚   â”œâ”€â”€ cross-page.ts
â”‚   â”‚   â””â”€â”€ broken-detect.ts
â”‚   â”œâ”€â”€ entity/
â”‚   â”‚   â””â”€â”€ codex-link.ts
â”‚   â”œâ”€â”€ history/
â”‚   â”‚   â””â”€â”€ via-cms.ts
â”‚   â”œâ”€â”€ search/
â”‚   â”‚   â””â”€â”€ via-search.ts
â”‚   â”œâ”€â”€ recent-changes/
â”‚   â”‚   â””â”€â”€ feed.ts
â”‚   â”œâ”€â”€ watchlist/
â”‚   â”‚   â””â”€â”€ via-notify.ts
â”‚   â””â”€â”€ cli.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Page rendering + hierarchy
### v0.2 â€” Cross-linking + broken-link detection
### v0.3 â€” Codex entity linking
### v0.4 â€” Search integration
### v0.5 â€” Recent changes
### v0.6 â€” Watchlists
### v1.0 â€” Stable API

## Product potential

**Internal:** NekoBattler wiki, Mara Kane codex, NekoSystems knowledge.
**Open source release:** Modest â€” game-wiki niche less crowded than general wiki.
**Commercial:** Marginal.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Content / narrative.
- **Estimated learning return:** High. Cross-linking semantics, hierarchy navigation, entity-aware wiki design.
