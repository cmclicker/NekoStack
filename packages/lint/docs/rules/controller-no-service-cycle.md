# `controller-no-service-cycle`

Flags imports in controller files whose source path resolves to another controller.

## Why

Controllers should depend on services, not on each other. A controller-to-controller import creates a coupling at the HTTP-routing layer that belongs at the service layer instead. If controller A needs logic from controller B, that logic should be extracted into a shared service that both controllers inject.

The rule detects controller files by `.controller.ts` suffix or `controllers/` path segment, and flags any `ImportDeclaration` whose source path contains `.controller` or `controllers/`.

## Examples

### Incorrect

```ts
// src/orders/order.controller.ts
import { UserController } from '../users/user.controller.js'; // flagged
```

### Correct

```ts
// src/orders/order.controller.ts
import { UserService } from '../users/user.service.js'; // inject the service instead
```

## Options

None.

## When to disable

Never. Extract shared logic to a service.
