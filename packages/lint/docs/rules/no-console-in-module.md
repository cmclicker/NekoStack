# `no-console-in-module`

Flags `console.log`, `console.debug`, `console.info`, `console.dir`, and `console.table` in non-test source files.

## Why

`console.log` calls left in production code produce noisy, unstructured output that has no log level, no correlation ID, and no destination control. NekoStack applications should route all observability through a structured logger (e.g. a future `@nekostack/logger` package). `console.error` and `console.warn` are permitted because they signal real runtime problems that operators need to see even before a proper logger is wired up.

Test files (`.spec.ts`, `.test.ts`, `__tests__/`) are fully exempt.

## Examples

### Incorrect

```ts
// src/users/user.service.ts
console.log('Creating user', userId);   // flagged
console.debug('Cache hit', cacheKey);   // flagged
console.info('Server started');         // flagged
```

### Correct

```ts
console.error('Fatal: DB connection failed', err); // permitted
console.warn('Deprecated API path used');           // permitted

// Use a structured logger for everything else
logger.info('Creating user', { userId });
```

## Options

None.

## When to disable

Legitimate `console.log` is rare in application code. In scripts (not source modules) the rule can be disabled for the whole file with `/* eslint-disable @nekostack/no-console-in-module */`.
