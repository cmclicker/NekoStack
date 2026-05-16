# @nekostack/editor

> Rich text editor built on ProseMirror. Schemas, plugins, collaborative editing primitives. The substrate for narrative drafts, agent prompt editing, admin notes, comments.

## Quick reference

| | |
|---|---|
| **Build tier** | Frontend depth |
| **Depends on** | `schema`, `ui`, `theme`, `realtime` (collaborative editing optional), `md` (markdown round-trip) |
| **Used by** | Mara Kane (narrative drafts), `prompts` (prompt template editor), `admin` (notes), `wiki` (page editing), narrative tooling |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 12–20 weeks focused |
| **Sellable?** | Modest — Tiptap dominates; integration angle |

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
├── src/
│   ├── core/
│   │   ├── editor.ts          # ProseMirror wrapper
│   │   └── schema.ts
│   ├── nodes/
│   │   ├── paragraph.ts
│   │   ├── headings.ts
│   │   ├── lists.ts
│   │   └── ...
│   ├── plugins/
│   │   ├── slash-command.ts
│   │   ├── annotation.ts
│   │   └── track-changes.ts
│   ├── collab/
│   │   └── yjs.ts             # via realtime
│   ├── markdown/
│   │   ├── from-md.ts
│   │   └── to-md.ts
│   └── react/
│       └── component.tsx
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Basic ProseMirror editor
### v0.2 — Standard rich-text nodes
### v0.3 — Markdown round-trip
### v0.4 — Slash commands
### v0.5 — Annotations
### v0.6 — Collaborative editing
### v0.7 — Track changes
### v1.0 — Stable API

## Product potential

**Internal:** Mara Kane, prompt editing, admin, wiki.
**Open source release:** Modest.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Frontend depth.
- **Estimated learning return:** Very high. ProseMirror semantics, collaborative editing via CRDTs, document schema design.
