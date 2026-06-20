# `no-type-assertion-to-any`

Flags `x as any` and `<any>x` type assertions.

## Why

Asserting to `any` silences TypeScript entirely for the expression. It is strictly worse than `as unknown` because `unknown` still requires narrowing before use, while `any` removes all subsequent type checks. Every `as any` is a place where the type system offers zero protection against runtime errors.

The rule covers both the `as` keyword form (`TSAsExpression`) and the angle-bracket form (`TSTypeAssertion`).

## Examples

### Incorrect

```ts
const value = response.data as any;
value.foo.bar.baz; // no type error, but crashes if structure is wrong

const el = <any>document.getElementById('root');
```

### Correct

```ts
// Assert to the specific type you expect
const value = response.data as ApiResponse;

// Or use unknown and narrow
const value = response.data as unknown;
if (typeof value === 'object' && value !== null && 'id' in value) {
  // value is narrowed here
}

// Use a Zod schema to parse untrusted data
const value = ApiResponseSchema.parse(response.data);
```

## Options

None.

## When to disable

Extremely rare. If a type assertion to `any` is genuinely the right move (e.g. working around a broken third-party type definition), use an inline disable with a comment naming the upstream issue.
