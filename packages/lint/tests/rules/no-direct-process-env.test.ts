import { afterAll, describe, it } from 'vitest';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { noDirectProcessEnv } from '../../src/rules/no-direct-process-env.js';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe as typeof RuleTester.describe;
RuleTester.it = it as typeof RuleTester.it;

const tester = new RuleTester();

tester.run('no-direct-process-env', noDirectProcessEnv, {
  valid: [
    // Unrelated member access — not process.env
    { code: 'process.exit(0);' },
    { code: 'process.version;' },
    { code: 'const x = 42;' },
    { code: 'import { getConfig } from "@nekostack/config";' },
    // Config package is self-exempt (filename check)
    {
      code: 'const port = process.env.PORT;',
      filename: '/workspace/packages/config/src/index.ts',
    },
  ],
  invalid: [
    // Direct property access
    {
      code: 'const x = process.env.NODE_ENV;',
      errors: [{ messageId: 'direct' }],
    },
    // Computed string key
    {
      code: 'const x = process.env["API_KEY"];',
      errors: [{ messageId: 'direct' }],
    },
    // Bare reference (assigning the entire env object)
    {
      code: 'const env = process.env;',
      errors: [{ messageId: 'direct' }],
    },
    // Computed property name on process itself
    {
      code: 'if (process["env"].DEBUG) {}',
      errors: [{ messageId: 'direct' }],
    },
    // Inside a function
    {
      code: 'function getPort() { return process.env.PORT; }',
      errors: [{ messageId: 'direct' }],
    },
    // Inside a conditional
    {
      code: 'const isProd = process.env.NODE_ENV === "production";',
      errors: [{ messageId: 'direct' }],
    },
  ],
});
