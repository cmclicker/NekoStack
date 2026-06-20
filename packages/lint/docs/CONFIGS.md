# @nekostack/lint — Config reference

Five flat-config arrays are available. Spread whichever fits your project into `eslint.config.ts` after your TypeScript parser config.

```
base  ←  recommended  ←  strict
                ↑
         react  |  nest
```

`recommended` is a superset of `base`. `strict` is a superset of `recommended`. `react` and `nest` are independent frameworks layers — use them alongside `base` or `recommended`, not instead.

---

## `base`

**Import:** `import { base } from '@nekostack/lint';`

Universal rules. Zero false positives on any TypeScript codebase. Every NekoStack project should include this.

| Rule | Severity | Why here |
|---|---|---|
| `no-direct-process-env` | `error` | Unvalidated env reads fail silently |
| `no-hardcoded-secrets` | `error` | Security baseline — no project is exempt |
| `consistent-type-imports` | `warn` | `isolatedModules` / tree-shaking hygiene |
| `no-console-in-module` | `warn` | Unstructured output in source modules |

---

## `recommended`

**Import:** `import { recommended } from '@nekostack/lint/recommended';`

Sensible defaults for any TypeScript project. Includes everything in `base`, plus schema conventions and type-safety rules. A good starting point for new projects.

| Rule | Severity | Why here |
|---|---|---|
| `no-direct-process-env` | `error` | (from base) |
| `no-hardcoded-secrets` | `error` | (from base) |
| `consistent-type-imports` | `warn` | (from base) |
| `no-console-in-module` | `warn` | (from base) |
| `schema-no-inline-zod` | `warn` | Schema drift prevention |
| `schema-export-type` | `warn` | Type export discipline |
| `service-has-spec` | `warn` | Coverage baseline |
| `controller-no-service-cycle` | `error` | Hard architectural constraint |
| `no-type-assertion-to-any` | `error` | Defeats type-checking entirely |
| `no-non-null-assertion` | `warn` | Runtime unsafety without guarantee |

---

## `strict`

**Import:** `import { strict } from '@nekostack/lint/strict';`

All rules, highest severities. Recommended for established codebases and CI-gating of `@nekostack/*` packages themselves.

| Rule | Severity |
|---|---|
| `no-direct-process-env` | `error` |
| `no-hardcoded-secrets` | `error` |
| `no-raw-sql` | `error` |
| `schema-no-inline-zod` | `error` |
| `schema-export-type` | `warn` |
| `prisma-json-cast` | `error` |
| `service-has-spec` | `warn` |
| `controller-no-service-cycle` | `error` |
| `react-no-inline-style` | `warn` |
| `react-no-dangerously-set-html` | `error` |
| `nest-no-orm-in-controller` | `error` |
| `consistent-type-imports` | `error` |
| `no-console-in-module` | `error` |
| `no-direct-date-now` | `warn` |
| `no-type-assertion-to-any` | `error` |
| `no-non-null-assertion` | `error` |
| `react-hook-naming` | `warn` |
| `nest-controller-response-type` | `warn` |

---

## `react`

**Import:** `import { react } from '@nekostack/lint/react';`

Rules for React 19 projects. Layer on top of `base` or `recommended`. For complete React linting also install `eslint-plugin-react`, `eslint-plugin-react-hooks`, and `eslint-plugin-jsx-a11y`.

| Rule | Severity |
|---|---|
| `no-direct-process-env` | `error` |
| `no-hardcoded-secrets` | `error` |
| `schema-no-inline-zod` | `error` |
| `prisma-json-cast` | `error` |
| `schema-export-type` | `warn` |
| `react-no-inline-style` | `warn` |
| `react-no-dangerously-set-html` | `error` |
| `no-type-assertion-to-any` | `error` |
| `no-non-null-assertion` | `warn` |
| `react-hook-naming` | `warn` |

---

## `nest`

**Import:** `import { nest } from '@nekostack/lint/nest';`

Rules for NestJS 10+ projects. Requires `experimentalDecorators: true` and `emitDecoratorMetadata: true` in `tsconfig.json`.

| Rule | Severity |
|---|---|
| `no-direct-process-env` | `error` |
| `no-hardcoded-secrets` | `error` |
| `no-raw-sql` | `error` |
| `schema-no-inline-zod` | `error` |
| `prisma-json-cast` | `error` |
| `schema-export-type` | `warn` |
| `service-has-spec` | `warn` |
| `controller-no-service-cycle` | `error` |
| `nest-no-orm-in-controller` | `error` |
| `nest-event-handler-has-spec` | `warn` |
| `no-direct-date-now` | `warn` |
| `no-type-assertion-to-any` | `error` |
| `no-non-null-assertion` | `warn` |
| `nest-controller-response-type` | `warn` |
