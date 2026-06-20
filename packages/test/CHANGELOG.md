# @nekostack/test — Changelog

Per-milestone changes. Pairs with git tags (`test-vX.Y.Z`). Format: newest first.

---

## test-v0.1.0 — 2026-06-19

PR #TBD · Bootstrap milestone.

### What shipped

**`createRuleTester(config?)`**
- Wires vitest lifecycle hooks (`afterAll`, `describe`, `it`) onto `RuleTester` statics and returns a configured `RuleTester` instance.
- Replaces the 3-line boilerplate repeated in every `@nekostack/lint` test file.

**`createJsxRuleTester()`**
- Convenience wrapper that calls `createRuleTester` with `ecmaFeatures.jsx: true` pre-set.
- Used for rules that need to parse JSX (e.g. `react-no-inline-style`).

**Plumbing**
- `tsconfig.json` extending root `tsconfig.base.json`, outputs to `dist/`
- `vitest.config.ts` scoped to `tests/**/*.test.ts`
- Added to CI `--filter` in the same PR (governance rule)
- Peer deps: `@typescript-eslint/rule-tester >= 8`, `vitest >= 2`

### Test count

5 tests (3 for `createRuleTester`, 2 for `createJsxRuleTester`).

### Not in scope (deferred to v0.2+)
- Schema IR fixture builders (`makeFieldNode`, `makeSchemaNode`)
- Filesystem mock helpers (injectable `existsSync` pattern)
- Snapshot assertion helpers
