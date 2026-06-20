import { afterAll, describe, it } from 'vitest';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { noHardcodedSecrets } from '../../src/rules/no-hardcoded-secrets.js';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe as typeof RuleTester.describe;
RuleTester.it = it as typeof RuleTester.it;

const tester = new RuleTester();

tester.run('no-hardcoded-secrets', noHardcodedSecrets, {
  valid: [
    // Empty string assigned to secret-named var — placeholder, not a secret
    {
      code: `const password = '';`,
      filename: '/app/services/auth.service.ts',
    },
    // Value loaded from environment variable
    {
      code: `const apiKey = process.env.API_KEY;`,
      filename: '/app/services/auth.service.ts',
    },
    // Value loaded from config module
    {
      code: `const token = config.authToken;`,
      filename: '/app/services/auth.service.ts',
    },
    // Non-secret variable name with a plain string
    {
      code: `const greeting = 'hello world';`,
      filename: '/app/services/user.service.ts',
    },
    // Test files are exempt — fixtures use literal credentials intentionally
    {
      code: `const password = 'test-password-123';`,
      filename: '/app/tests/auth.test.ts',
    },
    // Secret-named var in a spec file — also exempt
    {
      code: `const apiKey = 'sk_test_fixture';`,
      filename: '/app/services/auth.service.spec.ts',
    },
  ],
  invalid: [
    // Password hardcoded in a service
    {
      code: `const password = 'hunter2';`,
      filename: '/app/services/auth.service.ts',
      errors: [{ messageId: 'secretName' }],
    },
    // API key hardcoded (name pattern)
    {
      code: `const apiKey = 'abc123def456xyz';`,
      filename: '/app/services/stripe.service.ts',
      errors: [{ messageId: 'secretName' }],
    },
    // Secret in an object property
    {
      code: `const cfg = { secret: 'my-app-secret-value' };`,
      filename: '/app/config/app.config.ts',
      errors: [{ messageId: 'secretName' }],
    },
    // GitHub token detected by value prefix
    {
      code: `const x = 'ghp_1234567890abcdefghijklmnopqrstuvwxyz';`,
      filename: '/app/services/github.service.ts',
      errors: [{ messageId: 'secretValue' }],
    },
    // Stripe live key detected by value prefix
    {
      code: `const key = 'sk_live_abc123xyz456';`,
      filename: '/app/services/payment.service.ts',
      errors: [{ messageId: 'secretValue' }],
    },
  ],
});
