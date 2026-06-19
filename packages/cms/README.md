# @nekostack/cms

> Headless content management: draft / review / publish lifecycle, content versioning, scheduling, localized variants. The "edit content separately from code" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Content / narrative |
| **Depends on** | `schema` (content types), `editor` (rich text), `md`, `audit`, `storage`, `time` (scheduling), `locale` |
| **Used by** | Mara Kane (narrative content), `wiki` (page content), game patch notes, blog / news surfaces, marketing pages |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 12â€“18 weeks focused |

## Why this exists

Content that changes independently of code (blog posts, narrative chapters, lore entries, patch notes, marketing copy) needs its own lifecycle. Embedding into code means deploys for every content change. `cms` is the layer.

## Scope

### In scope
- Content type definitions (via `schema`).
- Draft / review / published lifecycle.
- Content versioning + history.
- Scheduled publishing (via `time`).
- Localized content variants (via `locale`).
- Content references (link from content to other entities).
- Author / editor / reviewer roles (via `permissions`).
- Publish webhooks.

### Out of scope
- Markdown processing (`md`).
- Rich text editor (`editor`).
- Wiki rendering (`wiki`).
- File storage (`storage`).

## Boundary

### Owns
- Content type definitions
- Draft / review / published lifecycle
- Content versioning
- Scheduled publishing
- Localized variants
- Content references
- Publish webhooks

### Does NOT own
| Capability | Lives in |
|---|---|
| Markdown | `md` |
| Editor UI | `editor` |
| Wiki rendering | `wiki` |
| File storage | `storage` |
| Translation catalogs | `locale` |
| Audit | `audit` |
| Permissions | `permissions` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **Sanity** | Mature headless CMS. | Hosted; vendor. |
| **Strapi** | OSS self-hosted CMS. | Heavyweight, opinionated. |
| **Payload** | TS-native CMS. | Closer fit. |
| **Contentful** | Hosted enterprise. | Vendor. |
| **Custom CMS** | Common. | Reinvented. |

## How this fits the NekoStack

- **`schema`** defines content types.
- **`editor`** for rich text editing.
- **`md`** for markdown content.
- **`locale`** for translations.
- **`audit`** records publish events.
- **`permissions`** for author / editor roles.
- **`time`** for scheduled publishing.

## Design philosophy

- **Schema-typed content.** No free-form "post" with arbitrary fields.
- **Lifecycle is explicit.** Draft / in-review / approved / published / archived.
- **Versioning mandatory.** Old versions retrievable; rollback supported.
- **Scheduling first-class.** "Publish at 9am Monday" is a real workflow.

## Architecture sketch

```
packages/cms/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ types/
â”‚   â”‚   â””â”€â”€ define.ts          # content type DSL
â”‚   â”œâ”€â”€ lifecycle/
â”‚   â”‚   â”œâ”€â”€ draft.ts
â”‚   â”‚   â”œâ”€â”€ review.ts
â”‚   â”‚   â””â”€â”€ publish.ts
â”‚   â”œâ”€â”€ versioning/
â”‚   â”‚   â””â”€â”€ history.ts
â”‚   â”œâ”€â”€ schedule/
â”‚   â”‚   â””â”€â”€ publish-at.ts      # via time
â”‚   â”œâ”€â”€ locale/
â”‚   â”‚   â””â”€â”€ variant.ts          # via locale
â”‚   â”œâ”€â”€ references/
â”‚   â”‚   â””â”€â”€ cross-link.ts
â”‚   â”œâ”€â”€ webhooks/
â”‚   â”‚   â””â”€â”€ on-publish.ts
â”‚   â””â”€â”€ cli.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Content types + draft/publish lifecycle
### v0.2 â€” Versioning
### v0.3 â€” Scheduled publishing
### v0.4 â€” Localized variants
### v0.5 â€” Cross-references
### v0.6 â€” Publish webhooks
### v1.0 â€” Stable API

## Product potential

**Internal:** Mara Kane, narrative tools, patch notes.
**Open source release:** Modest.
**Commercial:** Marginal.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Content / narrative.
- **Estimated learning return:** High. Content lifecycle, versioning, scheduled publishing, localized variants.
