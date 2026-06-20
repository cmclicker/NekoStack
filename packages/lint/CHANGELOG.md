# @nekostack/lint — Changelog

Per-milestone changes. Pairs with git tags (`lint-vX.Y.Z`). Format: newest first.

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
