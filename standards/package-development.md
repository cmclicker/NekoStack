# Standard: Package Development

> Every concrete NekoStack package — first commit through v1.0 — follows this standard. Violating it is a defect.

## The rule

A NekoStack package is a **contract**, not just code. Before any phase of a package is merged, it must satisfy three audits and own five local artifacts.

### 1. The three audits (required for every phase / version bump)

Every phase landing must answer all three. Failing any one blocks merge.

- **Scope audit.** Does the change implement only what the phase scope listed? Anything beyond it is rejected, even if the extra work is "nice to have." A bug fix doesn't include surrounding refactors; a v0.N candidate doesn't ship v0.N+1 features.
- **Contract audit.** Does the public API, the types, and the documented invariants behave as the docs say? "Tests pass" is necessary, not sufficient — tests prove the implementation matches the tests, not that the tests captured the right invariants.
- **Boundary audit.** Does the package import only from external deps and other packages it is explicitly allowed to depend on per [`BOUNDARIES.md`](../BOUNDARIES.md)? Cross-package imports without a documented dependency edge are rejected.

### 2. The five local artifacts (required for every package)

Each package owns these under `packages/<name>/docs/` (or equivalent — see Exceptions). They are the package's local enforcement layer, separate from repo-wide standards.

| Artifact | Owns | Why it exists |
|---|---|---|
| `SCOPE.md` | What the package owns + what it does NOT own (with the owning package named). Per-phase scope shipping in the current version. | Prevents scope creep. The "does not own" half is the load-bearing half. |
| `INVARIANTS.md` | Numbered list of rules that constrain every future phase. | Future-you reads this before adding a feature. If the feature violates an invariant, raise it explicitly — don't work around it silently. |
| `ROADMAP.md` | Phase plan (v0.1 → v1.0+) with what each phase includes and explicitly does NOT include. | Prevents misaligned expectations across audits. The "explicitly does not include" half blocks scope creep within phases. |
| Contract docs | Package-specific contracts that bind future work (`IR_CONTRACT.md`, `API_SHAPE.md`, `ERROR_CODES.md`, `ABSENCE_SEMANTICS.md`, etc.). **At least one is required when the package exposes behavior that downstream packages depend on.** Pure-internal utility packages with no downstream contract may omit. | Packages that bind downstream consumers need named, enforceable contracts beyond invariants — e.g., `@nekostack/schema`'s `IR_CONTRACT.md` constrains every future generator. Omitting these when downstream consumers exist leaves the contract implicit, which means it drifts. |
| Package `README.md` | What it is, why it exists, scope summary, links to the four files above. | The entry point — humans, agents, and downstream consumers all start here. |

### 3. Public API discipline

Every package exposes a single entry point (`src/index.ts`). Its surface is intentionally narrow:

- Each export is deliberate. If you cannot justify why something is public, it is internal.
- Future-only capabilities (declared types with no implementation yet) are NOT exported. They describe capacity, not capability.
- Implementation classes are usually exported as `type` only, not as runtime constructors, unless construction outside the package's DSL is a deliberate use case.

### 4. The "candidate before complete" pattern

A package version is a candidate until the three audits have passed and reviewers have accepted. **Do not push package implementations directly to `main`.** Open a draft PR, run the audits, address findings, then promote to ready-for-review.

The PR description must include:
- Scope statement: what this phase includes.
- Explicit non-scope: what this phase deliberately does NOT include.
- Invariants the phase upholds.
- Validation output: `test`, `typecheck`, `build`, `pack --dry-run`, `ls`.
- Answers to the [implementation-acceptance checklist](../checklists/package/implementation-acceptance.md).

## Examples

### Correct

[`packages/schema`](../packages/schema/) v0.1 is the reference implementation:

```
packages/schema/
├── README.md
├── docs/
│   ├── SCOPE.md
│   ├── INVARIANTS.md
│   ├── ROADMAP.md
│   ├── ABSENCE_SEMANTICS.md   ← contract doc
│   └── IR_CONTRACT.md          ← contract doc
├── src/
│   └── index.ts                ← tight public surface
└── tests/
    ├── builders.test.ts
    ├── inference.test-d.ts     ← type-level tests
    └── ir.test.ts
```

The PR for v0.1 is opened as a **draft**, answers the implementation-acceptance checklist, and explicitly lists what is **not** shipped (generators, parser, registry, etc.).

### Incorrect

- A package that ships v0.1 by writing code, running tests, pushing to `main`, with no scope statement and no per-package docs. The implementation may be correct, but there is no contract for future phases to honor — and no way to detect when a later phase silently violates it.
- A package whose `src/index.ts` exports every internal type "in case someone needs it." This freezes implementation details as public API and constrains every future refactor.
- A package that adds future-only IR / type / class definitions and re-exports them, implying support that does not exist.

## Exceptions

- **Pure-asset folders** (`references/`, `snippets/`, `configs/`, etc.) are not packages — they have no `src/`, no public API, no audits. This standard does not apply to them. See [`ARTIFACTS.md`](../ARTIFACTS.md).
- **First-commit placeholder packages** (a `packages/<name>/` with only a `README.md` describing intent and a placeholder `src/index.ts` exporting nothing) are exempt from the five-artifact rule until they ship their first version. Adding the artifacts is part of v0.1.
- **Single-author projects without code review** still follow this standard — the audits become a self-review discipline. The standard exists to constrain future-you, not just other reviewers.
- **The five-artifact rule allows folding small packages**: a tiny package may put SCOPE / INVARIANTS / ROADMAP as sections inside `README.md` instead of separate files. Contract docs almost always merit their own file because they get linked from elsewhere.

## Enforcement

- **Manual review (this standard).** The [implementation-acceptance checklist](../checklists/package/implementation-acceptance.md) is the operational form of this standard. Walk it before merging.
- **Static analysis (future).** A lint rule in `@nekostack/lint` should detect cross-package imports not declared in `BOUNDARIES.md` and reject them.
- **Runtime governance (future).** `@nekostack/governance` may publish runtime checks for invariant violations in shipped code (e.g., builder mutability).

## Rationale

The repo already has [`BOUNDARIES.md`](../BOUNDARIES.md) for capability ownership and [`ARTIFACTS.md`](../ARTIFACTS.md) for asset placement. What was missing: a standard for *how a package gets built and accepted*. Without it, every package's first commit risked becoming "code that passes tests" rather than "a contract future phases must honor."

`@nekostack/schema` v0.1 surfaced the gap because it is foundational — every other package will inherit its contracts. Treating it as a candidate, running an explicit audit, and producing local enforcement docs is the pattern. This standard generalizes the pattern so every future package gets the same discipline.

The deeper reason: the cost of accepting an under-audited package is paid by every downstream package that inherits its contract. The cost of pausing to audit is small.

## See also

- [`BOUNDARIES.md`](../BOUNDARIES.md) — capability ownership.
- [`ARTIFACTS.md`](../ARTIFACTS.md) — asset taxonomy.
- [`checklists/package/implementation-acceptance.md`](../checklists/package/implementation-acceptance.md) — the operational checklist.
- [`packages/schema/`](../packages/schema/) — first reference implementation.
