# @nekostack/deploy

> CI/CD recipes + infrastructure-as-code templates + deployment automation. The "how does this actually ship?" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Ops |
| **Depends on** | `schema` (deploy config), `secrets` (deploy credentials), `audit`, `governance` (deploy gates), `health` (pre-deploy checks), `backup` (pre-deploy snapshots), `migrate` (deploy-time migrations) |
| **Used by** | every product getting deployed |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 10â€“16 weeks focused |

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
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ ci/
â”‚   â”‚   â”œâ”€â”€ github-actions.ts
â”‚   â”‚   â””â”€â”€ gitlab-ci.ts
â”‚   â”œâ”€â”€ iac/
â”‚   â”‚   â”œâ”€â”€ terraform.ts
â”‚   â”‚   â””â”€â”€ pulumi.ts
â”‚   â”œâ”€â”€ gates/
â”‚   â”‚   â”œâ”€â”€ health.ts
â”‚   â”‚   â”œâ”€â”€ smoke.ts
â”‚   â”‚   â””â”€â”€ governance.ts
â”‚   â”œâ”€â”€ rollout/
â”‚   â”‚   â”œâ”€â”€ blue-green.ts
â”‚   â”‚   â””â”€â”€ canary.ts
â”‚   â”œâ”€â”€ hooks/
â”‚   â”‚   â”œâ”€â”€ pre-backup.ts
â”‚   â”‚   â””â”€â”€ pre-migrate.ts
â”‚   â”œâ”€â”€ release/
â”‚   â”‚   â”œâ”€â”€ semver.ts
â”‚   â”‚   â””â”€â”€ changelog.ts
â”‚   â”œâ”€â”€ rollback/
â”‚   â”‚   â””â”€â”€ runbook.ts
â”‚   â””â”€â”€ container/
â”‚       â””â”€â”€ build.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” GitHub Actions templates
### v0.2 â€” Deploy gates
### v0.3 â€” Pre-deploy backup + migration hooks
### v0.4 â€” Blue-green rollout
### v0.5 â€” Rollback runbooks
### v0.6 â€” Release / changelog
### v0.7 â€” IaC adapters
### v1.0 â€” Stable API

## Product potential

**Internal:** Used by every shipped product.
**Open source release:** Modest.
**Commercial:** None directly.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Ops.
- **Estimated learning return:** Very high. CI/CD architecture, deploy gates, rollback patterns, IaC.
