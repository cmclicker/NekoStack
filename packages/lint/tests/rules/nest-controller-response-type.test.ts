import { afterAll, describe, it } from 'vitest';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { nestControllerResponseType } from '../../src/rules/nest-controller-response-type.js';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe as typeof RuleTester.describe;
RuleTester.it = it as typeof RuleTester.it;

const tester = new RuleTester();

tester.run('nest-controller-response-type', nestControllerResponseType, {
  valid: [
    // @Get with explicit return type
    {
      code: `
        class UserController {
          @Get()
          getUser(): Promise<UserDto> { return this.service.find(); }
        }
      `,
      filename: 'src/user/user.controller.ts',
    },
    // @Post with sync return type
    {
      code: `
        class UserController {
          @Post()
          createUser(): UserDto { return this.service.create(); }
        }
      `,
      filename: 'src/user/user.controller.ts',
    },
    // Method without HTTP decorator — no requirement
    {
      code: `
        class UserController {
          private helper() { return 42; }
        }
      `,
      filename: 'src/user/user.controller.ts',
    },
    // Non-HTTP decorator — no requirement
    {
      code: `
        class UserController {
          @UseGuards(AuthGuard)
          getProtected(): UserDto { return this.service.find(); }
        }
      `,
      filename: 'src/user/user.controller.ts',
    },
    // Not a controller file — rule is inactive
    {
      code: `
        class UserService {
          @Get()
          getUser() { return this.repo.find(); }
        }
      `,
      filename: 'src/user/user.service.ts',
    },
    // @Delete with return type
    {
      code: `
        class ItemController {
          @Delete(':id')
          remove(): Promise<void> { return this.service.remove(id); }
        }
      `,
      filename: 'src/item/item.controller.ts',
    },
  ],
  invalid: [
    // @Get without return type
    {
      code: `
        class UserController {
          @Get()
          getUser() { return this.service.find(); }
        }
      `,
      filename: 'src/user/user.controller.ts',
      errors: [{ messageId: 'missingReturnType' }],
    },
    // @Post without return type
    {
      code: `
        class UserController {
          @Post()
          createUser() { return this.service.create(); }
        }
      `,
      filename: 'src/user/user.controller.ts',
      errors: [{ messageId: 'missingReturnType' }],
    },
    // @Put without return type
    {
      code: `
        class ItemController {
          @Put(':id')
          replace() { return this.service.replace(id); }
        }
      `,
      filename: 'src/item/item.controller.ts',
      errors: [{ messageId: 'missingReturnType' }],
    },
    // @Patch without return type
    {
      code: `
        class ItemController {
          @Patch(':id')
          update() { return this.service.update(id); }
        }
      `,
      filename: 'src/item/item.controller.ts',
      errors: [{ messageId: 'missingReturnType' }],
    },
    // @Delete without return type
    {
      code: `
        class ItemController {
          @Delete(':id')
          remove() { return this.service.remove(id); }
        }
      `,
      filename: 'src/item/item.controller.ts',
      errors: [{ messageId: 'missingReturnType' }],
    },
    // Multiple missing in one controller
    {
      code: `
        class UserController {
          @Get()
          getAll() { return []; }
          @Get(':id')
          getOne() { return {}; }
        }
      `,
      filename: 'src/user/user.controller.ts',
      errors: [{ messageId: 'missingReturnType' }, { messageId: 'missingReturnType' }],
    },
  ],
});
