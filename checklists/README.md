# `checklists/`

> Repeatable verification process. Step-by-step verification lists for recurring tasks. Short, often-repeated, "before-X-do-these" shape.

## What lives here

Checklists that get walked top-to-bottom every time a task is performed. Designed for the case where forgetting a step is expensive — pre-release, pre-deploy, pre-merge, code review.

Examples:

- `checklists/release/pre-release.md` — "Before tagging a release, verify each of these items."
- `checklists/release/post-release.md` — "After a release ships, verify each of these items."
- `checklists/node/project-start.md` — "When starting a new Node package, do each of these."
- `checklists/accessibility/wcag-aa-review.md` — "Before accepting a UI surface as a11y-compliant, verify each of these items."
- `checklists/code-review/general.md` — "Before approving a PR, verify each of these items."
- `checklists/deploy/pre-deploy.md` — "Before initiating a production deploy, verify each of these items."

Format inside each checklist:

- Short markdown lists with `- [ ]` checkboxes.
- Each item is verifiable (binary: did/didn't).
- Items grouped by phase if the checklist has multiple stages.
- No narrative — that's `playbooks/`.

## What does NOT live here

| Type | Where it goes | Why |
|---|---|---|
| Multi-step procedure with judgment calls / branches | `playbooks/` | Narrative, not verification |
| A reusable form template (not a checklist) | `snippets/` or `starters/` | Different artifact |
| A standard the org follows | `standards/` | Rule, not check |
| A learning note about why we check this | `references/` | Doctrine |

The distinguishing test: **is each item a discrete yes/no verification?** If yes → checklist. If items have multi-step narratives or branches → playbook.

## Naming + sharding

Shard by **domain or phase**:

- `checklists/release/` — release-related
- `checklists/deploy/` — deployment-related
- `checklists/code-review/` — review-related
- `checklists/accessibility/` — a11y-related
- `checklists/node/` — Node-project lifecycle (project-start, dependency-upgrade, etc.)
- `checklists/security/` — security-related (e.g., post-incident)

File names: kebab-case noun-phrase that describes the trigger event. `pre-release.md`, `post-deploy.md`, `project-start.md`.

## How to add a checklist

1. Identify the trigger event. Is it actually recurring? If it's a one-off, don't create a checklist.
2. Pick the right shard.
3. Write the items as binary verifications.
4. Order them: prerequisites first, blocking checks before optional ones.
5. Test it: walk the checklist once in real conditions. If any item is ambiguous, rewrite it.

## Checklist hygiene

- **Items rot.** Re-walk every checklist after meaningful infrastructure changes. Update or remove stale items.
- **Keep them short.** A 30-item checklist nobody completes is worse than a 7-item one that always gets walked.
- **Distinguish blocking from advisory.** Use `- [ ] (advisory)` or a separate "nice-to-have" section for non-blocking items.

## See also

- [`ARTIFACTS.md`](../ARTIFACTS.md) — taxonomy.
- [`playbooks/`](../playbooks/README.md) — for multi-step narrative procedures.
- [`standards/`](../standards/README.md) — for the rules behind the checks.
- [`@nekostack/governance`](../packages/governance/README.md) — for runtime enforcement of policies.
