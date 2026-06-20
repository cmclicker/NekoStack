# `no-raw-sql`

Flags unsafe Prisma raw-query methods.

## Why

Prisma's raw-query API has two forms: the tagged-template form (`` prisma.$queryRaw`SELECT …` ``) and the call form (`prisma.$queryRaw('SELECT …')`). Only the tagged-template form is safe — Prisma parameterises variables at the tag level, making injection impossible. The call form accepts a plain string, which is trivially injectable.

`$queryRawUnsafe` and `$executeRawUnsafe` are always flagged because their names document the risk and there is no safe variant.

## Examples

### Incorrect

```ts
// Call form — string is NOT parameterised
const users = await prisma.$queryRaw(`SELECT * FROM users WHERE id = ${id}`);

// Unsafe variants — always flagged
const result = await prisma.$queryRawUnsafe('SELECT 1');
await prisma.$executeRawUnsafe(`DELETE FROM sessions WHERE token = '${token}'`);
```

### Correct

```ts
// Tagged-template form — Prisma handles parameterisation
const users = await prisma.$queryRaw`SELECT * FROM users WHERE id = ${id}`;

await prisma.$executeRaw`UPDATE users SET name = ${name} WHERE id = ${id}`;

// Regular Prisma client methods are always fine
const user = await prisma.user.findUnique({ where: { id } });
```

## Options

None.

## When to disable

Only when the raw SQL is itself a literal with no interpolation and you have verified there is no ORM equivalent. Use `$executeRaw` tagged-template even then.
