# @nekostack/lint — Migration guide

Upgrade paths from no linting to the full NekoStack rule set.

---

## Starting from zero

### Step 1 — Install

```bash
npm install --save-dev @nekostack/lint eslint typescript-eslint
```

### Step 2 — Create `eslint.config.ts`

```ts
import tseslint from 'typescript-eslint';
import { base } from '@nekostack/lint';

export default tseslint.config(
  ...tseslint.configs.recommended,
  ...base,
);
```

### Step 3 — Add a lint script

```json
// package.json
{
  "scripts": {
    "lint": "eslint src"
  }
}
```

### Step 4 — Fix errors

Run `npx eslint src` and fix the reported errors. At the `base` level:

- **`no-direct-process-env`** — move `process.env.X` reads to `@nekostack/config` (or a config module of your own)
- **`no-hardcoded-secrets`** — remove any string literals in secret-named variables; use env-backed config
- **`consistent-type-imports`** — run `npx eslint src --fix`; the auto-fixer handles all of these
- **`no-console-in-module`** — replace `console.log` with a structured logger or remove debug logs

---

## `base` → `recommended`

Upgrade when your codebase is stable and you want schema conventions enforced.

```ts
import { recommended } from '@nekostack/lint/recommended';

export default tseslint.config(
  ...tseslint.configs.recommended,
  ...recommended,       // replaces `base`
);
```

New rules enabled:

| Rule | Common fix |
|---|---|
| `schema-no-inline-zod` | Move `z.object(…)` calls to `.schema.ts` files |
| `schema-export-type` | Run `--fix` — auto-inserts `export type T = z.infer<typeof T>` |
| `service-has-spec` | Create co-located spec files; disable with comment if intentionally deferred |
| `controller-no-service-cycle` | Move shared logic to a service; remove controller-to-controller imports |
| `no-type-assertion-to-any` | Replace `as any` with `as unknown` + narrowing, or assert to the specific type |
| `no-non-null-assertion` | Replace `x!` with `x ?? fallback`, `x?.property`, or an explicit null check |

---

## `recommended` → `strict`

Upgrade when your project is mature and you want maximum enforcement. Expect more errors, particularly in older code.

```ts
import { strict } from '@nekostack/lint/strict';

export default tseslint.config(
  ...tseslint.configs.recommended,
  ...strict,            // replaces `recommended`
);
```

Additional rules enabled vs. `recommended`:

| Rule | Common fix |
|---|---|
| `no-raw-sql` | Replace `prisma.$queryRaw('…')` call form with tagged-template form |
| `prisma-json-cast` | Cast `Prisma.JsonValue` variables before accessing properties |
| `react-no-inline-style` | Move inline styles to CSS classes using design token custom properties |
| `react-no-dangerously-set-html` | Sanitise with DOMPurify; document with an inline eslint-disable comment |
| `nest-no-orm-in-controller` | Move Prisma/TypeORM usage to a repository or service |
| `no-direct-date-now` | Accept `nowMs: number` as a parameter; seed from `Date.now()` at the call site |
| `react-hook-naming` | Rename helpers that call hooks to `useXxx` |
| `nest-controller-response-type` | Add explicit return type to each `@Get`/`@Post`/… handler |
| `consistent-type-imports` (escalated to `error`) | Run `--fix` |
| `no-console-in-module` (escalated to `error`) | Replace remaining `console.log` calls |
| `no-non-null-assertion` (escalated to `error`) | Eliminate remaining `!` assertions |

---

## Adding framework configs

Framework configs are independent of the base/recommended/strict ladder. Layer them after your chosen baseline:

### React

```ts
import { recommended } from '@nekostack/lint/recommended';
import { react } from '@nekostack/lint/react';

export default tseslint.config(
  ...tseslint.configs.recommended,
  ...recommended,
  ...react,
);
```

### NestJS

```ts
import { recommended } from '@nekostack/lint/recommended';
import { nest } from '@nekostack/lint/nest';

export default tseslint.config(
  ...tseslint.configs.recommended,
  ...recommended,
  ...nest,
);
```

---

## Incremental adoption

If you have a large existing codebase, adopt rules incrementally with targeted overrides:

```ts
import { strict } from '@nekostack/lint/strict';

export default tseslint.config(
  ...tseslint.configs.recommended,
  ...strict,
  // Temporarily downgrade rules with many violations
  {
    rules: {
      '@nekostack/no-non-null-assertion': 'warn', // will graduate to error
      '@nekostack/react-hook-naming': 'off',      // needs a cleanup sprint
    },
  },
);
```

Track each override as a tech-debt item and remove them as the violations are fixed.
