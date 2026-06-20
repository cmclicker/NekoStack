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

Status: **in progress (PR open)**.

- `no-hardcoded-secrets` — flags secret-named vars (`password`, `apiKey`, `token`, …) assigned string literals + well-known credential value prefixes (Stripe, GitHub, AWS, Google, PEM headers); test files exempt; 11 tests
- `no-raw-sql` — flags unsafe Prisma raw-query methods; distinguishes safe tagged-template `$queryRaw`/`$executeRaw` from unsafe call form; always flags `$queryRawUnsafe`/`$executeRawUnsafe`; 10 tests
- `schema-export-type` — flags exported Zod schemas in `.schema.ts` files without a corresponding `export type T = z.infer<typeof schema>` declaration; **auto-fixer** inserts the type export; 8 tests
- `react-no-dangerously-set-html` — flags `dangerouslySetInnerHTML` prop (XSS risk); 7 tests
- `base` config updated: adds `no-hardcoded-secrets` (security baseline for all projects)
- `strict`, `react`, `nest` configs updated with new rules
- 105 total tests (36 new + 69 from v0.3)

---

## v0.5 — Module-boundary and quality rules

Status: **not started**. Target: ~4 new rules, ~40 new tests → ~145 total.

- **`consistent-type-imports`** — flags `import { SomeType }` where `import type { SomeType }` should be used; **auto-fixer** adds the `type` modifier. Unique value: enforces the NekoStack convention of separating runtime and type-only imports to enable `isolatedModules` and improve tree-shaking.
- **`no-console-in-module`** — flags `console.log` / `console.debug` in non-test, non-script source files (allow `console.error` / `console.warn` which are intentional); covers cases where a logger like `@nekostack/logger` (future) should be used instead.
- **`nest-event-handler-has-spec`** — extends `service-has-spec` pattern to `@EventPattern` / `@MessagePattern` decorated methods; event handlers are often untested.
- **`no-direct-date-now`** — flags `Date.now()` and `new Date()` outside test files and dedicated time-utility modules; testability enforcement — callers should receive a clock/timestamp as a parameter or from `@nekostack/config`.

---

## v0.6 — Type-safety rules + config polish

Status: **not started**. Target: ~4 new rules, `recommended` config → ~185 total tests.

- **`no-type-assertion-to-any`** — flags `as any` and `<any>` type assertions outside test files; these bypass TypeScript's safety guarantees and should use proper Zod validation or explicit `unknown` narrowing.
- **`no-non-null-assertion`** — flags `!` non-null assertions outside test files and generated code; prefer optional chaining or explicit null checks.
- **`react-hook-naming`** — flags custom hooks (functions in components/ or hooks/ directories that use `use*` hooks internally) whose name does not start with `use`; required for the React compiler's rule-of-hooks checks.
- **`nest-controller-response-type`** — flags controller methods with implicit `any` return type; every endpoint should declare its response DTO explicitly.
- New **`recommended`** config — lighter alternative to `strict`; omits the most opinionated rules (`service-has-spec`, `schema-export-type` warns only) for teams adopting incrementally.

---

## v1.0 — Stable rule catalog

Status: **not started**. Target: ~20 rules, all configs complete, migration guide.

Done-criteria:
- All shipped rules have structured `docs/rules/*.md` files auto-linked from `meta.docs.url`
- Every config (`base`, `recommended`, `strict`, `react`, `nest`) is documented with a table showing each rule and its severity
- A `MIGRATION.md` explains upgrading from no linting → `base` → `recommended` → `strict`
- No rules marked "not in scope" in any prior CHANGELOG remain unfixed without a deliberate decision note
- CI coverage: at least one real NekoStack package (`@nekostack/schema`) is linted with `strict` on every PR

---

## v1.x — Post-stable backlog

Items deferred from v1.0 or discovered after release:

- **Auto-fixers for v0.5–v0.6 rules** (`consistent-type-imports` already has one; add for `no-type-assertion-to-any` where the safe replacement is knowable)
- **`named-imports-only`** — flag default exports; named exports are more refactor-safe and tree-shake cleanly
- **`no-barrel-cycle-import`** — detect barrel files (`index.ts`) imported inside their own package's implementation files, causing internal cycles
- **Schema-aware rules** — rules that import `@nekostack/schema` IR types and enforce IR-level conventions (e.g., every IR FieldNode with `required: true` must have a corresponding non-nullable Prisma field)
- **IDE integration docs** — VS Code settings, `.editorconfig`, and `settings.json` snippets that surface NekoStack lint errors inline
