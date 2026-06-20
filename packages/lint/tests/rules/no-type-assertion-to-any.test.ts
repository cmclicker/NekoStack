import { createRuleTester } from '@nekostack/test';
import { noTypeAssertionToAny } from '../../src/rules/no-type-assertion-to-any.js';

const tester = createRuleTester();

tester.run('no-type-assertion-to-any', noTypeAssertionToAny, {
  valid: [
    // Assertion to a concrete type
    { code: 'const x = value as string;' },
    // Assertion to unknown is acceptable
    { code: 'const x = value as unknown;' },
    // Assertion to a named interface
    { code: 'const x = value as UserDto;' },
    // Chained assertion to non-any
    { code: 'const x = (value as Foo).bar;' },
    // No assertion at all
    { code: 'const x: string = value;' },
  ],
  invalid: [
    // Basic `as any`
    {
      code: 'const x = value as any;',
      errors: [{ messageId: 'noAsAny' }],
    },
    // Property access result cast to any
    {
      code: 'const x = obj.prop as any;',
      errors: [{ messageId: 'noAsAny' }],
    },
    // In return statement
    {
      code: 'function f() { return value as any; }',
      errors: [{ messageId: 'noAsAny' }],
    },
    // In variable declaration
    {
      code: 'const y = fn() as any;',
      errors: [{ messageId: 'noAsAny' }],
    },
    // Nested: cast then access
    {
      code: 'const z = (x as any).foo;',
      errors: [{ messageId: 'noAsAny' }],
    },
    // Double cast — both should fire
    {
      code: 'const a = x as any; const b = y as any;',
      errors: [{ messageId: 'noAsAny' }, { messageId: 'noAsAny' }],
    },
  ],
});
