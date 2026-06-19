# @nekostack/config

> Runtime configuration as a typed schema. Validate env vars at boot, separate secrets from config, fail fast with a readable error when something's missing.

## Quick reference

| | |
|---|---|
| **Build tier** | Foundation primitive â€” build after `schema` |
| **Depends on** | `schema` (config schema DSL); coordinates with `secrets` (for the Secret type) |
| **Used by** | every backend app at boot; `api`, `auth`, `telemetry`, `jobs`, `billing`, every service-level package |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 1â€“2 weeks focused |

## Why this exists

Configuration is the most universally-mishandled part of every web project. The standard pattern looks like:

```ts
const dbUrl = process.env.DATABASE_URL!;
const jwtSecret = process.env.AUTH_JWT_SECRET ?? 'dev-secret';
const apiPort = parseInt(process.env.API_PORT ?? '3001');
```

This is wrong in several quiet ways:
1. `process.env.X!` lies â€” the value might be undefined and you'll find out at runtime, not boot.
2. The fallback `'dev-secret'` will ship to production if you forget to set the env var. We saw exactly this kind of problem in NekoVibe's auth flow â€” a stale `AUTH_SECRET` cookie surviving across env changes.
3. `parseInt` of `undefined` silently returns `NaN`.
4. No central catalog of "what env vars does this app need" â€” every file looks at `process.env` differently.
5. Secrets and non-secret config are mixed.

`@nekostack/config` makes runtime config a single typed schema. At boot, the schema is validated against the environment. If anything required is missing or malformed, the process exits with a clear error pointing at the variable name and the expected format. After boot, config is accessed through a typed `config` object â€” no more `process.env.X!` scattered through the code.

Building this yourself rather than using `dotenv`, `zod-env`, or `envalid` is justified because:
1. **Integration with `@nekostack/schema`.** The config schema reuses the same DSL as every other schema in the stack. One way to define types.
2. **Secrets discipline is encoded.** Secrets are declared as such and never log themselves. Non-secret config can be safely logged. Generic libraries don't enforce this.
3. **Multi-environment is first-class.** Dev/staging/prod profiles, env-file precedence, runtime override patterns â€” all opinionated, not a free-for-all.

## Scope

### In scope
- Config schema using `@nekostack/schema` DSL.
- Validation at boot with detailed errors.
- Typed `config` accessor â€” `config.api.port`, `config.db.url`, etc.
- Secret marking â€” fields tagged as secret have a redacted `toString`, never log, never appear in error traces.
- Multi-environment support: `.env`, `.env.local`, `.env.<NODE_ENV>`, `.env.<NODE_ENV>.local` precedence.
- Boot diagnostics: `neko config check` prints which sources contributed which values (without revealing secret values).
- Watch mode for dev: changes to `.env.local` reload config without process restart (where the consumer supports it).

### Out of scope
- Secrets storage (Vault, AWS Secrets Manager, etc.). We *read* secrets from env; we don't manage them at rest.
- Feature flags. Different concept, lives in `@nekostack/flags`.
- Per-tenant config (multi-tenant runtime config). That's `@nekostack/entitlements` territory.
- Pure config-file formats (TOML, YAML). We standardize on env + dotenv for runtime config.

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§33, Â§45 for the full capability map.

### Owns
- `defineConfig()` DSL on top of `@nekostack/schema`
- `.env` / `.env.local` / `.env.<NODE_ENV>` precedence + OS env merge
- Boot-time validation with structured errors
- Typed accessor (`config.db.url`, etc.) â€” no scattered `process.env.X`
- Per-field source attribution (`neko config check` diagnostics)
- Dev-mode reload on `.env.local` change

### Does NOT own
| Capability | Lives in |
|---|---|
| Secret loading / masking / rotation / leak detection | `secrets` |
| Vault / AWS SM / 1Password adapters | `secrets` (source adapters) |
| Feature flags (different concept) | `flags` |
| Per-tenant runtime config | `tenant` + `entitlements` |
| Devcontainer / docker-compose for local dev | `env` |
| Plain dotenv file parsing | external (dotenv used internally) |

## Competitors and adjacent tools

| Tool | What they do well | Where they fall short for us |
|---|---|---|
| **dotenv** | Loads `.env` files. Ubiquitous. | Just file loading. No validation, no typing, no secret discipline. |
| **envalid** | Validates env vars with a schema. | Schema is its own DSL. No integration with the rest of our schema layer. |
| **zod-env** / **`zod`-based env loaders** | Combine Zod with env loading. | Loose convention, not a package. Every project re-implements it. |
| **convict** | Mozilla's config lib. Schema-driven, supports multiple sources. | JSON-Schema-style DSL feels dated. No TS-native inference. |
| **dotenvx** | dotenv with encryption + multi-env. | Solves encryption, not validation. Complementary, not competing. |

The right framing: `@nekostack/config` uses `@nekostack/schema` as its DSL and adds env-loading, boot validation, and secret discipline on top.

## How this fits the NekoStack

**Depends on:**
- `@nekostack/schema` â€” for the config schema DSL.

**Used by:**
- Every app that boots. This is the first thing called in `main()` / `index.ts`.
- `@nekostack/api` â€” knows config for port, CORS origins, etc.
- `@nekostack/auth` â€” reads JWT secrets, OAuth client IDs.
- `@nekostack/telemetry` â€” reads sinks, DSNs.
- `@nekostack/jobs` â€” reads queue connection strings.
- Effectively every backend package.

## Design philosophy

- **Fail at boot, not at runtime.** Missing or malformed config kills the process with a clear error in the first second, not the first request.
- **Typed access, not string lookups.** After validation, you read `config.db.url`, never `process.env.DATABASE_URL`.
- **Secrets are a tagged type.** Reading a secret value works; logging or stringifying it returns `[REDACTED]`.
- **Sources are explicit.** Every value has a source: hardcoded default, `.env`, `.env.local`, OS environment, runtime override. `neko config check` shows the source per field.
- **Production-safe defaults are not silent.** Fallback values (`?? 'dev-secret'`) are a smell. Required fields are required; optional fields are declared optional.

## Architecture sketch

```
packages/config/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ schema.ts             # ConfigSchema<T> built on @nekostack/schema
â”‚   â”œâ”€â”€ load.ts               # env-file precedence, OS env merge
â”‚   â”œâ”€â”€ validate.ts           # boot-time validator
â”‚   â”œâ”€â”€ secret.ts             # Secret<T> wrapper type
â”‚   â”œâ”€â”€ proxy.ts              # typed config accessor (Proxy-based)
â”‚   â”œâ”€â”€ diagnostics.ts        # source attribution
â”‚   â””â”€â”€ reload.ts             # dev-mode file watcher
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

Authoring a config schema:

```ts
import { defineConfig, s, secret } from '@nekostack/config';

export const config = defineConfig({
  env: s.enum(['development', 'staging', 'production']),
  api: {
    port: s.number().int().min(1).max(65535).default(3001),
    corsOrigins: s.array(s.string().url()).default([]),
  },
  db: {
    url: secret(s.string().url()),
  },
  auth: {
    jwtSecret: secret(s.string().min(32)),
    googleClientId: s.string().optional(),
  },
});
```

Boot:

```ts
import { config } from './config';
// Throws at this import if anything required is missing or malformed.

console.log(config.api.port);          // 3001 (number, typed)
console.log(config.db.url);            // throws â€” secret access only via .reveal()
console.log(config.db.url.reveal());   // 'postgres://...' (explicit unwrap)
console.log(`${config.db.url}`);       // '[REDACTED]'
```

## Roadmap

### v0.1 â€” Bootstrap
- `defineConfig()` and basic env loading.
- Required/optional/default semantics.
- Boot validation with readable errors.

### v0.2 â€” Secret discipline
- `secret()` wrapper type.
- Redacted `toString`, `inspect`, JSON serialization.
- ESLint rule (in `@nekostack/lint`) forbidding direct access to `process.env` outside this package.

### v0.3 â€” Multi-environment
- `.env.local`, `.env.<NODE_ENV>` precedence.
- `neko config check` diagnostics command.

### v0.4 â€” Dev reload
- Watcher for `.env.local` changes in dev mode.
- Reload callback API for consumers that want to hot-reload.

### v1.0 â€” Stable API
- Documentation site with patterns: 12-factor mapping, secret rotation guidance, common-pitfall recipes.

## Product potential

**Internal use:** Essential. Every backend service uses this.

**Open source release:** Modest. The niche is crowded but the integration angle is genuinely unique. MIT release as part of NekoStack is fine; unlikely to be a standalone OSS hit.


**Estimated effort to v1.0:** 1-2 weeks of focused work. The schema work is done by `@nekostack/schema`; this is a thin shell over it plus env-loading logic.

## Status

- **Current:** Empty placeholder. Not started.
- **Owner:** Cody (solo dev project).
- **Priority tier:** Foundation primitive. Build after `@nekostack/schema` since it depends on the schema DSL.
- **Estimated learning return:** Moderate. Env handling is shallow but the secret-tagging type design and the schema-driven validation are good TS practice.
