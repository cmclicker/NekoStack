# NekoStack — Development Roadmap

> The phased plan for the stack. Vertical slices over depth-first tiers — each phase closes a real gap or unlocks a real product.

## Reality framing

The original phase ordering was theoretical. Reality ignored it: `@nekostack/ui` and `@nekostack/theme` (originally Phase 2) shipped at v1.0 while `lint`, `test`, and `config` (Phase 0) are still scaffolds. That is fine — vertical-slice thinking means product priority wins over theoretical sequence. But it means the roadmap must reflect actual position, not the original plan.

**This document is updated whenever:**
- A package graduates from scaffold → real implementation (update "Current position")
- A phase's done-condition is met (move the line down)
- A priority shift changes what's next (re-order phases; commit with `docs(roadmap):` prefix)

**Estimate cadence:** solo-dev at part-time means ~4–8 focused hours/week per package. A 6-week-estimated package becomes 6–12 calendar weeks at this pace.

**CI filter rule:** every package that graduates from scaffold to real implementation must be added to the `--filter` list in `.github/workflows/ci.yml` in the same PR that ships it. This is not optional. A published package not in the CI filter is ungoverned.

---

## Current position (as of June 2026)

Five packages published at v1.0+, plus the metapackage:

| Package | Version | Capability |
|---|---|---|
| `@nekostack/schema` | v1.0.0 | Schema IR, runtime validation, generators (TS, Zod, JSON Schema, OpenAPI), registry, diff, migration planning |
| `@nekostack/cli` | v1.0.1 | `neko schema *` and `neko schema migrate *` verbs |
| `@nekostack/migrate-runner` | v1.0.0 | Safe migration execution (pre-validate → transform → post-validate) |
| `@nekostack/theme` | v1.0.0 | Design tokens, CSS custom properties, multi-theme system |
| `@nekostack/ui` | v1.0.1 | Component library built on the token system |
| `nekostack` | v1.1.1 | Metapackage — installs all five above |

**Phase 0 gap (scaffold only, `export {}`, v0.0.0):**
`lint`, `test`, `config`, `env`

These are the open debt from skipping Phase 0. They are not blocking any shipped product today, but they become the primary drift vector as more packages land.

---

## Phase 1 — Foundation Closure

**Close the Phase 0 gap.** Every additional package built without `lint` and `test` is accruing convention debt that becomes harder to backfill.

| Package | Why now | Approximate effort |
|---|---|---|
| `lint` | Convention enforcement from day one — already past day one. The longer this waits, the more drift each new package bakes in. | 4–8 weeks |
| `test` | Shared factory / golden / schema-integration substrate. Every subsequent package without it reinvents fixtures. | 3–5 weeks |
| `config` | Boot-time schema validation. Required by any backend package; `@nekostack/api` and `@nekostack/auth` both need it. | 1–2 weeks |

`env` (devcontainer / docker-compose) is deprioritized until a product needs containerized local dev. Pull it forward if that becomes urgent.

**Done when:** A new package added to `packages/` can be linted, type-checked, and tested using only NekoStack tooling — no per-package reinvention of the test harness or lint config.

**Unlocks:** Every subsequent package is governed from the moment it ships rather than retroactively.

---

## Phase 2 — Governance

**This was Phase 8. It is not Phase 8 anymore.**

The stack is already multi-package with a published public API. Governance can't wait until 80% of the packages are built — by then the drift is already compounded and backfilling policies into existing packages is expensive. The right time to build the governance layer is immediately after the tooling substrate (Phase 1) is in place.

| Package | Why now | Approximate effort |
|---|---|---|
| `governance` | Runtime policy rules + lifecycle gates. Encodes the PRODUCT_THESIS four-question gate, phase-plan acceptance criteria, and per-package invariant checks as executable policy — not a markdown doc humans remember to consult. | 8–14 weeks |

**CI hardening that ships with this phase:**
- The CI `--filter` list is validated by `status:check` — any package at v1.0+ not in the filter is a CI error, not just a comment.
- `governance` policies run in CI as a gate alongside typecheck / build / test.
- The "add to CI filter in the same PR" rule becomes an automated check, not a convention.

**Done when:** Merging a PR that violates the product thesis, skips the four-question gate, or ships a v1.0 package without a CI filter entry causes CI to fail — not a human reviewer to catch it.

**Unlocks:** The remaining ~100 packages can be built with confidence that they won't silently drift from the doctrine.

---

## Phase 3 — Observability Spine

Cross-cutting infrastructure every production-grade package needs. Build before any product goes to production.

| Package | Why now | Approximate effort |
|---|---|---|
| `log` | Structured logging (separate from telemetry/audit). | 4–6 weeks |
| `errors` | Typed error tracking + grouping. | 6–10 weeks |
| `health` | Liveness vs readiness probes. | 3–5 weeks |
| `telemetry` | Typed product analytics event catalog. | 6–12 weeks |
| `audit` | Tamper-evident compliance log. | 8–12 weeks |

Optional in this phase: `trace`, `metrics`. Pull them forward if distributed tracing or SLO gates become urgent before Phase 9.

**Done when:** Any package can emit audit events, log structured records, surface errors, and expose a `/health` endpoint without writing that infrastructure itself.

**Unlocks:** Production-readiness for everything that follows.

---

## Phase 4 — NekoVibe Vertical Slice

The first consuming product. `ui` and `theme` already migrated in the pre-roadmap sprint. This phase finishes the migration.

| Package | Why now | Approximate effort |
|---|---|---|
| `codex` | Entity registry (puzzle types, daily metadata, tags) | 8–16 weeks |
| `auth` | Login flow + AuthContext orchestration | 12–24 weeks |
| `tenant` | Tenant isolation patterns | 6–10 weeks |
| `permissions` | Role + permission catalog | 8–12 weeks |
| `icons` | Sprite system | 3–5 weeks |
| `motion` | Animation primitives | 6–10 weeks |
| `a11y` | Accessibility utilities | 6–10 weeks |
| `form` | Form state + schema-driven validation | 8–14 weeks |
| `md` | Markdown processing | 4–8 weeks |
| `api` | Contract-first API | 12–20 weeks |

**Done when:** NekoVibe runs entirely on NekoStack packages, with no inline reimplementations of the capabilities above.

**Unlocks:** A live product on the stack. Validates every API surface against a real consumer.

---

## Phase 5 — Data + Networking Layer

Real apps need real persistence and resilient networking.

| Package | Why now | Approximate effort |
|---|---|---|
| `migrate` | Schema + data migrations (DDL-level; distinct from `migrate-runner`) | 6–10 weeks |
| `storage` | File upload / S3 abstraction | 6–10 weeks |
| `cache` | Multi-layer caching | 6–10 weeks |
| `events` | Event sourcing scaffolding | 10–16 weeks |
| `fetch` | Typed HTTP client with retry / circuit-breaker | 4–8 weeks |
| `webhooks` | Webhook reception + dispatch | 4–8 weeks |
| `realtime` | WebSocket transport | 16–32 weeks |
| `search` | Full-text + faceted search | 8–12 weeks |

**Done when:** Stack supports file uploads, multi-tier caching, real-time updates, search, and schema evolution over time.

**Unlocks:** Most SaaS-shape and game-server-shape products.

---

## Phase 6 — SaaS Layer

Commercial SaaS shape. Build when the first product is ready to monetize.

| Package | Why now | Approximate effort |
|---|---|---|
| `entitlements` | Plan logic + feature gating | 8–12 weeks |
| `billing` | Stripe integration | 8–16 weeks |
| `flags` | Feature flags for safe rollouts | 6–10 weeks |
| `notify` | Multi-channel notification routing | 8–12 weeks |
| `email` | Email templates + Resend integration | 4–8 weeks |
| `admin` | Admin dashboard starter | 12–20 weeks |
| `export` | GDPR DSAR + versioned data egress | 8–12 weeks |
| `import` | Symmetric import + migration | 6–10 weeks |
| `compliance` | GDPR / SOC 2 profiles + retention | 12–20 weeks |
| `backup` | Operational disaster recovery | 8–14 weeks |
| `limits` | Rate limiting + abuse detection | 4–8 weeks |

**Done when:** Stack supports a commercial SaaS product end-to-end: paying customers, plan changes, compliance posture, abuse mitigation.

**Unlocks:** NekoSystems / Business-OS / retail-ops SaaS / EdTech as commercial products.

---

## Phase 7 — Game Systems

NekoBattler migration.

| Package | Why now | Approximate effort |
|---|---|---|
| `rules` | Deterministic rule engine (autobattler combat) | 8–12 weeks |
| `random` | Seeded PRNG | 3–5 weeks |
| `math` | Curves / probability / interpolation | 3–5 weeks |
| `graph` | Generic graph algorithms | 4–8 weeks |
| `sim` | Simulation runner | 10–16 weeks |
| `replay` | Deterministic replay | 8–12 weeks |
| `assets` | Asset pipeline | 12–20 weeks |
| `economy` | Currency modeling + Monte Carlo | 8–12 weeks |
| `progression` | Unlock graphs + leveling curves | 6–10 weeks |
| `input` | Input abstraction | 4–8 weeks |
| `audio` | Audio engine + a11y | 8–12 weeks |
| `canvas` | Canvas 2D + scene management | 8–12 weeks |
| `saves` | Versioned save data | 6–10 weeks |
| `ai` | Game AI (FSM / BT / GOAP / utility) | 10–16 weeks |
| `procgen` | Procedural generation | 12–20 weeks |
| `pathfinding` | A* / navmesh | 6–10 weeks |
| `tilemap` | Tile-based world rendering | 8–14 weeks |

**Done when:** NekoBattler runs entirely on NekoStack.

**Unlocks:** All game projects can migrate.

---

## Phase 8 — LLM Workflow

LLM-workflow primitives for any product wanting agent-driven features.

| Package | Why now | Approximate effort |
|---|---|---|
| `prompts` | Template + versioning + provider abstraction | 8–14 weeks |
| `tools` | Function/tool registry | 8–14 weeks |
| `sandbox` | Sandboxed tool execution | 8–14 weeks |
| `changeset` | Dry-run / plan-apply / rollback for LLM edits | 6–10 weeks |
| `provenance` | Generated-artifact lineage | 6–10 weeks |
| `rag` | Retrieval-augmented generation | 12–20 weeks |
| `eval` | LLM evaluation framework | 10–16 weeks |
| `memory` | Agent conversation memory | 8–14 weeks |
| `chat` | Chat interface infrastructure | 10–16 weeks |

**Done when:** Stack supports LLM-using products end-to-end without inline LLM clients.

**Unlocks:** Agentic features inside SaaS products. RAG-driven applications. Standalone agent products.

---

## Phase 9 — Content + Narrative

Mara Kane and narrative-tool migration.

| Package | Why now | Approximate effort |
|---|---|---|
| `cms` | Headless content lifecycle | 12–18 weeks |
| `wiki` | Wiki engine | 10–16 weeks |
| `story` | Branching dialog + narrative scripting | 10–16 weeks |
| `validator` | Cross-reference + continuity validation | 8–14 weeks |
| `taxonomy` | Tags + hierarchies + aliases | 4–8 weeks |
| `media` | Image processing | 6–10 weeks |
| `editor` | ProseMirror-based rich text | 12–20 weeks |

**Done when:** Mara Kane's narrative bible runs through `@nekostack/codex` + `@nekostack/validator`. Continuity errors caught at build time.

**Unlocks:** Narrative products. Deduction games.

---

## Phase 10 — Meta / Control Plane

The portfolio control plane. `governance` moved to Phase 2; what remains here is the queryable portfolio layer.

| Package | Why now | Approximate effort |
|---|---|---|
| `path` | Portfolio + roadmap + next-action resolver | 12–20 weeks |
| `workspace` | Multi-project context + repo discovery | 6–10 weeks |
| `decision` | ADRs as typed entities | 6–10 weeks |
| `review` | Review state machine | 6–10 weeks |
| `session` | Dev session records + handoff | 6–10 weeks |
| `registry` | Capability-to-package map (consumes BOUNDARIES.md) | 4–8 weeks |
| `actions` | Unified command registry (CLI + UI + agent) | 6–10 weeks |

**Done when:** Portfolio state (which products are active, which milestones are next, which decisions shaped the architecture) is queryable as typed data. LLM sessions resume context in one query.

**Unlocks:** True solo-dev sustainability across many years of multi-project work.

---

## Phase 11 — Background + Ops + Specialty

Build as needed. None is critical to ship a product; each addresses a specific pain point when it arises.

| Package | When to build | Effort |
|---|---|---|
| `queue` | When `jobs` substrate proves inadequate | 6–10 weeks |
| `jobs` | When NekoVibe-style scheduled work scales | 6–10 weeks |
| `flow` | When workflows span hours/days | 12–20 weeks |
| `time` | When RRULE / calendar / cadence become repeat code | 4–8 weeks |
| `deploy` | When first product ships to production | 10–16 weeks |
| `locale` | When first product needs non-English | 6–10 weeks |
| `metrics` | When SLO / dashboard discipline becomes mandatory | 4–8 weeks |
| `trace` | When distributed-tracing becomes valuable | 6–10 weeks |
| `bench` | When perf-regression CI gates become mandatory | 4–8 weeks |
| `fuzz` | When `rules` / `sim` correctness needs reinforcement | 4–8 weeks |
| `mock` | When test suites need provider stubs | 4–8 weeks |
| `shell` | When native desktop ships | 8–14 weeks |
| `pwa` | When mobile installable matters | 4–8 weeks |
| `offline` | When mobile-shape offline-first matters | 10–16 weeks |
| `id` | When ID conventions need typing across projects | 2–4 weeks |
| `docs` | When the documentation site itself is ready | 8–12 weeks |
| `templates` | After Phase 10: starter content stabilized | 6–10 weeks |
| `seed` | After Phase 6: domain factories settled | 2–4 weeks |

---

## Vertical-slice principle

Phases are organized around outcomes, not tiers. Re-order freely when a product becomes more strategically important. The dependency graph in `DEPENDENCY-GRAPH.md` constrains *what must come before what*; within that, product priority is yours to set.

Products each phase unlocks:
- Phase 1 + 2 — the stack governs itself
- Phase 4 — NekoVibe on NekoStack
- Phase 6 — first SaaS commercial product
- Phase 7 — NekoBattler on NekoStack
- Phase 8 — LLM workflow capabilities across all products
- Phase 9 — Mara Kane

---

## Build heuristics

Favor:
- **Closing governance gaps before adding capabilities.** A package built outside the governance layer is technical debt from day one.
- **Vertical slice for a real product** over building entire tiers depth-first.
- **Smallest viable version (v0.1)** of many packages over a "complete" one package. Iterate as needed.
- **Ship and use it** before going on to the next package — using forces correctness.
- **Steal from existing code** — NekoVibe, NekoBattler already have working implementations. Lift when migrating.

Avoid:
- **Shipping a v1.0 package without adding it to the CI filter.** This is the primary drift vector.
- **Building beyond what a product needs.** A v0.1 with five real consumers beats a v1.0 with no consumers.
- **Deferring governance.** The cost of encoding the product thesis as policy goes up with every package that ships without it.

---

## Calendar realism

At part-time solo cadence (4–8 focused hours/week):

- Phase 1 (lint + test + config) — 2–3 months
- Phase 2 (governance) — 2–4 months
- Phase 3 (observability) — 4–6 months
- Phase 4 (NekoVibe slice) — 6–12 months
- Through Phase 7 (NekoBattler migrated) — roughly 24–36 months from now

This is fine. The point isn't to finish all 107; the point is that the *shape* of the eventual stack is known, and any package built tomorrow fits the plan.

---

## See also

- [`BOUNDARIES.md`](BOUNDARIES.md) — canonical capability-to-package map.
- [`DEPENDENCY-GRAPH.md`](DEPENDENCY-GRAPH.md) — build-order constraints.
- [`ARTIFACTS.md`](ARTIFACTS.md) — asset folder taxonomy.
- [`PRODUCT_THESIS.md`](PRODUCT_THESIS.md) — the doctrine that decides what belongs in the stack.
- Per-package READMEs — each contains its own `Roadmap` section with v0.1 → v1.0 milestones.
- `@nekostack/path` (when built) — consumes this roadmap as data.
