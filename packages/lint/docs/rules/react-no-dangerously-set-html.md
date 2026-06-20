# `react-no-dangerously-set-html`

Flags the `dangerouslySetInnerHTML` JSX prop.

## Why

Setting raw HTML without sanitisation is a direct XSS vector. React named this prop `dangerouslySetInnerHTML` precisely to force developers to think twice. Any use should be deliberate and reviewed — this rule makes it lint-visible so it cannot slip in unnoticed.

Approved exceptions must be accompanied by a `eslint-disable` comment explaining why the content is safe and what sanitisation (if any) is applied upstream.

## Examples

### Incorrect

```tsx
<div dangerouslySetInnerHTML={{ __html: userContent }} />

<article dangerouslySetInnerHTML={{ __html: marked(markdown) }} />
```

### Correct

```tsx
{/* Use a sanitisation library and document the decision */}
{/* eslint-disable-next-line @nekostack/react-no-dangerously-set-html -- DOMPurify sanitised before render */}
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }} />

{/* Prefer React children for non-HTML content */}
<div>{content}</div>
```

## Options

None.

## When to disable

Only when rendering sanitised HTML (e.g. a CMS rich-text field scrubbed with DOMPurify). The disable comment must name the sanitisation method.
