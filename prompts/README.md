# `prompts/`

> Reusable LLM / agent instructions. Prompt content as text files. The authoritative copy lives here; `@nekostack/prompts` (the package) may load from these files.

## What lives here

Markdown / text files containing prompts and prompt fragments designed for reuse — by Claude sessions, by `@nekostack/prompts` consumers, by agentic workflows.

Examples:

- `prompts/repo-audit.md` — "Audit this repository for ..." — the canonical prompt for invoking a repo audit.
- `prompts/package-readme-from-boundaries.md` — "Generate a package README from BOUNDARIES.md row using the standard template."
- `prompts/incident-response-assist.md` — Walk an on-call engineer through incident response.
- `prompts/code-review-strict.md` — System prompt for code-review agent operating against NekoStack standards.
- `prompts/scaffold-new-project.md` — Drive an agent to scaffold a new project from a starter.

Each file is the actual text you'd send to an LLM (or a template with variables marked `{{like-this}}`).

## What does NOT live here

| Type | Where it goes | Why |
|---|---|---|
| Prompt engine implementation | `@nekostack/prompts` package | Engine, not content |
| Doctrine about prompt engineering | `references/llm/` | Explains, not prompts |
| A one-line prompt fragment used in code | `snippets/llm/` | Too small for standalone file |
| Tool definitions (function-calling schemas) | `@nekostack/tools` package | Different concept |
| Memory / RAG content | `@nekostack/memory`, `@nekostack/rag` | Different runtime layer |

The distinguishing test: **is this a prompt you'd literally send to an LLM, or a fragment thereof?** If yes → `prompts/`. If it's machinery for prompts → package. If it explains prompts → references.

## Naming + sharding

Shard by **purpose** when accumulation justifies:

- `prompts/audit/` — audit-style prompts (repo audit, security audit, a11y audit)
- `prompts/generate/` — generation prompts (README, ADR, schema)
- `prompts/assist/` — assistive prompts (incident response, debugging guide)
- `prompts/system/` — system prompts for specific agents

For top-level prompts not fitting a shard, leave at root.

File names: kebab-case noun-or-verb phrase describing the prompt's purpose. `repo-audit.md`, `package-readme-from-boundaries.md`.

Format inside each file:

1. **Frontmatter (optional)** — variables, expected model, expected output schema.
2. **The prompt itself** — markdown text.
3. **Usage notes** at the bottom — examples of when to use, expected outputs.

## How to add a prompt

1. Identify the recurring use case. Is this prompt going to be reused? If it's a one-off, don't add it.
2. Pick the right shard (or root if no shard fits).
3. Write the prompt as you'd send it.
4. Mark variables `{{var}}` if the prompt is templated.
5. Add usage notes.

## Versioning

Prompts evolve. When a prompt changes substantively:

- Don't silently update. Add a `## Changelog` section noting what changed and why.
- For breaking changes, consider versioned filenames: `repo-audit.v2.md`.
- `@nekostack/prompts` (the package) handles formal versioning at the registry level; this folder is the content source.

## Relationship to `@nekostack/prompts` package

- **`prompts/` folder** = content. Static text files. The source of truth.
- **`@nekostack/prompts` package** = engine. Loads prompts from here, validates, versions, routes to providers, validates output.

The package consumes the folder. Both exist; neither replaces the other.

## See also

- [`ARTIFACTS.md`](../ARTIFACTS.md) — taxonomy.
- [`@nekostack/prompts`](../packages/prompts/README.md) — the engine.
- [`references/llm/`](../references/README.md) — for prompt-engineering doctrine.
- [`snippets/llm/`](../snippets/README.md) — for prompt fragments.
