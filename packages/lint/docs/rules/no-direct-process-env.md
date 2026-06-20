# `no-direct-process-env`

Flags direct `process.env` access. Use `@nekostack/config` to read environment variables instead.

## Why

Scattered `process.env` calls create an implicit, unvalidated environment contract. Any typo in a key name silently returns `undefined` at runtime. `@nekostack/config` centralises all env reads behind a Zod-validated schema so misconfiguration fails loudly at startup, not silently mid-request.

The `@nekostack/config` package itself is exempt from this rule.

## Examples

### Incorrect

```ts
const db = new Client({ url: process.env.DATABASE_URL });

const port = process.env['PORT'] ?? '3000';
```

### Correct

```ts
import { config } from '@nekostack/config';

const db = new Client({ url: config.databaseUrl });

const port = config.port;
```

## Options

None.

## When to disable

Scripts in the repository root (e.g. `scripts/*.mjs`) that run before the config package is available. Add an inline `// eslint-disable-next-line @nekostack/no-direct-process-env` with a comment explaining why.
