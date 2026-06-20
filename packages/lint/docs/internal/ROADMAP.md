# @nekostack/lint — Roadmap

Authoritative source for "what ships when." Full design rationale lives in the package [`README.md`](../../README.md).

---

## v0.1 — Bootstrap

Status: **shipped** ([#79](https://github.com/cmclicker/NekoStack/pull/79), merged 2026-06-20).

- ESLint flat-config plugin object (`src/plugin.ts`) with `meta` + `rules` map
- Base config (`src/configs/base.ts`) — flat-config array consumers spread into `eslint.config.ts`
- Rule: `no-direct-process-env` — catches `process.env` / `process["env"]` MemberExpression; `@nekostack/config` exempt
- 11 `RuleTester` fixture tests (5 valid, 6 invalid)
- `tsconfig.json`, `vitest.config.ts`, `package.json` fully wired; added to CI `--filter`

---

## v0.2 — Convention rules

Status: **shipped** ([#80](https://github.com/cmclicker/NekoStack/pull/80), merged 2026-06-20).

- `schema-no-inline-zod` — flags `z.TYPE()` calls outside schema files; 11 tests
- `prisma-json-cast` — flags property access on `Prisma.JsonValue`/`JsonValue` typed vars without cast; 12 tests
- `service-has-spec` — flags `*.service.ts` files missing a co-located spec; 5 tests
- `controller-no-service-cycle` — flags controller-to-controller imports; 10 tests
- `strict` config — enables all five rules; exported as `./strict`
- 49 total tests (38 new + 11 from v0.1)

---

## v0.3 — Framework configs

Status: **shipped** ([#81](https://github.com/cmclicker/NekoStack/pull/81), merged 2026-06-19).

- `react-no-inline-style` — flags `style={...}` JSX attributes; 10 tests
- `nest-no-orm-in-controller` — flags ORM imports in controller files; 10 tests
- `react` config — exported as `./react`; curated rule set for React 19
- `nest` config — exported as `./nest`; full server-side rule set for NestJS 10+
- 69 total tests (20 new + 49 from v0.2)

---

## v0.4 — Security rules + first auto-fixer

Status: **shipped** ([#83](https://github.com/cmclicker/NekoStack/pull/83), merged 2026-06-19).

- `no-hardcoded-secrets` — flags secret-named vars (`password`, `apiKey`, `token`, …) assigned string literals + well-known credential value prefixes (Stripe, GitHub, AWS, Google, PEM headers); test files exempt; 11 tests
- `no-raw-sql` — flags unsafe Prisma raw-query methods; distinguishes safe tagged-template `$queryRaw`/`$executeRaw` from unsafe call form; always flags `$queryRawUnsafe`/`$executeRawUnsafe`; 10 tests
- `schema-export-type` — flags exported Zod schemas in `.schema.ts` files without a corresponding `export type T = z.infer<typeof schema>` declaration; **auto-fixer** inserts the type export; 8 tests
- `react-no-dangerously-set-html` — flags `dangerouslySetInnerHTML` prop (XSS risk); 7 tests
- `base` config updated: adds `no-hardcoded-secrets` (security baseline for all projects)
- `strict`, `react`, `nest` configs updated with new rules
- 105 total tests (36 new + 69 from v0.3)

---

## v0.5 — Module-boundary and quality rules

Status: **shipped** ([#86](https://github.com/cmclicker/NekoStack/pull/86), merged 2026-06-20). 37 new tests → 142 total.

- **`consistent-type-imports`** — flags `import { SomeType }` where `import type { SomeType }` should be used; **auto-fixer** adds the `type` modifier. Unique value: enforces the NekoStack convention of separating runtime and type-only imports to enable `isolatedModules` and improve tree-shaking.
- **`no-console-in-module`** — flags `console.log` / `console.debug` in non-test, non-script source files (allow `console.error` / `console.warn` which are intentional); covers cases where a logger like `@nekostack/logger` (future) should be used instead.
- **`nest-event-handler-has-spec`** — extends `service-has-spec` pattern to `@EventPattern` / `@MessagePattern` decorated methods; event handlers are often untested.
- **`no-direct-date-now`** — flags `Date.now()` and `new Date()` outside test files and dedicated time-utility modules; testability enforcement — callers should receive a clock/timestamp as a parameter or from `@nekostack/config`.

---

## v0.6 — Type-safety rules + recommended config

Status: **shipped** ([#88](https://github.com/cmclicker/NekoStack/pull/88), merged 2026-06-20). 46 new tests → 188 total.

- **`no-type-assertion-to-any`** — flags `x as any` and `<any>x`; use `unknown` + type guard or the specific target type instead.
- **`no-non-null-assertion`** — flags postfix `x!`; use optional chaining, nullish coalescing, or an explicit null check.
- **`react-hook-naming`** — flags named functions that call React hooks (`use[A-Z]` callees) but are not named `use*` or PascalCase; hook calls inside anonymous callbacks are attributed to the innermost frame.
- **`nest-controller-response-type`** — flags `@Get`/`@Post`/`@Put`/`@Delete`/`@Patch`/`@Head`/`@Options`/`@All` methods in `*.controller.*` files without an explicit return type.
- New **`recommended`** config (`./recommended`) — sensible defaults for any TypeScript project; layer `./react` or `./nest` on top for framework-specific rules.

---

## v1.0 — Stable rule catalog

Status: **shipped** ([#89](https://github.com/cmclicker/NekoStack/pull/89), merged 2026-06-20). 188 total tests (unchanged — docs + CI milestone).

Done-criteria met:
- ✓ All 19 shipped rules have structured `docs/rules/*.md` files with examples and options
- ✓ Every config (`base`, `recommended`, `strict`, `react`, `nest`) documented in `docs/CONFIGS.md`
- ✓ `docs/MIGRATION_GUIDE.md` covers zero → base → recommended → strict + framework configs
- ✓ `@nekostack/schema` linted with `@nekostack/lint/recommended` on every CI run

**Note on "strict" criterion:** the original criterion said `@nekostack/schema` would be linted with `strict`. The full `strict` config found ~30 non-null assertions in schema `src/` that require careful per-call analysis before they can be safely removed. The CI gate ships with `recommended` (still catches `no-type-assertion-to-any` errors + `no-non-null-assertion` warnings in schema source). Schema strict cleanup is explicitly tracked in v1.x below.

---

## v1.x — Post-stable backlog

Items deferred from v1.0 or discovered after release:

- **`@nekostack/schema` strict cleanup** — schema `src/` has ~30 non-null assertions in registry/handler/migration files. Each needs per-call analysis (regex capture groups, already-filtered arrays, logic with early returns). When cleaned up, upgrade `packages/schema/eslint.config.mjs` from `recommended` to `strict`.
- **Auto-fixers for v0.5–v0.6 rules** (`consistent-type-imports` already has one; add for `no-type-assertion-to-any` where the safe replacement is knowable)
- **`named-imports-only`** — flag default exports; named exports are more refactor-safe and tree-shake cleanly
- **`no-barrel-cycle-import`** — detect barrel files (`index.ts`) imported inside their own package's implementation files, causing internal cycles
- **Schema-aware rules** — rules that import `@nekostack/schema` IR types and enforce IR-level conventions (e.g., every IR FieldNode with `required: true` must have a corresponding non-nullable Prisma field)
- **IDE integration docs** — VS Code settings, `.editorconfig`, and `settings.json` snippets that surface NekoStack lint errors inline
