# @nekostack/time

> Date / RRULE / calendar / cadence primitives. Timezone-aware. The package every other time-aware thing depends on. RFC 5545 RRULE is first-class.

## Quick reference

| | |
|---|---|
| **Build tier** | Background processing â€” primitives used everywhere |
| **Depends on** | (none â€” foundational); external: Temporal API polyfill or `date-fns-tz` |
| **Used by** | `jobs` (cron scheduling), `notify` (quiet hours, digests), `time`-scoped queries throughout, `path` (milestone target dates), `decision` (review dates), `review` (stale detection), `compliance` (retention windows), `audit` (retention), `entitlements` (period rollover), NekoLife (RRULE recurrence â€” already does this!) |
| **Status** | Empty placeholder â€” not started |
| **Est. to v1.0** | 4â€“8 weeks focused |

## Why this exists

Every NekoStack package that thinks about time reinvents the wheel:
- `jobs` parses cron strings.
- `notify` calculates "is now in quiet hours given user's timezone?"
- `entitlements` rolls usage counters at period boundaries.
- `NekoLife` already parses RRULE (we saw `app.py` doing this).

Centralizing time logic â€” RRULE, timezone handling, cadence math, due-date logic â€” means each consumer gets the same correct behavior. Centralized timezone handling alone prevents the "off by one day at DST" class of bugs.

## Scope

### In scope
- Date / time utilities (today / now / parse / format).
- Timezone handling (IANA tz database).
- RRULE recurrence parsing + evaluation (RFC 5545).
- Calendar event modeling.
- Cadence periods (daily / weekly / monthly / quarterly / annual).
- Due-date / overdue logic.
- Reminder generation (notification dispatch is `notify`).
- Localized daily-reset (e.g., 03:00 user-local time).
- "Next firing time" given an RRULE.
- "Is this date inside this cadence window?" predicates.

### Out of scope
- Notification dispatch (`notify`).
- Calendar UI rendering (consuming products).
- Astronomical / scientific time calculations.

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) Â§35 for the full capability map.

### Owns
- Date / time utilities
- Timezone handling
- RRULE parsing + evaluation
- Calendar event modeling
- Cadence period math
- Due-date / overdue logic
- Reminder time calculation
- Localized daily-reset

### Does NOT own
| Capability | Lives in |
|---|---|
| Notification dispatch | `notify` |
| Calendar UI rendering | consuming products |
| Cron job execution | `jobs` (we provide RRULE; jobs executes) |

## Competitors and adjacent tools

| Tool | Strength | Gap |
|---|---|---|
| **date-fns-tz** | Mature tz-aware library. | Substrate; we wrap. |
| **Temporal API** | Modern proposal. | Polyfill needed; we can adopt. |
| **rrule.js** | RFC 5545 RRULE parser. | Substrate; we wrap. |
| **Luxon** | Mature. | Slightly heavyweight. |
| **Moment.js** | Legacy. | Deprecated. |

## How this fits the NekoStack

- **`jobs`** uses RRULE for cron scheduling.
- **`notify`** for quiet-hours math.
- **`path`** for milestone dates.
- **`decision`** for review dates.
- **`compliance`** for retention windows.
- **`entitlements`** for period rollover.
- Most packages touch time somewhere.

## Design philosophy

- **Timezone-aware always.** Naive datetimes are bugs waiting to happen.
- **RRULE is first-class.** Recurrence is real; encode it in RFC 5545.
- **Localized daily-reset.** "Daily" isn't UTC; it's user-local 03:00 or product-configured.
- **Substrate-wrapping.** Wrap date-fns-tz / Temporal / rrule.js, don't reimplement.

## Architecture sketch

```
packages/time/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ date/
â”‚   â”‚   â”œâ”€â”€ parse.ts
â”‚   â”‚   â”œâ”€â”€ format.ts
â”‚   â”‚   â””â”€â”€ now.ts
â”‚   â”œâ”€â”€ timezone/
â”‚   â”‚   â”œâ”€â”€ iana.ts
â”‚   â”‚   â””â”€â”€ convert.ts
â”‚   â”œâ”€â”€ rrule/
â”‚   â”‚   â”œâ”€â”€ parse.ts          # via rrule.js
â”‚   â”‚   â”œâ”€â”€ next.ts
â”‚   â”‚   â””â”€â”€ matches.ts
â”‚   â”œâ”€â”€ calendar/
â”‚   â”‚   â””â”€â”€ event.ts
â”‚   â”œâ”€â”€ cadence/
â”‚   â”‚   â”œâ”€â”€ period.ts         # daily / weekly / etc.
â”‚   â”‚   â””â”€â”€ window.ts
â”‚   â”œâ”€â”€ due/
â”‚   â”‚   â”œâ”€â”€ overdue.ts
â”‚   â”‚   â””â”€â”€ reminder.ts
â”‚   â””â”€â”€ reset/
â”‚       â””â”€â”€ local-daily.ts
â”œâ”€â”€ tests/
â””â”€â”€ README.md
```

## Roadmap

### v0.1 â€” date-fns-tz wrapper
### v0.2 â€” RRULE parse + evaluate
### v0.3 â€” Cadence periods + windows
### v0.4 â€” Due / overdue / reminder
### v0.5 â€” Localized daily-reset
### v1.0 â€” Stable API

## Product potential

**Internal:** Used by many packages.
**Open source release:** Marginal â€” substrate libraries already mature.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Background processing â€” primitives.
- **Estimated learning return:** Moderate. RRULE semantics, timezone handling, cadence math â€” useful infrastructure skills.
