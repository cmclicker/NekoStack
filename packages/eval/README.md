# @nekostack/eval

> LLM evaluation framework: test suites, regression detection, output schema validation, rubric-based scoring. The "is this prompt / model / RAG actually working?" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | AI / LLM |
| **Depends on** | `schema` (eval definitions), `prompts` (eval target), `rag` (RAG eval), `audit` (eval results), `bench` (regression patterns), `governance` (eval gates) |
| **Used by** | every LLM-using project; CI eval runs; prompt-versioning regressions |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 10â€“16 weeks focused |

## Why this exists

LLMs are non-deterministic. "Did this prompt change make things better or worse?" can't be answered without an eval suite. Eval needs:
- Test cases (input â†’ expected behavior).
- Rubrics (graders that score outputs).
- LLM-as-judge support (use a stronger model to evaluate).
- Regression detection (this prompt version performs worse than the previous one).
- Output schema validation (did the model return valid JSON?).
- Retrieval evaluation (for RAG: did we retrieve the right docs?).

## Scope

### In scope
- Eval definition DSL (test case â†’ expected â†’ graders).
- Graders (exact match / contains / regex / schema-valid / LLM-as-judge / custom).
- LLM-as-judge support.
- Regression detection (compare versions).
- Output schema validation.
- RAG retrieval eval (precision / recall).
- CI eval gates (governance integration).
- Eval result reporting.

### Out of scope
- Functional code tests (`test`).
- Performance benchmarks (`bench`).
- Property-based tests (`fuzz`).

## Boundary

### Owns
- Eval definition + grader DSL
- LLM-as-judge
- Regression detection
- Output validation evals
- RAG retrieval evals
- CI integration
- Reporting

### Does NOT own
| Capability | Lives in |
|---|---|
| Code unit tests | `test` |
| Performance benchmarks | `bench` |
| Fuzz testing | `fuzz` |
| Prompt management | `prompts` |
| RAG itself | `rag` |
| Audit log | `audit` |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **Braintrust** | Hosted LLM evals. | Vendor; SaaS. |
| **LangSmith** | LangChain-coupled evals. | LangChain lock. |
| **OpenAI Evals** | Open framework. | Python; OpenAI-flavor. |
| **Promptfoo** | TS-native CLI eval. | Closer fit; could draw inspiration. |
| **Custom test scripts** | Common. | No regression detection, no LLM-judge support. |

## How this fits the NekoStack

- **`prompts`** is the target of evals.
- **`rag`** retrieval is evaluated.
- **`audit`** records eval results.
- **`bench`** patterns for regression detection.
- **`governance`** gates ("no prompt change ships if eval regresses by N%").

## Design philosophy

- **Evals are code.** Version-controlled, runnable in CI.
- **LLM-as-judge is real.** A stronger model grading outputs is often the right grader.
- **Regression detection is mandatory.** Don't just score; compare to baseline.
- **Schema validation as eval.** "Did the model return valid JSON?" is a basic eval.

## Architecture sketch

```
packages/eval/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ define/
â”‚   â”‚   â”œâ”€â”€ eval.ts            # defineEval({ cases, graders, ... })
â”‚   â”‚   â””â”€â”€ case.ts
â”‚   â”œâ”€â”€ graders/
â”‚   â”‚   â”œâ”€â”€ exact-match.ts
â”‚   â”‚   â”œâ”€â”€ contains.ts
â”‚   â”‚   â”œâ”€â”€ regex.ts
â”‚   â”‚   â”œâ”€â”€ schema-valid.ts
â”‚   â”‚   â”œâ”€â”€ llm-judge.ts
â”‚   â”‚   â””â”€â”€ custom.ts
â”‚   â”œâ”€â”€ regression/
â”‚   â”‚   â”œâ”€â”€ compare.ts
â”‚   â”‚   â””â”€â”€ baseline.ts
â”‚   â”œâ”€â”€ retrieval/
â”‚   â”‚   â”œâ”€â”€ precision.ts
â”‚   â”‚   â””â”€â”€ recall.ts
â”‚   â”œâ”€â”€ ci/
â”‚   â”‚   â””â”€â”€ gate.ts
â”‚   â”œâ”€â”€ report/
â”‚   â”‚   â”œâ”€â”€ markdown.ts
â”‚   â”‚   â””â”€â”€ json.ts
â”‚   â””â”€â”€ cli.ts                 # `neko eval run / compare / baseline`
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Eval definition + simple graders
### v0.2 â€” Output schema validation
### v0.3 â€” LLM-as-judge
### v0.4 â€” Regression detection
### v0.5 â€” RAG retrieval evals
### v0.6 â€” CI gate integration
### v0.7 â€” Reporting
### v1.0 â€” Stable API

## Product potential

**Internal:** Critical for production LLM use.
**Open source release:** Strong â€” TS-native LLM eval is undersupplied (Promptfoo exists but room remains).
**Commercial:** Real â€” Braintrust / LangSmith are real businesses.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** AI / LLM.
- **Estimated learning return:** Very high. LLM eval methodology is a young, important field; LLM-as-judge, regression detection, retrieval evals â€” all valuable skills.
