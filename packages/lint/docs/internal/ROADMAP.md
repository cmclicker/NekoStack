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

Status: **not started**.

Target rules:
- `schema-no-inline-zod` — prohibit inline `z.*` calls outside `@nekostack/schema`
- `prisma-json-cast` — require `as unknown as Prisma.InputJsonValue` for typed JSON column writes
- `service-has-spec` — every `*.service.ts` must have a matching `*.spec.ts`
- `controller-no-service-cycle` — controllers must not import services that import controllers

Plus: strict config enabling all rules.

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
