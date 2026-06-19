# NekoStack — Capability Boundaries

> The canonical map of "which package owns which capability." Read this **first** before adding a new package, splitting an existing one, or wondering where a thing should live.
>
> For *why* a capability belongs to NekoStack at all (rather than being left to an external library the user composes themselves), see [`PRODUCT_THESIS.md`](PRODUCT_THESIS.md). This document answers *where*; the thesis answers *whether*.

## Purpose

`BOUNDARIES.md` is the cross-cutting view of the stack that no single package README can produce. It exists because per-package READMEs are *locally* coherent but *globally* incomplete — they describe what a package does, not what *should exist somewhere* and where that "somewhere" is.

This document is organized **by capability**, not by package. Each capability has exactly one owning package (or, in a small number of cases, a clearly-declared sub-ownership where two packages cooperate). When a row has no owner, that is a **visible gap** and must be resolved before the stack can be called complete.

## Scope

This document governs `packages/` only — code that runs, validates, transforms, renders, or exposes an API. It does **not** govern the reusable asset layer (`references/`, `starters/`, `snippets/`, `checklists/`, `configs/`, `playbooks/`, `examples/`, `prompts/`, `standards/`, `decisions/`, `manifests/`). That layer has its own taxonomy in [`ARTIFACTS.md`](ARTIFACTS.md).

The two documents are siblings, not parent/child. If you are unsure whether a thing belongs in a package or an asset folder, the rule is: **if it runs, BOUNDARIES wins; otherwise, ARTIFACTS wins.** See `ARTIFACTS.md` for the full decision flow.

## How to use this document

- **Adding a new package?** Find the capabilities it owns here. If those capabilities already have an owner, you have a conflict to resolve before proceeding. If a new package's capabilities are already absorbed into an existing one's table, the new package shouldn't exist.
- **Splitting a package?** Update this document first. Move the affected rows to the new owner. Then update the affected README's `Boundary` section. Then update consumers.
- **Auditing for gaps?** Look for `TBD` in the Owner column. Look for capabilities that "feel" like they should have an owner but aren't listed — that's a missing row, which is also a gap.
- **Writing a package README?** The README's `## Boundary` section restates the relevant rows from this document. If they disagree, this document wins; the README is wrong.

## Conventions

- **Owner** = the single package that implements the capability. Multi-owner is rare and explicitly flagged.
- **`(input from X)`** = the capability is composed from inputs supplied by package X. The owner still owns the *composition*; X owns the *input shape*.
- **`(sink to X)`** = the capability emits events/data to package X for storage/persistence.
- **Game-specific capabilities** (combat, inventory, cards, quests, dialogue, gacha mechanics, etc.) live **inside specific games** (NekoBattler, NekoGacha, Leytide), not in the stack. They are not listed here. The stack provides reusable substrates (`@nekostack/rules`, `@nekostack/sim`, `@nekostack/economy`, etc.); games compose them.
- **Naming clarification**: `@nekostack/ai` is **game AI** (FSM, behavior trees, GOAP, utility AI). LLM provider abstraction and prompt orchestration live in `@nekostack/prompts`, `@nekostack/tools`, `@nekostack/chat`, `@nekostack/rag`, `@nekostack/eval`, and `@nekostack/memory`.

---

## Package inventory

107 packages total. The 27 new packages introduced by this boundary work are marked **NEW**.

| Status | Count | Notes |
|---|---|---|
| Original packages | 80 | From initial NekoStack bootstrap |
| New packages | 27 | Added to fill gaps identified by capability audit |
| Game-specific (not in stack) | n/a | Combat, inventory, cards, quests, etc. live in individual game projects |

### New packages added

**Meta / control plane (7):** `path`, `governance`, `workspace`, `decision`, `review`, `session`, `registry`

**Buried splits lifted out (6):** `tenant`, `permissions`, `log`, `secrets`, `queue`, `metrics`

**Missing utilities (8):** `a11y`, `taxonomy`, `id`, `random`, `math`, `graph`, `time`, `actions`

**LLM-workflow (3):** `sandbox`, `changeset`, `provenance`

**Symmetry / completeness (3):** `import`, `backup`, `compliance`

---

## 1. Project portfolio / control plane

The meta-layer that tracks what's being built across the whole portfolio.

| Capability | Owner | Notes |
|---|---|---|
| Project registry (what projects exist) | `path` | NEW |
| Active vs paused vs archived state per project | `path` | NEW |
| Cross-project dependencies | `path` | NEW |
| Roadmap milestones per project | `path` | NEW |
| Idea brainstorm queue | `path` | NEW |
| Idea promotion to project | `path` | NEW |
| Task decomposition | `path` | NEW |
| Project maturity lifecycle | `path` | NEW (uses `lifecycle` semantics — owned here) |
| Requirements / acceptance criteria per work item | `path` | NEW — folded in, not a separate package |
| Next-action resolver ("what should I work on?") | `path` | NEW |
| Project dormancy / archive / resurrection workflow | `path` | NEW |
| Backlog normalization | `path` | NEW |
| WIP boundaries (what's being touched) | `path` | NEW |
| Cross-project roadmap view (the dashboard) | `path` | NEW |

## 2. Workspace context

"Where am I, what's around me, what's the local project state?"

| Capability | Owner | Notes |
|---|---|---|
| Workspace model (which project is active) | `workspace` | NEW |
| Repo discovery (local map of where projects live) | `workspace` | NEW |
| Project root detection | `workspace` | NEW |
| Workspace switching | `workspace` | NEW |
| Local path aliases | `workspace` | NEW |
| Multi-package monorepo map | `workspace` | NEW |
| Git status reading per project | `workspace` | NEW |
| Repo health summary | `workspace` | NEW |
| Project metadata manifest | `workspace` | NEW |
| Dirty-repo state adapter | `workspace` | NEW |
| Package dependency graph (intra-monorepo) | `workspace` | NEW (uses `graph` substrate) |
| Package boundary enforcement | `lint` | enforces; `workspace` provides graph |
| Multi-project dashboard data (feeds `path` UI) | `workspace` | NEW |

## 3. Governance / process

Policy rules. What "acceptable" means.

| Capability | Owner | Notes |
|---|---|---|
| Governance rule definitions | `governance` | NEW |
| Operating policy declarations | `governance` | NEW |
| Lifecycle gate definitions (draft → review → done) | `governance` | NEW |
| Definition-of-done per artifact type | `governance` | NEW |
| Acceptance criteria templates | `governance` | NEW |
| Forbidden actions / kill-switches | `governance` | NEW |
| Rule waivers / override workflow | `governance` | NEW |
| LLM behavior constraints (must-read-before-write, no-placeholders) | `governance` | NEW (encoded in prompts via `prompts`) |
| Enforcement profiles (strict/relaxed/per-project) | `governance` | NEW |
| Compliance mode profiles (GDPR/HIPAA/SOC2) | `compliance` | NEW; cooperates with `governance` |
| Required-review gate registration | `governance` | NEW (consumed by `review`) |
| Architectural-pattern enforcement (runtime gates) | `governance` | NEW (vs `lint` which is static) |
| Lint rule authoring | `lint` | already exists |

## 4. Decision records

ADRs and product decisions over time.

| Capability | Owner | Notes |
|---|---|---|
| Architectural decision records (ADRs) | `decision` | NEW |
| Product decision records | `decision` | NEW |
| Decision dependency graph | `decision` | NEW (uses `graph`) |
| Decision rationale preservation | `decision` | NEW |
| Decision reversal / supersession tracking | `decision` | NEW |
| Decision review-date scheduling | `decision` | NEW (uses `time`) |
| Decision provenance | `decision` | NEW (links to `provenance`) |
| "Why not the alternative?" tracking | `decision` | NEW |

## 5. Review / approval state

Tracking who reviewed what and what came of it.

| Capability | Owner | Notes |
|---|---|---|
| Review request lifecycle | `review` | NEW |
| Approval / rejection state | `review` | NEW |
| Rework loops | `review` | NEW |
| Reviewer notes | `review` | NEW |
| Acceptance evidence | `review` | NEW |
| "Needs human review before proceeding" markers | `review` | NEW |
| Stale-review detection | `review` | NEW |
| Unresolved feedback tracker | `review` | NEW |
| LLM self-review output capture | `review` | NEW |
| Code review comments (general) | `comments` | TBD — not in this round; folded into `review` for now |

## 6. Session / handoff

Dev session state across context switches and LLM session boundaries.

| Capability | Owner | Notes |
|---|---|---|
| Dev session records | `session` | NEW |
| Session goal capture | `session` | NEW |
| Files-touched summary | `session` | NEW |
| Decisions-made-in-session log | `session` | NEW |
| Next-steps capture | `session` | NEW |
| Blockers capture | `session` | NEW |
| Resume-context bundle (for picking back up) | `session` | NEW |
| Session-to-roadmap linkage | `session` | NEW (connects to `path`) |
| Project cooldown / parked-work resolver | `session` | NEW |
| "What was I doing?" resolver | `session` | NEW |

## 7. Schema / types

Single source of truth for shape definitions.

| Capability | Owner | Notes |
|---|---|---|
| Schema DSL (object/array/union/etc.) | `schema` | |
| TypeScript type inference from schemas | `schema` | |
| Zod validator generation | `schema` | |
| JSON Schema generation | `schema` | |
| OpenAPI component generation | `schema` | |
| Schema versioning | `schema` | |
| Local schema registry (id + version lookup, in-process) | `schema` | v0.7+ — `buildRegistry`, `findSchema`; pure data-in/data-out; exposed via `@nekostack/schema/cli` subpath |
| Schema diff classification (breaking / additive / cosmetic) | `schema` | v0.7+ — `diffNodes` + `worstSeverity` aggregation; pure |
| Generated-artifact freshness verdict (two-hash matrix) | `schema` | v0.7+ — `checkHandler` + `parseProvenanceFromText`; pure classifier. CLI owns the filesystem reads that feed it. |
| Generation planning (emit-ready artifact payloads + suggested paths) | `schema` | v0.7+ — `generateHandler`. Pure. The CLI writes the files. |
| Schema-data migration **planning / verification / stub generation** (pure primitives + four handlers) | `schema` | v0.8 (in progress; [PR #28](https://github.com/cmclicker/NekoStack/pull/28)) — `parseMigrationProvenanceFromText`, `buildMigrationRegistry`, `planMigration`, `verifyMigrationProvenance`, `stubMigration`, four pure handlers. Exposed via `@nekostack/schema/cli` subpath; never executes `transform`. Contract: [`packages/schema/docs/MIGRATIONS.md`](packages/schema/docs/MIGRATIONS.md). |
| Schema-data migration **execution** (running a migration's `transform(input)` over real data) | `migrate-runner` | NEW (v0.9) — Downstream orchestrator that invokes `transform` per record; pure validation sandwich. |
| `neko schema migrate *` CLI verbs (`list` / `plan` / `verify` / `stub`) | `cli` | v0.8 (in progress) — owns migration-file walking, dynamic loading via `tsx`, stdout/stderr formatting, exit codes. Consumes the pure migration primitives via `@nekostack/schema/cli`. |
| Database / DDL migration execution | `migrate` | Data-level / DDL migrations (works with `schema`); completely separate from `@nekostack/schema`'s schema-data migration *planning* surface. |
| Branded IDs / typed identifiers | `id` | NEW; uses `schema` as substrate |
| Cross-package shared type contracts | `schema` | |
| Runtime validation execution | `schema` | (via `@nekostack/schema` runtime — `parse` / `safeParse` / `validate`; Zod is the internal engine, not part of the consumer surface) |
| Runtime issue normalization (Zod issues → `Issue[]`) | `schema` | v0.6+ — consumer-facing error contract; downstream packages depend on the stable `IssueCode` vocabulary |
| `ParseError` (thrown by `parse`) | `schema` | v0.6+ — `code = "parse_failed"`, frozen `issues: readonly Issue[]` |
| `neko schema *` CLI commands (`list` / `diff` / `check` / `generate`) | `cli` | v0.7 — owns filesystem discovery, dynamic schema loading via `tsx`, stdout/stderr formatting, exit codes. Consumes the pure registry primitives via `@nekostack/schema/cli`. |
| Form input validation (UI side) | `form` | consumes `schema` |
| Server-side request body validation | `api` | consumes `schema` |
| Content-shape validation (Codex entities, etc.) | `validator` | consumes `schema` |

## 8. Identity / authentication

The login part of auth. Crypto is deferred to providers.

| Capability | Owner | Notes |
|---|---|---|
| Login flow normalization | `auth` | |
| Session shape | `auth` | |
| Provider adapters (Auth.js/Clerk/Supabase/Firebase) | `auth` | |
| AuthContext composition | `auth` | |
| AccessDecision orchestration | `auth` | composes inputs from `permissions`, `entitlements`, `limits` |
| AccessDecision shape | `auth` | typed via `schema` |
| Password hashing | external (bcrypt/argon2 via provider) | |
| OAuth protocol internals | external (provider libs) | |
| JWT signing internals | external (provider libs) | |
| 2FA / passkey crypto | external (provider libs) | |
| User profile + account model | `auth` | folds account/profile in unless they grow |

## 9. Tenant

Multi-tenancy is a first-class concept, lifted out of `auth`.

| Capability | Owner | Notes |
|---|---|---|
| Tenant identity / model | `tenant` | NEW |
| Tenant lifecycle (create/suspend/delete) | `tenant` | NEW |
| Tenant settings | `tenant` | NEW |
| Tenant membership | `tenant` | NEW |
| Tenant isolation patterns | `tenant` | NEW |
| Tenant-scoped ID convention | `tenant` | NEW (works with `id`) |
| Tenant plan binding | `tenant` | NEW (works with `entitlements`) |
| Tenant audit scope | `tenant` | NEW (works with `audit`) |
| Tenant data boundaries / RLS patterns | `tenant` | NEW |

## 10. Permissions / access control

The authorization (not authentication) layer.

| Capability | Owner | Notes |
|---|---|---|
| Permission catalog (typed strings) | `permissions` | NEW |
| Role definitions | `permissions` | NEW |
| Role assignment | `permissions` | NEW |
| Role hierarchy / inheritance | `permissions` | NEW |
| RBAC primitives | `permissions` | NEW |
| ABAC primitives | `permissions` | NEW |
| Resource-level permissions | `permissions` | NEW |
| Permission decision input | `permissions` | NEW (feeds `auth.AccessDecision`) |
| Capability grants (temporary elevation) | `permissions` | NEW |

## 11. Entitlements / commercial gating

Plan-based gating. Distinct from permissions (role-based).

| Capability | Owner | Notes |
|---|---|---|
| Plan definitions | `entitlements` | |
| Feature gates (plan + feature → allow/deny) | `entitlements` | |
| Usage meters (counters with periods) | `entitlements` | |
| Soft / hard limit policies | `entitlements` | |
| Plan migration logic | `entitlements` | |
| Grandfathering | `entitlements` | |
| Upgrade-prompt metadata | `entitlements` | |
| Entitlement decision input | `entitlements` | feeds `auth.AccessDecision` |

## 12. Billing / payments

Money rails. Stripe-integrated.

| Capability | Owner | Notes |
|---|---|---|
| Stripe customer/subscription/price management | `billing` | |
| Stripe webhook reception | `billing` | (uses `webhooks` substrate) |
| Subscription lifecycle (upgrade/cancel/etc.) | `billing` | |
| Invoicing / receipts | `billing` | |
| Refunds / credit notes | `billing` | |
| Tax handling (Stripe Tax) | `billing` | |
| Customer portal redirect | `billing` | |
| Dunning emails | `billing` | (uses `email`) |
| Plan → entitlement state sync | `billing` | drives `entitlements` |
| Reconciliation job (Stripe ↔ local) | `billing` | |

## 13. Rate / abuse limiting

| Capability | Owner | Notes |
|---|---|---|
| Rate limit policies | `limits` | |
| Concurrency limits | `limits` | |
| Burst windows | `limits` | |
| Tenant-specific limits | `limits` | (works with `tenant`) |
| Entitlement-aware limits | `limits` | (works with `entitlements`) |
| Abuse detection | `limits` | |
| Rate-limit denial input | `limits` | feeds `auth.AccessDecision` |

## 14. Notifications / comms

| Capability | Owner | Notes |
|---|---|---|
| Multi-channel notification routing | `notify` | |
| Per-user channel preferences | `notify` | |
| In-app notification center / inbox | `notify` | (folds in feed/inbox concept) |
| Notification batching / digesting | `notify` | |
| Email templating | `email` | |
| Email deliverability + bounce handling | `email` | |
| Email send (via Resend or similar) | `email` | |
| Push notifications (Web Push) | `notify` | (push channel sub-module) |
| SMS (when needed) | `notify` | (sms channel sub-module, TBD) |
| Chat infrastructure (conversation UI) | `chat` | distinct from `notify` |

## 15. Structured logging

Distinct from telemetry, audit, and trace.

| Capability | Owner | Notes |
|---|---|---|
| Structured logger interface | `log` | NEW |
| Log levels (trace/debug/info/warn/error/fatal) | `log` | NEW |
| Log formatting (pretty + JSON) | `log` | NEW |
| Tagged / contextual logs | `log` | NEW |
| Redacted logs (PII-safe) | `log` | NEW (uses `secure` redaction) |
| Correlation IDs | `log` | NEW (works with `trace`) |
| Request IDs | `log` | NEW |
| Run IDs (for batch / sim runs) | `log` | NEW |
| Log sinks (console / file / OTLP) | `log` | NEW |
| Log-to-audit bridge | `log` | NEW (some logs are auditable) |
| Log-to-trace correlation | `log` | NEW |

## 16. Telemetry / product analytics

| Capability | Owner | Notes |
|---|---|---|
| Typed event catalog | `telemetry` | |
| Schema-validated event emission | `telemetry` | |
| Per-field PII tagging | `telemetry` | |
| Time-series query | `telemetry` | |
| Time-bucket aggregation | `telemetry` | |
| Sampling (head-based) | `telemetry` | |
| Replay recorded events | `telemetry` | |
| Sinks (SQLite / OTLP / NDJSON / custom) | `telemetry` | |

## 17. Metrics / runtime counters

Distinct from telemetry events.

| Capability | Owner | Notes |
|---|---|---|
| Counter / gauge / histogram primitives | `metrics` | NEW |
| Metric definitions registry | `metrics` | NEW |
| Metric aggregation | `metrics` | NEW |
| Metric exporters (Prometheus / StatsD / OTLP) | `metrics` | NEW |
| Per-tenant metrics scoping | `metrics` | NEW |
| KPI / SLO definitions | `metrics` | NEW |

## 18. Distributed tracing

| Capability | Owner | Notes |
|---|---|---|
| Span creation | `trace` | |
| Trace propagation across services | `trace` | |
| Span baggage | `trace` | |
| Sampling (tail-based) | `trace` | |
| OTLP export | `trace` | |
| Trace ↔ log correlation | `trace` | (works with `log`) |

## 19. Errors

| Capability | Owner | Notes |
|---|---|---|
| Typed error classes / codes | `errors` | |
| Error grouping / deduplication | `errors` | |
| Error alerting | `errors` | |
| User-safe vs internal error messages | `errors` | |
| Retryability classification | `errors` | |
| Remediation hints | `errors` | |

## 20. Health

| Capability | Owner | Notes |
|---|---|---|
| Health endpoint shape | `health` | |
| Readiness vs liveness | `health` | |
| Dependency health checks (DB/Redis/etc.) | `health` | |
| Status-page data feed | `health` | |

## 21. Audit

| Capability | Owner | Notes |
|---|---|---|
| Audit event records | `audit` | |
| Append-only log storage | `audit` | |
| Hash-chain tamper evidence | `audit` | |
| Audit query / browse | `audit` | |
| Audit retention policy | `audit` | (works with `compliance`) |
| Decision audit (from `auth`) | `audit` | sink |
| Action audit (from `actions`) | `audit` | sink |
| Plan-change audit (from `billing`) | `audit` | sink |

## 22. Compliance

| Capability | Owner | Notes |
|---|---|---|
| Compliance profile definitions (GDPR/HIPAA/SOC2) | `compliance` | NEW |
| Compliance checklists | `compliance` | NEW |
| Control mapping | `compliance` | NEW |
| Compliance evidence collection | `compliance` | NEW |
| Audit retention requirements | `compliance` | NEW |
| Legal hold | `compliance` | NEW |
| Standards mapping (e.g., ISO/SOC2 controls) | `compliance` | NEW |
| Consent records | `compliance` | NEW (folds consent in for now) |
| Retention policy enforcement | `compliance` | NEW (works with `audit`, `export`) |
| Region / jurisdiction handling | `compliance` | NEW (folds region for now) |

## 23. Privacy / redaction

| Capability | Owner | Notes |
|---|---|---|
| PII detection | `secure` | redaction sub-module |
| Redaction (scrub / hash) | `secure` | redaction sub-module |
| Log redaction | `log` | calls into `secure` |
| Telemetry PII scrub at egress | `telemetry` | calls into `secure` |
| Export redaction rules | `export` | (driven by `compliance`) |
| Right-to-be-forgotten workflows | `compliance` | (works with `export`, `audit`) |

## 24. Storage / persistence

| Capability | Owner | Notes |
|---|---|---|
| File upload abstraction | `storage` | |
| Object storage adapters (S3/local/etc.) | `storage` | |
| Signed URLs | `storage` | |
| Save data (game saves) | `saves` | game-side, distinct from `storage` |
| Cache layer | `cache` | |
| Cache invalidation | `cache` | |
| Multi-layer cache (memory + Redis + CDN) | `cache` | |
| Event sourcing | `events` | |
| CQRS projections | `events` | |
| Event replay | `events` | |
| Offline-first state | `offline` | |
| Offline sync + conflict resolution | `offline` | |
| ORM / data access | external (Prisma/Drizzle/etc.) | NekoStack doesn't ship an ORM |

## 25. Migrations / versioning of data

| Capability | Owner | Notes |
|---|---|---|
| Database schema migrations | `migrate` | |
| Data migrations (row-level transforms) | `migrate` | |
| Migration rollback | `migrate` | |
| Schema-version evolution for content | `schema` | (works with `migrate`) |
| Save-data migration | `saves` | game-side schema evolution |
| Export-archive migration on import | `import` | NEW |

## 26. Backup / recovery

Distinct from export (which is user-facing) and saves (which is per-game).

| Capability | Owner | Notes |
|---|---|---|
| Backup creation | `backup` | NEW |
| Restore points / snapshots | `backup` | NEW |
| Retention policies for backups | `backup` | NEW |
| Disaster recovery procedures | `backup` | NEW |
| Point-in-time recovery | `backup` | NEW |
| Archive creation | `backup` | NEW (cold storage / archived projects) |
| Backup validation / restore-test | `backup` | NEW |

## 27. Export

User / tenant data egress.

| Capability | Owner | Notes |
|---|---|---|
| Per-domain exporter definitions | `export` | |
| GDPR DSAR ("all data for user") | `export` | |
| Streaming output (large datasets) | `export` | |
| Versioned archive format | `export` | |
| Output formats (JSON/NDJSON/CSV/Parquet) | `export` | |
| Tenant-scoped exports | `export` | (works with `tenant`) |
| Export audit | `audit` | sink |

## 28. Import

Symmetric to export.

| Capability | Owner | Notes |
|---|---|---|
| Archive reader | `import` | NEW |
| Schema-validated row-level import | `import` | NEW |
| Conflict resolution on import | `import` | NEW |
| Import migration (vN → vN+1) | `import` | NEW |
| Source adapters (Stripe / external CMS / etc.) | `import` | NEW |
| Import preview / dry-run | `import` | NEW |
| Import rollback | `import` | NEW (works with `changeset`) |

## 29. Search / retrieval (text)

| Capability | Owner | Notes |
|---|---|---|
| Full-text indexing | `search` | |
| Faceted filtering | `search` | |
| Fuzzy matching | `search` | |
| Tokenizers (whitespace/n-gram/stem) | `search` | |
| BM25 ranking | `search` | |
| Snippet generation / highlights | `search` | |

## 30. Retrieval (semantic / vector)

| Capability | Owner | Notes |
|---|---|---|
| Embedding generation | `rag` | |
| Vector index | `rag` | |
| RAG retrieval pipeline | `rag` | |
| Reranking | `rag` | |
| Context pack assembly for LLMs | `rag` | |

## 31. Realtime

| Capability | Owner | Notes |
|---|---|---|
| WebSocket / SSE transport | `realtime` | |
| Typed channels with schema validation | `realtime` | |
| Presence | `realtime` | |
| Reconnect with replay | `realtime` | |
| Backpressure | `realtime` | |
| Pub/sub backplane (Redis/NATS) | `realtime` | |
| CRDT primitives (Yjs adapter) | `realtime` | |
| Per-message authorization | `realtime` | (uses `auth`) |

## 32. API / HTTP

| Capability | Owner | Notes |
|---|---|---|
| Contract-first endpoint definition | `api` | |
| Server adapters (Nest/Express/Fastify/Hono/Next) | `api` | |
| Typed client SDK generation | `api` | |
| OpenAPI 3.1 emission | `api` | |
| API versioning | `api` | |
| Breaking-change diff | `api` | |
| Webhook reception | `webhooks` | |
| Webhook dispatch | `webhooks` | |
| Webhook signature verification | `webhooks` | |
| HTTP client | `fetch` | |
| Retry / backoff / circuit-breaker | `fetch` | |

## 33. Security primitives

| Capability | Owner | Notes |
|---|---|---|
| Cryptographic primitive wrappers | `crypto` | wraps libsodium / Node crypto; doesn't reinvent |
| Encryption helpers (at-rest fields) | `crypto` | |
| Key derivation | `crypto` | |
| Random IDs (when cryptographic) | `crypto` | (vs `id` for non-cryptographic) |
| Security headers (CSP/HSTS/etc.) | `secure` | |
| CSRF protection | `secure` | |
| CORS configuration | `secure` | |
| Input sanitization | `secure` | (works with `schema`) |
| PII detection / redaction | `secure` | (redaction sub-module) |
| Secret loading / parsing | `secrets` | NEW |
| Secret masking in logs | `secrets` | NEW |
| Secret rotation | `secrets` | NEW |
| Secret leak detection | `secrets` | NEW |
| Secret source abstraction (Vault/AWS SM/local) | `secrets` | NEW |
| Env var loading + validation | `env` | (uses `schema`) |

## 34. Background processing

| Capability | Owner | Notes |
|---|---|---|
| Job queue substrate | `queue` | NEW |
| Retries / backoff | `queue` | NEW |
| Dead-letter queue | `queue` | NEW |
| Job deduplication | `queue` | NEW |
| Job locking | `queue` | NEW |
| Job priority | `queue` | NEW |
| Job execution (workers) | `jobs` | uses `queue` as substrate |
| Cron / scheduled jobs | `jobs` | (uses `time` for recurrence) |
| Workflow orchestration | `flow` | long-running, durable |
| State machines | `flow` | |
| Saga / compensation | `flow` | |
| Resumable flows | `flow` | |

## 35. Time

| Capability | Owner | Notes |
|---|---|---|
| Date / time utilities | `time` | NEW |
| Timezone handling (IANA) | `time` | NEW |
| RRULE recurrence | `time` | NEW |
| Calendar event modeling | `time` | NEW |
| Cadence periods (daily/weekly/monthly) | `time` | NEW |
| Due-date / overdue logic | `time` | NEW |
| Reminders | `time` | NEW (notification dispatch is `notify`) |
| Localized daily-reset (e.g., 03:00 local) | `time` | NEW |

## 36. Frontend / UI components

| Capability | Owner | Notes |
|---|---|---|
| Component library + headless primitives | `ui` | |
| Layout primitives (Stack/Grid/Container) | `ui` | layout sub-module |
| Theme tokens | `theme` | |
| Dark mode / a11y variants | `theme` | |
| Animation + transition primitives | `motion` | |
| Rich text editing | `editor` | |
| Charting / data viz | `chart` | |
| Data grids / tables | `table` | |
| Spatial UI / maps | `map` | |
| Canvas 2D scene management | `canvas` | |
| Icon system + SVG sprites | `icons` | |
| Markdown rendering + plugins | `md` | |
| Form state + bindings | `form` | (uses `schema`) |
| Routing / navigation | external (framework: Next.js router, etc.) | NekoStack provides patterns, not its own router |

## 37. Accessibility

| Capability | Owner | Notes |
|---|---|---|
| WCAG rule helpers | `a11y` | NEW |
| Focus management | `a11y` | NEW |
| Keyboard navigation patterns | `a11y` | NEW |
| Screen-reader announcement helpers | `a11y` | NEW |
| ARIA primitive utilities | `a11y` | NEW |
| Contrast checking | `a11y` | NEW |
| Reduced-motion utilities | `a11y` | NEW |
| Accessible form-error patterns | `a11y` | NEW (works with `form`) |
| Accessibility test helpers | `a11y` | NEW (works with `test`) |

## 38. Localization

| Capability | Owner | Notes |
|---|---|---|
| Translation catalogs | `locale` | |
| ICU MessageFormat | `locale` | |
| Pluralization | `locale` | |
| Date/number/currency formatting | `locale` | |
| RTL support | `locale` | |
| Locale fallback chains | `locale` | |
| Missing-key detection | `locale` | |

## 39. Content / narrative

| Capability | Owner | Notes |
|---|---|---|
| Entity graph + content registry | `codex` | |
| Knowledge pages (wiki) | `wiki` | |
| Narrative scripting / branching dialog | `story` | |
| Content lifecycle (draft/review/published) | `cms` | |
| Content versioning | `cms` | |
| Content scheduling | `cms` | (uses `time`) |
| Cross-reference / continuity validation | `validator` | |
| Content schema validation | `validator` | |
| Image processing | `media` | |
| Markdown parsing | `md` | |

## 40. Taxonomy / tags

| Capability | Owner | Notes |
|---|---|---|
| Taxonomies (categorization trees) | `taxonomy` | NEW |
| Tags / labels | `taxonomy` | NEW |
| Tag hierarchy | `taxonomy` | NEW |
| Tag aliases / synonyms | `taxonomy` | NEW |
| Tag-based filters | `taxonomy` | NEW (consumed by `search`, `codex`) |
| Classification rules | `taxonomy` | NEW |

## 41. AI / LLM workflow

| Capability | Owner | Notes |
|---|---|---|
| Prompt templates | `prompts` | |
| Prompt versioning | `prompts` | |
| Prompt registry | `prompts` | |
| Model provider abstraction (Anthropic/OpenAI/local) | `prompts` | folded in for now |
| LLM evaluation framework | `eval` | |
| Output schema validation | `eval` | (uses `schema`) |
| Prompt regression tests | `eval` | |
| Tool / function registry | `tools` | |
| Tool execution | `tools` | (sandboxed via `sandbox`) |
| Conversation memory | `memory` | |
| Episodic / semantic memory | `memory` | |
| Memory expiry + relevance scoring | `memory` | |
| Chat UI infrastructure | `chat` | |
| Conversation thread model | `chat` | |
| Assistant / tool message types | `chat` | |
| LLM output safety / moderation | `prompts` | folds in for now |

## 42. LLM-workflow safety

| Capability | Owner | Notes |
|---|---|---|
| Sandboxed command / script execution | `sandbox` | NEW |
| Tool permission allowlist | `sandbox` | NEW (works with `tools`) |
| Dry-run / plan-apply pattern | `changeset` | NEW |
| File diff / patch model | `changeset` | NEW |
| Apply / rollback workflow | `changeset` | NEW |
| Patch preview | `changeset` | NEW |
| LLM-touched artifact tracking | `provenance` | NEW |
| Generated-by / modified-by metadata | `provenance` | NEW |
| Source-to-output mapping | `provenance` | NEW |
| Prompt-to-output trace | `provenance` | NEW (works with `prompts`, `trace`) |
| Stale generated-artifact detection | `provenance` | NEW (works with `validator`) |

## 43. Game systems substrates

(Game-specific: combat, inventory, cards, quests, etc. live inside games.)

| Capability | Owner | Notes |
|---|---|---|
| Deterministic rule engine | `rules` | |
| Trigger ordering + conflict resolution | `rules` | |
| Replay-from-seed | `rules` | |
| Simulation runner | `sim` | (uses `rules`) |
| Game AI (FSM / BT / GOAP / utility) | `ai` | game AI, NOT LLM |
| Pathfinding (A* / navmesh) | `pathfinding` | |
| Procedural generation (noise / WFC / dungeons) | `procgen` | |
| Tile-based world rendering | `tilemap` | |
| Replay system (record + playback) | `replay` | |
| Save data + versioning | `saves` | |
| Input abstraction (keyboard/mouse/gamepad/touch) | `input` | |
| Audio engine + sprites | `audio` | |
| Asset pipeline (sprites/audio/atlases) | `assets` | |
| Economy modeling | `economy` | |
| Progression curves + skill trees | `progression` | |

## 44. Cross-platform / shell

| Capability | Owner | Notes |
|---|---|---|
| Tauri / Electron wrapping | `shell` | |
| PWA manifest + service workers | `pwa` | |
| Offline-first state | `offline` | |
| Native bridges | `shell` | |
| Auto-update channels | `shell` | |

## 45. Dev workflow

| Capability | Owner | Notes |
|---|---|---|
| CLI binary + plugin contract | `cli` | |
| Custom ESLint rules | `lint` | |
| Shareable ESLint configs | `lint` | |
| Test factories + golden files | `test` | |
| Performance benchmarks | `bench` | |
| Property-based / fuzz testing | `fuzz` | |
| Service mocking | `mock` | |
| Project template engine (load / render / apply / validate) | `templates` | starter *content* lives in top-level `starters/` — see `ARTIFACTS.md` |
| Demo seed data | `seed` | |
| Dev environment (devcontainer/docker-compose) | `env` | |
| Runtime config validation | `config` | (uses `schema`) |
| Deployment recipes / CI/CD templates | `deploy` | |
| Docs generation from schemas | `docs` | |

## 46. Identity / utility primitives

| Capability | Owner | Notes |
|---|---|---|
| UUID / ULID / nanoid generation | `id` | NEW |
| Branded TypeScript IDs | `id` | NEW (uses `schema`) |
| Deterministic IDs (content-addressed) | `id` | NEW |
| Tenant-scoped IDs | `id` | NEW (works with `tenant`) |
| Slug generation | `id` | NEW |
| Naming convention helpers | `id` | NEW |

## 47. Math / probability

| Capability | Owner | Notes |
|---|---|---|
| Curve functions (linear/log/exp/sigmoid) | `math` | NEW |
| Probability tables | `math` | NEW |
| Interpolation / clamping / scaling | `math` | NEW |
| Statistical helpers (mean / variance / percentile) | `math` | NEW |
| Vector / matrix ops (light) | `math` | NEW |
| Deterministic PRNG | `random` | NEW |
| Seeded RNG streams | `random` | NEW |
| Weighted random / shuffle bags | `random` | NEW |
| Distribution helpers (normal/poisson/etc.) | `random` | NEW |

## 48. Generic graph

| Capability | Owner | Notes |
|---|---|---|
| DAG primitives | `graph` | NEW |
| Cycle detection | `graph` | NEW |
| Topological sort | `graph` | NEW |
| Traversal (BFS/DFS) | `graph` | NEW |
| Shortest path (general; spatial in `pathfinding`) | `graph` | NEW |
| Graph diffing | `graph` | NEW |
| Graph serialization (DOT/Cypher-like) | `graph` | NEW |
| Typed entity graph (Codex-specific) | `codex` | uses `graph` substrate |
| Decision graph | `decision` | uses `graph` |
| Dependency graph (workspace-internal) | `workspace` | uses `graph` |

## 49. Commands / actions

| Capability | Owner | Notes |
|---|---|---|
| Action / command registry | `actions` | NEW |
| Command palette UI | `actions` | NEW (with `ui` consumer) |
| Permission-aware actions | `actions` | NEW (uses `permissions`) |
| Action audit emission | `actions` | NEW (sink: `audit`) |
| Action keyboard shortcuts | `actions` | NEW |
| Undoable actions | `actions` | NEW (works with `changeset`) |
| CLI ↔ UI command unification | `actions` | NEW (works with `cli`) |

## 50. Registry / discovery

| Capability | Owner | Notes |
|---|---|---|
| Package metadata registry | `registry` | NEW |
| Resource canonical-ID lookup | `registry` | NEW |
| Alias resolution | `registry` | NEW |
| Ownership mapping (capability → package) | `registry` | NEW (this document is the seed) |
| Runtime module discovery | `registry` | NEW |
| Package maturity status (scaffold/prototype/usable/stable) | `registry` | NEW |
| Package release status | `registry` | NEW (works with `path` + `governance`) |

---

## Known gaps / TBD

These rows have *intentional* TBD owners because the capability is real but doesn't warrant a package in this round. They will be promoted to a real owner when the need is concrete.

| Capability | Tentative home | Notes |
|---|---|---|
| Visual regression / screenshot testing | `test` | sub-module candidate; not in v1 |
| Service worker patterns beyond PWA | `pwa` | folded for now |
| Experiments / A/B testing | `flags` | distinct from flags but folded for now |
| Customer support tooling | TBD | not in v1; would need a product surface first |
| Comments / annotations | `review` | folded; if `comments` proves distinct, lift it |
| Activity feed / inbox | `notify` | folded; if `feed` proves distinct, lift it |
| Filesystem utilities (atomic writes / globs) | TBD | inline in consuming packages for now |
| Release / changelog / version bump | `deploy` | folded; promote `release` later if needed |
| Issue / defect tracking | external (Linear, GitHub Issues) | not a NekoStack package |
| Risk management | external (out of scope for v1) | |
| Technical-debt tracker | `path` | folded; could lift to `debt` later |

---

## Conflict resolution

Where two packages currently claim adjacent or overlapping capabilities, the resolution rule is:

| Apparent overlap | Resolution |
|---|---|
| `audit` vs `log` vs `telemetry` vs `trace` vs `events` | `log` = runtime debug; `audit` = compliance-grade; `telemetry` = product analytics events; `trace` = request spans; `events` = source-of-truth event sourcing |
| `auth` vs `permissions` vs `tenant` vs `entitlements` | `auth` orchestrates AccessDecision; `permissions` defines roles; `tenant` defines tenant context; `entitlements` defines plan gating |
| `schema` vs `validator` vs `lint` | `schema` = define + generate; `validator` = cross-reference + content validation; `lint` = static code-pattern enforcement |
| `docs` vs `md` vs `wiki` vs `cms` | `md` = parse/render markdown; `docs` = generate docs from schemas/contracts; `wiki` = knowledge-base UI; `cms` = content lifecycle (drafts/publish) |
| `ai` vs LLM packages | `ai` = game AI only (FSM/BT/GOAP). LLM is `prompts` + `tools` + `chat` + `rag` + `memory` + `eval` |
| `storage` vs `saves` vs `offline` vs `cache` vs `export` vs `backup` | `storage` = generic blob/file; `saves` = game-specific save data; `offline` = local-first state + sync; `cache` = transient layered cache; `export` = user-facing data egress; `backup` = operational disaster-recovery |
| `secure` vs `crypto` vs `secrets` vs `auth` | `crypto` = primitive wrappers; `secure` = headers + CSRF + CORS + redaction; `secrets` = secret lifecycle; `auth` = login + AccessDecision |
| `flags` vs `entitlements` vs `experiments` | `flags` = rollout/kill-switch; `entitlements` = plan-based gating; `experiments` = (folded into `flags` for now) |
| `jobs` vs `queue` vs `flow` | `queue` = substrate (retry/DLQ/dedup); `jobs` = scheduled+ad-hoc execution; `flow` = long-running stateful workflows |
| `map` vs `tilemap` vs `pathfinding` vs `graph` | `map` = spatial UI (pan/zoom/tiles render); `tilemap` = grid representation + collision; `pathfinding` = spatial path algorithms; `graph` = generic non-spatial graph |
| `time` vs `jobs` vs `notify` | `time` = date/RRULE/calendar primitives; `jobs` = cron execution; `notify` = reminder dispatch |
| `decision` vs `path` vs `governance` | `decision` = ADRs (the records); `path` = work tracking; `governance` = policy rules. ADRs cite governance policies and feed into path. |
| `provenance` vs `audit` vs `trace` vs `events` | `provenance` = lineage of generated artifacts (who/what/why produced this file); `audit` = compliance record of actions; `trace` = span-level execution path; `events` = source-of-truth state changes |

---

## Process

1. **Before adding a package**, find its capabilities here. If they exist with an owner, the package shouldn't.
2. **Before splitting a package**, edit this document to move rows. Then update the affected README's `Boundary` section. Then update consumers.
3. **When a new capability is discovered**, add it here first. Then assign or create an owner.
4. **Audit periodically**: empty Owner cells are gaps; "folded for now" entries are technical debt to promote when justified.

This document is the spine. Per-package READMEs restate the relevant rows; if they disagree with this, this wins.
