# NekoStack — Development Roadmap

> The phased plan for implementing 107 packages over a multi-year solo-dev horizon. Vertical slices preferred over depth-first layers — each phase unlocks at least one consuming product.

## Reality framing

107 packages, each estimated 2–32 weeks of focused work, can't be built in parallel or in sequence-of-tiers without producing nothing usable for years. The right shape is **vertical slices**: build the minimum across all relevant layers to unlock one product, then move to the next product, thickening the stack as you go.

This roadmap is opinionated. Re-order if a different consuming product becomes more strategically important. Phase 0 is non-negotiable; everything after is reorderable.

**Estimate cadence:** "solo-dev at part-time" means ~4-8 focused hours/week per package. A 6-week-focused package becomes 6-12 calendar weeks at this pace. Plan accordingly.

**This roadmap is itself an artifact.** As packages graduate from scaffold → prototype → usable → stable, this document gets updated. When `@nekostack/path` is built, it consumes this roadmap as data.

---

## Phase 0 — Bootstrap (~4-8 calendar weeks)

The non-negotiable starting point. Six packages that let the stack itself be developed.

| Package | Why now | Approximate effort |
|---|---|---|
| `schema` | Every other package depends on it | 4–8 weeks |
| `lint` | Convention enforcement from day one | 4–8 weeks |
| `test` | Factory + golden + schema-integration substrate | 3–5 weeks |
| `config` | Boot-time validation; needed for any backend | 1–2 weeks |
| `env` | Devcontainer / docker-compose for getting things running | 3–6 weeks |
| `cli` | The command surface for all of the above | 2–4 weeks |

**Done when:** A new package added to `packages/` can be linted, type-checked, tested, and have its config validated using only NekoStack tooling.

**Unlocks:** Stack-internal development. Nothing external yet.

---

## Phase 1 — Observability + Security Spine (~6-10 calendar weeks)

Cross-cutting infrastructure every later package will need. Build before anything tries to ship to production.

| Package | Why now | Approximate effort |
|---|---|---|
| `crypto` | Wrappers around libsodium; safe usage patterns | 4–8 weeks |
| `secrets` | Secret lifecycle (load/mask/rotate); avoid `.env` leaks | 4–8 weeks |
| `secure` | Headers / CSRF / CORS / redaction middleware | 6–10 weeks |
| `audit` | Tamper-evident compliance log; required by SaaS | 8–12 weeks |
| `telemetry` | Typed product analytics event catalog | 6–12 weeks |
| `log` | Structured logging (separate from telemetry/audit) | 4–6 weeks |
| `errors` | Typed error tracking + grouping | 6–10 weeks |
| `health` | Liveness vs readiness probes | 3–5 weeks |

Optional but valuable in this phase: `trace`, `metrics`, `bench`. They can land in Phase 7 if not needed yet.

**Done when:** Any future package can emit audit events, log structured records, surface errors, and expose a `/health` endpoint without scaffolding from scratch.

**Unlocks:** Production-grade observability for everything that follows.

---

## Phase 2 — First Vertical Slice (NekoVibe migration) (~3-5 calendar months)

The first consuming product. NekoVibe is the obvious target because it already exists and would benefit from the stack today.

| Package | Why now | Approximate effort |
|---|---|---|
| `codex` | Entity registry (puzzle types, daily metadata, tags) | 8–16 weeks |
| `auth` | Login flow + AuthContext orchestration | 12–24 weeks |
| `tenant` | Tenant isolation patterns (NekoVibe uses per-user already) | 6–10 weeks |
| `permissions` | Role + permission catalog | 8–12 weeks |
| `ui` | Component library (NekoVibe's `packages/ui` migrates here) | 12–24 weeks |
| `theme` | Design tokens (NekoVibe's `design-tokens.css` migrates here) | 4–8 weeks |
| `icons` | Sprite system | 3–5 weeks |
| `motion` | Animation primitives | 6–10 weeks |
| `a11y` | Accessibility utilities (NekoVibe's a11y work consolidates) | 6–10 weeks |
| `form` | Form state + schema-driven validation | 8–14 weeks |
| `md` | Markdown processing | 4–8 weeks |
| `api` | Contract-first API (NekoVibe's Nest API consumes) | 12–20 weeks |

**Done when:** NekoVibe runs entirely on NekoStack packages, with no inline reimplementations of the capabilities above. The `apps/web` and `apps/api` of NekoVibe import from `@nekostack/*` exclusively for shared concerns.

**Unlocks:** A daily-puzzle product on the stack. Validates the API surfaces against a real product.

---

## Phase 3 — Data + Networking Layer (~2-4 calendar months)

Real apps need real persistence and resilient networking. This phase makes the stack production-ready beyond a single product.

| Package | Why now | Approximate effort |
|---|---|---|
| `migrate` | Schema + data migrations | 8–14 weeks |
| `storage` | File upload / S3 abstraction | 6–10 weeks |
| `cache` | Multi-layer caching | 6–10 weeks |
| `events` | Event sourcing scaffolding | 10–16 weeks |
| `fetch` | Typed HTTP client with retry / circuit-breaker | 4–8 weeks |
| `webhooks` | Webhook reception + dispatch | 4–8 weeks |
| `realtime` | WebSocket transport (NekoVibe live leaderboards; Leytide MMO needs this) | 16–32 weeks |
| `search` | Full-text + faceted search (NekoBattler wiki) | 8–12 weeks |

**Done when:** Stack supports a SaaS product with file uploads, multi-tier caching, real-time updates, search, and schema evolution over time.

**Unlocks:** Most SaaS-shape and game-server-shape products.

---

## Phase 4 — SaaS Layer (~3-4 calendar months)

Commercial SaaS shape. Build when the first product is ready to monetize.

| Package | Why now | Approximate effort |
|---|---|---|
| `entitlements` | Plan logic + feature gating | 8–12 weeks |
| `billing` | Stripe integration (when first product monetizes) | 8–16 weeks |
| `flags` | Feature flags for safe rollouts | 6–10 weeks |
| `notify` | Multi-channel notification routing | 8–12 weeks |
| `email` | Email templates + Resend integration | 4–8 weeks |
| `admin` | Admin dashboard starter | 12–20 weeks |
| `export` | GDPR DSAR + versioned data egress | 8–12 weeks |
| `import` | Symmetric import + migration | 6–10 weeks |
| `compliance` | GDPR / SOC 2 profiles + retention | 12–20 weeks |
| `backup` | Operational disaster recovery | 8–14 weeks |
| `limits` | Rate limiting + abuse detection | 4–8 weeks |

**Done when:** Stack can support a commercial SaaS product end-to-end: paying customers, plan changes, compliance posture, abuse mitigation.

**Unlocks:** NekoSystems / Business-OS / retail-ops SaaS / EdTech as commercial products.

---

## Phase 5 — Game Systems (~3-5 calendar months)

NekoBattler migration. Builds the substrate for autobattler / card / Battlegrounds-style / tower-defense / gacha games.

| Package | Why now | Approximate effort |
|---|---|---|
| `rules` | Deterministic rule engine (autobattler combat) | 8–12 weeks |
| `random` | Seeded PRNG | 3–5 weeks |
| `math` | Curves / probability / interpolation | 3–5 weeks |
| `graph` | Generic graph algorithms | 4–8 weeks |
| `sim` | Simulation runner (drives `rules` for batch balance testing) | 10–16 weeks |
| `replay` | Deterministic replay (anti-cheat, balance debug, sharing) | 8–12 weeks |
| `assets` | Asset pipeline (NekoBattler's 565-champion roster) | 12–20 weeks |
| `economy` | Currency modeling + Monte Carlo | 8–12 weeks |
| `progression` | Unlock graphs + leveling curves | 6–10 weeks |
| `input` | Input abstraction (keyboard / mouse / gamepad / touch) | 4–8 weeks |
| `audio` | Audio engine + a11y | 8–12 weeks |
| `canvas` | Canvas 2D + scene management (share cards, HUDs) | 8–12 weeks |
| `saves` | Versioned save data | 6–10 weeks |
| `ai` | Game AI (FSM / BT / GOAP / utility) | 10–16 weeks |
| `procgen` | Procedural generation (puzzle generators + dungeons) | 12–20 weeks |
| `pathfinding` | A* / navmesh (Leytide world nav) | 6–10 weeks |
| `tilemap` | Tile-based world rendering (Leytide) | 8–14 weeks |

**Done when:** NekoBattler runs entirely on NekoStack. Combat is `@nekostack/rules`; balance simulations run via `@nekostack/sim`; the wiki search uses `@nekostack/search`; replays are deterministic via `@nekostack/replay`.

**Unlocks:** All game projects can migrate. Card autobattler / Battlegrounds-style modes become straightforward extensions of NekoBattler.

---

## Phase 6 — LLM Workflow (~2-3 calendar months)

LLM-workflow primitives. Used by any product wanting agent-driven features — customer-support agents inside NekoSystems / Business-OS SaaS, narrative co-author tools, coding assistants, future agentic apps.

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

**Done when:** Stack supports LLM-using products end-to-end. Any product wanting agentic features (in-SaaS customer support, narrative co-author, coding assistant, RAG over content) imports from the stack rather than writing inline LLM clients.

**Unlocks:** Agentic features inside SaaS products. Coding-assistant-style tools. RAG-driven applications. Standalone agent products.

---

## Phase 7 — Content + Narrative (~2-3 calendar months)

Mara Kane and narrative-tool migration. Codex graduates from "puzzle metadata" (NekoVibe Phase 2) to "20-book narrative continuity engine."

| Package | Why now | Approximate effort |
|---|---|---|
| `cms` | Headless content lifecycle | 12–18 weeks |
| `wiki` | Wiki engine (NekoBattler champion wiki + Mara Kane lore) | 10–16 weeks |
| `story` | Branching dialog + narrative scripting | 10–16 weeks |
| `validator` | Cross-reference + continuity validation | 8–14 weeks |
| `taxonomy` | Tags + hierarchies + aliases | 4–8 weeks |
| `media` | Image processing (UI-facing, distinct from `assets`) | 6–10 weeks |
| `editor` | ProseMirror-based rich text | 12–20 weeks |

**Done when:** Mara Kane's narrative bible runs through `@nekostack/codex` + `@nekostack/validator`. Continuity errors caught at build time. Wiki + CMS surfaces work across NekoBattler and Mara Kane.

**Unlocks:** Narrative products. Deduction games (combine with `story`).

---

## Phase 8 — Meta / Control Plane (~3-4 calendar months)

The portfolio control plane. This is the phase that retires manual memory-file management; the package replaces it.

| Package | Why now | Approximate effort |
|---|---|---|
| `path` | Portfolio + roadmap + next-action resolver | 12–20 weeks |
| `governance` | Runtime policy rules + lifecycle gates | 8–14 weeks |
| `workspace` | Multi-project context + repo discovery | 6–10 weeks |
| `decision` | ADRs as typed entities | 6–10 weeks |
| `review` | Review state machine | 6–10 weeks |
| `session` | Dev session records + handoff | 6–10 weeks |
| `registry` | Capability-to-package map (consumes BOUNDARIES.md) | 4–8 weeks |
| `actions` | Unified command registry (CLI + UI + agent) | 6–10 weeks |

**Done when:** The portfolio (which products are active, which milestones are next, which decisions shaped the architecture, which session captured what) is queryable as typed data instead of held in memory files. LLM sessions resume context in one query.

**Unlocks:** True solo-dev sustainability across many years of multi-project work.

---

## Phase 9 — Background + Ops + Specialty (~ongoing)

The remaining packages, built as needed. None is critical to ship a product; each addresses a specific pain point when it arises.

| Package | When to build | Effort |
|---|---|---|
| `queue` | When `jobs` substrate proves inadequate | 6–10 weeks |
| `jobs` | When NekoVibe-style scheduled work scales | 6–10 weeks |
| `flow` | When workflows span hours/days (agent flows, GDPR DSAR) | 12–20 weeks |
| `time` | When RRULE / calendar / cadence become repeat code | 4–8 weeks |
| `deploy` | When first product ships to production | 10–16 weeks |
| `locale` | When first product needs non-English | 6–10 weeks |
| `metrics` | When SLO / dashboard discipline becomes mandatory | 4–8 weeks |
| `trace` | When distributed-tracing becomes valuable (multi-service) | 6–10 weeks |
| `bench` | When perf-regression CI gates become mandatory | 4–8 weeks |
| `fuzz` | When `rules` / `sim` correctness needs reinforcement | 4–8 weeks |
| `mock` | When test suites need provider stubs | 4–8 weeks |
| `shell` | When native desktop ships (NekoBattler `src-tauri/`) | 8–14 weeks |
| `pwa` | When mobile installable matters | 4–8 weeks |
| `offline` | When mobile-shape offline-first matters | 10–16 weeks |
| `webhooks` | (covered in Phase 3) | — |
| `id` | When ID conventions need typing across projects | 2–4 weeks |
| `docs` | When the documentation site itself is ready | 8–12 weeks |
| `templates` | After Phase 8: starter content stabilized | 6–10 weeks |
| `seed` | After Phase 4: domain factories settled | 2–4 weeks |

---

## Vertical-slice principle

The phases above are organized so each delivers a product:

- Phase 0 — the stack itself
- Phase 2 — NekoVibe
- Phase 5 — NekoBattler
- Phase 4 — first SaaS commercial
- Phase 6 — LLM workflow capabilities (agentic features inside NekoSystems and other products)
- Phase 7 — Mara Kane
- Phase 8 — portfolio control plane (the meta-product)

If a different product is more strategically important on a given day, re-order. The dependency graph in `DEPENDENCY-GRAPH.md` constrains *what must come before what* (e.g., `schema` is always first); within that, product priority is yours to set.

---

## Build heuristics

Things to favor:

- **Vertical slice for a real product** over building entire tiers depth-first.
- **Smallest viable version (v0.1)** of many packages over a "complete" one package. Iterate as needed.
- **Ship and use it** before going on to the next package — using forces correctness.
- **Steal from existing code** — NekoVibe, NekoBattler already have working implementations. Lift them when migrating, don't re-author from spec.

Things to avoid:

- **Building beyond what a product needs.** A v0.1 with five real consumers beats a v1.0 with no consumers.
- **Skipping observability.** Phase 1 is foundational; products built without `audit` / `log` / `telemetry` accrue debt fast.
- **Skipping schema.** Every shortcut around `schema` becomes a type-drift bug later.

---

## Calendar realism

At part-time solo cadence (4-8 focused hours/week, accounting for life and context-switching):

- Phase 0 alone is 1-2 months.
- Phase 1 + Phase 2 (first product migrated) is 6-9 months.
- Through Phase 5 (NekoBattler migrated) is roughly 18-24 months.
- All 107 packages is a 3-5 year arc.

This is fine. The point isn't to finish all 107; the point is that the *shape* of the eventual stack is known, and any package built tomorrow fits the plan.

---

## When this roadmap changes

This document is itself an artifact. It changes when:

- A package's priority shifts (a product becomes more important; re-order phases).
- A capability gap is discovered (add a new package; update BOUNDARIES.md first, then add to a phase here).
- A phase's "done when" criteria are met (move the line down).
- A solo-dev reality check reveals a phase was over-scoped or under-scoped (re-estimate).

Commit roadmap edits with `docs(roadmap):` prefix so the history is searchable.

---

## See also

- [`BOUNDARIES.md`](BOUNDARIES.md) — canonical capability-to-package map.
- [`DEPENDENCY-GRAPH.md`](DEPENDENCY-GRAPH.md) — build-order constraints.
- [`ARTIFACTS.md`](ARTIFACTS.md) — asset folder taxonomy.
- Per-package READMEs — each contains its own `Roadmap` section with v0.1 → v1.0 milestones for that package.
- `@nekostack/path` (when built) — consumes this roadmap as data.
