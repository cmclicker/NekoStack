import { afterAll, describe, it } from 'vitest';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { serviceHasSpec, _setExistsSync } from '../../src/rules/service-has-spec.js';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe as typeof RuleTester.describe;
RuleTester.it = it as typeof RuleTester.it;

// Mock: user.service spec exists; post.service spec does not
_setExistsSync((p) => {
  const normalized = p.replace(/\\/g, '/');
  return (
    normalized.includes('/services/user.service.spec.ts') ||
    normalized.includes('/services/user.service.test.ts') ||
    normalized.includes('/services/user.spec.ts') ||
    normalized.includes('/services/user.test.ts')
  );
});

const tester = new RuleTester();

tester.run('service-has-spec', serviceHasSpec, {
  valid: [
    // Non-service file — rule doesn't apply
    {
      code: `export function formatDate(d: Date) { return d.toISOString(); }`,
      filename: '/app/utils/date.ts',
    },
    // Service file with co-located spec (per mock above)
    {
      code: `export async function getUser(id: string) { return db.users.findUnique({ where: { id } }); }`,
      filename: '/app/services/user.service.ts',
    },
    // Non-.service.ts file that happens to be in services/ — rule only checks filename suffix
    {
      code: `export type UserDto = { id: string };`,
      filename: '/app/services/user.types.ts',
    },
  ],
  invalid: [
    // Service file with no co-located spec (post.service — not in mock)
    {
      code: `export async function createPost(data: unknown) { return db.posts.create({ data }); }`,
      filename: '/app/services/post.service.ts',
      errors: [{ messageId: 'missingSpec' }],
    },
    // Another missing spec
    {
      code: `export class AuthService { async login() {} }`,
      filename: '/app/services/auth.service.ts',
      errors: [{ messageId: 'missingSpec' }],
    },
  ],
});
