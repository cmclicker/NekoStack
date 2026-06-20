# `no-direct-date-now`

Flags `Date.now()` and `new Date()` (no arguments) in non-test source files.

## Why

Calls to the system clock are a hidden dependency that makes code untestable without mocking globals. NekoStack enforces the injectable-clock pattern: callers receive the current timestamp as a parameter or from a clock service, so tests can control time without `vi.setSystemTime` or clock-stub libraries.

`new Date(value)` — parsing a specific timestamp — is permitted because it doesn't read the system clock.

Test files are fully exempt.

## Examples

### Incorrect

```ts
// src/events/event.service.ts
const now = Date.now();
const created = new Date();
```

### Correct

```ts
// Receive the timestamp as a dependency
function createEvent(payload: Payload, nowMs: number = Date.now()) {
  return { ...payload, createdAt: nowMs };
}

// In tests, pass a fixed timestamp
createEvent(payload, 1_700_000_000_000);
```

```ts
// Parsing a specific value is fine
const parsed = new Date('2026-01-01T00:00:00Z');
```

## Options

None.

## When to disable

Application entry points (e.g. `main.ts`) where you intentionally seed the real clock. Use an inline disable with a comment.
