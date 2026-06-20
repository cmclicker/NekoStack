# @nekostack/lint — Changelog

Per-milestone changes. Pairs with git tags (`lint-vX.Y.Z`). Format: newest first.

---

## lint-v1.0.0 — 2026-06-20

PR [#89](https://github.com/cmclicker/NekoStack/pull/89) · Stable rule catalog, full docs, CI integration.

### What shipped

**19 rule docs (`docs/rules/*.md`)**

Structured documentation for every shipped rule with Why section, Incorrect/Correct examples, Options table, and When to disable guidance. All files are linked from the rule's `meta.docs.url`.

Rules documented: `no-direct-process-env`, `schema-no-inline-zod`, `prisma-json-cast`, `service-has-spec`, `controller-no-service-cycle`, `react-no-inline-style`, `nest-no-orm-in-controller`, `no-hardcoded-secrets`, `no-raw-sql`, `schema-export-type`, `react-no-dangerously-set-html`, `consistent-type-imports`, `no-console-in-module`, `nest-event-handler-has-spec`, `no-direct-date-now`, `no-type-assertion-to-any`, `no-non-null-assertion`, `react-hook-naming`, `nest-controller-response-type`.

**Config reference (`docs/CONFIGS.md`)**

Full config documentation: config hierarchy diagram, per-rule severity table for all five configs (`base`, `recommended`, `strict`, `react`, `nest`), and usage examples.

**Migration guide (`docs/MIGRATION_GUIDE.md`)**

Step-by-step upgrade path: zero → `base`, `base` → `recommended`, `recommended` → `strict`, layering framework configs, and incremental adoption patterns.

**CI linting of `@nekostack/schema`**

`@nekostack/schema` is now linted with `@nekostack/lint/recommended` on every CI run. The package ships `eslint.config.mjs` + `eslint` + `typescript-eslint` devDependencies; the Turbo `lint` task runs after `build`. Strict cleanup of `@nekostack/schema`'s ~30 non-null assertions is tracked as a v1.x item.

**Package**

- Version: `0.6.0` → `1.0.0`
- 188 tests (unchanged — no new rules this milestone)

---

## lint-v0.6.0 — 2026-06-20

PR [#88](https://github.com/cmclicker/NekoStack/pull/88) · merge commit [`2a9dd2c`](https://github.com/cmclicker/NekoStack/commit/2a9dd2cda8dcc69e852a25a4d44cdb91cb913a86). Type-safety rules + recommended config.

### What shipped

**Four new rules**

- **`no-type-assertion-to-any`** — flags `x as any` and `<any>x` type assertions. Asserting to `any` silences TypeScript entirely and defeats type-checking. Use `unknown` with a type guard, or assert to the specific type needed. Reports both `TSAsExpression` and `TSTypeAssertion` forms. 11 tests (5 valid, 6 invalid).

- **`no-non-null-assertion`** — flags the postfix non-null assertion operator `x!`. The `!` removes `null` and `undefined` from a type without any runtime guarantee. Use optional chaining (`?.`), nullish coalescing (`??`), or an explicit null guard instead. 11 tests (5 valid, 6 invalid).

- **`react-hook-naming`** — flags named functions (function declarations and named arrow function expressions) that call React hooks (detected by `use[A-Z]` callee pattern) but are not named with the `use` prefix or as a PascalCase component. Hook calls inside anonymous callbacks are attributed to the innermost named function, so helpers that merely pass anonymous hook-calling callbacks are not flagged. Test files are exempt. 12 tests (7 valid, 5 invalid).

- **`nest-controller-response-type`** — flags NestJS controller route handler methods decorated with `@Get`, `@Post`, `@Put`, `@Delete`, `@Patch`, `@Head`, `@Options`, or `@All` that lack an explicit return type annotation. Without return types the API surface is undocumented in source and TypeScript cannot verify response shape mismatches. Active only in `*.controller.*` files. 12 tests (6 valid, 6 invalid).

**New config: `recommended`**

- `@nekostack/lint/recommended` — sensible defaults for any TypeScript project. More opinionated than `base`, less framework-specific than `strict`/`react`/`nest`. Includes all `base` rules, schema conventions (`schema-no-inline-zod: warn`, `schema-export-type: warn`), spec coverage (`service-has-spec: warn`), architecture (`controller-no-service-cycle: error`), and the new type-safety rules (`no-type-assertion-to-any: error`, `no-non-null-assertion: warn`). Layer `./react` or `./nest` on top for framework-specific rules.

**Config updates**

- `strict` — adds `no-type-assertion-to-any: error`, `no-non-null-assertion: error`, `react-hook-naming: warn`, `nest-controller-response-type: warn`
- `react` — adds `no-type-assertion-to-any: error`, `no-non-null-assertion: warn`, `react-hook-naming: warn`
- `nest` — adds `no-type-assertion-to-any: error`, `no-non-null-assertion: warn`, `nest-controller-response-type: warn`

**Package**

- Version: `0.5.0` → `0.6.0`
- Exports: added `./recommended` subpath
- 46 new tests → **188 total**

### Test count

- 142 → 188 (+46 net).

---

## lint-v0.5.0 — 2026-06-20

PR #86 · Module-boundary and quality rules.

### What shipped

**Four new rules**

- **`consistent-type-imports`** (**auto-fixer**) — flags `import { T }` bindings that are used exclusively in type positions (type annotations, type aliases, generic parameters) and never as values. Auto-fix adds the `type` modifier inline: `import { type T, Value }`. Works without a TypeScript project reference — uses AST parent-chain analysis. 10 tests (5 valid, 5 invalid with fixer output verified).

- **`no-console-in-module`** — flags `console.log`, `console.debug`, `console.info`, `console.dir`, and `console.table` in non-test source files. `console.error` and `console.warn` are permitted as they signal real runtime problems. Test files (`.spec.ts`, `.test.ts`, `__tests__/`) are fully exempt. 11 tests (5 valid, 6 invalid).

- **`nest-event-handler-has-spec`** — flags `@EventPattern` and `@MessagePattern` decorated methods in files that have no co-located spec. Extends the `service-has-spec` discipline to NestJS microservice event handler classes. Reports each decorated method individually. Uses the same injectable `_setExistsSync` test seam as `service-has-spec`. 6 tests (3 valid, 3 invalid).

- **`no-direct-date-now`** — flags `Date.now()` and `new Date()` (no arguments) in non-test source files. `new Date(value)` for parsing a specific timestamp is permitted. Enforces the injectable-clock pattern — callers should receive a timestamp or clock service as a dependency so time can be controlled in tests. 10 tests (5 valid, 5 invalid).

**Config updates**

- `base` — adds `consistent-type-imports: warn` and `no-console-in-module: warn` (universal rules for all NekoStack projects)
- `strict` — escalates `consistent-type-imports` to `error`, `no-console-in-module` to `error`; adds `no-direct-date-now: warn`
- `nest` — adds `nest-event-handler-has-spec: warn` and `no-direct-date-now: warn`

**Package**

- Version: `0.4.0` → `0.5.0`
- Total tests: 105 → 142 (+37)
- Total rules: 11 → 15

---

## lint-v0.4.0 — 2026-06-19

PR #TBD · Security rules + first auto-fixer milestone.

### What shipped

**Four new rules**

- **`no-hardcoded-secrets`** — flags string literals in secret-named bindings (`password`, `apiKey`, `token`, `secret`, `privateKey`, …) and string values matching well-known credential prefixes (Stripe `sk_live_`/`pk_live_`, GitHub `ghp_`/`gho_`, AWS `AKIA`, Google `AIza`, PEM headers, Slack `xoxb-`). Test files (`.test.ts`, `.spec.ts`, `tests/`) are exempt. 11 tests (6 valid, 5 invalid).

- **`no-raw-sql`** — flags unsafe Prisma raw-query methods. Key distinction: `$queryRaw` and `$executeRaw` are flagged only in **call** form (`prisma.$queryRaw('...')`) — the tagged-template form (`` prisma.$queryRaw`SELECT…` ``) is safe because Prisma parameterises at the tag level. `$queryRawUnsafe` and `$executeRawUnsafe` are always flagged regardless of form. 10 tests (5 valid, 5 invalid).

- **`schema-export-type`** (**auto-fixer**) — flags exported Zod schema constants in `.schema.ts` files that have no corresponding `export type T = z.infer<typeof schema>` declaration. Auto-fix inserts the type export immediately after the schema declaration. Handles default, namespace, and named `z` imports. 8 tests (5 valid, 3 invalid with fixer output verified).

- **`react-no-dangerously-set-html`** — flags the `dangerouslySetInnerHTML` JSX prop. Setting raw HTML without sanitisation exposes the app to XSS. Rule requires a documented `eslint-disable` comment with justification for any approved exception. 7 tests (4 valid, 3 invalid).

**Config updates**

- `base` — adds `no-hardcoded-secrets: error` (security baseline for every project regardless of framework)
- `strict` — adds all four new rules (`no-hardcoded-secrets`, `no-raw-sql`, `schema-export-type: warn`, `react-no-dangerously-set-html`)
- `react` — adds `no-hardcoded-secrets`, `schema-export-type: warn`, `react-no-dangerously-set-html`
- `nest` — adds `no-hardcoded-secrets`, `no-raw-sql`, `schema-export-type: warn`

**Package**
- Version bumped to `0.4.0`
- `plugin.ts` meta version updated to `0.4.0`

### Test count

105 total (36 new + 69 from v0.3).

### Not in scope (deferred)
- `consistent-type-imports` auto-fixer → v0.5
- Named import support for `schema-no-inline-zod` (`import { object } from 'zod'`) → v0.5
- `no-direct-date-now` → v0.5
- `no-type-assertion-to-any` → v0.6

---

## lint-v0.3.0 — 2026-06-19

PR #TBD · Framework configs milestone.

### What shipped

**Two new rules**

- **`react-no-inline-style`** — flags any `style={...}` JSX attribute (object literals, variable references, expressions). NekoStack exposes design tokens through `@nekostack/theme` and `@nekostack/ui`; inline styles bypass the token system. 10 tests (5 valid, 5 invalid).

- **`nest-no-orm-in-controller`** — flags direct ORM imports (Prisma, TypeORM, Mongoose, MikroORM) inside NestJS controller files (`.controller.ts` or `controllers/`). Controllers must delegate persistence to injected services. Covers `@prisma/*`, `typeorm`, `@nestjs/typeorm`, `@nestjs/mongoose`, `mongoose`, `@mikro-orm/*`. 10 tests (5 valid, 5 invalid).

**Two new framework configs**

- **`react` config** (`./react` export) — enables `no-direct-process-env`, `schema-no-inline-zod`, `prisma-json-cast` (errors) and `react-no-inline-style` (warn) for React 19 projects.

- **`nest` config** (`./nest` export) — enables the full server-side rule set: `no-direct-process-env`, `schema-no-inline-zod`, `prisma-json-cast`, `controller-no-service-cycle` (errors), `service-has-spec` (warn), and `nest-no-orm-in-controller` (error) for NestJS 10+ projects.

**Package**
- Version bumped to `0.3.0`
- `./react` and `./nest` added to `exports` map
- `plugin.ts` meta version updated to `0.3.0`

### Test count

69 total (49 from v0.2 + 20 new).

### Not in scope (deferred)
- Auto-fixers for either new rule
- `react-no-leaked-subscription` (requires control-flow analysis)
- Importing external plugins (eslint-plugin-react, eslint-plugin-react-hooks, jsx-a11y) — consumers wire those up alongside the NekoStack config

---

## lint-v0.2.0 — 2026-06-19

PR #TBD · Convention rules milestone.

### What shipped

**Four new rules**

- **`schema-no-inline-zod`** — flags `z.TYPE()` constructor calls (where `z` is imported from `'zod'`) in files that aren't designated schema files (`*.schema.ts`, `schemas/`, `packages/schema/`). Catches inline Zod usage in services and controllers; type-only uses (`z.infer<...>`) are excluded. 11 tests.

- **`prisma-json-cast`** — flags `.property` access on variables declared with a `Prisma.JsonValue` or `JsonValue` type annotation without a wrapping `as` cast. Prevents silent `unknown` sub-property drilling. Variables wrapped in `(v as SomeType).prop` are exempt. 12 tests.

- **`service-has-spec`** — reports on any `*.service.ts` file that has no co-located spec or test file (`*.service.spec.ts`, `*.service.test.ts`, `*.spec.ts`, `*.test.ts`). Filesystem check injectable for testing via `_setExistsSync`. 5 tests.

- **`controller-no-service-cycle`** — flags `ImportDeclaration` in controller files (`.controller.ts` or `controllers/`) whose source path resolves to another controller (`.controller` suffix or `controllers/` in path). Prevents the import pattern that produces controller-layer cycles. 10 tests.

**`strict` config** (`./strict` export)
- Flat-config array enabling all five rules (`no-direct-process-env` + four new); consumers spread after any parser config.

**Package**
- Version bumped to `0.2.0`
- `./strict` added to `exports` map
- `plugin.ts` meta version updated to `0.2.0`

### Test count

49 total (11 from v0.1 + 38 new).

### Not in scope (deferred)
- Named Zod constructor imports (`import { object } from 'zod'`) for `schema-no-inline-zod`
- Function-parameter `JsonValue` detection for `prisma-json-cast`
- `const { env } = process` destructuring for `no-direct-process-env`

---

## lint-v0.1.0 — 2026-06-20

[PR #79](https://github.com/cmclicker/NekoStack/pull/79) · Bootstrap milestone.

### What shipped

**Plugin structure**
- `src/plugin.ts` — flat-config plugin object with `meta` + `rules`
- `src/configs/base.ts` — flat-config array; spread into `eslint.config.ts`
- `src/index.ts` — re-exports `plugin`, `base`, and individual rules

**Rule: `no-direct-process-env`**
- Catches `process.env` / `process["env"]` MemberExpression anywhere in a project
- `@nekostack/config` package is self-exempt (filename check on `/packages/config/`)
- Error message directs consumers to `@nekostack/config`
- 11 RuleTester fixture tests (5 valid, 6 invalid)

**Plumbing**
- `tsconfig.json` extending root `tsconfig.base.json`, outputs to `dist/`
- `vitest.config.ts` scoped to `tests/**/*.test.ts`
- Added to CI `--filter` in the same commit

### Not in scope (deferred to v0.2+)
- `const { env } = process` destructuring (no MemberExpression, needs separate visitor)
- `@typescript-eslint/recommended` re-export in base config (needs `typescript-eslint` dep)
- Framework configs (`/react`, `/nest`)
- Auto-fixers
