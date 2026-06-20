import { afterAll, describe, it } from 'vitest';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { noDirectDateNow } from '../../src/rules/no-direct-date-now.js';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe as typeof RuleTester.describe;
RuleTester.it = it as typeof RuleTester.it;

const tester = new RuleTester();

tester.run('no-direct-date-now', noDirectDateNow, {
  valid: [
    // new Date(value) — parsing a specific timestamp, not current time
    {
      code: `const d = new Date('2024-01-01');`,
      filename: '/app/services/event.service.ts',
    },
    // new Date(timestamp) — constructing from a number
    {
      code: `const d = new Date(timestamp);`,
      filename: '/app/services/event.service.ts',
    },
    // Date.now() in a test file — always permitted
    {
      code: `const now = Date.now();`,
      filename: '/app/services/event.service.spec.ts',
    },
    // new Date() in a test file — always permitted
    {
      code: `const d = new Date();`,
      filename: '/app/services/event.service.test.ts',
    },
    // Date used for other static methods — not flagged
    {
      code: `const s = Date.parse('2024-01-01');`,
      filename: '/app/utils/time.ts',
    },
  ],
  invalid: [
    // Date.now() in a service
    {
      code: `const now = Date.now();`,
      filename: '/app/services/event.service.ts',
      errors: [{ messageId: 'noDateNow' }],
    },
    // new Date() with no args in a service
    {
      code: `const now = new Date();`,
      filename: '/app/services/event.service.ts',
      errors: [{ messageId: 'noNewDate' }],
    },
    // Date.now() in a controller
    {
      code: `const ts = Date.now();`,
      filename: '/app/controllers/order.controller.ts',
      errors: [{ messageId: 'noDateNow' } ],
    },
    // new Date() in a utility module
    {
      code: `return new Date();`,
      filename: '/app/utils/timestamp.ts',
      errors: [{ messageId: 'noNewDate' }],
    },
    // Both in the same file — each flagged
    {
      code: [
        `const a = Date.now();`,
        `const b = new Date();`,
      ].join('\n'),
      filename: '/app/services/audit.service.ts',
      errors: [{ messageId: 'noDateNow' }, { messageId: 'noNewDate' }],
    },
  ],
});
