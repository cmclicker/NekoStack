# NekoStack — Dependency Graph

> The aggregated cross-package dependency view. Derived from each package's `Quick reference` and `Boundary` sections. Useful for: build-order planning, impact analysis ("if I change X, what's affected"), cycle detection, and seeing the stack's shape at a glance.

## Purpose

`BOUNDARIES.md` answers "which package owns this capability?" — by capability.
`README.md` per-package answers "what does this package do, what does it depend on?" — locally.

**This document answers "how does the whole stack depend on itself?"** — globally, as a build-order-aware DAG. When per-package READMEs and `BOUNDARIES.md` are the source of truth, this document is the derived view.

This is the same role `@nekostack/registry` will eventually fill programmatically; until that package is built, this is the human-maintained version.

## Reading conventions

- **A → B** means "A depends on B" (A imports from B).
- Arrows always point "downhill" toward foundational packages. The graph is a DAG; cycles are forbidden and flagged loudly if they ever appear.
- `(external)` = external library, not a NekoStack package.
- `(via X)` = uses NekoStack package X as the integration adapter.

---

## The five build tiers

Build-order is constrained: a package can't be implemented before its dependencies. The 107 packages cluster into five tiers; everything in tier N depends only on tiers ≤ N.

### Tier 0 — Foundation primitives (no NekoStack deps)

These have only external dependencies. They are the substrate everything else builds on.

```
schema      (TypeScript only)
math        (none)
random      (none — except optional seedable PRNG)
graph       (schema for type defs only)
time        (external date libs only)
lint        (ESLint only)
```

### Tier 1 — Core utilities (depend on Tier 0)

```
crypto       → schema
id           → schema, crypto (for cryptographic IDs only)
config       → schema
env          → config, (Docker external)
test         → schema, random, (Vitest external)
cli          → schema (plus plugin contracts to many others)
```

### Tier 2 — Meta / control plane + identity (depend on Tier 0-1)

```
workspace    → schema, graph, lint
path         → schema, codex*, graph, time, workspace, review*, decision*, session*
registry     → schema, codex*, graph, lint
tenant       → schema, id, time
secrets      → schema, crypto, audit*
permissions  → schema, audit*, tenant
governance   → schema, lint, audit*, path*, decision*, review*
decision     → schema, codex*, graph, time, provenance*
review       → schema, audit*, governance*, path*, decision*, changeset*
session      → schema, workspace, path*, decision*, review*, changeset*, provenance*, time
```

(\* = forward references resolved within the same tier — these packages mutually compose.)

### Tier 3 — Force multipliers + observability (depend on Tier 0-2)

```
codex        → schema, cli, graph
rules        → schema, telemetry*, random
sim          → schema, rules, random, events*, telemetry*, replay*, time
auth         → schema, telemetry*, audit, tenant, permissions, entitlements*, limits, crypto, secrets, provider libs (external)
telemetry    → schema, lint, secure*
log          → schema, secure*, trace, secrets
metrics      → schema, tenant
errors       → schema, log, trace, tenant
health       → schema, metrics, cache*, storage*
trace        → external OpenTelemetry, (integrates with log, errors, fetch*, api*)
bench        → schema, metrics, audit, (regression patterns from `path`)
audit        → schema, crypto, tenant, time, storage*
secure       → schema, audit, log, telemetry
api          → schema, auth, telemetry, cli
fetch        → schema, telemetry, errors, trace
webhooks     → schema, audit, crypto, queue*, secrets, fetch
realtime     → schema, auth, telemetry, (Redis/NATS external)
search       → schema, codex, taxonomy*, (SQLite external)
form         → schema, ui*, a11y*
ui           → theme*, icons*, motion*, a11y*, (Radix UI external)
events       → schema, storage*, audit, time
cache        → schema, telemetry, time, (Redis external)
migrate      → schema, audit, cli, (Prisma external)
storage      → schema, audit, secrets, crypto, (AWS SDK external)
limits       → schema, auth, tenant, entitlements*, cache, telemetry
```

### Tier 4 — Domain packages (depend on Tier 0-3)

```
# SaaS layer
entitlements → schema, auth, telemetry, audit, tenant
billing      → schema, entitlements, telemetry, audit, webhooks, email, (Stripe SDK external)
export       → schema, codex, audit, auth, cli, compliance
import       → schema, migrate, changeset, audit, tenant, codex
admin        → ui, table, auth, audit, flags, entitlements, health, jobs, tenant
flags        → schema, audit, telemetry, tenant, auth
notify       → schema, email, audit, time, auth, tenant
email        → schema, audit, secrets, (Resend SDK external)
compliance   → schema, audit, export, secure, tenant, secrets, time
backup       → schema, storage, compliance, audit, time, crypto

# Background processing
queue        → schema, audit, telemetry, storage, (Redis/Postgres external)
jobs         → queue, time, schema, audit, telemetry, errors
flow         → schema, queue, audit, events, errors, time

# Game systems
assets       → schema, codex, cli, (sharp/ffmpeg external)
ai           → schema, rules, random, sim, telemetry
pathfinding  → schema, graph, tilemap
procgen      → schema, random, math, graph
tilemap      → schema, canvas, assets, graph, pathfinding
replay       → schema, sim, rules, random, events, storage
saves        → schema, migrate, storage, crypto, audit
input        → schema, a11y, actions
audio        → schema, assets, a11y
economy      → schema, sim, random, math, telemetry
progression  → schema, graph, math, telemetry, audit

# Frontend depth
theme        → schema
motion       → schema, theme, a11y
editor       → schema, ui, theme, realtime, md
chart        → schema, ui, theme, motion, a11y
table        → schema, ui, theme, a11y, actions
map          → schema, ui, theme, canvas, motion, a11y
canvas       → schema, theme, motion, assets
icons        → schema, theme, ui
md           → schema, (unified/remark external)
a11y         → schema, theme

# AI / LLM
prompts      → schema, audit, provenance, governance, telemetry, secrets
rag          → schema, codex, search, storage, prompts, eval
eval         → schema, prompts, rag, audit, bench, governance
tools        → schema, prompts, sandbox, audit, provenance, permissions, governance
memory       → schema, rag, storage, prompts, audit, time
chat         → schema, prompts, tools, memory, ui, realtime, audit

# LLM-workflow safety
sandbox      → schema, tools, permissions, governance, audit, changeset
changeset    → schema, audit, governance, review, provenance
provenance   → schema, audit, prompts, tools, rag, changeset, time

# Content / narrative
cms          → schema, editor, md, audit, storage, time, locale
wiki         → schema, cms, md, codex, search, ui, audit
story        → schema, codex, rules, validator, flow
validator    → schema, codex, audit, provenance
media        → schema, storage, audit, (sharp external)
taxonomy     → schema, codex, graph, search, audit

# Cross-platform
shell        → schema, secrets, audit, (Tauri/Electron external)
pwa          → schema, notify, offline, audit
offline      → schema, storage, events, realtime, audit

# Testing depth
fuzz         → schema, test, random, audit, (fast-check external)
mock         → schema, test, fetch, random, (msw external)

# Ops
deploy       → schema, secrets, audit, governance, health, backup, migrate
locale       → schema, audit, (ICU external)

# Utility primitives that depend on others
actions      → schema, permissions, audit, cli, ui, tools, changeset

# Documentation / scaffolding
docs         → schema, api, md, codex, registry, prompts
templates    → cli, schema, env, config
seed         → schema, test, random, id, tenant
```

---

## Critical-path build order

The shortest sequence to bootstrap the stack (each row depends only on rows above):

1. **schema** — every other package depends on this. Build first.
2. **math, random, graph, time, lint, crypto** — foundation primitives.
3. **id, config, test** — early utilities depending on schema.
4. **env, cli** — dev experience.
5. **tenant, permissions, secrets** — identity primitives.
6. **audit, telemetry, log, trace, errors** — observability backbone.
7. **codex, registry, workspace** — meta-layer over content + dev context.
8. **rules, sim, replay** — game systems substrate (or skip if no games yet).
9. **auth, entitlements, limits** — access control composition.
10. **api, fetch, webhooks, realtime** — networking.
11. **storage, cache, migrate, events, queue, jobs, flow** — data + background.
12. **a11y, theme, motion, ui** — frontend substrate.
13. **prompts, tools, sandbox, changeset, provenance** — LLM-workflow base.
14. Everything else, in any order consistent with their declared deps.

---

## Cross-cutting integrations (not strict deps, but tight coupling)

Several packages cooperate without strict dependency, by *emitting events to* or *consuming events from* each other. These integrations are documented but don't constrain build order:

- **Anything emitting audit events** → `audit` is a sink, not a dependency.
- **Anything emitting telemetry** → `telemetry` is a sink.
- **Anything emitting provenance** → `provenance` is a sink.
- **Anything triggering reviews** → `review` receives, doesn't drive.
- **Anything checking governance gates** → `governance` is consulted, doesn't dictate build order.

These sink-style integrations let packages cooperate without circular dependencies.

---

## Impact analysis (key "if I change X, what's affected" answers)

### Foundation changes — affect almost everything

- **`schema`** — every other package consumes it. Breaking changes ripple everywhere. Versioning critical.
- **`audit`** — most packages emit; downstream queries depend on shape. Schema versioning required.
- **`telemetry`** — same.

### Force-multiplier changes — wide blast radius

- **`auth`** — every authorization-aware package. `AccessDecision` shape changes break consumers.
- **`codex`** — every content-heavy project. Entity-kind schema changes need migrations.
- **`rules`** — autobattler combat, business workflows, agent policy gates. Trigger ordering changes change game/business behavior deterministically.
- **`api`** — every backend. Adapter contract changes break server adapters.
- **`ui`** — every frontend. Component API changes break consumer apps.

### Localized changes — small blast radius

- **`bench`**, **`fuzz`**, **`mock`** — testing only.
- **`backup`**, **`compliance`** — ops only.
- **`templates`**, **`seed`** — dev bootstrap only.
- **`shell`**, **`pwa`**, **`offline`** — cross-platform only.

---

## No-cycles guarantee

The graph is a DAG. To preserve this:

1. **Sink integrations** (audit / telemetry / provenance / review / governance) accept events but do not drive callers. Callers reference sinks; sinks never reference callers.
2. **Meta-layer packages** (`path`, `decision`, `review`, `session`) form a tight cluster with mutual references — resolved within the cluster but not circular at the package-import level (different entity kinds, not import cycles).
3. **Frontend depth packages** (`ui`, `theme`, `motion`, `a11y`, `icons`) compose carefully: `theme` is the lowest; `a11y` is next; `motion`, `icons`, `ui` build on those.
4. **`lint`** statically detects future import cycles in consuming projects.
5. **`registry`** (when implemented) detects boundary drift between BOUNDARIES.md and per-package READMEs.

If a future package introduces a cycle, refactoring must split or invert the dependency before merging.

---

## What's next

Now that the dependency graph is explicit:

1. **Pick a starter set** — usually `schema` + `cli` + `config` + `test` to bootstrap any other package's development.
2. **Each implemented package** should keep its README's `Quick reference > Depends on / Used by` rows accurate. Drift between this graph and the per-package rows is the gap `@nekostack/lint` (custom architecture rule) will eventually enforce automatically.
3. **As packages graduate from "scaffolded" to "usable" to "stable"**, the `Status` line in each README updates. `registry` (when built) will surface that progression.

This graph is the load-bearing artifact for any future "what should I work on next?" decision across the stack.
