# `service-has-spec`

Flags `*.service.ts` files that have no co-located test or spec file.

## Why

Services contain the core business logic of a NekoStack application. An unspecced service is invisible to the test suite — regressions go undetected until they surface in production. This rule makes missing coverage a lint error rather than a review comment.

The rule performs a filesystem check at lint time. It looks for a spec file alongside the service: `*.service.spec.ts`, `*.service.test.ts`, `*.spec.ts`, or `*.test.ts`.

## Examples

### Incorrect

```
src/
  users/
    user.service.ts   ← flagged — no spec file found
```

### Correct

```
src/
  users/
    user.service.ts
    user.service.spec.ts  ← spec exists — no error
```

## Options

None.

## When to disable

`// eslint-disable-next-line @nekostack/service-has-spec` in the service file, with a comment referencing the tracking issue for adding tests. Do not disable globally.
