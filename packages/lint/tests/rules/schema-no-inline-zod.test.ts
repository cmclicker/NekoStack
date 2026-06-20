import { afterAll, describe, it } from 'vitest';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { schemaNoInlineZod } from '../../src/rules/schema-no-inline-zod.js';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe as typeof RuleTester.describe;
RuleTester.it = it as typeof RuleTester.it;

const tester = new RuleTester();

tester.run('schema-no-inline-zod', schemaNoInlineZod, {
  valid: [
    // Schema file — construction allowed
    {
      code: `import { z } from 'zod'; export const UserSchema = z.object({ name: z.string() });`,
      filename: '/app/schemas/user.schema.ts',
    },
    // Schema file by path convention
    {
      code: `import { z } from 'zod'; export const S = z.string();`,
      filename: '/app/schemas/primitives.ts',
    },
    // packages/schema — always exempt
    {
      code: `import { z } from 'zod'; const s = z.object({});`,
      filename: '/workspace/packages/schema/src/generators/zod.ts',
    },
    // Importing z but only using for type inference (no CallExpression)
    {
      code: `import { z } from 'zod'; type User = z.infer<typeof UserSchema>;`,
      filename: '/app/services/user.service.ts',
    },
    // Non-zod member call — unrelated library
    {
      code: `import * as v from 'valibot'; const s = v.object({});`,
      filename: '/app/services/user.service.ts',
    },
    // No zod import at all
    {
      code: `const result = someLib.parse({});`,
      filename: '/app/controllers/user.controller.ts',
    },
  ],
  invalid: [
    // Service file calling z.object
    {
      code: `import { z } from 'zod'; export const schema = z.object({ id: z.string() });`,
      filename: '/app/services/user.service.ts',
      errors: [{ messageId: 'inline' }, { messageId: 'inline' }],
    },
    // Controller calling z.string
    {
      code: `import { z } from 'zod'; const nameSchema = z.string();`,
      filename: '/app/controllers/user.controller.ts',
      errors: [{ messageId: 'inline' }],
    },
    // Namespace import pattern
    {
      code: `import * as z from 'zod'; const s = z.number();`,
      filename: '/app/utils/validate.ts',
      errors: [{ messageId: 'inline' }],
    },
    // Default import pattern
    {
      code: `import z from 'zod'; const s = z.boolean();`,
      filename: '/app/utils/validate.ts',
      errors: [{ messageId: 'inline' }],
    },
    // Renamed import
    {
      code: `import { z as zod } from 'zod'; const s = zod.array(zod.string());`,
      filename: '/app/lib/parse.ts',
      errors: [{ messageId: 'inline' }, { messageId: 'inline' }],
    },
  ],
});
