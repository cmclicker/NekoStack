# @nekostack/test

> Factories, deterministic seed harnesses, golden-file assertions, and snapshot UX that doesn't suck. The testing infrastructure Vitest assumes you'll write yourself.

## Quick reference

| | |
|---|---|
| **Build tier** | Foundation primitive â€” build alongside `schema` (co-dependent) |
| **Depends on** | Vitest (external), `schema` (factory schemas), `@faker-js/faker` (primitive generators); coordinates with `random` for deterministic RNG |
| **Used by** | every package's test suite; every consuming project's test suite |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 3â€“5 weeks focused |

## Why this exists

Vitest and Jest give you `describe`, `it`, `expect`, and a runner. They don't give you:

- **Factories.** Generating realistic test data â€” users, attempts, puzzles, champions, audit log entries â€” without scattering literal object definitions through every test file.
- **Deterministic seeds.** Repeatable randomness so that a test that fails reproduces the same failure on rerun. Especially critical for testing simulations, rule engines, and procgen.
- **Golden files.** Snapshot tests that live in `.golden` files next to the source, with a sane workflow for reviewing and updating them.
- **Domain fixtures.** Snapshots of complex object graphs (a fully-populated NekoCodex entity graph, a NekoBattler combat state) that tests can load instead of constructing inline.
- **Spec organization.** Conventions for where spec files live, how they're named, and how they relate to source files â€” enforced by `@nekostack/lint`.

`@nekostack/test` is the layer between Vitest and your tests. You import factories, seed your test, run your code, assert against golden files or structured shapes. Tests become declarative instead of imperative-with-setup-noise.

Building this yourself rather than gluing together `@faker-js/faker`, `fishery`, and `snapshot-fluent` is justified because:
1. **Integration with `@nekostack/schema`.** Factories generate values that conform to schemas. The factory for `User` knows the schema is `User`, and the generated data is guaranteed to validate.
2. **Deterministic by default.** Every factory takes a seed. Same seed produces same output. Tests are reproducible without thinking.
3. **One unified test API.** Across 80 packages and 9+ products, the testing idioms are consistent. Muscle memory carries over.

## Scope

### In scope
- Factory pattern with schema-driven defaults: `factory(User).build()` produces a valid User.
- Trait composition: `factory(User).traits('admin', 'verified').build()`.
- Sequencing and overrides: `factory(User).build({ email: 'specific@example.com' })`.
- Deterministic randomness via seeded PRNG.
- Golden-file assertions: `expect(result).toMatchGolden('combat-log.json')`.
- Time/clock control helpers.
- Snapshot fixtures (loadable on-demand entity graphs).
- Custom matchers for NekoStack-specific types (`toMatchAccessDecision`, `toBeValidSchemaShape`, etc.).

### Out of scope
- Test running. Vitest is the runner. We don't replace it.
- E2E browser testing. Playwright is the right tool.
- Visual regression. Use Playwright + a service.
- Mocking individual functions. Vitest's `vi.mock` is fine. Service-level mocking belongs in `@nekostack/mock`.

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§45 for the full capability map.

### Owns
- Schema-driven factory API (`factory(Schema).build()`)
- Trait composition + sequence helpers
- Deterministic seeded factories (failures print seed for reproducibility)
- Golden-file matcher (`toMatchGolden`)
- Custom matchers for NekoStack-specific types
- Fake clock helpers
- Test fixture loaders

### Does NOT own
| Capability | Lives in |
|---|---|
| Test runner | external (Vitest) |
| Deterministic PRNG primitives | `random` (we use it; we don't define it) |
| Faker-style data generators | external (`@faker-js/faker` â€” wrapped) |
| E2E browser testing | external (Playwright) |
| Property-based / fuzz testing | `fuzz` |
| Service mocking | `mock` |
| Visual regression testing | TBD (folded into `test` sub-module later) |
| Performance benchmarks | `bench` |

## Competitors and adjacent tools

| Tool | What they do well | Where they fall short for us |
|---|---|---|
| **@faker-js/faker** | Excellent fake data generators. | Just data; no factories, no schema awareness. |
| **fishery** | TypeScript factory library. | No schema integration; manual default definitions. |
| **factory.ts** | Similar to fishery. | Same. |
| **vitest** (built-in) | The runner. Has `expect`, snapshots. | Snapshots are inline; no golden-file workflow. No factories. |
| **fast-check** | Property-based testing. | Different shape â€” lives in `@nekostack/fuzz`. |
| **jest-mock-extended** | Type-safe mocks. | Just mocking; lives in `@nekostack/mock`. |

The right framing: `@nekostack/test` is built **on top of** Vitest. We use faker internally for random word/email/name generation but wrap it in a factory layer. We use Vitest's snapshot machinery but provide a golden-file UX over it.

## How this fits the NekoStack

**Depends on:**
- Vitest (external runner).
- `@nekostack/schema` â€” for schema-driven factories.
- `@faker-js/faker` (or comparable) for primitive generators.

**Used by:**
- Every package's test suite.
- Every consuming project's test suite.

## Design philosophy

- **Declarative tests.** A test reads as "given X, when Y, expect Z" â€” not "construct 30 lines of setup, call the function, assert."
- **Reproducible failures.** Seeds are explicit. A failing test prints its seed in the failure message so reruns reproduce the same failure.
- **Schema awareness, not duplication.** Factories know the schema. You don't define a `User` shape in a factory AND a schema.
- **Golden files over inline snapshots.** Inline snapshots clutter the source. Golden files in `tests/__golden__/` are reviewable as files and diff cleanly.
- **No magic.** A test should be readable in isolation, without needing to chase setup files.

## Architecture sketch

```
packages/test/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ factory/
â”‚   â”‚   â”œâ”€â”€ builder.ts        # factory(schema).build(), .buildList()
â”‚   â”‚   â”œâ”€â”€ traits.ts         # trait registration + composition
â”‚   â”‚   â””â”€â”€ sequences.ts      # incrementing sequence helpers
â”‚   â”œâ”€â”€ random/
â”‚   â”‚   â”œâ”€â”€ prng.ts           # seeded PRNG
â”‚   â”‚   â””â”€â”€ primitives.ts     # name, email, uuid, etc. (faker wrappers, seeded)
â”‚   â”œâ”€â”€ golden/
â”‚   â”‚   â”œâ”€â”€ matcher.ts        # toMatchGolden custom matcher
â”‚   â”‚   â””â”€â”€ workflow.ts       # update / review / reject
â”‚   â”œâ”€â”€ clock/
â”‚   â”‚   â”œâ”€â”€ fake-clock.ts     # time control
â”‚   â”‚   â””â”€â”€ tick.ts           # advance time, run scheduled tasks
â”‚   â”œâ”€â”€ matchers/             # NekoStack-specific custom matchers
â”‚   â””â”€â”€ fixtures/             # snapshot loaders for shared test data
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

Usage:

```ts
import { factory } from '@nekostack/test';
import { User } from '@/schemas';

test('admin user can access settings', () => {
  const admin = factory(User).traits('admin').build();
  const result = canAccessSettings(admin);
  expect(result).toMatchGolden('admin-access-decision.json');
});
```

## Roadmap

### v0.1 â€” Factories
- `factory()` API with schema integration.
- Override / merge semantics.
- Vitest integration.

### v0.2 â€” Determinism
- Seeded PRNG.
- Faker wrappers with seed propagation.
- Failure messages print seed for reproducibility.

### v0.3 â€” Golden files
- `toMatchGolden(path)` matcher.
- CLI workflow: `neko test golden review`, `neko test golden update`.

### v0.4 â€” Traits + sequences
- Trait registration.
- Sequence helpers (`sequence('userIndex')`).

### v0.5 â€” Clock + scheduling
- Fake clock with `tick()`, `setTime()`.
- Integration with `@nekostack/jobs` for testing scheduled work.

### v1.0 â€” Stable API
- Custom matcher library.
- Documentation site with patterns and recipes.

## Product potential

**Internal use:** Essential. Every test suite uses this.

**Open source release:** Moderate. The factory + golden-file + schema-integration combo is genuinely undersupplied in the JS ecosystem. Most existing tools handle one of the three. An integrated release could attract users.


**Estimated effort to v1.0:** 3-5 weeks. The factory pattern is well-understood; the schema integration is the unique bit and not large. Golden-file UX is mostly polish.

## Status

- **Current:** Empty placeholder. Not started.
- **Owner:** Cody (solo dev project).
- **Priority tier:** Foundation primitive. Build alongside `@nekostack/schema` since they're co-dependent.
- **Estimated learning return:** High. Factory design, deterministic PRNGs, custom matcher authoring, golden-file workflows, and the discipline of writing tests well are all transferable.
