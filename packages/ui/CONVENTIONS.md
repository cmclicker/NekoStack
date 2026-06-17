# @nekostack/ui — authoring conventions (the contract)

Every component file MUST follow these rules exactly. The build (`scripts/build.mjs`) and the review
pass enforce them. `src/button.css` is the reference implementation — match its shape.

## Mission
Vanilla CSS components. **No JS, no React, no Tailwind, no preprocessor.** Plain `.css` files that
style semantic class names and consume `@nekostack/theme` CSS variables. Loaded after the theme's
`neko.css`.

## Naming — BEM-light
- **Block:** `.neko-<block>` (block names may contain single hyphens: `.neko-btn`, `.neko-btn-group`, `.neko-input-group`).
- **Element:** `.neko-<block>__<element>` (double underscore): `.neko-card__header`.
- **Modifier:** `.neko-<block>--<modifier>` (double hyphen): `.neko-btn--primary`, `.neko-alert--danger`.
- Sizes are modifiers: `--sm`, `--lg` (default = comfortable, no modifier).

## Tokens — the hard rules (build FAILS the purity check otherwise)
- **NEVER write a hardcoded color** (`#hex`, named colors, or raw `rgb()/rgba()` for color). The build greps for hex and fails.
- **All colors** come from `var(--neko-color-semantic-*)`. The full list is in `../theme/dist/neko.css` (`:root` block) — read it to get exact names. Key ones:
  - emphasis: `primary`, `secondary`, `accent-1`, `accent-2`, `accent-3` — each with `-hover`, `-content`, `-soft`.
  - status: `info`, `success`, `warning`, `danger` — same four-variant set.
  - surfaces: `bg-base`, `bg-raised`, `bg-sunken`, `bg-overlay`.
  - text: `text-base`, `text-muted`, `text-subtle`, `text-inverted`.
  - borders: `border-base`, `border-strong`, `border-subtle`.
  - state: `disabled`, `disabled-content`, `selected`, `selected-content`, `focus-ring`, `link`, `link-hover`.
  - code: `code-bg`, `code-content`.
- **Spacing:** `var(--neko-spacing-{0,1,2,3,4,5,6,8,10,12,16})`. No raw px for layout spacing.
- **Radius:** `var(--neko-radius-{none,xs,sm,md,lg,xl,pill})`.
- **Shadows:** `var(--neko-color-shadow-{xs,sm,base,md,lg,xl})`.
- **Fonts:** `var(--neko-font-sans|mono)`, `var(--neko-font-size-*)`, `var(--neko-line-height-*)`.
- **Motion:** `var(--neko-motion-duration-{fast,base,slow})`, `var(--neko-motion-easing-{standard,decelerate,accelerate})`.
- **Z-index:** `var(--neko-z-index-{base,popover,modal,toast,tooltip})`.
- Raw px is allowed ONLY for hairline borders (`1px`/`2px`), `0`, and sub-pixel optical nudges. Everything else = token.
- The ONLY hardcoded-color exception is `transparent` and `currentColor` (both fine, not hex).

## The local-variable pattern (use it for color-family components)
Define `--_<block>-<prop>` locals on the block, then variants remap only those locals. See `button.css`:
the base sets `--_btn-bg/--_btn-fg/--_btn-bg-hover`, and `.neko-btn--danger` just remaps them. This keeps
variants to 3 lines and guarantees states (hover/disabled) work for every variant automatically.

## Required interactive states (non-negotiable)
For anything clickable/focusable/inputtable:
- `:hover` — the hover token (`*-hover`) or a `bg-raised` lift.
- `:active` — subtle (e.g. `transform: translateY(1px)`), optional but encouraged.
- `:focus-visible` — `outline: 2px solid var(--neko-color-semantic-focus-ring); outline-offset: 2px;`. Never remove focus outlines.
- disabled — match on `:disabled, [disabled], [aria-disabled="true"]` → `--neko-color-semantic-disabled` / `-content`, `cursor: not-allowed`.
- inputs also: `[aria-invalid="true"]` → danger border; placeholder via `text-subtle`.
- Reduced motion is handled globally in `base.css` — do not fight it; keep transitions token-based.

## Theme/mode safety
Because you only use semantic tokens, components work across all four (theme × mode) combos
automatically. **Never assume dark.** No `color: white`, no dark-only opacity hacks. Use `-content`
tokens for text-on-color, `text-inverted` where needed.

## Hygiene
- No `!important` except `.neko-visually-hidden` (in base.css).
- Each file styles ONLY its own components; rely on `base.css` for resets and shared `@keyframes`
  (`neko-spin`, `neko-pulse`, `neko-shimmer` already exist there — reference them, don't redefine).
- Start each file with a top comment listing the classes it defines.
- Keep selectors flat and low-specificity (single class where possible; `:where()` for resets).

## File ownership (each is one `src/<name>.css`)
- `base.css` (DONE) — reset, element defaults, `.neko-prose`, `.neko-code`, `.neko-kbd`, `.neko-visually-hidden`, shared keyframes.
- `button.css` (DONE, reference) — `.neko-btn` (+ all color/ghost/outline/link variants, `--sm/--lg`, `--block/--pill/--icon`, `aria-busy` spinner), `.neko-btn-group`.
- `layout.css` — `.neko-container` (+`--sm/--lg/--full`), `.neko-stack` (vertical gap), `.neko-cluster` (horizontal wrap), `.neko-grid` (auto-fit), `.neko-center`, `.neko-divider` (+`--vertical`).
- `form.css` — `.neko-field`, `.neko-label`, `.neko-input`, `.neko-textarea`, `.neko-select`, `.neko-checkbox`, `.neko-radio`, `.neko-switch`, `.neko-help`, `.neko-input-group`, `.neko-fieldset`/`.neko-legend`. All states + `[aria-invalid]` + `--sm/--lg`.
- `card.css` — `.neko-card` (+`__header/__body/__footer/__title`, `--interactive`), `.neko-panel`, `.neko-surface`.
- `feedback.css` — `.neko-alert` (+`--info/--success/--warning/--danger`, `__title`), `.neko-badge` (+ color variants, `--pill`), `.neko-tag` (+`--removable`), `.neko-toast`, `.neko-spinner`, `.neko-progress` (+`__bar`, `--indeterminate`), `.neko-skeleton`.
- `nav.css` — `.neko-tabs` (+`__tab`, `[aria-selected="true"]`), `.neko-link`, `.neko-breadcrumb` (+`__item`), `.neko-menu` (+`__item`, selected), `.neko-pagination`.
- `overlay.css` — `.neko-backdrop`, `.neko-modal`/`.neko-dialog` (+`__header/__body/__footer`; support native `dialog.neko-dialog` + `::backdrop`), `.neko-drawer`, `.neko-tooltip` (CSS-only on `:hover`/`:focus-within`), `.neko-popover`.
- `data.css` — `.neko-table` (+`--striped`, hover rows), `.neko-list` (+`__item`), `.neko-avatar` (+`--sm/--lg`, `--circle`), `.neko-stat` (label/value), `.neko-empty` (empty-state).
- `utilities.css` — MINIMAL (~10): `.neko-text-muted`, `.neko-text-subtle`, `.neko-text-center/-left/-right`, `.neko-truncate`, `.neko-elevated` (shadow-md), `.neko-rounded`, `.neko-muted-surface`. NOT a utility framework.
