import { createRuleTester } from '@nekostack/test';
import { noNonNullAssertion } from '../../src/rules/no-non-null-assertion.js';

const tester = createRuleTester();

tester.run('no-non-null-assertion', noNonNullAssertion, {
  valid: [
    // Optional chaining instead of !
    { code: 'const x = obj?.property;' },
    // Nullish coalescing instead of !
    { code: 'const x = value ?? fallback;' },
    // Explicit null guard
    { code: 'if (x !== null) { x.foo(); }' },
    // Logical not — not a non-null assertion
    { code: 'if (!x) return;' },
    // Regular type assertion (not non-null)
    { code: 'const x = value as string;' },
  ],
  invalid: [
    // Property access after non-null assertion
    {
      code: 'const x = obj!.property;',
      errors: [{ messageId: 'noNonNull' }],
    },
    // Array element access
    {
      code: 'const first = arr[0]!;',
      errors: [{ messageId: 'noNonNull' }],
    },
    // Function return value
    {
      code: 'const x = fn()!;',
      errors: [{ messageId: 'noNonNull' }],
    },
    // Chained after cast
    {
      code: 'const x = (value as Foo)!.bar;',
      errors: [{ messageId: 'noNonNull' }],
    },
    // As argument
    {
      code: 'doSomething(param!);',
      errors: [{ messageId: 'noNonNull' }],
    },
    // Multiple in one file
    {
      code: 'const a = x!; const b = y!;',
      errors: [{ messageId: 'noNonNull' }, { messageId: 'noNonNull' }],
    },
  ],
});
