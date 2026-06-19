# @nekostack/lint

> Custom ESLint rules that enforce NekoStack architectural conventions. Catches the things type-checking and Prettier don't â€” the design patterns, the load-bearing casts, the "every service has a spec file" invariants.

## Quick reference

| | |
|---|---|
| **Build tier** | Foundation primitive â€” build early so conventions are enforced from day one |
| **Depends on** | ESLint (external), `@typescript-eslint/utils`, knowledge of `schema` / `config` / `api` / `auth` conventions |
| **Used by** | every package's CI; every consuming project's `eslint.config.js`; IDE integrations |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 4â€“8 weeks (per-rule effort small; cumulative across ~25â€“30 rules is the cost) |

## Why this exists

Type checking catches type errors. Prettier catches formatting. ESLint's default rules catch generic JavaScript footguns. None of them catch the **architectural conventions** that make a stack legible:

- "Every controller has a matching spec file."
- "No direct `process.env` access outside `@nekostack/config`."
- "Prisma JSON column writes must cast through `as unknown as Prisma.InputJsonValue`."
- "Service classes never import controllers."
- "Schema files only re-export `@nekostack/schema` builders, never inline-define DSL fragments."
- "Telemetry events must be defined in `*.events.ts` files and registered with the central catalog."

These are exactly the kinds of conventions that drift the moment they're not enforced. We literally hit this in NekoVibe â€” an agent removed 15 load-bearing `as object` casts during a cleanup pass and silently broke the build, because no rule caught the pattern.

`@nekostack/lint` is the package where those conventions live as executable lint rules. Run it locally, run it in CI, get instant feedback when a convention is violated. Every NekoStack-consuming project includes this as a dev dependency and runs it on save.

Building this yourself rather than relying on generic ESLint plugins is justified because:
1. **The rules are project-specific.** No third-party plugin knows that NekoStack uses `Prisma.InputJsonValue` casts for typed JSON columns.
2. **You learn ESLint's custom-rule API.** AST traversal, scope analysis, fixer hints â€” real CS skills, very transferable to any future static-analysis work.
3. **Bug-prevention through enforcement.** Every time you catch a real bug with a hand-written rule, the same class of bug is prevented from recurring across every project that uses the rule.

## Scope

### In scope
- ESLint flat-config-compatible plugin (`@nekostack/eslint-plugin` namespace).
- Shareable ESLint configs: `@nekostack/eslint-config/base`, `/typescript`, `/react`, `/nest`, `/strict`.
- Custom rules for NekoStack architectural conventions (catalog evolves over time).
- Fixers where the violation has a mechanical fix.
- Rule documentation site auto-generated from rule metadata.

### Out of scope
- Generic linting that already exists in `@typescript-eslint`, `eslint-plugin-react`, etc. We import and extend those, not reimplement.
- Prettier-style formatting. Different tool.
- Type checking. `tsc` already does that.
- Runtime enforcement. Lint rules are static.

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§3, Â§45 for the full capability map.

### Owns
- Custom ESLint rules enforcing NekoStack architectural patterns
- Shareable configs (`@nekostack/eslint-config/base`, `/typescript`, `/react`, `/nest`, `/strict`)
- Auto-fixers where mechanical fix is safe
- Rule documentation auto-generated from rule metadata
- Static enforcement of package-boundary rules (which package can import which)

### Does NOT own
| Capability | Lives in |
|---|---|
| Generic JS/TS rules | external (`@typescript-eslint`, `eslint-plugin-react`, etc. â€” we extend these) |
| Prettier-style formatting | external (Prettier) |
| Type checking | external (`tsc`) |
| Runtime policy enforcement (lifecycle gates, kill-switches) | `governance` (static vs runtime) |
| Test framework | external (Vitest) |
| Architectural conformance at runtime | `governance` |
| Workspace dependency graph | `workspace` (lint consumes the graph) |

## Competitors and adjacent tools

| Tool | What they do well | Where they fall short for us |
|---|---|---|
| **eslint** | The substrate. Battle-tested rule engine. | Default rules don't know our conventions. |
| **@typescript-eslint** | TS-aware lint rules. We extend this. | General-purpose; doesn't enforce architectural patterns. |
| **eslint-plugin-react / -hooks** | React-specific rules. We extend these. | Not architectural; framework-level. |
| **Biome** | Faster lint+format alternative. | Smaller rule ecosystem; custom-rule API less mature than ESLint's. We can consider it later. |
| **Sonarcloud / CodeClimate** | Hosted code-quality services. | External cost, lag time, less control. |
| **dependency-cruiser** | Module-graph enforcement (no cycles, etc). | Solves part of our problem; we can integrate it as a rule rather than replace. |

The right framing: `@nekostack/lint` is built **on top of** ESLint. We add the rules ESLint doesn't ship, and we curate sensible configs that combine general-purpose rules with NekoStack-specific ones.

## How this fits the NekoStack

**Depends on:**
- ESLint (external).
- `@typescript-eslint/utils` for rule authoring.
- Project-specific knowledge of `@nekostack/schema`, `@nekostack/config`, `@nekostack/api` patterns.

**Used by:**
- Every NekoStack-consuming project's `eslint.config.js`.
- CI pipelines.
- IDE integrations (VS Code ESLint plugin picks up the rules automatically).

## Design philosophy

- **One rule, one convention, one error message.** Avoid catch-all rules; prefer many narrow rules with clear names.
- **Fixers wherever safe.** If the rule can mechanically fix the violation, it should.
- **Error messages explain the rule, the rationale, and the fix.** Never just "violation of rule X."
- **Configurable, but with sensible defaults.** Strict mode (`@nekostack/eslint-config/strict`) enables every rule. Base mode enables only the high-signal ones.
- **Test every rule.** Each rule has a fixture-based test suite with valid + invalid cases.

## Architecture sketch

```
packages/lint/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ rules/
â”‚   â”‚   â”œâ”€â”€ no-direct-process-env.ts
â”‚   â”‚   â”œâ”€â”€ prisma-json-cast.ts
â”‚   â”‚   â”œâ”€â”€ service-has-spec.ts
â”‚   â”‚   â”œâ”€â”€ controller-no-service-import-cycle.ts
â”‚   â”‚   â”œâ”€â”€ schema-no-inline-zod.ts
â”‚   â”‚   â”œâ”€â”€ telemetry-events-registered.ts
â”‚   â”‚   â””â”€â”€ ... (~30 rules over time)
â”‚   â”œâ”€â”€ configs/
â”‚   â”‚   â”œâ”€â”€ base.ts
â”‚   â”‚   â”œâ”€â”€ typescript.ts
â”‚   â”‚   â”œâ”€â”€ react.ts
â”‚   â”‚   â”œâ”€â”€ nest.ts
â”‚   â”‚   â””â”€â”€ strict.ts
â”‚   â””â”€â”€ plugin.ts             # ESLint plugin entry
â”œâ”€â”€ tests/
â”‚   â””â”€â”€ rules/
â”‚       â””â”€â”€ no-direct-process-env.test.ts
â””â”€â”€ README.md
```

Example rule (sketch):

```ts
// no-direct-process-env: catches `process.env.X` outside @nekostack/config
export const noDirectProcessEnv: Rule = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow direct process.env access; use @nekostack/config' },
    messages: {
      direct: 'Direct process.env access is not allowed. Use @nekostack/config instead.',
    },
  },
  create(context) {
    if (isConfigPackage(context.filename)) return {}; // self-exempt
    return {
      MemberExpression(node) {
        if (isProcessEnvAccess(node)) {
          context.report({ node, messageId: 'direct' });
        }
      },
    };
  },
};
```

## Roadmap

### v0.1 â€” Bootstrap
- ESLint plugin scaffolding.
- Base config that re-exports `@typescript-eslint` recommended.
- One real custom rule (e.g., `no-direct-process-env`) end-to-end with tests.

### v0.2 â€” Convention rules
- `service-has-spec`, `prisma-json-cast`, `schema-no-inline-zod`, `controller-no-service-cycle`.
- Strict config combining all rules.

### v0.3 â€” Framework configs
- `react` config (React 19, hooks, refresh, a11y).
- `nest` config (Nest 10+ idioms, decorator patterns).

### v0.4 â€” Fixers
- Auto-fix for as many rules as safely possible.
- `--fix` integration end-to-end.

### v1.0 â€” Stable rule catalog
- Documentation site.
- ~25-30 rules covering the major architectural conventions across NekoStack.
- Migration guide for projects adopting the strict config.

## Product potential

**Internal use:** Very high. This is the codification of "what we mean by the NekoStack way."

**Open source release:** Plausible. Project-specific lint plugins do exist as OSS (e.g., `eslint-plugin-perfectionist`, `eslint-plugin-functional`). A "NekoStack-conventions" plugin would be niche externally but could attract users specifically using the rest of the stack.


**Estimated effort to v1.0:** 4-8 weeks of focused work, mostly because each rule needs tests and a docs page. The plugin scaffolding itself is small.

## Status

- **Current:** Empty placeholder. Not started.
- **Owner:** Cody (solo dev project).
- **Priority tier:** Foundation primitive. Build early so conventions are enforced from day one rather than retrofitted later.
- **Estimated learning return:** Very high. ESLint's custom-rule API, AST traversal, and scope analysis are deeply transferable to any future static-analysis or code-mod work (e.g., codemods, custom Babel plugins, codegen tools).
