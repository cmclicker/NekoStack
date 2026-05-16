# Checklist: Package Implementation Acceptance

> Walk this top-to-bottom **before merging any package phase** (v0.1 candidate, v0.2 candidate, …). Each item is binary: yes / no. If any blocking item fails, do not merge.
>
> Operational form of [`standards/package-development.md`](../../standards/package-development.md). The reference implementation that demonstrates a clean walk is [`packages/schema`](../../packages/schema/) v0.1.

## Trigger

A package version is candidate for merge — i.e., a draft PR exists, code compiles, tests pass locally.

## Scope (blocking)

- [ ] The PR description names which phase this is (v0.1 candidate, v0.2 candidate, etc.) and links to the phase entry in the package's `ROADMAP.md`.
- [ ] Every shipped feature maps to a scope item listed for this phase.
- [ ] No feature outside this phase's scope is shipped, even partially.
- [ ] The PR description explicitly lists what this phase **does NOT** include.

## Public API (blocking)

- [ ] Every export from `src/index.ts` is justified in the PR description.
- [ ] No future-only capability (declared but unimplemented types, classes, IR kinds) is re-exported. Such items remain package-internal.
- [ ] Implementation classes are exported as `type` only, unless construction outside the DSL is a deliberate use case.
- [ ] No `// @internal` or similarly-tagged item is exported.

## Boundary (blocking)

- [ ] `grep` for `@nekostack/` imports in the package source returns only allowed cross-package dependencies (each documented in [`BOUNDARIES.md`](../../BOUNDARIES.md)).
- [ ] `npm ls --workspace=@nekostack/<name>` shows only the expected runtime + dev deps. No surprise transitive NekoStack deps.
- [ ] The package's `SCOPE.md` lists the capabilities it does NOT own, and they match [`BOUNDARIES.md`](../../BOUNDARIES.md).

## Contracts (blocking)

- [ ] Every invariant in the package's `INVARIANTS.md` is upheld by this phase, or the PR explicitly raises the violation and seeks approval to amend the invariants.
- [ ] Contract-defining behavior (absence semantics, error vocabulary, IR shape, etc.) has a test that fails if the contract drifts. Tests reference the contract by name in the `describe(...)` string.
- [ ] Where outputs cannot faithfully represent the contract (e.g., a runtime-only refinement in JSON Schema), the gap is marked explicitly — not silently dropped.

## Immutability + determinism (blocking, where applicable)

- [ ] Builder/IR data structures are frozen (`Object.freeze`) on construction; mutation tests assert `TypeError` in strict mode.
- [ ] Generators, serializers, and any other "same input → same output" surface have a determinism test (byte-identical output across two runs or under irrelevant input reordering).

## Tests (blocking)

- [ ] Runtime tests cover happy path + edge cases for each public surface.
- [ ] Type-level tests (via `expectTypeOf` or equivalent) cover any type-inference contract the package promises.
- [ ] Tests read like the contract — `describe` strings name the behavior, not the implementation.
- [ ] No skipped or `.only` tests committed.

## Validation commands (blocking)

Each must produce clean output. The PR description includes the actual output, not just the command.

- [ ] `npm test --workspace=@nekostack/<name>` — all pass, zero type errors.
- [ ] `npm run typecheck --workspace=@nekostack/<name>` — clean.
- [ ] `npm run build --workspace=@nekostack/<name>` — clean.
- [ ] `npm pack --workspace=@nekostack/<name> --dry-run` — file count + size sane; no `node_modules`, no `dist/.tsbuildinfo`, no scratch files.
- [ ] `npm ls --workspace=@nekostack/<name>` — dep tree as expected.

## Local artifacts (blocking)

Per [`standards/package-development.md`](../../standards/package-development.md), the package must own these (separate files or folded into `README.md` for small packages — but they must exist):

- [ ] `README.md` — package overview + links to the rest.
- [ ] `docs/SCOPE.md` — what it owns + what it explicitly does NOT own (and which package does).
- [ ] `docs/INVARIANTS.md` — numbered rules that constrain every future phase.
- [ ] `docs/ROADMAP.md` — phase plan, with each phase listing what it includes AND explicitly does NOT include.
- [ ] Contract docs (zero or more, named for the contract they own — e.g., `IR_CONTRACT.md`, `API_SHAPE.md`, `ERROR_CODES.md`, `ABSENCE_SEMANTICS.md`).

## Process (blocking)

- [ ] PR is opened as **draft** initially. Promote to ready-for-review only after this checklist is fully walked.
- [ ] PR is on a branch (`feat/<name>-vX.Y-candidate` or similar), **not pushed directly to `main`**.
- [ ] Commit messages follow the repo's commit format ([`standards/commit-format.md`](../../standards/commit-format.md) when it ships; until then, Conventional Commits with NekoStack scope vocabulary).

## Advisory (not blocking, worth flagging)

- [ ] Any `TODO` / `FIXME` / `XXX` left in the source is justified inline.
- [ ] Open questions / decisions deferred to a later phase are listed in the PR description.
- [ ] Notes for the future-you reading this PR cold are written into either `docs/` or a code comment, not only in the PR thread.

## After merge

- [ ] The branch is deleted from the remote.
- [ ] The package's `ROADMAP.md` is updated: this phase moves from "candidate" to "shipped"; the next phase becomes the active target.
- [ ] If any invariants changed, [`standards/package-development.md`](../../standards/package-development.md) is reviewed for whether the standard itself needs an update.
