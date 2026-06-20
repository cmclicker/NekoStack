# `schema-no-inline-zod`

Flags `z.TYPE()` Zod constructor calls outside designated schema files.

## Why

When Zod schemas are defined inline in services, controllers, or handlers, they drift from the canonical `@nekostack/schema` IR. A field change in the IR may not propagate to the inline validator, silently accepting or rejecting data the API spec no longer matches. Schema definitions belong in `.schema.ts` files, `schemas/` directories, or `packages/schema/` — where the drift-check CI gate can catch them.

Type-only uses (`z.infer<…>`) are not flagged.

## Examples

### Incorrect

```ts
// src/users/user.service.ts
import { z } from 'zod';

const CreateUserInput = z.object({
  name: z.string(),
  email: z.string().email(),
});
```

### Correct

```ts
// src/users/user.schema.ts  ← correct location
import { z } from 'zod';

export const CreateUserInput = z.object({
  name: z.string(),
  email: z.string().email(),
});
export type CreateUserInput = z.infer<typeof CreateUserInput>;
```

```ts
// src/users/user.service.ts
import type { CreateUserInput } from './user.schema.js'; // type-only import is fine
```

## Options

None.

## When to disable

Never. If you're tempted to define a schema inline, move it to a schema file.
