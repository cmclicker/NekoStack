import { afterAll, describe, it } from 'vitest';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { nestNoOrmInController } from '../../src/rules/nest-no-orm-in-controller.js';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe as typeof RuleTester.describe;
RuleTester.it = it as typeof RuleTester.it;

const tester = new RuleTester();

tester.run('nest-no-orm-in-controller', nestNoOrmInController, {
  valid: [
    // Service file — ORM import is fine here
    {
      code: `import { PrismaClient } from '@prisma/client';`,
      filename: '/app/services/user.service.ts',
    },
    // Controller importing from a service — correct pattern
    {
      code: `import { UserService } from './user.service.js';`,
      filename: '/app/controllers/user.controller.ts',
    },
    // Controller importing NestJS core decorators — fine
    {
      code: `import { Controller, Get } from '@nestjs/common';`,
      filename: '/app/controllers/user.controller.ts',
    },
    // Controller importing shared types
    {
      code: `import type { UserDto } from '../types/user.js';`,
      filename: '/app/controllers/user.controller.ts',
    },
    // Repository file — not a controller, ORM import expected
    {
      code: `import { InjectRepository } from '@nestjs/typeorm';`,
      filename: '/app/repositories/user.repository.ts',
    },
  ],
  invalid: [
    // Controller importing Prisma directly
    {
      code: `import { PrismaClient } from '@prisma/client';`,
      filename: '/app/controllers/user.controller.ts',
      errors: [{ messageId: 'orm' }],
    },
    // Controller importing TypeORM via NestJS integration
    {
      code: `import { InjectRepository } from '@nestjs/typeorm';`,
      filename: '/app/controllers/user.controller.ts',
      errors: [{ messageId: 'orm' }],
    },
    // Controller importing Mongoose via NestJS integration
    {
      code: `import { InjectModel } from '@nestjs/mongoose';`,
      filename: '/app/controllers/user.controller.ts',
      errors: [{ messageId: 'orm' }],
    },
    // File in controllers/ directory importing typeorm directly
    {
      code: `import { Repository } from 'typeorm';`,
      filename: '/app/controllers/base.ts',
      errors: [{ messageId: 'orm' }],
    },
    // Controller importing a Prisma sub-package (startsWith check)
    {
      code: `import { Prisma } from '@prisma/client';`,
      filename: '/app/api/user.controller.ts',
      errors: [{ messageId: 'orm' }],
    },
  ],
});
