import { afterAll, describe, it } from 'vitest';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { consistentTypeImports } from '../../src/rules/consistent-type-imports.js';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe as typeof RuleTester.describe;
RuleTester.it = it as typeof RuleTester.it;

const tester = new RuleTester();

tester.run('consistent-type-imports', consistentTypeImports, {
  valid: [
    // Already using import type — no report
    {
      code: [
        `import type { Foo } from './foo';`,
        `const x: Foo = {} as Foo;`,
      ].join('\n'),
      filename: '/app/services/user.service.ts',
    },
    // Binding used as a value (new expression) — must stay as import
    {
      code: [
        `import { Foo } from './foo';`,
        `const x = new Foo();`,
      ].join('\n'),
      filename: '/app/services/user.service.ts',
    },
    // Binding used as both type and value — must stay as import
    {
      code: [
        `import { Foo } from './foo';`,
        `const x: Foo = new Foo();`,
      ].join('\n'),
      filename: '/app/services/user.service.ts',
    },
    // Inline `import { type Foo }` — already type import, no report
    {
      code: [
        `import { type Foo } from './foo';`,
        `const x: Foo = {} as Foo;`,
      ].join('\n'),
      filename: '/app/services/user.service.ts',
    },
    // Binding used as function call — value use
    {
      code: [
        `import { createFoo } from './foo';`,
        `const x = createFoo();`,
      ].join('\n'),
      filename: '/app/services/user.service.ts',
    },
  ],
  invalid: [
    // Used only in type annotation — should be import type
    {
      code: [
        `import { Foo } from './foo';`,
        `const x: Foo = {} as any;`,
      ].join('\n'),
      filename: '/app/services/user.service.ts',
      errors: [{ messageId: 'requireTypeImport', data: { name: 'Foo' } }],
      output: [
        `import { type Foo } from './foo';`,
        `const x: Foo = {} as any;`,
      ].join('\n'),
    },
    // Used only in type alias — should be import type
    {
      code: [
        `import { Foo } from './foo';`,
        `type X = Foo;`,
      ].join('\n'),
      filename: '/app/utils/types.ts',
      errors: [{ messageId: 'requireTypeImport', data: { name: 'Foo' } }],
      output: [
        `import { type Foo } from './foo';`,
        `type X = Foo;`,
      ].join('\n'),
    },
    // Used only in function return type annotation
    {
      code: [
        `import { Result } from './result';`,
        `function compute(): Result { return {} as any; }`,
      ].join('\n'),
      filename: '/app/services/compute.service.ts',
      errors: [{ messageId: 'requireTypeImport', data: { name: 'Result' } }],
      output: [
        `import { type Result } from './result';`,
        `function compute(): Result { return {} as any; }`,
      ].join('\n'),
    },
    // Used in generic type parameter only
    {
      code: [
        `import { Item } from './item';`,
        `const list: Array<Item> = [];`,
      ].join('\n'),
      filename: '/app/services/list.service.ts',
      errors: [{ messageId: 'requireTypeImport', data: { name: 'Item' } }],
      output: [
        `import { type Item } from './item';`,
        `const list: Array<Item> = [];`,
      ].join('\n'),
    },
    // Multiple specifiers — only one is type-only
    {
      code: [
        `import { Foo, Bar } from './foo';`,
        `const x: Foo = {} as any;`,
        `const y = new Bar();`,
      ].join('\n'),
      filename: '/app/services/user.service.ts',
      errors: [{ messageId: 'requireTypeImport', data: { name: 'Foo' } }],
      output: [
        `import { type Foo, Bar } from './foo';`,
        `const x: Foo = {} as any;`,
        `const y = new Bar();`,
      ].join('\n'),
    },
  ],
});
