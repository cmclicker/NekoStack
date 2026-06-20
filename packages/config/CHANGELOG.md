# @nekostack/config — Changelog

Per-milestone changes. Pairs with git tags (`config-vX.Y.Z`). Format: newest first.

---

## config-v0.1.0 — 2026-06-20

PR [#TBD](https://github.com/cmclicker/NekoStack/pull/TBD) · Bootstrap: typed env validation at boot.

### What shipped

**`defineConfig(shape, opts?)`**

Accepts a nested config shape of `c.*` field builders. Loads dotenv files in precedence order (`.env` → `.env.local` → `.env.<NODE_ENV>` → `.env.<NODE_ENV>.local` → OS env), validates every field, and returns a fully typed plain object. Throws `ConfigValidationError` listing all missing/invalid fields at once — the process should not continue after this error.

**`c.*` field builders**

- `c.string()` — `.minLength()`, `.maxLength()`, `.url()`, `.optional()`, `.default()`, `.secret()`, `.env()`
- `c.number()` — `.int()`, `.min()`, `.max()`, `.optional()`, `.default()`, `.secret()`, `.env()`. Coerces string env values to number automatically.
- `c.boolean()` — `.optional()`, `.default()`, `.secret()`, `.env()`. Coerces `'true'`, `'1'`, `'false'`, `'0'` from env.
- `c.enum(values)` — `.optional()`, `.default()`, `.secret()`, `.env()`
- `c.array(item)` — `.default()`, `.secret()`, `.env()`

**`Secret<T>`**

Wraps sensitive values so they can only be accessed via `.reveal()`. `toString()`, `toJSON()`, and `util.inspect` all return `'[REDACTED]'`. Prevents accidental logging or serialization of secrets.

**Env var name derivation**

Config paths are automatically mapped to `SCREAMING_SNAKE_CASE` env var names:
- `auth.jwtSecret` → `AUTH_JWT_SECRET`
- `api.port` → `API_PORT`
- `db.url` → `DB_URL`

Override with `.env('CUSTOM_VAR_NAME')`.

**`ConfigValidationError`**

Thrown when validation fails. Carries `.errors[]` — each with `path`, `envKey`, and `message` — so consumers can render structured error output.

**Package**

- Version: `0.1.0` (initial release)
- Dependencies: `dotenv`, `zod` (internal engines — not surfaced to consumers)
- 59 tests (9 Secret, 25 field builders, 7 env-loader, 18 defineConfig integration)
