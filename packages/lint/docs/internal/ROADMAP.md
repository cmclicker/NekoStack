# @nekostack/lint — Roadmap

Authoritative source for "what ships when." Full design rationale lives in the package [`README.md`](../../README.md).

## v0.1 — Bootstrap

Status: **shipped** ([#79](https://github.com/cmclicker/NekoStack/pull/79), merged 2026-06-20).

Includes:
- ESLint flat-config plugin object (`src/plugin.ts`) with `meta` + `rules` map
- Base config (`src/configs/base.ts`) — flat-config array; consumers spread into `eslint.config.ts`
- First real rule: `no-direct-process-env` — catches any `process.env` / `process["env"]` MemberExpression; `@nekostack/config` is self-exempt via filename check
- 11 `RuleTester` fixture tests (5 valid, 6 invalid)
- `tsconfig.json`, `vitest.config.ts`, `package.json` fully wired
- Added to CI `--filter` list in the same PR (governance rule)

## v0.2 — Convention rules

Status: **shipped** ([#80](https://github.com/cmclicker/NekoStack/pull/80), merged 2026-06-20).

Includes:
- `schema-no-inline-zod` — flags `z.TYPE()` calls outside schema files; 11 tests
- `prisma-json-cast` — flags property access on `Prisma.JsonValue`/`JsonValue` typed vars without cast; 12 tests
- `service-has-spec` — flags `*.service.ts` files missing a co-located spec; 5 tests
- `controller-no-service-cycle` — flags controller-to-controller imports; 10 tests
- `strict` config — enables all five rules, exported as `./strict`
- 49 total tests (38 new + 11 from v0.1)

## v0.3 — Framework configs

Status: **not started**.

- `/react` config (React 19, hooks, refresh, a11y rules)
- `/nest` config (NestJS 10+ idioms, decorator patterns)

## v0.4 — Auto-fixers

Status: **not started**.

Mechanical auto-fix for every rule where the correction is safe and unambiguous. `--fix` integration end-to-end.

## v1.0 — Stable rule catalog

Status: **not started**.

- ~25–30 rules covering the major NekoStack architectural conventions
- Documentation site (auto-generated from rule metadata)
- Migration guide for projects adopting `/strict`
