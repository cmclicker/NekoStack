# NekoStack — Package/Feature Lifecycle (Stage-Gate Model)

> **Human-owned doctrine.** This file defines the stages every package/feature passes
> through from design to product, and the *gate* (definition of done) to exit each stage.
> Edit this freely — it is the source of truth the evaluator and the gate scripts read.
> The AI does not edit this without explicit approval.

## Principle

Each gate is either a **deterministic check** (a script proves it; no human/AI judgment)
or a **human sign-off** (judgment required; the AI may surface but never self-certify).
Truth comes from scripts. Governance comes from you. The AI proposes and halts.

## Stages

| Stage | Exit gate (definition of done) | Enforced by |
|---|---|---|
| 0 · Scaffold | Named in `BOUNDARIES.md`; README with scope + thesis-fit answered | human sign-off |
| 1 · Spec | Requirements + invariants + **test-case list** (use / edge / niche / failure) written *before* code | human sign-off |
| 2 · Design | API surface + dependencies justified (PRODUCT_THESIS four questions) + ADR for load-bearing decisions | human sign-off |
| 3 · Implement | Builds clean, typechecks | **script** |
| 4 · Test | Tests written *from the spec list* (not the code), property-based where applicable, all green, every named case covered + one adversarial pass | **script** + human |
| 5 · Audit | Docs match code (drift checks green), no stale claims, thesis-fit re-confirmed | **script** + human |
| 6 · Release | version + matching git tag + changelog + license + packaged | **script** + human |

## How the evaluator uses this

`scripts/evaluate-readiness.mjs` computes, per package, the **proven stage** — the highest
stage whose deterministic signals hold — and lists the **gaps** blocking the next gate and
any **overstatement flags** (claims the code can't back). It is *static* analysis: it judges
presence/consistency, not quality. The judgment gates (1, 2, and the human half of 4–6)
remain your sign-off.

## What the evaluator CANNOT do

- Judge whether a design/spec is *good* (only whether the artifact exists).
- Catch semantic regressions inside green tests (e.g., a gutted test suite that still passes).
- Replace your review. It makes the rote part of your checkpoint cheap; it is not the checkpoint.
