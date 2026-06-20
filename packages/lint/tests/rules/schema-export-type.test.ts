import { afterAll, describe, it } from 'vitest';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { schemaExportType } from '../../src/rules/schema-export-type.js';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe as typeof RuleTester.describe;
RuleTester.it = it as typeof RuleTester.it;

const tester = new RuleTester();

tester.run('schema-export-type', schemaExportType, {
  valid: [
    // Schema and its inferred type are both exported
    {
      code: [
        `import { z } from 'zod';`,
        `export const userSchema = z.object({ name: z.string() });`,
        `export type UserSchema = z.infer<typeof userSchema>;`,
      ].join('\n'),
      filename: '/app/schemas/user.schema.ts',
    },
    // Non-schema file — rule does not apply
    {
      code: [
        `import { z } from 'zod';`,
        `export const userSchema = z.object({ name: z.string() });`,
      ].join('\n'),
      filename: '/app/services/user.service.ts',
    },
    // Schema not exported — no type export required
    {
      code: [
        `import { z } from 'zod';`,
        `const userSchema = z.object({ name: z.string() });`,
      ].join('\n'),
      filename: '/app/schemas/user.schema.ts',
    },
    // Namespace import — same logic applies
    {
      code: [
        `import * as z from 'zod';`,
        `export const loginSchema = z.object({ email: z.string() });`,
        `export type LoginSchema = z.infer<typeof loginSchema>;`,
      ].join('\n'),
      filename: '/app/schemas/login.schema.ts',
    },
    // Multiple schemas, all covered
    {
      code: [
        `import { z } from 'zod';`,
        `export const userSchema = z.object({ name: z.string() });`,
        `export type UserSchema = z.infer<typeof userSchema>;`,
        `export const postSchema = z.object({ title: z.string() });`,
        `export type PostSchema = z.infer<typeof postSchema>;`,
      ].join('\n'),
      filename: '/app/schemas/user.schema.ts',
    },
  ],
  invalid: [
    // Exported schema with no type export — auto-fix inserts the export
    {
      code: [
        `import { z } from 'zod';`,
        `export const userSchema = z.object({ name: z.string() });`,
      ].join('\n'),
      filename: '/app/schemas/user.schema.ts',
      errors: [{ messageId: 'missingTypeExport' }],
      output: [
        `import { z } from 'zod';`,
        `export const userSchema = z.object({ name: z.string() });`,
        `export type UserSchema = z.infer<typeof userSchema>;`,
      ].join('\n'),
    },
    // Two schemas, second one missing its type export
    {
      code: [
        `import { z } from 'zod';`,
        `export const userSchema = z.object({ name: z.string() });`,
        `export type UserSchema = z.infer<typeof userSchema>;`,
        `export const postSchema = z.object({ title: z.string() });`,
      ].join('\n'),
      filename: '/app/schemas/post.schema.ts',
      errors: [{ messageId: 'missingTypeExport' }],
      output: [
        `import { z } from 'zod';`,
        `export const userSchema = z.object({ name: z.string() });`,
        `export type UserSchema = z.infer<typeof userSchema>;`,
        `export const postSchema = z.object({ title: z.string() });`,
        `export type PostSchema = z.infer<typeof postSchema>;`,
      ].join('\n'),
    },
    // Namespace import — missing type export
    {
      code: [
        `import * as z from 'zod';`,
        `export const loginSchema = z.object({ email: z.string() });`,
      ].join('\n'),
      filename: '/app/schemas/login.schema.ts',
      errors: [{ messageId: 'missingTypeExport' }],
      output: [
        `import * as z from 'zod';`,
        `export const loginSchema = z.object({ email: z.string() });`,
        `export type LoginSchema = z.infer<typeof loginSchema>;`,
      ].join('\n'),
    },
  ],
});
