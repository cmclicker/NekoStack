# `@nekostack/schema` — Changelog

Per-milestone changes. Pairs with the git tags (`schema-vX.Y.Z`) and the [GitHub releases](https://github.com/cmclicker/NekoStack/releases). Format: newest first.

This package is workspace-internal (`private: true`, version `0.0.0`). The milestone identifiers are git/release markers, not npm publications.

---

## schema-v0.2.0 — 2026-05-16

[Tag](https://github.com/cmclicker/NekoStack/releases/tag/schema-v0.2.0) · merge commit [`eee079c`](https://github.com/cmclicker/NekoStack/commit/eee079c) · dogfood polish landed in [`17cd182`](https://github.com/cmclicker/NekoStack/commit/17cd182).

### Shipped

- **`generateTypeScript(node, options?)`** — TS type-alias generator with `mode: "input" | "output" | "both"` (default `"output"`). Absence-semantics input/output split preserved end-to-end.
- **`generateZod(node, options?)`** — Zod 3.x generator with fixed modifier ordering. See [`docs/ZOD_MODIFIER_ORDERING.md`](docs/ZOD_MODIFIER_ORDERING.md).
- **`irHash(node)`** — sha256 of canonical IR serialization, hex-encoded. Used by generated-file headers in v0.2; consumed (not introduced) by the v0.7 freshness check.
- **Deterministic generated-file headers** — schemaId, schemaVersion, irHash, generator, generatorVersion. See [`docs/HEADER_FORMAT.md`](docs/HEADER_FORMAT.md). `sourceHash` deferred to v0.7.
- **`UnsupportedNodeKindError`** — stable `code` / `kind` / `generator` fields. Tests assert on fields, not message text.
- **Runtime refinements throw, not skip** — both generators throw `UnsupportedNodeKindError({ kind: "runtimeRefinement" })` rather than silently dropping unsupported refinement kinds.
- **Snapshot tests** for generator output (`vitest` `toMatchFileSnapshot`, external `.snap` files).
- **Zod-execution tests** — load generated code into a real Zod runtime, validate fixtures.
- **Zod-modifier-composition tests** — the eight-row matrix from Decision #8 (optional / nullable / nullish / default and combinations).
- **v0.2 dogfood examples** — three realistic schemas (`Tenant`, `AuditEvent`, `Entitlement`) under [`examples/`](examples/) with committed generated artifacts under [`examples/generated/`](examples/generated/). The committed files double as snapshots for [`tests/examples/regenerate.test.ts`](tests/examples/regenerate.test.ts), so example drift fails CI.
- **Author-facing docs** — [`docs/USAGE.md`](docs/USAGE.md) and [`docs/EXAMPLES.md`](docs/EXAMPLES.md).
- **TS generator output polish** — nested object types indent per depth; array-of-object element parens use a structural top-level-union scanner.

### Dependency changes

- Added `zod ^3.22.0` as **optional `peerDependency`** (consumers using the generated Zod runtime install it themselves) and `devDependency` (for the execution test harness). Generators ship as pure TS; no runtime import of Zod from the package itself.

### Test count

- 44 → 163 (+119 net).

### Still deferred

- JSON Schema — v0.3
- OpenAPI 3.1 — v0.4
- Composition operators (`extend` / `pick` / `omit` / `partial` / `merge`) — v0.5
- Runtime `parse` / `validate` from this package directly — v0.6
- `neko schema generate / check / diff` CLI — v0.7
- `sourceHash` in generated headers — v0.7
- Migrations between schema versions — v0.8+
- Zod 4 target — future generator option (Zod 4 is stable; intentionally deferred for scope)

---

## schema-v0.1.0 — 2026-05-16

[Tag](https://github.com/cmclicker/NekoStack/releases/tag/schema-v0.1.0) · merge commit [`8a94853`](https://github.com/cmclicker/NekoStack/commit/8a94853). First package phase accepted under [`standards/package-development.md`](../../standards/package-development.md).

### Shipped

- **Canonical `SchemaNode` IR** — all 12 node kinds typed; 7 with v0.1 builders (string / number / boolean / literal / enum / array / object). Future kinds (date / union / recursiveRef / transform) declared internally but not surfaced.
- **DSL builders** — `s.string` / `s.number` / `s.boolean` / `s.literal` / `s.enum` / `s.array` / `s.object`.
- **Modifiers** — `optional` / `nullable` / `nullish` / `default`. `Schema` base tracks `TInputKey` and `TOutputKey` separately so default-bearing fields are correctly input-optional + output-required.
- **Metadata** — `id` / `version` / `describe` / `deprecated`.
- **Strict-by-default object policy** — `strict` (default) / `stripUnknown` / `passthrough`. Stored in IR; runtime enforcement deferred to v0.6.
- **Type inference** — `s.infer` / `s.input` / `s.output`.
- **`Issue` / `IssueCode` / `Result`** — vocabulary pinned; the parser that produces them ships in v0.6.
- **Canonical IR serialization** — `serializeIR(node)` sorts keys recursively, strips undefined. Foundation for v0.2's `irHash` and v0.7's freshness check.
- **Tight public API** — `src/index.ts` re-exports only v0.1-buildable node kinds. Implementation classes exported as type-only.
- **Package-local docs** — `README.md`, [`docs/SCOPE.md`](docs/SCOPE.md), [`docs/INVARIANTS.md`](docs/INVARIANTS.md), [`docs/ROADMAP.md`](docs/ROADMAP.md), [`docs/IR_CONTRACT.md`](docs/IR_CONTRACT.md), [`docs/ABSENCE_SEMANTICS.md`](docs/ABSENCE_SEMANTICS.md).
- **Package tooling** — first concrete package in the monorepo to wire `tsconfig.json` + `vitest.config.ts` + per-package scripts.

### Test count

- 0 → 44 (29 runtime + 15 type-level via `expectTypeOf`).

### Still deferred

- TypeScript generation — v0.2
- Zod generation — v0.2
- JSON Schema — v0.3
- OpenAPI — v0.4
- Composition operators — v0.5
- Runtime `parse` / `validate` — v0.6
- Schema registry + CLI + diff — v0.7
- Migrations — v0.8+

---

## Milestone process

For every shipped schema milestone:

1. Merge the implementation PR.
2. Merge the ROADMAP status PR (`candidate` → `shipped`; advance the next phase to `active target`).
3. Tag the implementation merge commit: `git tag -a schema-vX.Y.Z <sha> -m "..."` + `git push origin schema-vX.Y.Z`.
4. Create a GitHub release pointing at the tag.
5. Add a new section at the top of this file.
6. Keep `docs/` and `README.md` current — never duplicate them under `docs/v0.x/`.

The git history is the implementation truth; tags + releases + this changelog are the milestone-visible truth.
