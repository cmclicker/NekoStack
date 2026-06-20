# `nest-event-handler-has-spec`

Flags methods decorated with `@EventPattern` or `@MessagePattern` in files that have no co-located test or spec file.

## Why

NestJS microservice event handlers are the entry points for async workloads. Because they are not reachable by HTTP integration tests, they are the most likely application code to go completely untested. This rule extends the `service-has-spec` discipline to event-handler classes.

Each decorated method is reported individually so the error message identifies which handler is missing coverage.

## Examples

### Incorrect

```
src/
  notifications/
    notification.handler.ts   ← contains @EventPattern methods, no spec found
```

### Correct

```
src/
  notifications/
    notification.handler.ts
    notification.handler.spec.ts  ← spec exists — no error
```

## Options

None.

## When to disable

`// eslint-disable-next-line @nekostack/nest-event-handler-has-spec` with a tracking issue. Do not disable globally.
