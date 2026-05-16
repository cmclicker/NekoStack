# `standards/`

> Mandatory conventions. Hard rules NekoStack itself follows. Read as authoritative, not advisory.

## What lives here

Rules and conventions that bind. Where doctrine ends and "this is how we do it" begins.

Examples:

- `standards/readme-shape.md` — Every package README has this exact section order: tagline → Quick reference → Why this exists → Scope → Boundary → Competitors → How this fits → Design philosophy → Architecture → Roadmap → Product potential → Status.
- `standards/commit-format.md` — Conventional Commits format with NekoStack-specific scope vocabulary.
- `standards/capability-ownership.md` — Every capability has exactly one owning package; conflicts resolved in BOUNDARIES.md.
- `standards/folder-naming.md` — kebab-case for folders, exceptions documented.
- `standards/imports.md` — Import ordering, package vs internal, no circular dependencies.
- `standards/test-files.md` — Test file naming, location, structure.
- `standards/error-codes.md` — Error code format and registry.

Each standard is a rule. Violating it is a defect. Standards are short — long content is doctrine and lives in `references/`.

## What does NOT live here

| Type | Where it goes | Why |
|---|---|---|
| Explanation of why we have this rule | `references/` | Doctrine, not rule |
| Specific architectural decisions | `decisions/` | ADRs, not standards |
| Recurring verification checklists | `checklists/` | Process, not rule |
| The lint rule that enforces the standard | `@nekostack/lint` package | Implementation |
| Runtime policy enforcement | `@nekostack/governance` package | Runtime, not static rule |

The distinguishing test: **is this a rule that, if violated, is a defect — regardless of context?** If yes → standard. If it depends on context → reference or decision.

## Naming + sharding

Most standards are flat. Shard if a domain accumulates many:

- `standards/code/` — code-level conventions (imports, naming, structure)
- `standards/docs/` — documentation conventions (README shape, commit format)
- `standards/process/` — process conventions (review, release, ownership)

File names: kebab-case noun describing what's standardized. `readme-shape.md`, `commit-format.md`.

Format inside each standard:

1. **The rule** — one or two paragraphs, stated declaratively.
2. **Examples** — both correct and incorrect.
3. **Exceptions** — explicitly enumerated; if there are too many, the standard isn't a standard.
4. **Enforcement** — how this is enforced (manual review, lint rule in `@nekostack/lint`, runtime gate in `@nekostack/governance`, CI check).
5. **Rationale** (brief) — why this is the rule. Link to `references/` or `decisions/` for deeper explanation.

## How to add a standard

1. Confirm this *is* a binding rule, not advisory practice. Advisory things go in `references/`.
2. Write the standard concisely. If it sprawls, it's not yet ready to be a standard.
3. Add positive and negative examples.
4. Decide on enforcement: static (lint), runtime (governance), or manual (review checklist).
5. If lintable, file a follow-up to add the lint rule in `@nekostack/lint`.

## Standards evolve

Standards can change, but the change is a deliberate act:

- **Adding a standard** — significant. Often triggered by a decision (`decisions/`).
- **Modifying a standard** — needs a version bump or supersession note. Code following the old version isn't a defect retroactively, but new code follows new rule.
- **Removing a standard** — rare. Usually superseded rather than deleted; old standard kept with a "superseded by X" pointer.

## See also

- [`ARTIFACTS.md`](../ARTIFACTS.md) — taxonomy.
- [`references/`](../references/README.md) — for the rationale behind standards.
- [`decisions/`](../decisions/README.md) — for the formal decisions that created standards.
- [`checklists/`](../checklists/README.md) — for verifying standards are followed.
- [`@nekostack/lint`](../packages/lint/README.md) — for static enforcement.
- [`@nekostack/governance`](../packages/governance/README.md) — for runtime enforcement.
