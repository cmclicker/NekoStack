# @nekostack/locale

> i18n / translation: catalogs, ICU MessageFormat, pluralization, date / number / currency formatting, RTL, fallback chains. The "this app speaks more than English" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Ops |
| **Depends on** | `schema` (translation catalog shape), `audit` (translation changes); external: ICU MessageFormat library, Intl APIs |
| **Used by** | every product going beyond English; `cms` (localized content), `email` (localized templates), `notify` (localized notifications), `form` (validation messages), `story` (narrative localization) |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 6–10 weeks focused |
| **Sellable?** | Low — react-i18next / formatjs dominate |

## Why this exists

Localization seems easy ("just translate strings") and isn't:
- ICU MessageFormat handles plurals + gender + nesting correctly.
- Pluralization rules vary per language (Russian has 3 plural forms).
- Date / number / currency formatting is locale-specific.
- RTL languages need bidirectional text + UI flips.
- Translation workflow: extraction, hand-off to translators, integration, validation.
- Missing-key detection.

## Scope

### In scope
- Translation catalogs (typed via `schema`).
- ICU MessageFormat (full spec).
- Pluralization (CLDR rules).
- Date / number / currency formatting (Intl APIs).
- RTL support.
- Locale fallback chains (en-US → en → default).
- Translation extraction from code.
- Missing-key detection.
- Translation file generation (JSON / PO / XLIFF).

### Out of scope
- Translation services (DeepL / Google Translate — external).
- Region / jurisdiction handling (`compliance`).
- Audio dubbing.

## Boundary

### Owns
- Translation catalogs
- ICU MessageFormat
- Pluralization
- Date / number / currency formatting
- RTL support
- Fallback chains
- Extraction + missing-key detection
- File format generation

### Does NOT own
| Capability | Lives in |
|---|---|
| Region / jurisdiction (legal) | `compliance` |
| Audio localization | `audio` (dubbing files) |
| Translation memory tools | external |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **react-i18next** | Mature React i18n. | React-coupled. |
| **formatjs** | Mature ICU. | Library-shaped. |
| **next-intl** | Next-coupled. | Framework. |
| **Lingui** | Modern. | Closer fit. |

## How this fits the NekoStack

- **`cms`** for localized content.
- **`email`** for localized templates.
- **`notify`** for localized notifications.
- **`form`** for validation messages.

## Design philosophy

- **ICU MessageFormat as standard.** Plurals + gender + nesting handled.
- **Fallback chains explicit.** No silent fallback bugs.
- **Missing keys flagged.** CI detects.

## Architecture sketch

```
packages/locale/
├── src/
│   ├── catalog/
│   │   └── load.ts
│   ├── icu/
│   │   └── format.ts
│   ├── plural/
│   │   └── cldr.ts
│   ├── format/
│   │   ├── date.ts
│   │   ├── number.ts
│   │   └── currency.ts
│   ├── rtl/
│   │   └── direction.ts
│   ├── fallback/
│   │   └── chain.ts
│   ├── extract/
│   │   └── from-code.ts
│   ├── missing/
│   │   └── detect.ts
│   └── files/
│       ├── json.ts
│       ├── po.ts
│       └── xliff.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — Catalog loading + ICU MessageFormat
### v0.2 — Date / number / currency formatting
### v0.3 — Pluralization
### v0.4 — RTL support
### v0.5 — Fallback chains
### v0.6 — Extraction + missing-key detection
### v0.7 — File format generation
### v1.0 — Stable API

## Product potential

**Internal:** Required for global products.
**Open source release:** Marginal.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Ops.
- **Estimated learning return:** High. ICU MessageFormat depth, pluralization, RTL, fallback chains — underrated production skills.
