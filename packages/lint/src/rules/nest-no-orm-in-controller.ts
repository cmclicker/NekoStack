import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

const createRule = RuleCreator(
  (name) =>
    `https://github.com/cmclicker/NekoStack/tree/main/packages/lint/docs/rules/${name}.md`,
);

const ORM_PACKAGES = new Set([
  '@prisma/client',
  'prisma',
  'typeorm',
  '@nestjs/typeorm',
  '@nestjs/mongoose',
  'mongoose',
  '@mikro-orm/core',
  '@mikro-orm/nestjs',
]);

function isOrmImport(source: string): boolean {
  if (ORM_PACKAGES.has(source)) return true;
  if (source.startsWith('@prisma/')) return true;
  if (source.startsWith('@mikro-orm/')) return true;
  return false;
}

function isControllerFile(filename: string): boolean {
  const f = filename.replace(/\\/g, '/');
  return (
    f.endsWith('.controller.ts') ||
    f.endsWith('.controller.js') ||
    f.includes('/controllers/')
  );
}

export const nestNoOrmInController = createRule({
  name: 'nest-no-orm-in-controller',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow direct ORM imports (Prisma, TypeORM, Mongoose, MikroORM) in NestJS controller files. ' +
        'Controllers must delegate persistence to injected services; importing the ORM directly ' +
        'couples HTTP routing to data access and breaks the service layer abstraction.',
    },
    messages: {
      orm:
        'Controllers must not import ORM clients directly. ' +
        'Inject a service that encapsulates the data access logic instead.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    if (!isControllerFile(context.filename)) return {};

    return {
      ImportDeclaration(node) {
        const source = node.source.value as string;
        if (isOrmImport(source)) {
          context.report({ node, messageId: 'orm' });
        }
      },
    };
  },
});
