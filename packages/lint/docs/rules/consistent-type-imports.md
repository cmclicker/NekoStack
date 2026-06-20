# `consistent-type-imports`

Flags `import { Foo }` bindings used exclusively in type positions. **Provides an auto-fixer** that adds the `type` modifier inline.

## Why

TypeScript's `import type` (or the inline `import { type Foo }` form) tells the compiler and bundlers that the binding is erased at runtime. Without `type`, the import may survive in the output even when the value is never needed, defeating tree-shaking and breaking `isolatedModules` mode (required by Vite, esbuild, and SWC).

The rule analyses the import binding's usage in the file without requiring a full TypeScript project reference — making it fast and safe to run in any CI environment.

## Examples

### Incorrect

```ts
import { User, createUser } from './user.js';
//       ^^^^ used only as a type annotation — should be `import type`

function getUser(): User { … }
```

### Correct

```ts
import { type User, createUser } from './user.js'; // auto-fixer result

function getUser(): User { … }
createUser({ … });
```

```ts
// Or use a separate type import
import type { User } from './user.js';
import { createUser } from './user.js';
```

## Options

None.

## When to disable

Never — the auto-fixer handles it.
