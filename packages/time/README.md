# @nekostack/time

> Date / RRULE / calendar / cadence primitives. Timezone-aware. The package every other time-aware thing depends on. RFC 5545 RRULE is first-class.

## Quick reference

| | |
|---|---|
| **Build tier** | Background processing — primitives used everywhere |
| **Depends on** | (none — foundational); external: Temporal API polyfill or `date-fns-tz` |
| **Used by** | `jobs` (cron scheduling), `notify` (quiet hours, digests), `time`-scoped queries throughout, `path` (milestone target dates), `decision` (review dates), `review` (stale detection), `compliance` (retention windows), `audit` (retention), `entitlements` (period rollover), NekoLife (RRULE recurrence — already does this!) |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 4–8 weeks focused |
| **Sellable?** | Low — date libraries are mature; library-level addition niche |

## Why this exists

Every NekoStack package that thinks about time reinvents the wheel:
- `jobs` parses cron strings.
- `notify` calculates "is now in quiet hours given user's timezone?"
- `entitlements` rolls usage counters at period boundaries.
- `NekoLife` already parses RRULE (we saw `app.py` doing this).

Centralizing time logic — RRULE, timezone handling, cadence math, due-date logic — means each consumer gets the same correct behavior. Centralized timezone handling alone prevents the "off by one day at DST" class of bugs.

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

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §35 for the full capability map.

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
├── src/
│   ├── date/
│   │   ├── parse.ts
│   │   ├── format.ts
│   │   └── now.ts
│   ├── timezone/
│   │   ├── iana.ts
│   │   └── convert.ts
│   ├── rrule/
│   │   ├── parse.ts          # via rrule.js
│   │   ├── next.ts
│   │   └── matches.ts
│   ├── calendar/
│   │   └── event.ts
│   ├── cadence/
│   │   ├── period.ts         # daily / weekly / etc.
│   │   └── window.ts
│   ├── due/
│   │   ├── overdue.ts
│   │   └── reminder.ts
│   └── reset/
│       └── local-daily.ts
├── tests/
└── README.md
```

## Roadmap

### v0.1 — date-fns-tz wrapper
### v0.2 — RRULE parse + evaluate
### v0.3 — Cadence periods + windows
### v0.4 — Due / overdue / reminder
### v0.5 — Localized daily-reset
### v1.0 — Stable API

## Product potential

**Internal:** Used by many packages.
**Open source release:** Marginal — substrate libraries already mature.
**Commercial:** None.

## Status

- **Current:** Empty placeholder.
- **Owner:** Cody (solo dev).
- **Priority tier:** Background processing — primitives.
- **Estimated learning return:** Moderate. RRULE semantics, timezone handling, cadence math — useful infrastructure skills.
