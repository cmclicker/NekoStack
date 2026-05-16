# @nekostack/templates

> `npx create-neko` project starters. Scaffolds new projects using the NekoStack ecosystem with sensible defaults.

## Quick reference

| | |
|---|---|
| **Build tier** | Documentation / scaffolding |
| **Depends on** | `cli`, `schema`, `env`, `config` |
| **Used by** | new project creation; `neko init` invokes us |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 6–10 weeks focused |
| **Sellable?** | Modest — create-next-app etc. dominate |

## Why this exists

Once the stack exists, new projects need quick starts that use it correctly. `templates` is the `create-neko` collection.

Note: this package is most useful **after** other packages reach maturity. Building it earlier creates templates for vapor.

## Scope

### In scope
- Project template DSL.
- `create-neko` CLI command.
- Built-in templates (SaaS / game / narrative / agent / utility-kit).
- Interactive prompts for template selection.
- Customization options per template.
- Post-init hooks (install deps, init git, set up env).

### Out of scope
- The actual NekoStack packages (we use them).
- Generic project scaffolding outside NekoStack.

## Boundary

### Owns
- Template DSL
- create-neko command
- Built-in templates
- Interactive prompts
- Post-init hooks

### Does NOT own
| Capability | Lives in |
|---|---|
| CLI substrate | `cli` |
| Dev environment setup | `env` |
| Specific package code | each NekoStack package |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **create-next-app** | Mature framework starter. | Framework-specific. |
| **degit** | Lightweight scaffold. | Substrate. |
| **giget** | Modern alternative. | Substrate. |

## How this fits the NekoStack

- **`cli`** integrates.
- **`env`** for post-init dev environment.
- Other packages are what's scaffolded.

## Design philosophy

- **Opinionated defaults.** Templates ship with NekoStack-conventional setup.
- **Customizable.** Users can override defaults.
- **Post-init real.** Templates aren't just files; they install deps + init git.

## Architecture sketch

```
packages/templates/
├── src/
│   ├── dsl/
│   │   └── template.ts
│   ├── create/
│   │   └── command.ts
│   ├── prompts/
│   │   └── interactive.ts
│   ├── hooks/
│   │   ├── install-deps.ts
│   │   └── init-git.ts
│   └── built-in/
│       ├── saas/
│       ├── game/
│       ├── narrative/
│       ├── agent/
│       └── utility-kit/
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Template DSL + create-neko command
### v0.2 — SaaS template
### v0.3 — Game template
### v0.4 — Narrative template
### v0.5 — Agent template
### v0.6 — Utility-kit template
### v0.7 — Customization
### v1.0 — Stable templates

## Product potential

**Internal:** New project bootstrap.
**Open source release:** Modest.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Documentation / scaffolding — **build late**, after underlying packages are stable.
- **Estimated learning return:** Moderate. Project template architecture, interactive CLIs.
