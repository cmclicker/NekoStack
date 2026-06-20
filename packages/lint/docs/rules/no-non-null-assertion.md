# `no-non-null-assertion`

Flags the postfix non-null assertion operator `x!`.

## Why

The `!` operator removes `null` and `undefined` from a type at the assertion site without any runtime guarantee. If the value actually is `null` at runtime, the error surfaces as a confusing `Cannot read properties of null` far from the assertion, not as a clear null-check failure. Optional chaining (`?.`), nullish coalescing (`??`), and explicit null guards are all safer alternatives that make the assumption visible and handle the null case explicitly.

## Examples

### Incorrect

```ts
const user = getUser()!;
user.profile.name;

const el = document.getElementById('root')!;

const first = items[0]!;
```

### Correct

```ts
const user = getUser();
if (!user) throw new Error('User not found');
user.profile.name;

const el = document.getElementById('root');
if (!el) throw new Error('Root element missing');

const first = items[0] ?? defaultItem;

// Optional chaining for safe access
const name = getUser()?.profile?.name;
```

## Options

None.

## When to disable

When working with a third-party library that has incorrect type definitions (e.g. a method typed as returning `T | null` but documented as never returning `null`). Use an inline disable with a comment referencing the library issue.
