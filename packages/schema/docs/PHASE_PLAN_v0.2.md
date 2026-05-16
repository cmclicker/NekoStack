# Phase Plan: `@nekostack/schema` v0.2 — TypeScript + Zod generators

> **PLAN only — no code in the PR that lands this doc.** Per the post-v0.1 guidance: pre-bake the audit into the design.
>
> Reviewed against [`checklists/package/implementation-acceptance.md`](../../../checklists/package/implementation-acceptance.md). Once this plan is approved, the implementation candidate opens on `feat/schema-v0.2-candidate`.

## Phase scope

v0.2 ships three things, all consuming the v0.1 `SchemaNode` IR:

1. **`generateTypeScript(node, options?) → string`** — emits a TS type alias for the given IR. Supports `mode: "output" | "input" | "both"` (default `"output"`) so the v0.1 input/output split is honored at generation time, not just at the `s.infer` / `s.input` / `s.output` level.
2. **`generateZod(node, options?) → string`** — emits Zod 3.x schema code that, when executed against an input, accepts/rejects per the IR's semantics. Modifier ordering follows the contract in Decision #8 so the v0.1 absence-semantics table is preserved through to runtime Zod.
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
│   ├── types.ts        # GeneratorOptions (incl. TS `mode: input|output|both`)
│   ├── version.ts      # GENERATOR_VERSION constant
│   ├── header.ts       # buildHeader(node, generatorName, generatorVersion)
│   ├── errors.ts       # UnsupportedNodeKindError (stable code/kind/generator)
│   ├── ts.ts           # TS type-alias generator (input/output/both modes)
│   └── zod.ts          # Zod 3.x generator (modifier ordering per Decision #8)
└── ir/
    └── hash.ts         # irHash(node) — sha256 of canonical serialization
```

Tests:

```
packages/schema/tests/
├── generators/
│   ├── ts.test.ts                  # snapshot tests across all three modes
│   ├── zod.test.ts                 # snapshot tests
│   ├── zod-execution.test.ts       # exec generated code, assert behavior
│   ├── zod-modifier-composition.test.ts  # absence-semantics parity (Decision #8)
│   ├── header.test.ts
│   └── unsupported-kinds.test.ts   # throw assertions (code/kind/generator fields)
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

## Decisions locked

Ten decisions. Status after the v0.2-plan review pass:

1. **TS emit shape**: type alias only (`export type User = { ... }`), not interface. Type aliases handle unions / intersections / transforms cleanly; interfaces cannot. **Approved.**

2. **Zod target**: Zod 3.x is the only v0.2 target — chosen for scope control and stability of this phase, not because Zod 4 is unstable. Zod 4 is stable and is the package root export for `zod@^4.0.0` (Zod 3 remains available via `zod/v3`). Zod 4 is intentionally deferred because it has breaking changes vs. Zod 3 and deserves its own generator target (or a compatibility pass) in a future phase, not a rushed inclusion here. **Approved with corrected wording.**

3. **Header format**: JSDoc block comment, one field per line, matching the package README's "Generated artifact policy" example but with `sourceHash` omitted (CLI-dependent, deferred to v0.7). Codified during the candidate PR in a new `docs/HEADER_FORMAT.md`. **Approved.**

4. **Anonymous schemas (no `.id()`)**: header `schemaId` field is `null` and the header includes a `// anonymous schema` comment. Generator does not refuse. **Approved.**

5. **Generator version string**: `"@nekostack/schema@<package-version>"` (single source of truth, bumped with the package). **Approved.**

6. **Snapshot technology**: vitest `toMatchFileSnapshot` (external `.snap`), not inline. Regeneration is an explicit `npm run snapshots:update`. **Approved.**

7. **Unhandled IR kind**: throws `UnsupportedNodeKindError` with a **stable machine-readable shape**:

   ```ts
   class UnsupportedNodeKindError extends Error {
     readonly code = "UNSUPPORTED_NODE_KIND" as const;
     readonly kind: string;                              // the IR node.kind that was rejected
     readonly generator: "typescript" | "zod";           // which generator threw
     constructor(args: { kind: string; generator: "typescript" | "zod" });
   }
   ```

   Tests assert on the **`code`, `kind`, and `generator` fields** — never on message text (message text is for humans and can change without breaking the contract). Error class lives at `src/generators/errors.ts`. **Approved with stricter shape.**

8. **Zod generation — modifier ordering contract**: not just a 1:1 mapping table; the *order* in which modifiers are applied changes Zod's input/output typing and runtime behavior, so the generator must apply them in a fixed sequence:

   1. Base schema (`z.string()`, `z.number()`, `z.object({...})`, etc.).
   2. Portable refinements (`.min()`, `.max()`, `.email()`, `.regex()`, `.int()`, `.multipleOf()`, etc.) — in IR insertion order.
   3. Nullability — `.nullable()` if `modifiers.nullable === true` and `modifiers.optional !== true`.
   4. Optionality — `.optional()` if `modifiers.optional === true` and `modifiers.nullable !== true`.
   5. Nullish — `.nullish()` if both `modifiers.optional === true` and `modifiers.nullable === true`.
   6. **Default LAST**: `.default(value)` if `modifiers.default` is set. Default applies *after* nullish/optional so the IR's "input-optional, output-required" semantics are preserved in the generated Zod type.

   Required modifier-composition tests (each gets a snapshot + an execution test that proves Zod input/output typing matches the v0.1 absence-semantics table):

   - `optional` alone
   - `nullable` alone
   - `nullish` alone
   - `default` alone
   - `optional + default` (input optional; output required)
   - `nullable + default`
   - `nullish + default`
   - Object containing each of the above as fields, asserting input vs output field requiredness parity with `s.input<T>` / `s.output<T>` from v0.1

   **Approved with full ordering contract.**

9. **TS generator emits input *and* output**: the input/output split is a v0.1 contract (default is input-optional + output-required), not v1.0 polish. The generator must support both. `generateTypeScript` takes a `mode` option:

   ```ts
   generateTypeScript(node, { mode: "output" })  // default
   generateTypeScript(node, { mode: "input" })
   generateTypeScript(node, { mode: "both" })
   ```

   Naming convention:
   - `mode: "output"` → `export type <Name> = ...` (e.g. `User`)
   - `mode: "input"` → `export type <Name>Input = ...` (e.g. `UserInput`)
   - `mode: "both"` → emits both `<Name>Input` and `<Name>Output` (no bare `<Name>` — `both` is explicit on both sides)

   Default is `"output"` to match `s.infer` ergonomics. Tests cover all three modes against the v0.1 absence-semantics table. **Approved with corrected scope — input/output split is in v0.2.**

10. **`irHash` algorithm**: `sha256(serializeIR(node))` over UTF-8 bytes, hex-encoded. The v0.2 implementation PR **also updates [`docs/ROADMAP.md`](./ROADMAP.md)** so v0.2 explicitly lists `irHash(node)` as shipped supporting work, and v0.7 reads as "freshness checks **consume** the existing `irHash`" — not "introduce `irHash`." Otherwise plan and roadmap drift. **Approved with roadmap alignment.**

## Checklist pre-mapping

Each section of [`checklists/package/implementation-acceptance.md`](../../../checklists/package/implementation-acceptance.md), pre-mapped to v0.2's strategy:

| Checklist section | v0.2 strategy |
|---|---|
| **Scope** | Implementation PR titled `feat(schema): v0.2 candidate — TS + Zod generators`, links this plan + ROADMAP v0.2 heading. |
| **Public API** | Six new exports listed in §"Public API delta", each justified in implementation PR body. |
| **Boundary** | No `@nekostack/*` imports. New peer dep on `zod` (external) declared in `SCOPE.md`. |
| **Contracts** | Two new contract docs ship with the implementation PR: `docs/HEADER_FORMAT.md` (header field spec) and `docs/ZOD_MODIFIER_ORDERING.md` (the modifier-ordering contract from Decision #8). `INVARIANTS.md` extended with two corollaries: "Generators throw, not warn, on unsupported IR kinds" (stable code/kind/generator fields, asserted by tests) and "Generated Zod modifier order follows the absence-semantics table." |
| **Immutability + determinism** | Generators are pure functions of IR; explicit determinism test (generate twice, assert byte-equal). |
| **Tests** | Snapshot tests per fixture; Zod-execution tests run generated code in a real Zod runtime; modifier-composition tests prove absence-semantics parity between IR / generated Zod / generated TS (input + output modes); throw tests cover every unsupported kind and assert on `code`/`kind`/`generator` fields; header tests assert structure. |
| **Validation commands** | Same five (`test`, `typecheck`, `build`, `pack --dry-run`, `ls`); outputs in implementation PR body. |
| **Local artifacts** | `README.md` unchanged (already describes v0.2 in its Roadmap section). `docs/ROADMAP.md` updated per Decision #10: v0.2 lists `irHash(node)` as shipped work; v0.7 says freshness checks **consume** the existing `irHash` rather than introducing it. v0.2 status flipped to "candidate" while the implementation PR is open. Two new contract docs (`HEADER_FORMAT.md`, `ZOD_MODIFIER_ORDERING.md`). |
| **Process** | Draft PR on `feat/schema-v0.2-candidate`. Ready-for-review only after self-audit walks the checklist clean. |

## Sequencing

The implementation PR lands as a single squash-merge but should be reviewable commit-by-commit:

1. `irHash` + tests.
2. `header.ts` + tests.
3. `UnsupportedNodeKindError` (with stable `code` / `kind` / `generator` fields) + per-kind throw tests asserting on fields, not message text.
4. TS generator: leaves (string / number / boolean / literal / enum) in **output mode** + snapshot tests.
5. TS generator: composites (array / object) + modifiers + metadata + snapshot tests (output mode).
6. TS generator: **input mode** + **both mode**, with absence-semantics parity tests against `s.input<T>` / `s.output<T>`.
7. Zod generator: full surface, applying modifier ordering per Decision #8 + snapshot tests.
8. Zod **modifier-composition tests** (the eight cases listed in Decision #8) — proves absence-semantics parity end-to-end (IR ↔ generated TS input ↔ generated TS output ↔ generated Zod runtime).
9. Zod-execution test harness + assertions.
10. `docs/HEADER_FORMAT.md` + `docs/ZOD_MODIFIER_ORDERING.md`.
11. `docs/ROADMAP.md` update per Decision #10 (v0.2 lists `irHash`; v0.7 consumes it).
12. `docs/INVARIANTS.md` extended with the two phase corollaries.
13. `src/index.ts` update + per-export justifications in PR body.

## Estimate

4–6 focused days (revised from 3–5 after expanding TS to all three modes + adding the modifier-composition test matrix). Highest-risk step remains the Zod-execution harness — prototype it early.

## What this plan does NOT decide

Out-of-scope for this plan; deferred to later phases or future plan PRs:

- JSON Schema / OpenAPI generator shape (v0.3 / v0.4 plans).
- How the v0.7 CLI computes `sourceHash` and threads it into the existing header.
- The exact freshness-check algorithm in v0.7 (only that it will consume `irHash`).
- Plugin contract for third-party generators (post-v1.0).
- Zod 4 target — its own future generator option, not a rushed inclusion here.

## Decision history

- **v0.2-plan, initial draft** — 10 open decisions, plan-only PR.
- **v0.2-plan, post-review amendment** — decisions #2, #7, #8, #9, #10 corrected per review:
  - #2 reworded to acknowledge Zod 4 is stable but intentionally deferred.
  - #7 tightened to a stable error shape (`code` / `kind` / `generator` fields).
  - #8 expanded from a 1:1 mapping table to a full modifier-ordering contract + 8 required composition tests.
  - #9 changed from "TS output only (v1.0 polish)" to "TS supports `input` / `output` / `both` modes in v0.2".
  - #10 augmented with a ROADMAP-alignment requirement.

## Action requested from reviewer

- Final ack on the amended decisions.
- Flag any further in-scope item you'd remove or any non-scope item you'd add.

Once approved, this doc stays in the repo as historical reference; the implementation PR cites it.
