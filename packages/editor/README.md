# @nekostack/editor

> Rich text editor built on ProseMirror. Schemas, plugins, collaborative editing primitives. The substrate for narrative drafts, agent prompt editing, admin notes, comments.

## Quick reference

| | |
|---|---|
| **Build tier** | Frontend depth |
| **Depends on** | `schema`, `ui`, `theme`, `realtime` (collaborative editing optional), `md` (markdown round-trip) |
| **Used by** | Mara Kane (narrative drafts), `prompts` (prompt template editor), `admin` (notes), `wiki` (page editing), narrative tooling |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 12â€“20 weeks focused |

## Why this exists

Rich text editing is hard. ProseMirror is the right substrate. Tiptap is the popular wrapper. `editor` provides NekoStack-conventional defaults + collaborative editing via `realtime`'s Yjs adapter + markdown round-trip.

## Scope

### In scope
- ProseMirror-based editor.
- Standard rich-text nodes (paragraph, headings, lists, code, blockquote, links, images).
- Custom node types per consumer.
- Collaborative editing (Yjs via `realtime`).
- Markdown round-trip.
- Slash commands for node insertion.
- Comments / inline annotations.
- Track changes.

### Out of scope
- Markdown parsing primitives (`md`).
- Real-time transport (`realtime`).
- Non-rich-text inputs (`form`).
- Code-only editor (Monaco / CodeMirror).

## Boundary

### Owns
- ProseMirror editor
- Standard rich-text nodes
- Custom node API
- Collaborative editing integration
- Markdown round-trip
- Slash commands
- Inline annotations
- Track changes

### Does NOT own
| Capability | Lives in |
|---|---|
| Markdown parsing primitives | `md` |
| Real-time transport | `realtime` |
| Form inputs | `form` |
| Code editor | external (Monaco / CodeMirror) |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **Tiptap** | Mature ProseMirror wrapper. | Closest fit; we could build on. |
| **Lexical (Meta)** | Modern, frameworkagnostic. | Larger learning curve. |
| **Slate** | Mature. | Smaller momentum than Tiptap. |
| **Quill** | Mature. | Older, harder to customize. |

## How this fits the NekoStack

- **`realtime`** for collaborative editing via Yjs.
- **`md`** for markdown round-trip.
- **`ui`** + **`theme`** for styling.

## Design philosophy

- **ProseMirror under the hood.** Battle-tested substrate.
- **Markdown round-trip is default.** Content should be portable.
- **Collaborative is opt-in.** Single-user works; collab adds via Yjs.

## Architecture sketch

```
packages/editor/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ core/
â”‚   â”‚   â”œâ”€â”€ editor.ts          # ProseMirror wrapper
â”‚   â”‚   â””â”€â”€ schema.ts
â”‚   â”œâ”€â”€ nodes/
â”‚   â”‚   â”œâ”€â”€ paragraph.ts
â”‚   â”‚   â”œâ”€â”€ headings.ts
â”‚   â”‚   â”œâ”€â”€ lists.ts
â”‚   â”‚   â””â”€â”€ ...
â”‚   â”œâ”€â”€ plugins/
â”‚   â”‚   â”œâ”€â”€ slash-command.ts
â”‚   â”‚   â”œâ”€â”€ annotation.ts
â”‚   â”‚   â””â”€â”€ track-changes.ts
â”‚   â”œâ”€â”€ collab/
â”‚   â”‚   â””â”€â”€ yjs.ts             # via realtime
â”‚   â”œâ”€â”€ markdown/
â”‚   â”‚   â”œâ”€â”€ from-md.ts
â”‚   â”‚   â””â”€â”€ to-md.ts
â”‚   â””â”€â”€ react/
â”‚       â””â”€â”€ component.tsx
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Basic ProseMirror editor
### v0.2 â€” Standard rich-text nodes
### v0.3 â€” Markdown round-trip
### v0.4 â€” Slash commands
### v0.5 â€” Annotations
### v0.6 â€” Collaborative editing
### v0.7 â€” Track changes
### v1.0 â€” Stable API

## Product potential

**Internal:** Mara Kane, prompt editing, admin, wiki.
**Open source release:** Modest.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Frontend depth.
- **Estimated learning return:** Very high. ProseMirror semantics, collaborative editing via CRDTs, document schema design.
