# `@nekostack/cli` — Roadmap

Authoritative source for "what ships when" on the CLI side. The full design rationale lives in [`../README.md`](../README.md); this file is the operational checklist. Pairs with [`packages/schema/docs/ROADMAP.md`](../../schema/docs/ROADMAP.md) — the two roadmaps cross-reference at v0.7 because the phases ship jointly.

## v0.7 — `neko schema *` ← *active target*

Status: **plan-only draft** (PR pending). Plan: [`PHASE_PLAN_v0.7.md`](./PHASE_PLAN_v0.7.md). Master plan (schema-side): [`packages/schema/docs/PHASE_PLAN_v0.7.md`](../../schema/docs/PHASE_PLAN_v0.7.md).

First implementation phase for `@nekostack/cli`. The package was a placeholder through v0.1–v0.6; v0.7 is the phase that justifies its existence.

Ships:

- `neko` binary on PATH (via `bin` entry; run as `npx neko` or installed globally).
- `neko schema list` — enumerate every schema in the workspace, with id / version / source path / `irHash`.
- `neko schema diff <a> <b>` — classify the change from `a` to `b` as `breaking` / `additive` / `cosmetic`. Pretty output + `--json` for CI.
- `neko schema check [pattern]` — freshness gate. Exits nonzero if any generated artifact is out of sync with its source. The load-bearing CI signal.
- `neko schema generate [pattern]` — regenerate artifacts for matching schema files.
- Exit-code table (0 / 1 / 2 / 3 / 4) per the locked plan.
- Pretty default + `--json` opt-in across every command.
- In-process test harness for argv → exit-code / stdout / stderr assertions.

Explicitly deferred:

- **Plugin contract / `defineCommand` API.** The CLI README documents a long-term plugin-based shape; v0.7 ships the four schema commands directly without any plugin indirection. Plugin scaffolding lands when a second package needs subcommands.
- **`neko init` / `neko new`.** Project-bootstrap verbs. Land when `@nekostack/templates` has a stable starter contract to invoke.
- **`neko codex export` / `neko lint` / `neko sim run` / etc.** Subcommands owned by their respective packages. Each lands with its owning package's first CLI-bearing phase.
- **Interactive prompts.** No clack / inquirer / readline. v0.7 is CI-first.
- **`--watch` mode** for `check` / `generate`. Defer until a real consumer asks.
- **`neko schema validate <file>`** — runtime-data validation. Different concern; the v0.6 runtime is already library-importable. May land in v0.7.1.
- **Configuration file (`neko.config.json`).** Convention-driven in v0.7.

The CLI consumes [`@nekostack/schema`](../../schema)'s handler functions directly. Per the v0.7 plan's locked schema/cli ownership:

- `@nekostack/schema` owns: registry, diff, `sourceHash`, handler functions.
- `@nekostack/cli` owns: argv parse, dispatch, formatters, exit codes, filesystem I/O.

## v0.8+ — TBD

Subcommand families owned by their packages will register here as they land. Likely first additions:

- `neko codex export` once `@nekostack/codex` has a stable entity-graph export shape.
- Plugin contract once the second subcommand family needs to land.
- `neko init` once `@nekostack/templates` has a stable starter contract.

## v1.0 — Stable CLI surface

- Plugin contract frozen.
- Help output stable across versions.
- `--json` output schema documented per command.
- Cross-platform behavior (Windows / Linux / macOS) verified per command.

---

Future phases must respect the invariants in [`SCOPE.md`](./SCOPE.md) (when added during the v0.7 implementation) and the cross-package boundary in [`BOUNDARIES.md`](../../../BOUNDARIES.md) §45. If a phase needs to violate one, raise it explicitly; do not work around it silently.
