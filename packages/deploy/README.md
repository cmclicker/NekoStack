# @nekostack/deploy

> CI/CD recipes + infrastructure-as-code templates + deployment automation. The "how does this actually ship?" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Ops |
| **Depends on** | `schema` (deploy config), `secrets` (deploy credentials), `audit`, `governance` (deploy gates), `health` (pre-deploy checks), `backup` (pre-deploy snapshots), `migrate` (deploy-time migrations) |
| **Used by** | every product getting deployed |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 10–16 weeks focused |
| **Sellable?** | Modest — crowded space; opinionated NekoStack-conventional value |

## Why this exists

Deployment is the boundary where bugs become outages. Every product reinvents CI/CD pipelines, infrastructure templates, deploy-gate checks, rollback playbooks. `deploy` provides NekoStack-conventional patterns.

## Scope

### In scope
- GitHub Actions / GitLab CI / etc. templates per project type.
- Infrastructure-as-code patterns (Terraform / Pulumi adapters).
- Deploy gates (health / smoke / governance).
- Blue-green / canary rollout patterns.
- Pre-deploy backup hook via `backup`.
- Pre-deploy migration hook via `migrate`.
- Rollback runbooks.
- Release versioning (semver helpers; folds `release` for now).
- Changelog generation.
- Container image build patterns.

### Out of scope
- Dev environment (`env`).
- Native packaging (`shell`).
- PWA build (`pwa`).
- Application code.

## Boundary

### Owns
- CI/CD pipeline templates
- IaC adapter patterns
- Deploy gates
- Blue-green / canary rollouts
- Pre-deploy backup + migration hooks
- Rollback runbooks
- Release versioning + changelog (folded `release`)
- Container image build patterns

### Does NOT own
| Capability | Lives in |
|---|---|
| Dev environment | `env` |
| Native packaging | `shell` |
| PWA build | `pwa` |
| Backup mechanics | `backup` |
| Migration mechanics | `migrate` |
| Health probes | `health` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **GitHub Actions** | Standard. | Substrate; we provide templates. |
| **Terraform / Pulumi** | IaC standards. | Substrate; we adapt. |
| **Vercel / Fly / Railway** | Hosted PaaS. | Vendor-coupled. |
| **Custom scripts** | Common. | Reinvented. |

## How this fits the NekoStack

- **`backup`** pre-deploy snapshot.
- **`migrate`** deploy-time migrations.
- **`health`** post-deploy checks.
- **`governance`** deploy gates.
- **`secrets`** for credentials.

## Design philosophy

- **Opinionated templates.** GitHub Actions YAML you can adopt unchanged.
- **Deploy gates mandatory.** Health check + smoke test before traffic shift.
- **Rollback runbooks.** Every deploy has a documented rollback.
- **Pre-deploy backup.** Snapshot is the safety net.

## Architecture sketch

```
packages/deploy/
├── src/
│   ├── ci/
│   │   ├── github-actions.ts
│   │   └── gitlab-ci.ts
│   ├── iac/
│   │   ├── terraform.ts
│   │   └── pulumi.ts
│   ├── gates/
│   │   ├── health.ts
│   │   ├── smoke.ts
│   │   └── governance.ts
│   ├── rollout/
│   │   ├── blue-green.ts
│   │   └── canary.ts
│   ├── hooks/
│   │   ├── pre-backup.ts
│   │   └── pre-migrate.ts
│   ├── release/
│   │   ├── semver.ts
│   │   └── changelog.ts
│   ├── rollback/
│   │   └── runbook.ts
│   └── container/
│       └── build.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — GitHub Actions templates
### v0.2 — Deploy gates
### v0.3 — Pre-deploy backup + migration hooks
### v0.4 — Blue-green rollout
### v0.5 — Rollback runbooks
### v0.6 — Release / changelog
### v0.7 — IaC adapters
### v1.0 — Stable API

## Product potential

**Internal:** Used by every shipped product.
**Open source release:** Modest.
**Commercial:** None directly.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Ops.
- **Estimated learning return:** Very high. CI/CD architecture, deploy gates, rollback patterns, IaC.
