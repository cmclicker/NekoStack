# Phase Plan: `@nekostack/schema` v0.2 — TypeScript + Zod generators

> **PLAN only — no code in the PR that lands this doc.** Per the post-v0.1 guidance: pre-bake the audit into the design.
>
> Reviewed against [`checklists/package/implementation-acceptance.md`](../../../checklists/package/implementation-acceptance.md). Once this plan is approved, the implementation candidate opens on `feat/schema-v0.2-candidate`.

## Phase scope

v0.2 ships three things, all consuming the v0.1 `SchemaNode` IR:

1. **`generateTypeScript(node, options?) → string`** — emits a TS type alias matching `s.infer<Schema>` for the given IR.
2. **`generateZod(node, options?) → string`** — emits Zod 3.x schema code that, when executed against an input, accepts/rejects per the IR's semantics.
3. **Deterministic generated-file header** — every generator output starts with a header containing `schemaId`, `schemaVersion`, `irHash`, generator name + version. (No `sourceHash` yet — that requires the CLI to walk source files; deferred to v0.7.)

Supporting work:
- `irHash(node) → string` — sha256 of `serializeIR(node)`, hex-encoded.
- Snapshot tests: byte-for-byte expected output per fixture.
- Zod-execution tests: load generated Zod code into a real Zod runtime and assert pass/fail behavior matches the IR's intent.

## Explicit non-scope

The phase deliberately defers:

- JSON Schema generator → v0.3.
- OpenAPI generator → v0.4.
- Generators for IR kinds without v0.1 builders: `DateNode`, `UnionNode`, `RecursiveRefNode`, `TransformNode`, runtime `Refinement`. v0.2 generators **throw** `UnsupportedNodeKindError` on these; the throw is part of the contract and is tested.
- `sourceHash` field in headers — requires CLI integration.
- File-writing utilities — generators return strings; writing to disk is a downstream concern.
- `neko schema generate / check / diff` CLI handlers → v0.7.
- Runtime parse/validate → v0.6.
- Zod 4.x target — v0.2 ships 3.x only.
- Composition operators (`extend`, `pick`, `omit`, `partial`, `required`, `merge`) → v0.5.

## Public API delta

To be added to `src/index.ts`:

```ts
export { generateTypeScript } from "./generators/ts.js";
export { generateZod } from "./generators/zod.js";
export type { GeneratorOptions } from "./generators/types.js";
export { GENERATOR_VERSION } from "./generators/version.js";
export { UnsupportedNodeKindError } from "./generators/errors.js";
export { irHash } from "./ir/hash.js";
```

Nothing is removed. v0.1 surface stays intact. Each new export is justified in the implementation PR per the checklist.

## Internal file delta

```
packages/schema/src/
├── generators/
│   ├── types.ts        # GeneratorOptions, GeneratorResult (if needed)
│   ├── version.ts      # GENERATOR_VERSION constant
│   ├── header.ts       # buildHeader(node, generatorName, generatorVersion)
│   ├── errors.ts       # UnsupportedNodeKindError
│   ├── ts.ts           # TS type-alias generator
│   └── zod.ts          # Zod 3.x generator
└── ir/
    └── hash.ts         # irHash(node) — sha256 of canonical serialization
```

Tests:

```
packages/schema/tests/
├── generators/
│   ├── ts.test.ts                  # snapshot tests
│   ├── zod.test.ts                 # snapshot tests
│   ├── zod-execution.test.ts       # exec generated code, assert behavior
│   ├── header.test.ts
│   └── unsupported-kinds.test.ts   # throw assertions
├── ir/
│   └── hash.test.ts
├── fixtures/                        # IR fixture files
└── __snapshots__/                   # generator output snapshots
```

## Dependency delta

- **peerDependency** added: `zod ^3.22.0`. Consumers install the Zod runtime themselves. Per [`docs/SCOPE.md`](./SCOPE.md), we **generate** Zod; we don't reimplement it.
- **devDependency** added: `zod ^3.22.0` for the Zod-execution test harness.
- No new external runtime dep. `crypto.createHash` is a Node built-in.
- No new `@nekostack/*` deps. Boundary stays clean.

## Invariants — phase-specific risk

All 8 invariants in [`docs/INVARIANTS.md`](./INVARIANTS.md) apply. Highest-risk for this phase:

| # | Invariant | Risk in v0.2 | Mitigation |
|---|---|---|---|
| 1 | IR is the only generator input | A generator that pattern-matches `node instanceof StringSchema` instead of `node.kind === "string"` violates this | Generator function signatures take `SchemaNode` only; builder classes are not imported anywhere under `src/generators/`. Lint/grep check during review. |
| 2 | Public API is small | Each new export must be justified | Listed above; PR body will justify each |
| 6 | Builders/IR are immutable | Generators must not mutate the IR they consume | Generators are pure functions; no `node.xyz = ...` anywhere |
| 7 | Runtime-only semantics marked explicitly | Encountering an unhandled IR kind must not silently emit garbage | `UnsupportedNodeKindError` thrown with kind + generator name; tested |

## Decisions to lock before coding

Ten open decisions. The plan PR exists to resolve them — please weigh in inline:

1. **TS emit shape**: type alias only (`export type User = { ... }`), not interface. Reason: type aliases handle unions / intersections / transforms cleanly; interfaces can't. ➜ confirm.
2. **Zod target**: Zod 3.x only in v0.2. Zod 4 has breaking changes; defer to a future generator option. ➜ confirm.
3. **Header format**: JSDoc block comment, one field per line, matching the package README's "Generated artifact policy" example but with `sourceHash` omitted. ➜ confirm. (Codified during candidate PR in a new `docs/HEADER_FORMAT.md`.)
4. **Anonymous schemas (no `.id()`)**: header `schemaId` field is `null` and the header includes a `// anonymous schema` comment. Generator does not refuse. ➜ confirm.
5. **Generator version string**: `"@nekostack/schema@<package-version>"` (single source of truth, bumped with the package). Alternative: per-generator versioning (`"@nekostack/schema/zod@..."`). ➜ confirm single string.
6. **Snapshot technology**: vitest `toMatchFileSnapshot` (external `.snap`), not inline. Reason: diff-readable. Regeneration is an explicit `npm run snapshots:update`. ➜ confirm.
7. **Unhandled IR kind**: throw `UnsupportedNodeKindError({ kind, generator })`. Error class lives under `src/generators/errors.ts`. ➜ confirm error shape.
8. **Zod modifier mapping** (1:1 with absence-semantics table):
   - `optional()` → `.optional()`
   - `nullable()` → `.nullable()`
   - `nullish()` → `.nullish()`
   - `default(v)` → `.default(v)`
   ➜ confirm.
9. **TS generator emits `s.output` (not input)**: TS type produced matches the post-default, post-transform shape. Input/output split via a separate generator option is a v1.0 polish. ➜ confirm.
10. **`irHash` algorithm**: `sha256(serializeIR(node))` (UTF-8), hex-encoded. ➜ confirm.

## Checklist pre-mapping

Each section of [`checklists/package/implementation-acceptance.md`](../../../checklists/package/implementation-acceptance.md), pre-mapped to v0.2's strategy:

| Checklist section | v0.2 strategy |
|---|---|
| **Scope** | Implementation PR titled `feat(schema): v0.2 candidate — TS + Zod generators`, links this plan + ROADMAP v0.2 heading. |
| **Public API** | Six new exports listed in §"Public API delta", each justified in implementation PR body. |
| **Boundary** | No `@nekostack/*` imports. New peer dep on `zod` (external) declared in `SCOPE.md`. |
| **Contracts** | New contract doc `docs/HEADER_FORMAT.md` ships with the implementation PR. `INVARIANTS.md` extended with one corollary: "Generators throw, not warn, on unsupported IR kinds." |
| **Immutability + determinism** | Generators are pure functions of IR; explicit determinism test (generate twice, assert byte-equal). |
| **Tests** | Snapshot tests per fixture; Zod-execution tests run generated code in a real Zod runtime; throw tests cover every unsupported kind; header tests assert structure. |
| **Validation commands** | Same five (`test`, `typecheck`, `build`, `pack --dry-run`, `ls`); outputs in implementation PR body. |
| **Local artifacts** | `README.md` unchanged (already describes v0.2 in its Roadmap section). `docs/ROADMAP.md` v0.2 → "candidate". New `docs/HEADER_FORMAT.md`. |
| **Process** | Draft PR on `feat/schema-v0.2-candidate`. Ready-for-review only after self-audit walks the checklist clean. |

## Sequencing

The implementation PR lands as a single squash-merge but should be reviewable commit-by-commit:

1. `irHash` + tests
2. `header.ts` + tests
3. `UnsupportedNodeKindError` + per-kind throw tests
4. TS generator (leaves: string / number / boolean / literal / enum) + snapshot tests
5. TS generator (composites: array / object) + modifiers + metadata + snapshot tests
6. Zod generator (full surface) + snapshot tests
7. Zod-execution test harness + assertions
8. `docs/HEADER_FORMAT.md`
9. `src/index.ts` update

## Estimate

3–5 focused days. Highest-risk step is #7 (Zod-execution): loading generated TS-emitting-Zod code into a runtime cleanly may need a small harness (compile to JS string in-memory, `new Function`, or write to a tmp file and dynamic import). I'll prototype this early to confirm the approach.

## What this plan does NOT decide

Out-of-scope for this plan; deferred to later phases or future plan PRs:

- JSON Schema / OpenAPI generator shape (v0.3 / v0.4 plans).
- How the v0.7 CLI computes `sourceHash` and threads it into the existing header.
- How `irHash` participates in the v0.7 freshness check.
- Plugin contract for third-party generators (post-v1.0).

## Action requested from reviewer

- Approve / push back on the 10 decisions above.
- Flag any in-scope item you'd remove or any non-scope item you'd add.
- Confirm the test strategy is adequate.
- Confirm the file layout.

Once approved, this doc stays in the repo as historical reference; the implementation PR cites it.
