import { afterAll, describe, it } from 'vitest';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { controllerNoServiceCycle } from '../../src/rules/controller-no-service-cycle.js';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe as typeof RuleTester.describe;
RuleTester.it = it as typeof RuleTester.it;

const tester = new RuleTester();

tester.run('controller-no-service-cycle', controllerNoServiceCycle, {
  valid: [
    // Non-controller file — rule doesn't apply, even if importing a controller
    {
      code: `import { AuthController } from './auth.controller.js';`,
      filename: '/app/services/proxy.service.ts',
    },
    // Controller importing from a service — fine
    {
      code: `import { AuthService } from '../services/auth.service.js';`,
      filename: '/app/controllers/auth.controller.ts',
    },
    // Controller importing from utils
    {
      code: `import { formatResponse } from '../utils/response.js';`,
      filename: '/app/controllers/user.controller.ts',
    },
    // Controller importing shared types
    {
      code: `import type { UserDto } from '../types/user.js';`,
      filename: '/app/controllers/user.controller.ts',
    },
    // Controller importing from a package (not a local controller)
    {
      code: `import { something } from '@nekostack/schema';`,
      filename: '/app/controllers/user.controller.ts',
    },
    // File in controllers/ directory importing from services
    {
      code: `import { PostService } from '../services/post.service.js';`,
      filename: '/app/controllers/posts/list.ts',
    },
  ],
  invalid: [
    // Controller importing another controller by .controller suffix
    {
      code: `import { UserController } from './user.controller.js';`,
      filename: '/app/controllers/auth.controller.ts',
      errors: [{ messageId: 'cycle' }],
    },
    // Controller importing peer without .js extension
    {
      code: `import { PostController } from './post.controller';`,
      filename: '/app/controllers/auth.controller.ts',
      errors: [{ messageId: 'cycle' }],
    },
    // Controller importing from controllers/ directory (path-based)
    {
      code: `import { UserController } from '../controllers/user.js';`,
      filename: '/app/controllers/auth.controller.ts',
      errors: [{ messageId: 'cycle' }],
    },
    // File in controllers/ directory importing from controllers/ via absolute alias
    {
      code: `import { AuthController } from '@app/controllers/auth';`,
      filename: '/app/controllers/posts/list.ts',
      errors: [{ messageId: 'cycle' }],
    },
  ],
});
