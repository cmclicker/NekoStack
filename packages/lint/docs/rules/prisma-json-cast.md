# `prisma-json-cast`

Flags property access on `Prisma.JsonValue` or `JsonValue` typed variables without an explicit type cast.

## Why

Prisma types JSON columns as `Prisma.JsonValue`, which is `string | number | boolean | null | Prisma.JsonObject | Prisma.JsonArray`. Accessing `.property` on this union compiles (TypeScript allows property access on `any`-widened paths) but silently loses type safety — the accessed property is typed `any`. An explicit `as` cast forces the developer to declare what shape they expect, making the assumption visible and catchable by TypeScript.

## Examples

### Incorrect

```ts
const meta = record.metadata; // Prisma.JsonValue
const name = meta.name;       // property access without cast — flagged
```

### Correct

```ts
type Meta = { name: string; version: number };

const meta = record.metadata as Meta;
const name = meta.name; // safe — explicit cast before access
```

```ts
// Parsing with Zod is the preferred approach
import { MetaSchema } from './meta.schema.js';

const meta = MetaSchema.parse(record.metadata);
const name = meta.name;
```

## Options

None.

## When to disable

When you are intentionally treating the value as opaque (e.g. forwarding it without accessing properties). Use an inline disable with a comment explaining the intent.
