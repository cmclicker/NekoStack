# @nekostack/compliance

> GDPR / HIPAA / SOC 2 profiles, evidence collection, control mapping, retention policy enforcement, consent records, legal hold, region/jurisdiction handling. The compliance layer that orchestrates `audit`, `export`, `secrets`, `secure`, and `tenant` into actual regulatory posture.

## Quick reference

| | |
|---|---|
| **Build tier** | Compliance / data governance — pairs with `audit` |
| **Depends on** | `schema` (compliance profile shape), `audit` (evidence source), `export` (DSAR), `secure` (redaction policies), `tenant` (region binding), `secrets` (encryption controls), `time` (retention dates) |
| **Used by** | products with regulatory exposure (any SaaS handling PII / health / payment data); `path` (compliance milestones); `governance` (compliance enforcement profiles compose into governance) |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 12–20 weeks focused |
| **Sellable?** | Strong — compliance tooling market is real and growing (Drata / Vanta / Secureframe at high end); SMB-tier opportunity exists |

## Why this exists

Compliance isn't audit (that's the log). Compliance is the layer above:
- Which controls do we need to satisfy (GDPR Art. 15, SOC 2 CC6.1, HIPAA §164.312)?
- How do we collect evidence that we're satisfying them?
- What's our retention policy per data type per jurisdiction?
- What's our consent record for this user?
- Is this tenant under legal hold (cannot delete their data)?
- What jurisdiction applies — EU GDPR, California CCPA, Brazil LGPD?

Without an explicit package:
- Compliance posture is "vibes" (probably we're OK?).
- DSAR requests scramble engineers.
- Auditor questions can't be answered with structured data.
- Retention is "we never delete anything" (which is a compliance violation).

`compliance` is the structured answer.

## Scope

### In scope
- Compliance profile definitions (GDPR / HIPAA / SOC 2 / ISO 27001 / CCPA / LGPD).
- Control catalogs per profile (mapped to industry standards).
- Evidence collection from `audit` + `secure` + `secrets` + `governance`.
- Retention policy declarations + enforcement (cooperates with `audit`).
- Legal hold (suspends retention).
- Consent records (per-user, per-purpose, with version).
- Region / jurisdiction binding (per tenant).
- DSAR orchestration (calls `export` + `audit` + `tenant`).
- Right-to-be-forgotten workflow.
- Standards mapping (e.g., NekoStack control X satisfies SOC2 CC6.1).

### Out of scope
- Audit log storage (`audit`).
- Data export mechanics (`export`).
- Authentication (`auth`).
- Compliance certification process itself (consultant / auditor).

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §22 for the full capability map.

### Owns
- Compliance profile definitions
- Compliance checklists
- Control mapping (NekoStack controls ↔ industry standards)
- Compliance evidence collection
- Retention requirements
- Legal hold
- Standards mapping
- Consent records
- Region / jurisdiction handling
- Right-to-be-forgotten workflows

### Does NOT own
| Capability | Lives in |
|---|---|
| Audit log storage | `audit` |
| Data export mechanics | `export` |
| PII redaction primitives | `secure` |
| Secret rotation | `secrets` |
| Tenant identity | `tenant` |
| Authentication / login | `auth` |
| Policy enforcement at runtime | `governance` (compliance profiles compose into governance) |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **Vanta / Drata / Secureframe** | Mature compliance automation. | Expensive enterprise pricing; vendor-coupled. |
| **OneTrust / DataGrail** | GDPR / privacy-focused. | Enterprise, legal-workflow-heavy. |
| **TrustArc** | Privacy management. | Enterprise. |
| **Custom spreadsheets** | Common practice. | Drift, no integration, no evidence collection. |

## How this fits the NekoStack

- Pulls evidence from `audit`, `secure`, `secrets`, `governance`.
- Drives policies enforced by `audit` (retention), `secure` (redaction), `export` (DSAR scope).
- Composes profiles consumed by `governance` enforcement profiles.

## Design philosophy

- **Standards mapping is canonical.** Every NekoStack control documents which SOC 2 / GDPR / etc. controls it satisfies.
- **Evidence is structured.** Compliance evidence is typed queryable data, not screenshots.
- **Consent is versioned.** Privacy policy updates create new consent versions; old consents remain valid for old data.
- **Retention is enforced.** Policies aren't documents; they trigger actual deletion via `audit`.
- **Legal hold is a suspension primitive.** Retention pauses; resumes when hold lifts.

## Architecture sketch

```
packages/compliance/
├── src/
│   ├── profiles/
│   │   ├── gdpr.ts
│   │   ├── hipaa.ts
│   │   ├── soc2.ts
│   │   ├── ccpa.ts
│   │   └── iso27001.ts
│   ├── controls/
│   │   ├── catalog.ts
│   │   └── mapping.ts        # NekoStack ↔ standard
│   ├── evidence/
│   │   ├── collect.ts
│   │   └── present.ts
│   ├── retention/
│   │   ├── policy.ts
│   │   ├── enforce.ts        # cooperates with audit
│   │   └── legal-hold.ts
│   ├── consent/
│   │   ├── record.ts
│   │   └── version.ts
│   ├── region/
│   │   └── jurisdiction.ts
│   ├── dsar/
│   │   └── orchestrate.ts    # calls export + audit
│   ├── right-to-forget/
│   │   └── workflow.ts
│   └── cli.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Profile definitions (GDPR + SOC 2)
### v0.2 — Control catalog + mapping
### v0.3 — Retention enforcement
### v0.4 — Consent records
### v0.5 — Legal hold
### v0.6 — DSAR orchestration
### v0.7 — Right-to-forget
### v0.8 — Region / jurisdiction
### v1.0 — Stable API

## Product potential

**Internal:** Critical once any product processes PII / health / payment data.
**Open source release:** Plausible — SMB-tier compliance is undersupplied.
**Commercial:** **Strong** — Vanta / Drata at high end leave room for SMB-tier hosted offering.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Compliance — build before any product reaches "we handle real PII at scale".
- **Estimated learning return:** Very high. GDPR / SOC 2 / HIPAA mapping, evidence-collection design, retention enforcement, consent versioning — directly relevant to any commercial SaaS work.
