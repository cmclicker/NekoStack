# @nekostack/secrets

> Secret loading, masking, rotation, leak detection. The secret-lifecycle layer lifted out of `env` / `config`. Knows how to read secrets from local files in dev and from Vault / AWS Secrets Manager / 1Password in production, without leaking them through logs.

## Quick reference

| | |
|---|---|
| **Build tier** | Security — split out of `env` for explicit ownership |
| **Depends on** | `schema` (secret type tagging), `audit` (secret access audited), `crypto` (encryption helpers), `config` (some overlap on env-loading) |
| **Used by** | `auth` (JWT signing secret, OAuth client secrets), `billing` (Stripe API key), `email` (Resend / SendGrid API key), `notify` (Web Push VAPID), every package needing API keys or signing secrets |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 4–8 weeks focused |
| **Sellable?** | Modest — Doppler / Infisical / HashiCorp Vault territory; library-level niche is small but real |

## Why this exists

Secrets are not config. Config can be logged, debugged, and inspected. Secrets cannot. Bundling them in one package leads to bugs like:

- `console.log(config)` accidentally leaks `config.db.password`.
- Stack traces include secret values.
- Error reports to Sentry include secret-bearing fields.
- The `.env` file in version control. (Or worse: in tests.)
- "Just for now" secrets in code that ship to production.

Lifting `secrets` out of `env` / `config` makes:
- **Secret values typed and tagged.** A `Secret<string>` type's `toString` returns `[REDACTED]`. JSON.stringify returns the same. Inspection always redacts.
- **Sources pluggable.** Local dev reads from `.env`. Production reads from Vault / AWS SM / 1Password. Same API.
- **Rotation a first-class concept.** Rotation policies declared; old secrets graceful-expire; rotation audited.
- **Leak detection at the boundary.** Egress to logs / telemetry / error tracking scrubs secret-tagged fields.

## Scope

### In scope
- `Secret<T>` wrapper type with redacted `toString` / inspect / JSON.
- Secret loading from multiple sources (env file, OS env, Vault, AWS SM, 1Password, GCP Secret Manager).
- Source priority + fallback chains.
- Secret rotation policies (declared with rotation cadence).
- Rotation grace periods (old + new accepted briefly).
- Leak detection at egress points (logs, telemetry, error tracking).
- Secret access audit (who/what read this secret, when).
- CI checks: secrets-in-code detection (uses substring/entropy heuristics).
- Dev-local secret bootstrap.

### Out of scope
- Cryptographic primitives themselves (`crypto` wraps libsodium / Node crypto).
- Non-secret runtime config (`config`).
- Devcontainer / docker-compose (`env`).
- Login flow (`auth`).
- Compliance evidence for secret management (`compliance`).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §33 for the full capability map.

### Owns
- `Secret<T>` wrapper type
- Source adapters (env / Vault / AWS SM / 1Password / GCP SM / local-dev)
- Secret loading + fallback chain
- Secret masking on egress (logs / telemetry / errors)
- Rotation policies + grace periods
- Secret access audit
- Secrets-in-code CI detection
- Dev-local secret bootstrap

### Does NOT own
| Capability | Lives in |
|---|---|
| Cryptographic primitive wrappers (encrypt/decrypt) | `crypto` |
| Non-secret runtime config | `config` |
| Env-file loading mechanics | `env` (we share dotenv) |
| Devcontainer / docker-compose | `env` |
| Compliance evidence for secret management | `compliance` |
| Password hashing (different shape) | external (bcrypt / argon2) |
| JWT signing internals | external (provider libs via `auth`) |

## Competitors and adjacent tools

| Tool | What they do well | Where they fall short for us |
|---|---|---|
| **Doppler** | Modern hosted secrets manager. | Vendor-coupled; per-seat pricing. |
| **Infisical** | OSS Doppler-alike. | Heavier than a library; runs as a service. |
| **HashiCorp Vault** | Enterprise-grade. | Heavyweight ops; overkill for solo. |
| **AWS Secrets Manager / GCP Secret Manager** | Cloud-native. | Provider-coupled; we wrap them. |
| **1Password CLI** | Personal-developer-friendly. | Just a CLI; integration is yours. |
| **dotenvx** | dotenv + encryption. | Solves at-rest encryption, not lifecycle. |
| **Custom `process.env.X!`** | Cheap. | What this replaces with structure. |

## How this fits the NekoStack

- **`auth`** reads `AUTH_JWT_SECRET`, OAuth client secrets.
- **`billing`** reads Stripe API key.
- **`email`** reads Resend API key.
- **`notify`** reads VAPID keys.
- **`log`** scrubs secret-tagged values on egress.
- **`telemetry`** scrubs secret-tagged values before sending to OTLP.
- **`audit`** records every secret access.
- **`crypto`** is used to decrypt at-rest secrets when source supports it.

## Design philosophy

- **Typed secrets, not strings.** `Secret<string>` is a different type than `string`. The compiler catches accidental misuse.
- **Egress-time scrubbing.** Logs, errors, telemetry — anywhere secrets could leak, an automatic scrubber runs.
- **Sources are interchangeable.** Same API for dev (`.env`) and prod (Vault) — adapter pattern.
- **Rotation grace periods.** Production secrets rotate without downtime; old + new accepted briefly.
- **Audit every access.** Sensitive operation; every read goes to `audit`.

## Architecture sketch

```
packages/secrets/
├── src/
│   ├── type/
│   │   ├── secret.ts         # Secret<T> wrapper with redacted serialization
│   │   └── tag.ts            # tagged-as-secret marker
│   ├── sources/
│   │   ├── env-file.ts       # .env + .env.local (delegates to env)
│   │   ├── vault.ts          # HashiCorp Vault adapter
│   │   ├── aws-sm.ts         # AWS Secrets Manager
│   │   ├── gcp-sm.ts         # GCP Secret Manager
│   │   ├── op-cli.ts         # 1Password CLI
│   │   └── local-dev.ts      # ephemeral dev mode
│   ├── load/
│   │   ├── chain.ts          # source priority + fallback
│   │   └── boot.ts           # boot-time required-secret validation
│   ├── rotate/
│   │   ├── policy.ts         # rotation cadence declarations
│   │   ├── grace.ts          # old + new accepted briefly
│   │   └── audit.ts
│   ├── scrub/
│   │   ├── log.ts            # log-output egress scrubber
│   │   ├── telemetry.ts
│   │   └── error.ts
│   ├── leak-detect/
│   │   ├── code-scan.ts      # CI check for secrets-in-code
│   │   └── entropy.ts
│   └── cli.ts                # `neko secrets check / rotate / audit`
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Secret<T> type + redacted serialization
### v0.2 — Env-file + OS env source adapters
### v0.3 — Vault + AWS SM adapters
### v0.4 — Egress scrubbers (log / telemetry / error)
### v0.5 — Rotation policies + grace periods
### v0.6 — Secrets-in-code CI detection
### v0.7 — 1Password / GCP SM adapters
### v1.0 — Stable API

## Product potential

**Internal:** Essential — secret leaks are CVE-level events.
**Open source release:** Plausible — niche between Doppler (hosted) and rolling your own.
**Commercial:** Marginal — Doppler / Infisical / Vault dominate.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Security. Build early since secret leaks are catastrophic.
- **Estimated learning return:** High. Secret lifecycle, redaction patterns, rotation strategies, source-adapter design, leak detection — all directly applicable to production security work.
