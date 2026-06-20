import { afterAll, describe, it } from 'vitest';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { noRawSql } from '../../src/rules/no-raw-sql.js';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe as typeof RuleTester.describe;
RuleTester.it = it as typeof RuleTester.it;

const tester = new RuleTester();

tester.run('no-raw-sql', noRawSql, {
  valid: [
    // Typed Prisma query — no raw SQL
    { code: `prisma.user.findMany({ where: { active: true } });` },
    // $queryRaw as a tagged template literal — safe (Prisma parameterises at the tag)
    { code: 'prisma.$queryRaw`SELECT * FROM "User" WHERE id = ${id}`;' },
    // $executeRaw as a tagged template literal — safe
    { code: 'prisma.$executeRaw`UPDATE "User" SET active = true WHERE id = ${id}`;' },
    // Non-Prisma method with a similar name — not in our set
    { code: `db.query('SELECT 1');` },
    // Computed property access — our rule only checks non-computed MemberExpression
    { code: `prisma['$queryRaw']('SELECT 1');` },
  ],
  invalid: [
    // $queryRaw called as a function — unsafe string argument
    {
      code: `prisma.$queryRaw('SELECT * FROM "User" WHERE id = ' + id);`,
      errors: [{ messageId: 'rawSql' }],
    },
    // $executeRaw called as a function
    {
      code: `prisma.$executeRaw('DELETE FROM "User" WHERE id = ' + id);`,
      errors: [{ messageId: 'rawSql' }],
    },
    // $queryRawUnsafe — never safe regardless of form
    {
      code: `prisma.$queryRawUnsafe('SELECT * FROM "User"');`,
      errors: [{ messageId: 'rawSql' }],
    },
    // $executeRawUnsafe — never safe
    {
      code: `prisma.$executeRawUnsafe('TRUNCATE "User"');`,
      errors: [{ messageId: 'rawSql' }],
    },
    // $queryRawUnsafe as tagged template — still unsafe (the 'Unsafe' suffix bypasses escaping)
    {
      code: 'prisma.$queryRawUnsafe`SELECT * FROM "User" WHERE email = ${email}`;',
      errors: [{ messageId: 'rawSql' }],
    },
  ],
});
