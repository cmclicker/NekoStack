# @nekostack/ui

> The component library + design-system primitives every NekoStack frontend builds on. Headless where possible, themed via `@nekostack/theme`, accessible by default via `@nekostack/a11y`.

## Quick reference

| | |
|---|---|
| **Build tier** | Force multiplier — build after `theme`, `icons`, `a11y`, `motion` |
| **Depends on** | `theme` (tokens), `icons` (iconography), `motion` (animations), `a11y` (accessibility primitives); optional substrate: Radix UI / React Aria |
| **Used by** | NekoVibe (replaces current `packages/ui` over time), NekoBattler (combat HUD, wiki, profile), Leytide (every surface), NekoSystems (agent dashboards), future products |
| **Status** | Empty placeholder — not started |
| **Est. to v1.0** | 12–24 weeks focused (per-component small; cumulative ~30 components is large) |
| **Sellable?** | Plausible MIT (solo-dev-optimized angle); UI library market crowded so independent commercial traction unlikely |

## Why this exists

Every NekoStack frontend reaches for the same components: buttons, inputs, modals, tooltips, popovers, command palettes, toasts, tabs, accordions, navs, avatars, progress, sliders, switches. Without a shared library, each project reinvents them — slightly differently, with subtly different a11y behavior, drifting design tokens, and zero cross-project muscle memory.

NekoVibe already has a `packages/ui` workspace package, and the design-tokens.css file we committed today is exactly the seed of this kind of system. The shape exists; it just needs to be lifted into a shared, reusable, opinionated place.

`@nekostack/ui` is that place. Headless primitives (Radix-style — behavior and a11y, no opinions on visuals), styled defaults that match `@nekostack/theme`, and composable building blocks for the products to assemble their own surfaces. Crucially, it's not a "use our entire opinionated kit" lock-in — each component is independently consumable and replaceable.

Building this yourself rather than adopting shadcn/ui, Radix, MUI, or Mantine is justified because:
1. **You learn component design patterns end-to-end.** Render props, slot composition, controlled-vs-uncontrolled patterns, accessibility primitives, focus management, portal rendering — all transferable to any future UI work.
2. **Tight design-token integration.** `@nekostack/theme` defines tokens; this library consumes them. No shadow-DOM hacks or theme-provider gymnastics.
3. **Solo-friendly API.** Most major libraries optimize for team adoption. We optimize for "I wrote this six months ago and need to be productive in it now."
4. **Replaceability without forking.** Want a different `Button`? Don't fork the whole library — drop in your own; the rest still composes.

## Scope

### In scope
- Headless component primitives: behavior, state, accessibility. (Pattern: Radix UI or React Aria.)
- Styled default implementations using `@nekostack/theme` tokens.
- Composable building blocks: Slot, Portal, FocusTrap, VisuallyHidden, etc.
- Common components: Button, Input, Textarea, Select, Combobox, Checkbox, RadioGroup, Switch, Slider, Tabs, Accordion, Dialog, Drawer, Popover, Tooltip, Toast, Avatar, Badge, Card, Skeleton, Progress, Spinner.
- Layout primitives: Stack, Inline, Grid, Container, Divider.
- Form primitives that integrate with `@nekostack/form`.
- A11y discipline: keyboard navigation, ARIA roles, focus management, reduced-motion respect.

### Out of scope
- Specific domain widgets (LeaderboardTable, CombatLog, PuzzleBoard). Those live in consuming projects.
- Animation primitives — `@nekostack/motion` covers those, this library consumes them.
- Charts — `@nekostack/chart`.
- Data tables — `@nekostack/table`.
- Rich text editing — `@nekostack/editor`.
- Icons — `@nekostack/icons`.
- Theme management — `@nekostack/theme`.
- The kitchen sink. We avoid 50-prop components; prefer composition.

## Boundary

> See [`BOUNDARIES.md`](../../BOUNDARIES.md) §36 for the full capability map.

### Owns
- Headless component primitives (Slot, Portal, FocusTrap, VisuallyHidden, useControllable, useId)
- Styled defaults consuming `theme` tokens
- Common components: Button, Input, Textarea, Select, Combobox, Checkbox, RadioGroup, Switch, Slider
- Overlays: Dialog, Drawer, Popover, Tooltip
- Feedback: Toast, Skeleton, Spinner, Progress
- Navigation: Tabs, Accordion, Breadcrumb
- Data display: Avatar, Badge, Card
- Layout primitives (Stack, Inline, Grid, Container, Divider) — layout sub-module
- Form bindings consuming `form` state

### Does NOT own
| Capability | Lives in |
|---|---|
| Theme tokens + dark mode + a11y variants | `theme` |
| Animation + transition primitives | `motion` |
| Accessibility utilities (focus / ARIA / keyboard / contrast) | `a11y` |
| Charting / data viz | `chart` |
| Data grids (sort / filter / virtualize / edit) | `table` |
| Spatial UI / maps | `map` |
| Canvas 2D scene management | `canvas` |
| Icon system + SVG sprite pipeline | `icons` |
| Markdown rendering | `md` |
| Rich text editing | `editor` |
| Form state management + validation | `form` (we consume bindings) |
| Routing / navigation | external framework router (Next.js, Solid Router, etc.) |
| Domain widgets (LeaderboardTable, CombatLog, PuzzleBoard) | consuming products |

## Competitors and adjacent tools

| Tool | What they do well | Where they fall short for us |
|---|---|---|
| **Radix UI** | Excellent headless primitives, a11y-first. | Headless only; no styled defaults. Great inspiration; we'd likely use it as a substrate for some primitives. |
| **shadcn/ui** | Copy-paste components built on Radix + Tailwind. | Not a library; you re-author when you upgrade. Tailwind-coupled. |
| **React Aria** | Adobe's a11y primitives. | Excellent but verbose; high learning curve. |
| **MUI** | Mature, complete, well-documented. | Material-design opinionated, heavy bundle. |
| **Mantine** | Modern, comprehensive, great defaults. | Strong opinions; theming is its own thing. |
| **Chakra UI** | TS-friendly, themeable. | Heavier than needed; runtime-css overhead. |
| **Ariakit** | Great a11y primitives. | Smaller ecosystem than Radix. |
| **Headless UI** | Tailwind-team's headless components. | Small, Tailwind-flavored. |

The right framing: `@nekostack/ui` is *headless behavior + styled defaults*, possibly using Radix or React Aria internally for the gnarly a11y bits, exposing a NekoStack-idiomatic API on top. We don't compete with Radix — we may **build on top of it**. The styled layer and the design-token integration are what we own.

## How this fits the NekoStack

**Depends on:**
- `@nekostack/theme` — design tokens.
- `@nekostack/icons` — iconography.
- `@nekostack/motion` — animations.
- (Optional) Radix UI / React Aria — substrate libraries.

**Used by:**
- **NekoVibe** — replaces its current `packages/ui` over time.
- **NekoBattler** — wiki, combat HUD, profile screens.
- **Leytide** — every UI surface.
- **NekoSystems** — agent dashboards, prompt editing UIs.
- Future products.

## Design philosophy

- **Composition over configuration.** Small components that compose, not one Button with 30 props.
- **Headless underneath, styled by default.** You can drop down to the headless layer if our styled version doesn't fit.
- **Accessibility is non-negotiable.** Keyboard nav, ARIA, focus, contrast — all default. Not an opt-in.
- **Theme via tokens.** Components consume CSS variables from `@nekostack/theme`. No `theme={...}` prop drilling.
- **Solo-friendly API.** Predictable props, minimal magic, code that reads as itself after six months away.
- **Replaceable parts.** Don't like our `Button`? Drop in your own. The rest still composes.

## Architecture sketch

```
packages/ui/
├── src/
│   ├── primitives/           # headless behavior
│   │   ├── Slot.ts
│   │   ├── Portal.ts
│   │   ├── FocusTrap.ts
│   │   ├── VisuallyHidden.ts
│   │   ├── useId.ts
│   │   └── useControllable.ts
│   ├── form/                 # form-related controls
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Textarea.tsx
│   │   ├── Select.tsx
│   │   ├── Combobox.tsx
│   │   ├── Checkbox.tsx
│   │   ├── RadioGroup.tsx
│   │   ├── Switch.tsx
│   │   └── Slider.tsx
│   ├── layout/
│   │   ├── Stack.tsx
│   │   ├── Inline.tsx
│   │   ├── Grid.tsx
│   │   └── Container.tsx
│   ├── feedback/
│   │   ├── Toast.tsx
│   │   ├── Skeleton.tsx
│   │   ├── Spinner.tsx
│   │   └── Progress.tsx
│   ├── overlays/
│   │   ├── Dialog.tsx
│   │   ├── Drawer.tsx
│   │   ├── Popover.tsx
│   │   └── Tooltip.tsx
│   ├── navigation/
│   │   ├── Tabs.tsx
│   │   ├── Accordion.tsx
│   │   └── Breadcrumb.tsx
│   ├── data-display/
│   │   ├── Avatar.tsx
│   │   ├── Badge.tsx
│   │   └── Card.tsx
│   └── styles/
│       └── reset.css
├── tests/
└── README.md
```

Usage:

```tsx
import { Button, Stack, Dialog } from '@nekostack/ui';

<Stack gap="md">
  <Button variant="primary" onClick={() => openDialog()}>
    Edit profile
  </Button>
  <Dialog open={isOpen} onClose={close}>
    <Dialog.Title>Edit profile</Dialog.Title>
    <Dialog.Body>{/* ... */}</Dialog.Body>
  </Dialog>
</Stack>
```

## Roadmap

### v0.1 — Primitives + Button
- Slot, Portal, FocusTrap, VisuallyHidden.
- Button with variants.
- Theme token consumption working end-to-end.

### v0.2 — Form controls
- Input, Textarea, Select, Checkbox, Switch.

### v0.3 — Layout
- Stack, Inline, Grid, Container.

### v0.4 — Overlays
- Dialog, Drawer, Popover, Tooltip.

### v0.5 — Feedback
- Toast (works with `@nekostack/notify`), Skeleton, Spinner, Progress.

### v0.6 — Navigation
- Tabs, Accordion, Breadcrumb.

### v0.7 — Data display
- Avatar, Badge, Card.

### v0.8 — Combobox / Command palette
- Combobox, Command (Spotlight-style).

### v1.0 — Stable API
- Documentation site (Storybook or custom).
- A11y test suite (axe + manual audit).
- Migration recipes from MUI / Mantine / shadcn.

## Product potential

**Internal use:** Essential. The shared frontend toolkit.

**Open source release:** Plausible. UI libraries are crowded, but a "solo-dev-optimized, design-tokens-first, replaceable-parts" angle has room. MIT release as part of NekoStack ecosystem.

**Commercial product:** Unlikely as a standalone product (the market is saturated with both free and paid options). Could be part of a broader "starter kit" sale.

**Estimated effort to v1.0:** 12-24 weeks of focused work. Per-component effort is small; the cumulative weight of ~30 components with full a11y and tests is substantial.

## Status

- **Current:** Empty placeholder. Not started.
- **Owner:** Cody (solo dev project).
- **Priority tier:** Force multiplier. Build after `@nekostack/theme` since theme tokens are the substrate.
- **Estimated learning return:** Very high. Component design patterns, headless architectures, a11y discipline, focus management — half of professional frontend work.
