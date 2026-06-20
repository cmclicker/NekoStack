# @nekostack/lint — Changelog

Per-milestone changes. Pairs with git tags (`lint-vX.Y.Z`). Format: newest first.

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
