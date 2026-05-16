# NekoStack — Reusable Artifact Taxonomy

> The canonical map of "which top-level folder owns which kind of reusable asset." Read this **first** before adding a new doc, snippet, starter, or checklist — and especially before creating a new top-level folder.

## Purpose

`ARTIFACTS.md` is the asset-layer counterpart to [`BOUNDARIES.md`](BOUNDARIES.md). The two documents answer different questions:

| Document | Question it answers | Layer it governs |
|---|---|---|
| `BOUNDARIES.md` | Which **package** owns which **capability**? | `packages/` — code that runs, validates, transforms, renders |
| `ARTIFACTS.md` | Which **folder** owns which **kind of reusable asset**? | `references/`, `starters/`, `snippets/`, `checklists/`, `configs/`, `playbooks/`, `examples/`, `prompts/`, `standards/`, `decisions/`, `manifests/` |

A capability is implementation. An artifact is reference, scaffold, or process material. NekoStack hosts both — and the rules for one don't apply to the other.

## How to use this document

- **Adding a new doc, snippet, or starter?** Find which folder owns that artifact kind here. If your artifact doesn't match any row, that's a signal to either reshape it (so it does) or propose a new top-level folder (rare — see "Adding a new artifact folder" below).
- **Adding a new top-level folder?** Don't, unless the rules below clearly fail. The asset layer should stay small and stable.
- **Wondering whether to make something a package or an artifact?** See the "Package vs artifact" rule at the bottom.

## Conventions

- **Asset folders are content libraries, not implementations.** They are consumed by humans, agents, or — in some cases — packages. They do not run, validate, or transform on their own.
- **One artifact kind per folder.** A snippet does not live under `references/`; a starter does not live under `snippets/`. If a thing fits two folders, pick the dominant one and link from the other.
- **Tooling-tier subdirs.** Most asset folders are sharded by tooling/domain at the first level: `references/node/`, `starters/react/`, `snippets/python/`, `checklists/release/`. Keep this consistent.
- **Asset → package, not the reverse.** Packages may consume assets (e.g., `packages/templates` reads starter manifests from `starters/`). Assets never depend on package internals.

---

## Naming clarification: `packages/templates` vs `starters/`

These are not the same thing. They were confusable when the asset folder was also named `templates/`; renaming the asset folder to `starters/` resolves it.

| Path | What it is | What lives in it |
|---|---|---|
| `packages/templates` | The **template engine** — code that loads manifests, renders variables, applies scaffolds, validates structure. Implements capability rows in BOUNDARIES.md §45 ("Project templates"). | TypeScript source: `loadTemplate.ts`, `renderTemplate.ts`, `applyTemplate.ts`, `validateTemplate.ts`. |
| `starters/` | The **starter content library** — reusable starting structures consumed by `packages/templates` (and by humans copying directly). | Folders of files: `starters/node/node-ts-cli/`, `starters/react/react-dashboard/`, etc. |

Rule of thumb: if it runs `pnpm test`, it belongs in `packages/`. If it is what you scaffold *from*, it belongs in `starters/`.

---

## Folder inventory

| Folder | Artifact kind | Purpose | Typical contents |
|---|---|---|---|
| `references/` | Doctrine + learning notes | Personal engineering handbook. Explains *how a tooling works* and *how NekoStack uses it*. Read to learn or refresh; not copied wholesale. | `references/node/package-json.md`, `references/react/component-architecture.md`, `references/python/packaging.md` |
| `starters/` | Scaffold-ready starting structures | What a new project begins as. Consumed by `packages/templates` or copied by hand. Each starter is a self-contained folder tree. | `starters/node/node-ts-cli/`, `starters/react/react-dashboard/`, `starters/fullstack/react-node-api/` |
| `snippets/` | Small reusable code/config atoms | Copy-into-project fragments too small to be a package. Single files or tiny clusters. Lives here until promoted to a package or starter. | `snippets/node/tsconfig/node-strict.json`, `snippets/node/safe-write-file.ts`, `snippets/react/accessible-modal.tsx` |
| `configs/` | Canonical config presets | Reusable tool configs (ESLint, Prettier, TS, etc.) as standalone files. Distinct from snippets in that they are **complete, drop-in** configs, not fragments. | `configs/typescript/node-strict.json`, `configs/eslint/react-strict.cjs` |
| `checklists/` | Repeatable verification process | Checklists for recurring tasks: project-start, pre-release, code review, accessibility audit. Markdown only. | `checklists/release/pre-release.md`, `checklists/node/project-start.md`, `checklists/accessibility/wcag-aa-review.md` |
| `playbooks/` | Operating procedures | Longer step-by-step procedures: incident response, rollback, post-mortem template. Distinct from checklists in that they are narrative procedures, not just verification lists. | `playbooks/incident-response.md`, `playbooks/dependency-upgrade.md` |
| `examples/` | Completed working examples | End-to-end working demos showing how packages compose. Different from starters (which are *empty* shells) and apps (which are *real* products). | `examples/auth-with-tenant/`, `examples/schema-to-openapi/` |
| `prompts/` | Reusable LLM/agent instructions | Prompt fragments and full prompts intended for reuse with Claude / other agents. Authoritative copies live here; `packages/prompts` may load from this. | `prompts/repo-audit.md`, `prompts/package-readme-from-boundaries.md` |
| `standards/` | Mandatory conventions | Hard rules NekoStack itself follows: file naming, commit format, README structure, capability-ownership protocol. Read as authoritative, not advisory. | `standards/readme-shape.md`, `standards/commit-format.md`, `standards/capability-ownership.md` |
| `decisions/` | Architectural decision records | ADR snapshots stored as files, separate from the runtime `packages/decision` engine. Human-readable, version-controlled, append-only in practice. | `decisions/0001-monorepo.md`, `decisions/0014-asset-vs-package-split.md` |
| `manifests/` | Cross-cutting machine-readable indexes | Generated or hand-maintained manifests that tools consume to navigate the stack (package list, agent memory map, etc.). | `manifests/packages.json`, `manifests/NekoAPI.mind.md` |

---

## Decision rules: "where does this thing go?"

When unsure, walk these top-to-bottom — first match wins:

1. **Does it run, enforce, validate, render, transform, or expose an API?** → `packages/`. Stop. (Then see `BOUNDARIES.md` for which package.)
2. **Is it a complete folder tree intended as a starting point for a new project?** → `starters/<tooling>/<name>/`.
3. **Is it a small reusable fragment (single file, < ~50 lines, or a tight cluster) meant to be copied?** → `snippets/<tooling>/`.
4. **Is it a complete, drop-in tool config (eslint/prettier/tsconfig/etc.)?** → `configs/<tool>/`. If it's a fragment of a config, it goes in `snippets/<tooling>/<tool>/`.
5. **Is it a verification list for a recurring task?** → `checklists/<domain>/`.
6. **Is it a step-by-step narrative procedure?** → `playbooks/`.
7. **Is it a working, end-to-end demonstration of packages composing?** → `examples/`.
8. **Is it a prompt or prompt fragment for LLM/agent use?** → `prompts/`.
9. **Is it a hard rule NekoStack itself follows?** → `standards/`.
10. **Is it an ADR-style record of a decision?** → `decisions/`.
11. **Is it a machine-readable index for tools/agents?** → `manifests/`.
12. **Is it teaching or doctrine — explaining how something works or how we use it?** → `references/<tooling>/`.

If none match cleanly, the artifact is probably either (a) miscategorized — try reshaping it, or (b) genuinely new — see below.

---

## Package vs artifact: the load-bearing rule

The most common mistake: putting implementation in an asset folder, or putting reference material in a package.

> **If it runs, enforces, validates, renders, transforms, or provides an API → `packages/`.**
> **If it teaches, demonstrates, scaffolds, reminds, or documents reusable practice → asset folder.**

Examples:

| Thing | Correct home | Why |
|---|---|---|
| Node `package.json` field-by-field explanation | `references/node/package-json.md` | Teaches |
| Node TS CLI starter folder | `starters/node/node-ts-cli/` | Scaffolds |
| Reusable strict `tsconfig.json` preset | `configs/typescript/node-strict.json` | Drop-in config |
| `tsconfig` fragment showing a single compiler option | `snippets/node/tsconfig/strict-options.json` | Fragment |
| CLI engine that applies starters | `packages/templates` (+ `packages/cli`) | Runs |
| Validator implementation | `packages/validator` | Validates |
| "How to validate YAML with NekoStack" doc | `references/node/validation.md` | Teaches |
| Claude prompt for repo audit | `prompts/repo-audit.md` | Reusable agent instruction |
| Project-start checklist | `checklists/project-start.md` | Verification list |
| ADR: "why monorepo" | `decisions/0001-monorepo.md` | Decision record |
| ADR engine + storage layer | `packages/decision` | Runs |

The same topic can have entries in multiple folders. Templates is the canonical example:

- `packages/templates` — the engine (code).
- `starters/<tooling>/<name>/` — the starter content (folder trees).
- `references/templates.md` — how the template system works (doctrine).
- `checklists/project-start.md` — checklist that *uses* a starter.
- `prompts/scaffold-new-project.md` — prompt that drives an agent to scaffold.

These are not duplicates — they are five different artifact kinds for one capability.

---

## Adding a new artifact folder

The asset layer should stay small. Before adding a new top-level folder, confirm:

1. The artifact kind cannot be reshaped into any existing folder (re-read the decision rules and the inventory).
2. You have at least three real artifacts that would live in it. One artifact is not enough.
3. The folder name describes what's *inside*, not who *uses* it (good: `playbooks/`; bad: `for-claude/`, `internal/`).
4. The folder cannot collide with a package name. Asset folders are top-level siblings of `packages/`; a new folder named `templates/` would re-create the confusion this taxonomy was built to resolve.

If all four hold, add the folder, add a row to the inventory table above, and update the decision rules.

---

## Sharding inside asset folders

Most asset folders shard by **tooling or domain** at the first level:

- `references/node/`, `references/react/`, `references/python/`
- `starters/node/`, `starters/react/`, `starters/fullstack/`
- `snippets/node/`, `snippets/react/`
- `checklists/node/`, `checklists/release/`, `checklists/accessibility/`

Use kebab-case for sub-folders (`node-ts-cli`, not `NodeTSCli`). Prefer the most specific applicable category at each level: `references/node/package-json.md` over `references/general/node-package-json.md`.

For `configs/`, shard by **tool** not tooling: `configs/typescript/`, `configs/eslint/`, `configs/prettier/`. A config preset is owned by the tool it configures.

---

## Process

1. **Before adding an asset**, walk the decision rules. Place it in the right folder, in the right sub-folder.
2. **Before adding a new top-level folder**, satisfy all four conditions above and update this document.
3. **When an asset grows into something that runs or enforces** (e.g., a snippet that wants to be imported as a function, or a starter that wants to validate itself), promote it into `packages/` and update `BOUNDARIES.md`.
4. **When a package's surface stops running and becomes pure reference** (rare), demote it into the appropriate asset folder and remove its rows from `BOUNDARIES.md`.
5. **Audit periodically**: empty sub-folders are tolerated as placeholders; empty top-level folders are a smell — either populate or remove.

---

## Relationship to `BOUNDARIES.md`

The two documents are siblings, not parent/child. Reading one without the other gives an incomplete picture of what NekoStack is:

- `BOUNDARIES.md` is the spine of the **built stack**. It governs what gets implemented and where.
- `ARTIFACTS.md` is the spine of the **reusable asset library**. It governs what gets documented, scaffolded, and reused as content.

A capability described in `BOUNDARIES.md` may have artifacts referenced in `ARTIFACTS.md`-governed folders (e.g., the "Project templates" capability has both a package row in BOUNDARIES.md and starter content in `starters/`). When this happens, the package README should cross-link to the relevant asset folder, and vice versa.

Where the two appear to conflict on ownership of a specific item, the rule is: **if the item runs, BOUNDARIES wins; otherwise, ARTIFACTS wins.**
