# `schema-export-type`

Flags exported Zod schemas in `.schema.ts` files that have no corresponding `export type T = z.infer<typeof schema>` declaration. **Provides an auto-fixer** that inserts the missing type export.

## Why

A Zod schema doubles as a runtime validator and a static type definition. Exporting only the schema constant forces consumers to write `z.infer<typeof MySchema>` at every use site — verbose and fragile if the schema is renamed. Exporting the inferred type alongside the schema locks the name and makes the type importable without importing the runtime validator.

Active only in `.schema.ts` files.

## Examples

### Incorrect

```ts
// user.schema.ts
import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
});
// missing: export type UserSchema = z.infer<typeof UserSchema>
```

### Correct

```ts
// user.schema.ts
import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type UserSchema = z.infer<typeof UserSchema>; // auto-fixer inserts this
```

## Options

None.

## When to disable

For internal schema constants intentionally not exposed to consumers (e.g. sub-schemas composed into a public schema). Prefer not exporting them at all over disabling the rule.
