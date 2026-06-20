# @nekostack/config — Roadmap

Authoritative source for "what ships when." Full design rationale lives in the package [`README.md`](../../README.md).

---

## v0.1 — Bootstrap ← *active target*

Status: **shipped** ([#TBD](https://github.com/cmclicker/NekoStack/pull/TBD), merged 2026-06-20). 59 tests.

- `defineConfig(shape, opts?)` — typed boot-time validation; loads dotenv files in precedence order
- `c.*` field builders — `string`, `number`, `boolean`, `enum`, `array` with full modifier chains
- `Secret<T>` — redacted toString/JSON/inspect; explicit `.reveal()` for access
- Auto-derived env var names from config path (`auth.jwtSecret` → `AUTH_JWT_SECRET`)
- `.env(name)` override for non-convention var names
- `ConfigValidationError` — collects all field errors before throwing (fail-fast with full picture)

---

## v0.2 — Diagnostics + ESLint rule tightening

Status: **not started**.

Done-criteria:
- `neko config check` CLI verb — prints a table of every field: env var name | source (.env / .env.local / OS / default) | value or `[REDACTED]` | status (ok / missing / invalid)
- Wire into `@nekostack/cli` as a `config` subcommand group
- `@nekostack/lint` `no-direct-process-env` rule promoted to `error` severity in `strict` config for packages that depend on `@nekostack/config`
- ESLint rule: `config-no-secret-reveal-in-log` — flags `.reveal()` calls inside `console.*` arguments

---

## v0.3 — Agent-facing exports

Status: **not started**.

Done-criteria:
- `configToJsonSchema(shape)` — emit a JSON Schema document describing the config shape (env var names, types, required/optional, secret flag). Machine-readable catalog of "what does this app need to run."
- `configToMarkdown(shape)` — emit a markdown table suitable for README or agent context documents
- This is the first bridge from runtime config to the agentic tooling layer: an agent reads the JSON Schema, knows exactly what env the app needs, and can provision it without guessing

---

## v1.0 — Stable API

Status: **not started**.

Done-criteria:
- All v0.x features stable with no breaking changes planned
- Full docs in `docs/` covering: quick-start, Secret<T> patterns, env precedence, 12-factor mapping
- `@nekostack/config` linted with `@nekostack/lint/strict` on CI

---

## v1.x — Post-stable backlog

- **Dev reload** — watch `.env.local` in dev mode; fire reload callback when values change
- **`configToToolDef(shape)`** — emit an Anthropic/OpenAI function-calling tool definition from the config shape. Pairs with agent generator 5 on `@nekostack/schema`.
- **Profile support** — named profiles (test, staging) with profile-scoped defaults; `defineConfig({ profile: 'test', ...shape })`
- **Validation report format** — `validateConfig(shape, { report: true })` returns structured report without throwing; for use in health-check endpoints
