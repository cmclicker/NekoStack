# `playbooks/`

> Longer operating procedures. Multi-step narrative processes with judgment calls and branches. Distinct from checklists in that playbooks have narrative shape, not pure verification.

## What lives here

Procedures with shape:

- "When X happens, do these steps in order. At step 3, depending on Y, branch."
- "If you need to do Z, this is the canonical sequence and rationale."

Examples:

- `playbooks/incident-response.md` — How to respond to a production incident. Identify severity → page → mitigate → write post-mortem.
- `playbooks/dependency-upgrade.md` — How to upgrade a major dependency. Read changelog → assess breaks → update one package → test → propagate.
- `playbooks/rollback.md` — How to roll back a bad release. Pause traffic → revert → verify → communicate.
- `playbooks/post-mortem.md` — How to write a post-mortem. Capture timeline → identify contributing factors → write findings → distribute.
- `playbooks/data-migration.md` — How to safely run a large data migration. Backup → dry-run → batch-apply → verify → finalize.
- `playbooks/security-incident.md` — How to handle a suspected security incident. Contain → assess → notify → remediate → audit.

Format inside each playbook:

- A short framing: when does this playbook apply?
- Numbered steps with explanation.
- Decision points clearly marked: "If A, go to step 4. If B, go to step 7."
- Templates inline or linked (post-mortem template, communication template, etc.).
- Estimated time per step or whole playbook.

## What does NOT live here

| Type | Where it goes | Why |
|---|---|---|
| Binary verification checklist | `checklists/` | Different artifact shape |
| A one-time runbook for a specific deploy | (a project's own `ops/`) | Project-specific, not reusable |
| Doctrine about why these procedures exist | `references/` | Explanation, not procedure |
| Standards / hard rules | `standards/` | Rules, not procedures |
| Automated procedure (code) | `packages/` | If it runs, package |

The distinguishing test: **does this artifact have judgment calls or branches?** If yes → playbook. If purely linear yes/no → checklist.

## Naming + sharding

Most playbooks are flat in `playbooks/`. Shard only if a domain accumulates many playbooks:

- `playbooks/release/` — release-related procedures
- `playbooks/incident/` — incident-related procedures
- `playbooks/data/` — data-related procedures
- `playbooks/security/` — security procedures

File names: kebab-case verb-or-event phrase. `incident-response.md`, `dependency-upgrade.md`.

## How to add a playbook

1. Trigger first: when does this playbook get invoked?
2. Walk through it mentally end-to-end before writing.
3. Document each step with context (why, not just what).
4. Mark decision points explicitly.
5. Include templates inline where the playbook produces an artifact (post-mortem, communication, etc.).
6. Estimate time. People won't start a playbook if they don't know it'll take 4 hours vs 4 days.

## Playbook hygiene

- **Playbooks rot fast.** After every real execution, update the playbook with what was missing or wrong.
- **Time-stamp updates.** Note when steps were last verified.
- **Cross-link to checklists.** Some steps in a playbook may invoke a checklist; reference it.

## See also

- [`ARTIFACTS.md`](../ARTIFACTS.md) — taxonomy.
- [`checklists/`](../checklists/README.md) — for binary verification lists.
- [`standards/`](../standards/README.md) — for rules cited in playbooks.
- [`@nekostack/governance`](../packages/governance/README.md) — for runtime gates that some playbook steps invoke.
