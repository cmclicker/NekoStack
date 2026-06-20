# @nekostack/test — Roadmap

Authoritative source for "what ships when."

## v0.1 — Bootstrap

Status: **in progress (PR open)**.

- `createRuleTester(config?)` — vitest-wired RuleTester factory
- `createJsxRuleTester()` — JSX-enabled convenience wrapper
- 5 tests

## v0.2 — Schema fixtures

Status: **not started**.

- `makeFieldNode`, `makeSchemaNode` — IR builders for `@nekostack/schema` test suites
- Eliminates inline IR construction repeated across schema tests

## v0.3 — Filesystem mocks

Status: **not started**.

- `makeExistsSync(map)` — returns an injectable `existsSync` mock keyed by path substring
- Replaces the hand-rolled `_setExistsSync` pattern in `service-has-spec`

## v1.0 — Stable substrate

Status: **not started**.

- Full coverage of NekoStack test patterns; any new package can `import from '@nekostack/test'` instead of reinventing fixtures
