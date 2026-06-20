# `react-no-inline-style`

Flags `style={…}` JSX attributes.

## Why

NekoStack exposes design tokens through `@nekostack/theme` CSS custom properties and `@nekostack/ui` component classes. Inline styles bypass this token system entirely: they create one-off values that don't respond to theme switching, can't be referenced in design tools, and accumulate as invisible tech debt. All styling should go through token-referencing CSS classes.

## Examples

### Incorrect

```tsx
<div style={{ color: 'red', marginTop: '8px' }}>Error</div>

const styles = { padding: '16px' };
<Card style={styles}>Content</Card>
```

### Correct

```tsx
<div className="error-text">Error</div>

<Card className="padded-card">Content</Card>
```

```css
/* tokens used in class definitions */
.error-text { color: var(--neko-color-semantic-error); }
.padded-card { padding: var(--neko-spacing-4); }
```

## Options

None.

## When to disable

For programmatic styles where the value is genuinely dynamic and cannot be expressed as a CSS custom property (e.g. canvas dimensions derived from a ResizeObserver). Use an inline disable with a brief justification.
