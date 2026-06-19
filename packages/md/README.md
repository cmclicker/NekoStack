# @nekostack/md

> Markdown processing with custom plugins. Frontmatter parsing, code highlighting, math, cross-references, embeds. The substrate beneath `docs`, `wiki`, `editor`, narrative tooling.

## Quick reference

| | |
|---|---|
| **Build tier** | Frontend depth â€” content substrate |
| **Depends on** | `schema` (frontmatter shapes); external: unified / remark / rehype |
| **Used by** | `docs` (doc generation), `wiki` (page rendering), `editor` (markdown round-trip), `cms` (markdown content), Mara Kane (narrative drafts), NekoSystems (tenant-facing docs + knowledge content) |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 4â€“8 weeks focused |

## Why this exists

You have a *lot* of markdown across projects. Every consumer needs slightly different processing: NekoStack docs need cross-references to BOUNDARIES.md, wiki needs entity links to Codex, narrative drafts need scene-break syntax. `md` provides the unified pipeline with NekoStack-specific plugins.

## Scope

### In scope
- Markdown parsing (via remark).
- Markdown rendering (HTML + JSX).
- Frontmatter parsing (typed via `schema`).
- Code highlighting (Shiki / Prism).
- Math (KaTeX).
- Custom plugins (entity links to `codex`, boundary refs to BOUNDARIES.md).
- Markdown â†’ AST â†’ markdown round-trip (for `editor`).
- Linting (broken links, missing frontmatter fields).

### Out of scope
- Markdown UI editor (`editor`).
- Doc site generation (`docs`).
- Wiki rendering (`wiki`).
- CMS storage (`cms`).

## Boundary

### Owns
- Markdown parser + renderer
- Frontmatter parsing
- Code highlighting
- Math rendering
- Custom plugins (codex links, boundary refs)
- Round-trip (md â†’ AST â†’ md)
- Markdown linting

### Does NOT own
| Capability | Lives in |
|---|---|
| UI editor | `editor` |
| Doc site generation | `docs` |
| Wiki page rendering | `wiki` |
| Content lifecycle | `cms` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **unified / remark / rehype** | Standard. | Substrate; we wrap. |
| **markdown-it** | Mature. | Less plugin ecosystem than unified. |
| **MDX** | JSX-in-markdown. | We support; not replace. |

## How this fits the NekoStack

- **`docs`** consumes for doc generation.
- **`wiki`** consumes for page rendering.
- **`editor`** uses for markdown round-trip.
- **`cms`** stores markdown content.

## Design philosophy

- **unified/remark substrate.** Don't reinvent.
- **Custom plugins for NekoStack conventions.** Codex entity refs, boundary refs.
- **Round-trip-clean.** Markdown â†’ AST â†’ markdown produces identical output.

## Architecture sketch

```
packages/md/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ parse/
â”‚   â”‚   â””â”€â”€ remark.ts
â”‚   â”œâ”€â”€ render/
â”‚   â”‚   â”œâ”€â”€ html.ts
â”‚   â”‚   â””â”€â”€ jsx.tsx
â”‚   â”œâ”€â”€ frontmatter/
â”‚   â”‚   â””â”€â”€ parse.ts            # schema-validated
â”‚   â”œâ”€â”€ highlight/
â”‚   â”‚   â””â”€â”€ shiki.ts
â”‚   â”œâ”€â”€ math/
â”‚   â”‚   â””â”€â”€ katex.ts
â”‚   â”œâ”€â”€ plugins/
â”‚   â”‚   â”œâ”€â”€ codex-entity.ts
â”‚   â”‚   â””â”€â”€ boundary-ref.ts
â”‚   â”œâ”€â”€ round-trip/
â”‚   â”‚   â””â”€â”€ stringify.ts
â”‚   â””â”€â”€ lint/
â”‚       â””â”€â”€ check.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” unified/remark wrapper
### v0.2 â€” Frontmatter parsing
### v0.3 â€” Code highlighting
### v0.4 â€” Math
### v0.5 â€” Custom plugins
### v0.6 â€” Round-trip
### v0.7 â€” Linting
### v1.0 â€” Stable API

## Product potential

**Internal:** Used by many doc/content packages.
**Open source release:** Marginal.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Frontend depth â€” content substrate.
- **Estimated learning return:** Moderate. AST manipulation, plugin authoring, round-trip semantics.
