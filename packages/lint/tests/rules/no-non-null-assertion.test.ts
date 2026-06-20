import { afterAll, describe, it } from 'vitest';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { noNonNullAssertion } from '../../src/rules/no-non-null-assertion.js';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe as typeof RuleTester.describe;
RuleTester.it = it as typeof RuleTester.it;

const tester = new RuleTester();

tester.run('no-non-null-assertion', noNonNullAssertion, {
  valid: [
    { code: 'const x = obj?.property;' },
    { code: 'const x = value ?? fallback;' },
    { code: 'if (x !== null) { x.foo(); }' },
    { code: 'if (!x) return;' },
    { code: 'const x = value as string;' },
  ],
  invalid: [
    {
      code: 'const x = obj!.property;',
      errors: [{ messageId: 'noNonNull' }],
    },
    {
      code: 'const first = arr[0]!;',
      errors: [{ messageId: 'noNonNull' }],
    },
    {
      code: 'const x = fn()!;',
      errors: [{ messageId: 'noNonNull' }],
    },
    {
      code: 'const x = (value as Foo)!.bar;',
      errors: [{ messageId: 'noNonNull' }],
    },
    {
      code: 'doSomething(param!);',
      errors: [{ messageId: 'noNonNull' }],
    },
    {
      code: 'const a = x!; const b = y!;',
      errors: [{ messageId: 'noNonNull' }, { messageId: 'noNonNull' }],
    },
  ],
});
