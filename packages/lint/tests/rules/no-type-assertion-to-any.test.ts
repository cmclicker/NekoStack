import { afterAll, describe, it } from 'vitest';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { noTypeAssertionToAny } from '../../src/rules/no-type-assertion-to-any.js';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe as typeof RuleTester.describe;
RuleTester.it = it as typeof RuleTester.it;

const tester = new RuleTester();

tester.run('no-type-assertion-to-any', noTypeAssertionToAny, {
  valid: [
    { code: 'const x = value as string;' },
    { code: 'const x = value as unknown;' },
    { code: 'const x = value as UserDto;' },
    { code: 'const x = (value as Foo).bar;' },
    { code: 'const x: string = value;' },
  ],
  invalid: [
    {
      code: 'const x = value as any;',
      errors: [{ messageId: 'noAsAny' }],
    },
    {
      code: 'const x = obj.prop as any;',
      errors: [{ messageId: 'noAsAny' }],
    },
    {
      code: 'function f() { return value as any; }',
      errors: [{ messageId: 'noAsAny' }],
    },
    {
      code: 'const y = fn() as any;',
      errors: [{ messageId: 'noAsAny' }],
    },
    {
      code: 'const z = (x as any).foo;',
      errors: [{ messageId: 'noAsAny' }],
    },
    {
      code: 'const a = x as any; const b = y as any;',
      errors: [{ messageId: 'noAsAny' }, { messageId: 'noAsAny' }],
    },
  ],
});
