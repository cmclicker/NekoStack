import { afterAll, describe, it } from 'vitest';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { noConsoleInModule } from '../../src/rules/no-console-in-module.js';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe as typeof RuleTester.describe;
RuleTester.it = it as typeof RuleTester.it;

const tester = new RuleTester();

tester.run('no-console-in-module', noConsoleInModule, {
  valid: [
    // console.error is permitted — signals a real problem
    {
      code: `console.error('Something failed:', err);`,
      filename: '/app/services/user.service.ts',
    },
    // console.warn is permitted
    {
      code: `console.warn('Deprecated API used');`,
      filename: '/app/services/user.service.ts',
    },
    // Test file — all console methods exempt
    {
      code: `console.log('debug value:', value);`,
      filename: '/app/services/user.service.spec.ts',
    },
    // Test file by .test.ts suffix
    {
      code: `console.debug('test output');`,
      filename: '/app/utils/format.test.ts',
    },
    // Test file in __tests__ directory
    {
      code: `console.log('setup');`,
      filename: '/app/__tests__/setup.ts',
    },
  ],
  invalid: [
    // console.log in a service file
    {
      code: `console.log('user created', userId);`,
      filename: '/app/services/user.service.ts',
      errors: [{ messageId: 'bannedConsole', data: { method: 'log' } }],
    },
    // console.debug in a utility module
    {
      code: `console.debug('payload:', payload);`,
      filename: '/app/utils/transform.ts',
      errors: [{ messageId: 'bannedConsole', data: { method: 'debug' } }],
    },
    // console.info in a controller
    {
      code: `console.info('Request received');`,
      filename: '/app/controllers/user.controller.ts',
      errors: [{ messageId: 'bannedConsole', data: { method: 'info' } }],
    },
    // console.dir in a schema file
    {
      code: `console.dir(obj, { depth: null });`,
      filename: '/app/schemas/user.schema.ts',
      errors: [{ messageId: 'bannedConsole', data: { method: 'dir' } }],
    },
    // console.table
    {
      code: `console.table(rows);`,
      filename: '/app/services/report.service.ts',
      errors: [{ messageId: 'bannedConsole', data: { method: 'table' } }],
    },
    // Multiple console calls — each flagged separately
    {
      code: [
        `console.log('start');`,
        `doWork();`,
        `console.log('end');`,
      ].join('\n'),
      filename: '/app/services/worker.service.ts',
      errors: [
        { messageId: 'bannedConsole', data: { method: 'log' } },
        { messageId: 'bannedConsole', data: { method: 'log' } },
      ],
    },
  ],
});
