# `@nekostack/schema` — Changelog

Per-milestone changes. Pairs with the git tags (`schema-vX.Y.Z`) and the [GitHub releases](https://github.com/cmclicker/NekoStack/releases). Format: newest first.

This package is workspace-internal (`private: true`, version `0.0.0`). The milestone identifiers are git/release markers, not npm publications.

---

## schema-v0.2.1 — 2026-05-16

[Tag](https://github.com/cmclicker/NekoStack/releases/tag/schema-v0.2.1) · merge commit [`17cd182`](https://github.com/cmclicker/NekoStack/commit/17cd182). Patch release on the v0.2 line — proof artifacts + generator output polish from the dogfood pass.

### Shipped

- **v0.2 dogfood examples** — three realistic schemas (`Tenant`, `AuditEvent`, `Entitlement`) under [`examples/`](examples/) with committed generated artifacts under [`examples/generated/`](examples/generated/). The committed files double as snapshots for [`tests/examples/regenerate.test.ts`](tests/examples/regenerate.test.ts), so example drift fails CI.
- **Author-facing docs** — [`docs/USAGE.md`](docs/USAGE.md) and [`docs/EXAMPLES.md`](docs/EXAMPLES.md).
- **TS generator: nested object indentation** — nested object types now indent per depth (was: collapsed to outer-field column).
- **TS generator: array-of-object element parens** — replaced unsafe `startsWith("{")` heuristic with a structural top-level-union scanner. Closes the semantic hole where `s.array(s.object({...}).optional())` could emit `{...} | undefined[]` (parsed as "object OR array of undefined") instead of the correct `({...} | undefined)[]`.

### Test count

- 144 → 163 (+19 since v0.2.0): 9 regenerate-test cases, 4 nested-indent assertions, 6 array-paren assertions.

### Why this was its own release

The dogfood polish changed generator behavior (real bug fix in the array-paren case, presentational change in the nested-indent case). Folding it under `schema-v0.2.0` would have understated the change and made the tagged release diverge from main. A patch tag preserves honesty without bumping the minor version.

### No public API change

- No new exports.
- No new dependency.
- `src/index.ts` unchanged from v0.2.0.

### Still deferred

Same as v0.2.0 (see below).

---

## schema-v0.2.0 — 2026-05-16

[Tag](https://github.com/cmclicker/NekoStack/releases/tag/schema-v0.2.0) · merge commit [`eee079c`](https://github.com/cmclicker/NekoStack/commit/eee079c).

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

### Dependency changes

- Added `zod ^3.22.0` as **optional `peerDependency`** (consumers using the generated Zod runtime install it themselves) and `devDependency` (for the execution test harness). Generators ship as pure TS; no runtime import of Zod from the package itself.

### Test count

- 44 → 144 (+100 net at the tag commit; v0.2.1 took it to 163).

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
2. Merge the dogfood / proof PR if one exists (examples, generator polish surfaced during dogfooding, regenerate snapshots).
3. Merge the ROADMAP status PR (`candidate` → `shipped`; advance the next phase to `active target`).
4. Tag the **final** commit on the milestone — i.e. the dogfood merge if there is one, otherwise the implementation merge. Use `git tag -a schema-vX.Y.Z <sha> -m "..."` + `git push origin schema-vX.Y.Z`.
5. Create a GitHub release pointing at the tag.
6. Add a new section at the top of this file.
7. Keep `docs/` and `README.md` current — never duplicate them under `docs/v0.x/`.

Behavior-changing dogfood polish that lands AFTER the implementation has already been tagged gets its own patch milestone (`schema-v0.2.1`-style) — see the v0.2 line in this changelog for the working precedent. Folding it back into the implementation tag would make the tagged release diverge from main and understate the change.

The git history is the implementation truth; tags + releases + this changelog are the milestone-visible truth.
