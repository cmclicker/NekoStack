import { afterAll, describe, it } from 'vitest';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { prismaJsonCast } from '../../src/rules/prisma-json-cast.js';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe as typeof RuleTester.describe;
RuleTester.it = it as typeof RuleTester.it;

const tester = new RuleTester();

tester.run('prisma-json-cast', prismaJsonCast, {
  valid: [
    // Non-JsonValue type — member access is fine
    { code: `const user: User = getUser(); const name = user.name;` },
    // string type — fine
    { code: `const s: string = 'hello'; const len = s.length;` },
    // JsonValue variable accessed without property drilling (just assigning)
    { code: `const meta: Prisma.JsonValue = record.metadata;` },
    // JsonValue with explicit type cast — fine
    { code: `const meta: Prisma.JsonValue = record.metadata; const key = (meta as UserMeta).someKey;` },
    // Unqualified JsonValue with explicit cast
    { code: `const data: JsonValue = raw; const id = (data as { id: string }).id;` },
    // No type annotation — not tracked
    { code: `const meta = record.metadata; const key = meta.someKey;` },
    // Prisma.JsonValue but not accessing properties (passing it around)
    { code: `const meta: Prisma.JsonValue = record.metadata; doSomething(meta);` },
  ],
  invalid: [
    // Prisma.JsonValue — direct property access without cast
    {
      code: `const meta: Prisma.JsonValue = record.metadata; const key = meta.someKey;`,
      errors: [{ messageId: 'cast' }],
    },
    // Unqualified JsonValue
    {
      code: `const data: JsonValue = response.body; const id = data.id;`,
      errors: [{ messageId: 'cast' }],
    },
    // Bracket notation on JsonValue
    {
      code: `const payload: Prisma.JsonValue = row.payload; const v = payload['key'];`,
      errors: [{ messageId: 'cast' }],
    },
    // Multiple accesses — each flagged
    {
      code: `const j: JsonValue = raw; j.a; j.b;`,
      errors: [{ messageId: 'cast' }, { messageId: 'cast' }],
    },
    // Prisma.JsonValue in nested statement
    {
      code: `function f() { const cfg: Prisma.JsonValue = getConfig(); return cfg.host; }`,
      errors: [{ messageId: 'cast' }],
    },
  ],
});
