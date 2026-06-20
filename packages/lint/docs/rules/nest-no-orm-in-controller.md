# `nest-no-orm-in-controller`

Flags direct ORM imports (Prisma, TypeORM, Mongoose, MikroORM) inside NestJS controller files.

## Why

Controllers own HTTP routing, request parsing, and response shaping. Persistence is a service responsibility. Importing the ORM client directly in a controller collapses two distinct layers, making the controller untestable without a real database and making the persistence strategy invisible to the service layer where it belongs.

Detected by file name: `.controller.ts` suffix or `controllers/` path segment. Flagged import sources: `@prisma/client`, `@prisma/*`, `typeorm`, `@nestjs/typeorm`, `@nestjs/mongoose`, `mongoose`, `@mikro-orm/*`.

## Examples

### Incorrect

```ts
// src/users/user.controller.ts
import { PrismaClient } from '@prisma/client'; // flagged
import { InjectRepository } from '@nestjs/typeorm'; // flagged
```

### Correct

```ts
// src/users/user.controller.ts
import { UserService } from './user.service.js'; // inject the service

@Controller('users')
export class UserController {
  constructor(private readonly users: UserService) {}
}
```

## Options

None.

## When to disable

Never. If direct ORM access is needed, it belongs in a repository class or service.
