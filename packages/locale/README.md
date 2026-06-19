# @nekostack/locale

> i18n / translation: catalogs, ICU MessageFormat, pluralization, date / number / currency formatting, RTL, fallback chains. The "this app speaks more than English" layer.

## Quick reference

| | |
|---|---|
| **Build tier** | Ops |
| **Depends on** | `schema` (translation catalog shape), `audit` (translation changes); external: ICU MessageFormat library, Intl APIs |
| **Used by** | every product going beyond English; `cms` (localized content), `email` (localized templates), `notify` (localized notifications), `form` (validation messages), `story` (narrative localization) |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 6â€“10 weeks focused |

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
- Locale fallback chains (en-US â†’ en â†’ default).
- Translation extraction from code.
- Missing-key detection.
- Translation file generation (JSON / PO / XLIFF).

### Out of scope
- Translation services (DeepL / Google Translate â€” external).
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
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ catalog/
â”‚   â”‚   â””â”€â”€ load.ts
â”‚   â”œâ”€â”€ icu/
â”‚   â”‚   â””â”€â”€ format.ts
â”‚   â”œâ”€â”€ plural/
â”‚   â”‚   â””â”€â”€ cldr.ts
â”‚   â”œâ”€â”€ format/
â”‚   â”‚   â”œâ”€â”€ date.ts
â”‚   â”‚   â”œâ”€â”€ number.ts
â”‚   â”‚   â””â”€â”€ currency.ts
â”‚   â”œâ”€â”€ rtl/
â”‚   â”‚   â””â”€â”€ direction.ts
â”‚   â”œâ”€â”€ fallback/
â”‚   â”‚   â””â”€â”€ chain.ts
â”‚   â”œâ”€â”€ extract/
â”‚   â”‚   â””â”€â”€ from-code.ts
â”‚   â”œâ”€â”€ missing/
â”‚   â”‚   â””â”€â”€ detect.ts
â”‚   â””â”€â”€ files/
â”‚       â”œâ”€â”€ json.ts
â”‚       â”œâ”€â”€ po.ts
â”‚       â””â”€â”€ xliff.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” Catalog loading + ICU MessageFormat
### v0.2 â€” Date / number / currency formatting
### v0.3 â€” Pluralization
### v0.4 â€” RTL support
### v0.5 â€” Fallback chains
### v0.6 â€” Extraction + missing-key detection
### v0.7 â€” File format generation
### v1.0 â€” Stable API

## Product potential

**Internal:** Required for global products.
**Open source release:** Marginal.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Ops.
- **Estimated learning return:** High. ICU MessageFormat depth, pluralization, RTL, fallback chains â€” underrated production skills.
