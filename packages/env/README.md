# @nekostack/env

> One command to get any NekoStack project running locally. Devcontainers, docker-compose, port allocation, service dependencies, and tear-down — all declarative.

## Why this exists

Every NekoStack project has the same problem: getting it running locally is a multi-step ritual. Start Postgres on the right port. Start Redis. Configure env vars. Apply database migrations. Generate Prisma clients. Build packages in the right order. Start the API. Start the web frontend. Make sure they can talk to each other.

The NekoVibe README has a *six-section troubleshooting guide* just for the "I can't get it running" failure modes. That's not a NekoVibe problem — that's a problem every project will have without a uniform dev-environment abstraction.

`@nekostack/env` makes the local dev environment a first-class declarative artifact:

```yaml
# neko-env.yaml
services:
  postgres:
    image: postgres:16
    port: 51214
    healthcheck: pg_isready
  redis:
    image: redis:7
    port: 6379
processes:
  api:
    cwd: apps/api
    cmd: npm run start:dev
    depends_on: [postgres, redis]
    port: 3001
  web:
    cwd: apps/web
    cmd: npm run dev
    depends_on: [api]
    port: 3000
```

Then `neko env up` reads this file, brings up the services in dependency order with healthchecks, allocates non-conflicting ports if defaults are taken, prints a single status table, and tails logs. `neko env down` tears it all down cleanly.

Building this yourself rather than using docker-compose directly is justified because:
1. **Cross-project consistency.** Every project's `neko-env.yaml` looks the same. Once you know one, you know them all.
2. **Process orchestration, not just containers.** docker-compose handles containers. We also orchestrate native processes (the Vite dev server, the Nest API, the Tauri shell) and chain dependencies between them.
3. **Port collision handling.** When you have NekoVibe and NekoBattler open at once and both want port 3000, the tool resolves it instead of failing.
4. **Tear-down discipline.** Stopping `neko env up` cleanly stops everything it started. No orphan processes.

## Scope

### In scope
- Declarative env spec (`neko-env.yaml`) per project.
- `neko env up` / `down` / `restart` / `status` / `logs`.
- Service types: container (docker-managed), process (native command), task (one-off).
- Dependency ordering with healthcheck gates.
- Port allocation with collision detection and override.
- Unified log multiplexing with per-service color and prefix.
- Devcontainer definitions for VS Code integration.

### Out of scope
- Production orchestration. This is dev-only. Production is `@nekostack/deploy`'s territory.
- CI environment orchestration (GitHub Actions workflows). Different problem.
- Cloud sandbox environments (Gitpod, Codespaces). Could be supported via devcontainer output, but the cloud-specific config lives elsewhere.
- Native package installation (Homebrew, apt). We assume Docker + Node are present.

## Competitors and adjacent tools

| Tool | What they do well | Where they fall short for us |
|---|---|---|
| **docker-compose** | Mature, ubiquitous, well-understood. | Container-only. No native processes. No cross-project port management. |
| **Tilt** | Declarative dev orchestration, including native processes and containers. | Kubernetes-focused; overkill for solo dev. |
| **DevContainers (VS Code)** | Excellent IDE integration, container-native dev. | One container per project; doesn't orchestrate multiple services natively. |
| **Procfile / foreman** | Simple multi-process runner. | No container support, no healthchecks, no dependency ordering. |
| **mprocs** / **overmind** | Better Procfile alternatives. | Same scope as foreman; still no containers. |
| **Nx run-many** | Monorepo task orchestration. | Task-graph oriented; not for service lifecycle management. |

The right framing: `@nekostack/env` is the *thin layer over Docker + native processes* that gives you a uniform, declarative, dev-loop-fast experience across every project. It's not replacing docker-compose; it's wrapping it.

## How this fits the NekoStack

**Depends on:**
- Docker (external) — for container services.
- `@nekostack/cli` — `neko env` is a CLI subcommand.
- `@nekostack/config` — reads project config to discover ports and env vars.

**Used by:**
- Every developer working on any NekoStack project — every day.
- CI smoke tests can use the same spec to spin up a representative environment.
- Onboarding docs reduce from a 20-step README to "run `neko env up`."

## Design philosophy

- **One command starts everything.** Don't make humans remember service start order.
- **Healthchecks are gates, not optional.** Dependent services wait until their dependencies are *actually reachable*, not just "started."
- **Logs are unified and color-coded.** Every service's stdout/stderr is prefixed and demultiplexed in one stream.
- **Tear-down is exact.** Whatever `up` started, `down` stops. No orphans.
- **Multi-project sane.** Running NekoVibe and NekoBattler at the same time should not fight over port 3000. The tool picks free ports and tells you which it picked.

## Architecture sketch

```
packages/env/
├── src/
│   ├── spec.ts               # parse neko-env.yaml, validate schema
│   ├── docker.ts             # container service driver
│   ├── process.ts            # native process service driver
│   ├── healthcheck.ts        # readiness probes (tcp, http, command)
│   ├── ports.ts              # allocation + collision detection
│   ├── logs.ts               # multiplexed log streaming
│   ├── lifecycle.ts          # up / down / restart orchestration
│   └── cli.ts                # subcommand registration
├── tests/
└── README.md
```

Project-side `neko-env.yaml` example (already shown above) plus optional `devcontainer.json` output:

```
$ neko env up
[postgres] starting…
[postgres] ✔ healthy (pg_isready)
[redis] starting…
[redis] ✔ healthy
[api] starting (npm run start:dev)…
[api] Nest application successfully started on :3001
[api] ✔ healthy (http://localhost:3001/health)
[web] starting (npm run dev)…
[web] Ready at http://localhost:3000

All services running. Press Ctrl+C to stop.
```

## Roadmap

### v0.1 — Bootstrap
- Schema for `neko-env.yaml`.
- Docker service driver (start/stop containers).
- Basic up/down lifecycle.

### v0.2 — Native processes
- Process service driver with stdout/stderr capture.
- Multiplexed log output.

### v0.3 — Healthchecks
- TCP, HTTP, and command-based readiness probes.
- Dependency ordering using probe results.

### v0.4 — Port management
- Port allocation with collision detection.
- Override and discovery API.

### v0.5 — Devcontainer output
- Generate `.devcontainer/devcontainer.json` from `neko-env.yaml` for VS Code users.

### v1.0 — Stable spec
- Documentation site.
- Migration recipes from raw docker-compose.

## Product potential

**Internal use:** High value for solo dev across many projects. Removes the friction tax of context-switching.

**Open source release:** Plausible MIT release. The "process orchestration + container management in one declarative spec" niche has Tilt, but Tilt is Kubernetes-focused. A simpler tool for solo devs / small teams is undersupplied.

**Commercial product:** Unlikely. Dev tooling rarely monetizes directly except as part of a broader IDE / platform.

**Estimated effort to v1.0:** 3-6 weeks of focused work. Docker + process drivers are mostly orchestration; healthchecks are the subtle part.

## Status

- **Current:** Empty placeholder. Not started.
- **Owner:** Cody (solo dev project).
- **Priority tier:** Foundation primitive. Mid-priority — projects can survive without it for a while, but solo-dev context-switching pain becomes intolerable past 3-4 active projects.
- **Estimated learning return:** Moderate. Docker API, process management, healthcheck patterns, log multiplexing — all useful operational skills.
