# @nekostack/rules

> A deterministic rule engine with explicit trigger ordering, conflict resolution, and replay. Game combat, business rules, and content validation share the same shape — this is the spine.

## Quick reference

| | |
|---|---|
| **Build tier** | Force multiplier — critical for NekoBattler combat and any card/board game |
| **Depends on** | `schema` (rule validation), `telemetry` (rule-fire events optional), `random` (deterministic RNG for stochastic conditions) |
| **Used by** | NekoBattler combat, NekoGacha banner rules + pity, future card autobattler mode, NekoSystems policy gates, NekoVibe puzzle-validation, business workflows |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 8–12 weeks focused |
| **Sellable?** | Strong: deterministic-replayable rule engines in JS are surprisingly absent; OSS + hosted authoring-tool angle both viable |

## Why this exists

A *rule* is a piece of logic that fires when a condition is true and produces a deterministic effect. Auto-battler combat is rules. Card-game stacks are rules. Hearthstone trigger resolution is rules. Business contract evaluation is rules. Form validation is rules. Promotion eligibility is rules. The first time you implement trigger ordering correctly, you understand half of what makes Hearthstone hard.

Most projects re-invent rule engines badly. They look like this:

```ts
if (unit.hp <= 0) {
  if (unit.hasTrait('reanimate')) {
    unit.hp = 1;
    log.push(`${unit.name} reanimates!`);
  } else {
    units = units.filter(u => u.id !== unit.id);
  }
}
```

Then they grow:

- "When a unit dies, *if* it has Reanimate, it survives at 1 HP. *But* only once per combat. *Unless* it has Reanimate Plus."
- "Reanimate triggers in order of unit speed. *But* Last Will triggers before Reanimate."
- "If both players have units with Last Will, the active player's triggers first."

By unit 100, this code is unmaintainable, untestable, and bugs are constantly discovered in production. The reason is that **trigger ordering** is a real CS problem with known solutions, and ad-hoc if-statements aren't one of them.

`@nekostack/rules` is the answer: rules are first-class data, the engine evaluates them in deterministic order, and the resolution is a replayable trace of every fire. Used correctly, this turns "why did this happen?" into a debuggable question.

Building this yourself rather than using `nools`, `json-rules-engine`, or a forward-chaining library is justified because:
1. **Determinism is the whole game.** Most general rule engines are non-deterministic for performance. We *need* determinism for replay, anti-cheat, balance simulation.
2. **Game-shaped triggers.** Most rule engines optimize for "evaluate a set of conditions once." We need "events fire continuously, triggers chain, the queue must resolve in a defined order." Different shape.
3. **Learning the algorithm.** RETE, forward chaining, conflict resolution strategies — real CS that pays off in every system you build afterward.

## Scope

### In scope
- Rule definition DSL: condition + effect + metadata.
- Rule storage and indexing.
- Event-driven evaluation: `engine.fire(event)` triggers matching rules.
- Trigger ordering: priority, source, timing-band (pre/main/post), explicit tie-breakers.
- Resolution queue: triggers chain into more triggers; queue resolves in order.
- Replay: given a seed, an initial state, and a sequence of events, the engine produces the exact same trace every time.
- Trace output: every fire is recorded with rule id, trigger source, resulting effect, timestamp.
- Conflict resolution policies: which rule wins when two rules contradict.

### Out of scope
- Distributed evaluation across machines. In-process only.
- Probabilistic rules (statistical predicates). Use `@nekostack/sim` for stochastic simulation.
- A graphical rule editor. Could be a future companion package; not core.
- Forward-chaining inference at scale (thousands of rules with deep chains). The shape is right but the optimization work for that scale is post-1.0.

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §43 for the full capability map.

### Owns
- Rule definition DSL (when / then / priority / timing-band / metadata)
- Rule storage and indexing for fast lookup
- Event-driven evaluation (`engine.fire(event)`)
- Trigger ordering (priority → timing-band → source → stable tiebreaker)
- Resolution queue (effects emit further events, queue resolves in order)
- Replay-from-seed determinism
- Trace output (every fire recorded)
- Conflict resolution policies (priority-only, priority-then-source, owner-first, etc.)
- Composable matcher predicates

### Does NOT own
| Capability | Lives in |
|---|---|
| Stochastic / probabilistic simulation | `sim` (uses rules as one component) |
| Long-running stateful workflows / sagas | `flow` |
| Forward-chaining inference at scale | out of scope (v1) |
| LLM-driven decision rules | `prompts` + `tools` (LLM) or `ai` (game AI) |
| Authorization rules | `permissions` + `auth` |
| Form validation rules | `form` (uses `schema`) |
| Specific game semantics (combat / cards / abilities) | consuming games (NekoBattler etc. — they use us as substrate) |
| Distributed rule evaluation across machines | out of scope |
| Graphical rule editor UI | future companion (not core) |

## Competitors and adjacent tools

| Tool | What they do well | Where they fall short for us |
|---|---|---|
| **nools** | Node.js RETE implementation. | Stale (low recent activity), no TS-first API. |
| **json-rules-engine** | Mature JS rule engine, JSON-defined rules. | Event-shape is wrong for games. No trigger ordering primitives. No replay. |
| **GoRules / Drools** | Enterprise rule engines. | Java/Go-centric. JVM overhead. Optimized for business rules, not game triggers. |
| **xstate** | State machine library. | Different abstraction — state machines model state transitions, not rule chains. We use xstate for some things; not the same. |
| **rete-next** | Modern RETE in TS. | Promising but young. Doesn't solve our game-trigger shape directly. |
| **Lua scripting** (common in games) | Embed scripts, flexible. | No determinism guarantees, no trace, hard to test. |

The right framing: this is **game-engine combat trigger ordering, generalized.** Magic: The Gathering's Comprehensive Rules and Hearthstone's trigger resolution are the closest formal analogues — and they're notoriously hard precisely because the underlying problem is hard.

## How this fits the NekoStack

**Depends on:**
- `@nekostack/schema` — rules are schema-validated.
- `@nekostack/telemetry` — fires can emit telemetry events.

**Used by:**
- **NekoBattler** — combat trigger resolution, ability stacking, trait interactions.
- **NekoGacha** — banner rules, pity calculations, drop rate modifiers.
- A future card autobattler / Hearthstone-Battlegrounds-style mode.
- **NekoSystems** — business contract evaluation, workflow policy gates.
- **NekoVibe** — puzzle validation rules (cross-puzzle cross-reference).
- Form validation cascades, business workflow gates, content moderation — anything where "if X then Y unless Z" composes.

## Design philosophy

- **Rules are data.** A rule is a JSON-serializable object with `id`, `when`, `then`, `priority`. They can be stored, version-controlled, and audited.
- **Determinism above all.** Given seed + state + event sequence, the trace is identical. No exceptions.
- **Trace everything.** Every rule fire is recorded. The trace is the truth.
- **Conflict resolution is explicit.** When two rules can fire simultaneously, the policy that picks the winner is configured at engine construction, not hidden in implementation order.
- **Composable matchers.** Conditions are built from small composable predicates, not arbitrary code closures (closures break replay).

## Architecture sketch

```
packages/rules/
├── src/
│   ├── core/
│   │   ├── rule.ts           # Rule<TEvent, TState>
│   │   ├── engine.ts         # Engine<TEvent, TState>
│   │   ├── event.ts          # Event types
│   │   └── trace.ts          # Trace + TraceEntry
│   ├── matching/
│   │   ├── predicate.ts      # composable predicates
│   │   └── index.ts          # rule indexing for fast lookup
│   ├── resolution/
│   │   ├── queue.ts          # priority queue with stable tiebreaker
│   │   ├── order.ts          # priority / timing-band / source ordering
│   │   └── conflict.ts       # resolution policies
│   ├── effects/
│   │   ├── apply.ts          # state delta application
│   │   └── chain.ts          # effects emit further events
│   ├── replay.ts             # replay from seed + events
│   └── debug.ts              # trace inspection helpers
├── tests/
└── README.md
```

Defining a rule:

```ts
import { defineRule } from '@nekostack/rules';

export const reanimateRule = defineRule({
  id: 'feline.reanimate',
  priority: 100,           // higher = first
  timing: 'post-death',    // timing band
  when: (event, state) =>
    event.type === 'unit-died' &&
    event.unit.hasTrait('reanimate') &&
    !state.usedReanimates.has(event.unit.id),
  then: (event, state) => ({
    type: 'reanimate',
    unitId: event.unit.id,
    hp: 1,
  }),
});
```

Engine usage:

```ts
const engine = new Engine({ rules, seed: 42, resolveConflict: 'priority-then-source' });
const result = engine.run(initialState, events);
console.log(result.trace);     // ordered list of every fire
console.log(result.finalState); // deterministic end state
```

## Roadmap

### v0.1 — Core
- Rule definition + engine + trivial in-order evaluation.
- Trace output.

### v0.2 — Priority + timing bands
- Priority-ordered queue.
- Configurable timing bands (pre/main/post).

### v0.3 — Effect chaining
- Effects can emit new events that re-enter the queue.
- Recursion guard.

### v0.4 — Replay
- Deterministic replay from seed + events.
- Reproduction-test harness.

### v0.5 — Conflict policies
- Multiple resolution strategies (priority-only, priority-then-source, owner-first, etc.).

### v0.6 — Composable predicates
- Predicate library for common conditions.
- Predicate composition (and/or/not).

### v1.0 — Stable API
- Documentation site with game-trigger examples and business-rule examples.
- Benchmark suite (rules-per-second, trace size, memory).

## Product potential

**Internal use:** Very high. The combat/business-rules backbone of multiple projects.

**Open source release:** Strong candidate. Deterministic-replayable rule engines for games are surprisingly absent in JS. MIT or Apache release could attract indie game devs and serious tabletop-game-rules implementations.

**Commercial product:** Plausible as **"hosted rule authoring + simulation"** — a SaaS where designers author rules in a UI, simulate balance, and ship rule packs to consuming games. Niche but real.

**Estimated effort to v1.0:** 8-12 weeks of focused work. Core is small; correctness of trigger ordering and conflict resolution under all edge cases is the hard part.

## Status

- **Current:** Empty placeholder. Not started.
- **Owner:** Cody (solo dev project).
- **Priority tier:** Force multiplier. Critical for NekoBattler and any future card/board game; valuable for SaaS business-logic too.
- **Estimated learning return:** Very high. RETE algorithm, forward chaining, conflict resolution, deterministic replay — foundational CS that pays off forever.
