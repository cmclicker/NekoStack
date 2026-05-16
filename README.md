# NekoStack

> A hand-crafted, opinionated full-stack utility suite covering schema, contracts, auth, telemetry, UI, game systems, AI tooling, and everything between.

NekoStack is **not** a folder template, a boilerplate, or a Bash script generator. It is a working, documented, tested system kit that products and games build on top of.

## What this is

A monorepo of ~80 packages spanning every layer a full-stack solo developer needs to build games (NekoBattler, NekoGacha, Leytide), SaaS products (NekoSystems, NekoVibe, retail-ops simulators, EdTech), narrative tools (Mara Kane lore graphs, continuity validators), and AI agent runtimes — without renting infrastructure from a dozen third-party vendors.

Each package is its own product surface. Each one is opinionated, schema-first where possible, designed for the specific shape of the projects that consume it. Where third-party tools cover similar territory (Auth.js, Zod, Sentry, Prisma, Refine, etc.), each NekoStack package explicitly documents what it does differently and why.

## What this is not

- A side project that exists for its own sake. Every package is built because at least one product consumes it.
- A general-purpose framework. NekoStack is opinionated. Things that fall outside its design philosophy are intentionally out of scope.
- A replacement for security-critical primitives (bcrypt, OAuth protocol internals, JWT signing crypto, TLS). Where touching cryptography directly is dangerous, NekoStack wraps battle-tested libraries and owns only the policy/composition layer above.
- A 1.0 release. This is a long-horizon working stack.

## Why a monorepo

Most of these packages reference each other:
- `@nekostack/api` imports `@nekostack/schema`
- `@nekostack/cli` orchestrates code-gen against `@nekostack/schema` and `@nekostack/codex`
- `@nekostack/auth` emits events to `@nekostack/telemetry`
- `@nekostack/ui` consumes `@nekostack/theme`, `@nekostack/icons`, `@nekostack/motion`

Separate repos would mean version-juggling, dependency hell, and broken atomic refactors across the stack. A single monorepo with locked-step versioning is the right shape for this kind of system kit. Turborepo handles incremental builds; npm workspaces handle dependency resolution.

Individual packages can still be published to npm as standalone products. Monorepo and publish-as-library are not in tension.

## Layout

```
NekoStack/
├── package.json              # workspaces config
├── turbo.json                # turbo task graph
├── tsconfig.base.json        # shared TS config
├── packages/
│   ├── schema/               # @nekostack/schema
│   ├── cli/                  # @nekostack/cli
│   ├── codex/                # @nekostack/codex
│   ├── rules/                # @nekostack/rules
│   ├── auth/                 # @nekostack/auth
│   ├── telemetry/            # @nekostack/telemetry
│   ├── ui/                   # @nekostack/ui
│   └── ...                   # ~80 packages total
├── apps/                     # optional demo / admin / docs apps
└── docs/                     # cross-cutting design docs
```

## Package index

Each package has its own README documenting purpose, scope, competitors, design philosophy, architecture sketch, roadmap, and product potential. The list below groups them by build tier — the order in which they're likely to be useful, not the order they must be built.

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

### Project unblockers (specific products need these now)
- [@nekostack/realtime](packages/realtime/README.md) — WebSocket / SSE / sync layer for multiplayer + live UI
- [@nekostack/assets](packages/assets/README.md) — Game asset pipeline: sprites, atlases, hot-reload
- [@nekostack/search](packages/search/README.md) — Full-text + faceted + fuzzy search
- [@nekostack/form](packages/form/README.md) — Declarative form schema + state + validation

### SaaS layer
- [@nekostack/entitlements](packages/entitlements/README.md) — Plans, feature gating, usage metering
- [@nekostack/billing](packages/billing/README.md) — Stripe integration, invoicing, subscription lifecycle
- [@nekostack/export](packages/export/README.md) — Versioned data export, GDPR DSAR, import validation
- [@nekostack/admin](packages/admin/README.md) — Admin dashboard starter
- [@nekostack/flags](packages/flags/README.md) — Feature flags (rollout/AB-test, separate from entitlements)
- [@nekostack/notify](packages/notify/README.md) — Unified notification routing (email + push + in-app + SMS)
- [@nekostack/email](packages/email/README.md) — Email-specific: templates, deliverability, bounce handling
- [@nekostack/audit](packages/audit/README.md) — Tamper-evident audit log infrastructure
- [@nekostack/webhooks](packages/webhooks/README.md) — Webhook receiver + dispatcher with verification

### Background processing
- [@nekostack/jobs](packages/jobs/README.md) — Background job queue + scheduler
- [@nekostack/flow](packages/flow/README.md) — Long-running workflow orchestration

### Data layer
- [@nekostack/events](packages/events/README.md) — Event sourcing / CQRS scaffolding
- [@nekostack/cache](packages/cache/README.md) — Declarative multi-layer caching
- [@nekostack/migrate](packages/migrate/README.md) — Schema + data migrations with rollback
- [@nekostack/storage](packages/storage/README.md) — File upload + object storage abstraction
- [@nekostack/fetch](packages/fetch/README.md) — Typed HTTP client with retry / circuit-breaker

### Security
- [@nekostack/secure](packages/secure/README.md) — Security headers, CSRF, CORS middleware
- [@nekostack/limits](packages/limits/README.md) — Rate limiting + abuse detection
- [@nekostack/crypto](packages/crypto/README.md) — Safe encryption-usage patterns

### Observability
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

### AI / LLM
- [@nekostack/prompts](packages/prompts/README.md) — Prompt template management + versioning
- [@nekostack/rag](packages/rag/README.md) — Retrieval-augmented generation infrastructure
- [@nekostack/eval](packages/eval/README.md) — LLM evaluation framework
- [@nekostack/tools](packages/tools/README.md) — Agent function/tool registry
- [@nekostack/memory](packages/memory/README.md) — Agent conversation memory + persistence
- [@nekostack/chat](packages/chat/README.md) — Chat interface infrastructure

### Content / narrative
- [@nekostack/cms](packages/cms/README.md) — Headless content management
- [@nekostack/wiki](packages/wiki/README.md) — Wiki engine for game lore / agent knowledge
- [@nekostack/story](packages/story/README.md) — Branching dialog + narrative scripting
- [@nekostack/validator](packages/validator/README.md) — Cross-reference + continuity validation
- [@nekostack/media](packages/media/README.md) — Image processing: resize, format, responsive

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
- **NekoSystems** — CrewAI agent command center
- **NekoLite** — Lightweight SaaS sibling
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

- **Stage:** Bootstrap. Packages scaffolded with substantive READMEs. No implementation yet.
- **Owner:** Cody — solo developer.
- **Versioning policy:** TBD. Likely locked-step across the monorepo until any individual package goes 1.0 for public release.
- **License:** TBD. Each package documents its intended license posture (internal-only, MIT open-source, commercial-with-source-available, etc.) in its own README.

## How to contribute

This is a solo project. There is no external contribution flow at this stage. If you've been pointed at this repo to look at a specific package, see that package's README.
