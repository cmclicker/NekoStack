# NekoStack

> A hand-crafted, opinionated full-stack utility suite covering schema, contracts, auth, telemetry, UI, game systems, AI tooling, and everything between.

NekoStack is **not** a folder template, a boilerplate, or a Bash script generator. It is a working, documented, tested system kit that products and games build on top of.

## What this is

A monorepo of 108 packages spanning every layer a full-stack solo developer needs to build games (NekoBattler, NekoGacha, Leytide), SaaS products (NekoSystems, NekoVibe, retail-ops simulators, EdTech), narrative tools (Mara Kane lore graphs, continuity validators), and AI agent runtimes — without renting infrastructure from a dozen third-party vendors.

**Five top-level governing documents:**
- [`PRODUCT_THESIS.md`](PRODUCT_THESIS.md) — the doctrine: NekoStack is a workflow-replacement stack, not an adapter collection. Read first to decide whether a phase belongs at all.
- [`BOUNDARIES.md`](BOUNDARIES.md) — canonical capability-to-package map (read first when adding / splitting packages).
- [`ARTIFACTS.md`](ARTIFACTS.md) — taxonomy for the 11 non-code asset folders (`references/`, `starters/`, `snippets/`, `configs/`, `checklists/`, `playbooks/`, `examples/`, `prompts/`, `standards/`, `decisions/`, `manifests/`).
- [`DEPENDENCY-GRAPH.md`](DEPENDENCY-GRAPH.md) — build-order DAG + impact analysis.
- [`ROADMAP.md`](ROADMAP.md) — phased multi-year vertical-slice development plan.

Each package is its own product surface. Each one is opinionated, schema-first where possible, designed for the specific shape of the projects that consume it. Where third-party tools cover similar territory (Auth.js, Zod, Sentry, Prisma, Refine, etc.), each NekoStack package explicitly documents what it does differently and why.

## What this is not

- A side project that exists for its own sake. Every package is built because at least one product consumes it.
- A general-purpose framework. NekoStack is opinionated. Things that fall outside its design philosophy are intentionally out of scope.
- A replacement for security-critical primitives (bcrypt, OAuth protocol internals, JWT signing crypto, TLS). Where touching cryptography directly is dangerous, NekoStack wraps battle-tested libraries and owns only the policy/composition layer above.

## Why a monorepo

Most of these packages reference each other:
- `@nekostack/api` imports `@nekostack/schema`
- `@nekostack/cli` orchestrates code-gen against `@nekostack/schema` and `@nekostack/codex`
- `@nekostack/auth` emits events to `@nekostack/telemetry`
- `@nekostack/ui` consumes `@nekostack/theme`, `@nekostack/icons`, `@nekostack/motion`

Separate repos would mean version-juggling, dependency hell, and broken atomic refactors across the stack. A single monorepo with locked-step versioning is the right shape for this kind of system kit. Turborepo handles incremental builds; npm workspaces handle dependency resolution.

Individual packages can still be published to npm as standalone products. Monorepo and publish-as-library are not in tension.

## Layout

NekoStack has two top-level layers: the **built stack** (`packages/`, governed by [`BOUNDARIES.md`](BOUNDARIES.md)) and the **reusable asset library** (everything else, governed by [`ARTIFACTS.md`](ARTIFACTS.md)).

```
NekoStack/
├── package.json              # workspaces config
├── turbo.json                # turbo task graph
├── tsconfig.base.json        # shared TS config
├── BOUNDARIES.md             # capability → package ownership (built stack)
├── ARTIFACTS.md              # artifact kind → folder ownership (asset library)
│
├── packages/                 # the built stack — code that runs/validates/renders/exposes APIs
│   ├── schema/               # @nekostack/schema
│   ├── cli/                  # @nekostack/cli
│   ├── codex/                # @nekostack/codex
│   ├── rules/                # @nekostack/rules
│   ├── auth/                 # @nekostack/auth
│   ├── telemetry/            # @nekostack/telemetry
│   ├── ui/                   # @nekostack/ui
│   └── ...                   # 108 packages total
├── apps/                     # optional demo / admin / docs apps
│
├── starters/                 # scaffold-ready starting structures (consumed by packages/templates)
├── references/               # doctrine + learning notes (engineering handbook)
├── snippets/                 # small reusable code/config atoms
├── configs/                  # canonical drop-in tool configs (eslint/prettier/tsconfig/etc.)
├── checklists/               # repeatable verification lists
├── playbooks/                # operating procedures
├── examples/                 # completed working examples of packages composing
├── prompts/                  # reusable LLM/agent instructions
├── standards/                # mandatory conventions NekoStack itself follows
├── decisions/                # ADR records (the docs; runtime engine is packages/decision)
├── manifests/                # machine-readable indexes for tools/agents
├── schemas/                  # cross-cutting schema sources
└── docs/                     # cross-cutting design docs
```

Asset folders shard by tooling/domain at the first level (`references/node/`, `starters/react/`, `checklists/release/`). See [`ARTIFACTS.md`](ARTIFACTS.md) for the full taxonomy, decision rules, and the package-vs-artifact rule.

> Note: `packages/templates` is the **template engine** (code). Starter content lives in `starters/`. The two are not the same thing — see ARTIFACTS.md for the distinction.

## Package index

Each package has its own README documenting purpose, scope, competitors, design philosophy, architecture sketch, roadmap, and product potential. The list below groups them by build tier — the order in which they're likely to be useful, not the order they must be built.

For the **canonical "which package owns which capability"** map, see [`BOUNDARIES.md`](BOUNDARIES.md). Per-package READMEs restate the relevant rows from BOUNDARIES.md in their own `Boundary` section; if they disagree, BOUNDARIES.md wins.

> **Published on npm (v1.0+):** `@nekostack/schema`, `@nekostack/cli`, `@nekostack/migrate-runner`, `@nekostack/theme`, `@nekostack/ui`, `@nekostack/lint` — plus the `nekostack` metapackage. Everything else in the index below is **planned but not yet published**.

### Meta / control plane (the layer that organizes the rest)
- [@nekostack/path](packages/path/README.md) — Portfolio + roadmap + active-work + next-action resolver
- [@nekostack/governance](packages/governance/README.md) — Policy rules, lifecycle gates, definition-of-done, LLM behavior constraints
- [@nekostack/workspace](packages/workspace/README.md) — Multi-project context, repo discovery, package dependency graph
- [@nekostack/decision](packages/decision/README.md) — Architectural + product decision records (ADRs)
- [@nekostack/review](packages/review/README.md) — Review request lifecycle, approval state, follow-up tracking
- [@nekostack/session](packages/session/README.md) — Dev session records, handoff summaries, resume-context
- [@nekostack/registry](packages/registry/README.md) — Package metadata + canonical resource lookup + capability-to-package map

### Foundation primitives (build early, used by almost everything else)
- [@nekostack/schema](packages/schema/README.md) — Define types once, generate Zod validators + JSON Schema + OpenAPI + TS types
- [@nekostack/cli](packages/cli/README.md) — Unified command-line tool for scaffolding, validation, code generation
- [@nekostack/config](packages/config/README.md) — Runtime config validation, env schema, secrets separation
- [@nekostack/env](packages/env/README.md) — Dev environment bootstrap: devcontainers, docker-compose patterns
- [@nekostack/lint](packages/lint/README.md) — Custom ESLint rules enforcing NekoStack architectural conventions
- [@nekostack/test](packages/test/README.md) — Test factories, deterministic seeds, golden files, snapshot UX

### Force multipliers (high-leverage, broadly applicable)
- [@nekostack/codex](packages/codex/README.md) — Entity graph + content registry with typed relationships
- [@nekostack/rules](packages/rules/README.md) — Deterministic rule engine with trigger ordering and replay
- [@nekostack/auth](packages/auth/README.md) — Tenant + role + permission + entitlement policy layer
- [@nekostack/telemetry](packages/telemetry/README.md) — Event schema, ingestion, time-series query
- [@nekostack/api](packages/api/README.md) — Contract-first API: define once, generate server + clients + docs
- [@nekostack/ui](packages/ui/README.md) — Component library + design system primitives

### Identity / access (lifted out of auth)
- [@nekostack/tenant](packages/tenant/README.md) — Tenant identity, lifecycle, isolation patterns (distinct from auth)
- [@nekostack/permissions](packages/permissions/README.md) — Permission catalog, role definitions, RBAC/ABAC primitives
- [@nekostack/secrets](packages/secrets/README.md) — Secret loading, masking, rotation, leak detection

### Project unblockers (specific products need these now)
- [@nekostack/realtime](packages/realtime/README.md) — WebSocket / SSE / sync layer for multiplayer + live UI
- [@nekostack/assets](packages/assets/README.md) — Game asset pipeline: sprites, atlases, hot-reload
- [@nekostack/search](packages/search/README.md) — Full-text + faceted + fuzzy search
- [@nekostack/form](packages/form/README.md) — Declarative form schema + state + validation

### SaaS layer
- [@nekostack/entitlements](packages/entitlements/README.md) — Plans, feature gating, usage metering
- [@nekostack/billing](packages/billing/README.md) — Stripe integration, invoicing, subscription lifecycle
- [@nekostack/export](packages/export/README.md) — Versioned data export, GDPR DSAR
- [@nekostack/import](packages/import/README.md) — Symmetric import: validation, migration, conflict resolution
- [@nekostack/admin](packages/admin/README.md) — Admin dashboard starter
- [@nekostack/flags](packages/flags/README.md) — Feature flags (rollout/AB-test, separate from entitlements)
- [@nekostack/notify](packages/notify/README.md) — Unified notification routing (email + push + in-app + SMS)
- [@nekostack/email](packages/email/README.md) — Email-specific: templates, deliverability, bounce handling
- [@nekostack/audit](packages/audit/README.md) — Tamper-evident audit log infrastructure
- [@nekostack/webhooks](packages/webhooks/README.md) — Webhook receiver + dispatcher with verification

### Compliance / data governance
- [@nekostack/compliance](packages/compliance/README.md) — GDPR/HIPAA/SOC2 profiles, evidence, retention, consent
- [@nekostack/backup](packages/backup/README.md) — Backup creation, restore points, point-in-time recovery

### Background processing
- [@nekostack/queue](packages/queue/README.md) — Job queue substrate (retries, DLQ, dedup, locking, priority)
- [@nekostack/jobs](packages/jobs/README.md) — Scheduled + ad-hoc job execution (uses queue)
- [@nekostack/flow](packages/flow/README.md) — Long-running stateful workflow orchestration
- [@nekostack/time](packages/time/README.md) — Date/RRULE/calendar/cadence primitives

### Data layer
- [@nekostack/events](packages/events/README.md) — Event sourcing / CQRS scaffolding
- [@nekostack/cache](packages/cache/README.md) — Declarative multi-layer caching
- [@nekostack/migrate](packages/migrate/README.md) — Schema + data migrations with rollback
- [@nekostack/migrate-runner](packages/migrate-runner/README.md) — Executes authored schema-data migrations against real records (downstream of migrate)
- [@nekostack/storage](packages/storage/README.md) — File upload + object storage abstraction
- [@nekostack/fetch](packages/fetch/README.md) — Typed HTTP client with retry / circuit-breaker

### Security
- [@nekostack/secure](packages/secure/README.md) — Security headers, CSRF, CORS, redaction
- [@nekostack/limits](packages/limits/README.md) — Rate limiting + abuse detection
- [@nekostack/crypto](packages/crypto/README.md) — Safe encryption-usage patterns (wraps libsodium etc.)

### Observability
- [@nekostack/log](packages/log/README.md) — Structured logger (distinct from telemetry/audit/trace)
- [@nekostack/metrics](packages/metrics/README.md) — Counter/gauge/histogram primitives + SLO definitions
- [@nekostack/errors](packages/errors/README.md) — Error tracking, grouping, alerting
- [@nekostack/health](packages/health/README.md) — Health probes + readiness/liveness
- [@nekostack/trace](packages/trace/README.md) — Distributed tracing (OpenTelemetry-compatible)
- [@nekostack/bench](packages/bench/README.md) — Performance benchmarking + regression detection

### Game systems
- [@nekostack/sim](packages/sim/README.md) — Simulation runner (tick-based + event-based)
- [@nekostack/ai](packages/ai/README.md) — Game AI primitives: FSM, behavior trees, GOAP, utility AI
- [@nekostack/pathfinding](packages/pathfinding/README.md) — A*, navmesh, jump-point search
- [@nekostack/procgen](packages/procgen/README.md) — Procedural generation: noise, WFC, dungeon gen
- [@nekostack/tilemap](packages/tilemap/README.md) — Tile-based world rendering
- [@nekostack/replay](packages/replay/README.md) — Deterministic replay from seed + actions
- [@nekostack/saves](packages/saves/README.md) — Versioned save data + cloud sync + migration
- [@nekostack/input](packages/input/README.md) — Input abstraction: keyboard, mouse, gamepad, touch
- [@nekostack/audio](packages/audio/README.md) — Audio engine: sprites, music, ducking, a11y
- [@nekostack/economy](packages/economy/README.md) — In-game currency design + sink/source modeling
- [@nekostack/progression](packages/progression/README.md) — Unlock graphs, leveling curves, skill trees

### Frontend depth
- [@nekostack/theme](packages/theme/README.md) — Theming, dark mode, a11y variants
- [@nekostack/motion](packages/motion/README.md) — Animation + transition primitives
- [@nekostack/editor](packages/editor/README.md) — Rich text editor (ProseMirror-based)
- [@nekostack/chart](packages/chart/README.md) — Charting / data visualization
- [@nekostack/table](packages/table/README.md) — Data grid: sort / filter / virtualize / edit
- [@nekostack/map](packages/map/README.md) — Spatial UI / pan-zoom / map rendering
- [@nekostack/canvas](packages/canvas/README.md) — Canvas 2D primitives + scene management
- [@nekostack/icons](packages/icons/README.md) — Icon system + SVG sprite pipeline
- [@nekostack/md](packages/md/README.md) — Markdown processing with custom plugins
- [@nekostack/a11y](packages/a11y/README.md) — Accessibility utilities: focus, keyboard, ARIA, contrast

### AI / LLM
- [@nekostack/prompts](packages/prompts/README.md) — Prompt template management + versioning + provider abstraction
- [@nekostack/rag](packages/rag/README.md) — Retrieval-augmented generation infrastructure
- [@nekostack/eval](packages/eval/README.md) — LLM evaluation framework
- [@nekostack/tools](packages/tools/README.md) — Agent function/tool registry
- [@nekostack/memory](packages/memory/README.md) — Agent conversation memory + persistence
- [@nekostack/chat](packages/chat/README.md) — Chat interface infrastructure

### LLM-workflow safety
- [@nekostack/sandbox](packages/sandbox/README.md) — Sandboxed command/script execution for agent tool calls
- [@nekostack/changeset](packages/changeset/README.md) — Dry-run / plan-apply / patch / rollback for LLM-driven edits
- [@nekostack/provenance](packages/provenance/README.md) — Generated-artifact lineage, prompt-to-output trace

### Content / narrative
- [@nekostack/cms](packages/cms/README.md) — Headless content management
- [@nekostack/wiki](packages/wiki/README.md) — Wiki engine for game lore / agent knowledge
- [@nekostack/story](packages/story/README.md) — Branching dialog + narrative scripting
- [@nekostack/validator](packages/validator/README.md) — Cross-reference + continuity validation
- [@nekostack/media](packages/media/README.md) — Image processing: resize, format, responsive
- [@nekostack/taxonomy](packages/taxonomy/README.md) — Tags, categories, hierarchies, aliases

### Utility primitives
- [@nekostack/id](packages/id/README.md) — ID generation (UUID/ULID/nanoid/branded/deterministic/slug)
- [@nekostack/random](packages/random/README.md) — Deterministic PRNG, seeded streams, weighted random, shuffle bags
- [@nekostack/math](packages/math/README.md) — Curves, probability tables, interpolation, statistics
- [@nekostack/graph](packages/graph/README.md) — Generic graph primitives (DAG, traversal, cycle detection, topo sort)
- [@nekostack/actions](packages/actions/README.md) — Unified action/command registry across CLI + UI + agents

### Cross-platform / shell
- [@nekostack/shell](packages/shell/README.md) — Tauri/Electron native wrapper patterns
- [@nekostack/pwa](packages/pwa/README.md) — Progressive Web App infrastructure
- [@nekostack/offline](packages/offline/README.md) — Offline-first + sync + conflict resolution

### Testing depth
- [@nekostack/fuzz](packages/fuzz/README.md) — Property-based / fuzz testing
- [@nekostack/mock](packages/mock/README.md) — Service mocking patterns

### Ops
- [@nekostack/deploy](packages/deploy/README.md) — CI/CD recipes + infra-as-code templates
- [@nekostack/locale](packages/locale/README.md) — i18n / translation infrastructure

### Documentation / scaffolding
- [@nekostack/docs](packages/docs/README.md) — Documentation site generator from schemas
- [@nekostack/templates](packages/templates/README.md) — `create-neko` project starters
- [@nekostack/seed](packages/seed/README.md) — Seed data + fixtures + demo content

## Consuming projects

NekoStack packages are consumed by these sibling projects:
- **NekoVibe** — Daily puzzle hub (Turbo monorepo)
- **NekoBattler** — Auto-battler
- **NekoGacha** — Gacha collection game
- **Leytide** — Browser MMORPG
- **NekoSystems** — Multi-tenant Business-OS SaaS (enterprise tier of NekoPlatform). *Note: the repo currently contains CrewAI-based planning/R&D tooling — that's the workspace state, not the product.*
- **NekoLite** — Multi-tenant Business-OS SaaS (SMB / lightweight tier of NekoPlatform)
- **NekoLife** — Personal Life Bootcamp Framework
- **NekoLabs** — Dev tools web app
- **Mara Kane** — 20-book narrative series

Each project imports specific NekoStack packages as needed. There is no requirement that every project use every package.

## Design philosophy

1. **Schema-first**. Where a schema can be the source of truth, it is. Types, validators, docs, and clients are generated from schemas — not duplicated.
2. **Composable, not configurable**. Packages expose small composable primitives over kitchen-sink configuration objects.
3. **Honest about what's hard**. Where the wheel is genuinely round (crypto primitives, the React runtime, the V8 engine), we wrap or defer. Where the wheel is uniquely shaped to our projects, we build.
4. **Replay-friendly**. Anything that produces state from inputs should be deterministic given the same seed + inputs. Rules engines, sims, content generators all share this discipline.
5. **Observability is not optional**. Every meaningful system action emits a typed event. Audit and telemetry are built in, not bolted on.
6. **Solo-friendly**. Build configurations, defaults, and error messages assume one human, not a team. Where teams optimize for blast-radius isolation, we optimize for legibility on return after weeks away.

## Status

- **Stage:** Five packages are published to npm at **v1.0**, with 2,364 passing tests between them:
  - [**@nekostack/schema**](https://www.npmjs.com/package/@nekostack/schema) — `schema-v1.0.0`, public API frozen, 1,294 tests.
  - [**@nekostack/migrate-runner**](https://www.npmjs.com/package/@nekostack/migrate-runner) — `migrate-runner-v1.0.0`, 405 tests.
  - [**@nekostack/cli**](https://www.npmjs.com/package/@nekostack/cli) — `cli-v1.0.1`, the `neko` command, 504 tests.
  - [**@nekostack/theme**](https://www.npmjs.com/package/@nekostack/theme) — `theme-v1.0.0`, W3C DTCG token pipeline, 78 tests.
  - [**@nekostack/ui**](https://www.npmjs.com/package/@nekostack/ui) — `ui-v1.0.1`, 92-component vanilla CSS library, 83 tests.
  - The [**nekostack**](https://www.npmjs.com/package/nekostack) metapackage bundles all five. The remaining ~103 packages are scaffolded stubs with substantive READMEs but no implementation yet.
- **Canonical status:** [`manifests/workspace-status.json`](manifests/workspace-status.json) is the machine-readable source of truth for release tags, active workstream, and per-package test counts. Regenerate it with `npm run status:generate` (and verify with `npm run status:check`) — do not hand-edit it.
- **Owner:** Cody — solo developer.
- **Versioning policy:** Per-package semver with independent release tags (e.g. `schema-v1.0.0`). The `nekostack` metapackage pins compatible versions of the published set.
- **License:** **Apache-2.0** for all published packages. Unpublished scaffold packages document their intended license posture in their own README.

## How to contribute

This is a solo project. There is no external contribution flow at this stage. If you've been pointed at this repo to look at a specific package, see that package's README.
