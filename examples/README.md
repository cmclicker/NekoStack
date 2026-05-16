# `examples/`

> Completed working examples. End-to-end demos showing how NekoStack packages compose. Read to learn; not modified.

## What lives here

Self-contained, runnable demonstrations:

- "Here's how `@nekostack/auth` + `@nekostack/tenant` + `@nekostack/entitlements` work together to gate a feature."
- "Here's how `@nekostack/schema` → `@nekostack/api` → generated client → form binding via `@nekostack/form` produces a typed end-to-end flow."
- "Here's a working puzzle game using `@nekostack/rules`, `@nekostack/sim`, `@nekostack/replay`."
- "Here's an LLM agent using `@nekostack/prompts`, `@nekostack/tools`, `@nekostack/sandbox`."

Each example is a folder you could `cd examples/<name> && npm install && npm run dev` and watch work.

Examples are designed to **demonstrate**, not to be the starting point for a real project. They're intentionally narrow: one capability, end-to-end, with explanatory comments.

## What does NOT live here

| Type | Where it goes | Why |
|---|---|---|
| A scaffold to start a new project from | `starters/` | Designed to be modified, not studied |
| A small fragment showing one technique | `snippets/` | Too small for example shape |
| The package itself with its own tests | `packages/<name>` | The implementation, not a demo |
| Production product code | (a sibling Neko* project) | Real products, not demos |
| Doctrine explaining the patterns | `references/` | Doctrine, not demonstration |

The distinguishing test: **is this designed to be read in full?** If yes → example. If designed to be forked and customized → starter. If a single small snippet → snippet.

## Naming + sharding

Most examples are flat under `examples/`. Shard when a domain accumulates many:

- `examples/saas/` — SaaS-shape examples (auth + entitlements + billing flows)
- `examples/game/` — game-shape examples
- `examples/agent/` — LLM agent examples
- `examples/api/` — API contract / codegen examples

Each example is a folder: `examples/<shard>/<name>/`. Inside:

- `README.md` explaining what's demonstrated, how to run, what to look at.
- Working source files.
- `package.json` with explicit dependencies.

## How to add an example

1. Identify the demonstration: "I want to show how X + Y + Z compose."
2. Build the example in place. Keep it small — single purpose.
3. Comment liberally. Examples are teaching artifacts; readers will read every line.
4. Add a README with:
   - What this demonstrates.
   - Run instructions.
   - The lines to focus on (highlight specific files / sections).
5. Don't optimize. Examples favor clarity over performance.

## Example hygiene

- **Examples rot when packages change.** When a consumed package has a breaking change, all examples using it need updates.
- **Keep them deterministic.** Examples that depend on network calls or external services frustrate readers.
- **Date the examples.** Note "Last verified against NekoStack vX.Y.Z" at the top.

## See also

- [`ARTIFACTS.md`](../ARTIFACTS.md) — taxonomy.
- [`starters/`](../starters/README.md) — for empty-shell starting points.
- [`snippets/`](../snippets/README.md) — for single-purpose atoms.
- [`references/`](../references/README.md) — for explanatory doctrine.
