import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

const createRule = RuleCreator(
  (name) =>
    `https://github.com/cmclicker/NekoStack/tree/main/packages/lint/docs/rules/${name}.md`,
);

// $queryRaw / $executeRaw are safe ONLY as tagged template literals (Prisma handles
// parameterisation at the tag level). Regular call form accepts raw strings → SQL injection.
// $queryRawUnsafe / $executeRawUnsafe bypass all escaping and are never safe.
const UNSAFE_CALL_METHODS = new Set([
  '$queryRaw',
  '$executeRaw',
  '$queryRawUnsafe',
  '$executeRawUnsafe',
]);

const ALWAYS_UNSAFE_METHODS = new Set([
  '$queryRawUnsafe',
  '$executeRawUnsafe',
]);

export const noRawSql = createRule({
  name: 'no-raw-sql',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow unsafe Prisma raw-query methods that are vulnerable to SQL injection. ' +
        '`$queryRaw` and `$executeRaw` are only safe as tagged template literals — the tag ' +
        'handles parameterisation. `$queryRawUnsafe` and `$executeRawUnsafe` are never safe. ' +
        'Use typed Prisma query methods or the tagged-template form instead.',
    },
    messages: {
      rawSql:
        '`{{method}}` is a SQL-injection risk. ' +
        'Use typed Prisma query methods or the tagged-template form ' +
        '(`` prisma.$queryRaw`SELECT … WHERE id = ${id}` ``) instead.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      // Flag regular call expressions: prisma.$queryRaw('SELECT …')
      CallExpression(node) {
        if (
          node.callee.type === AST_NODE_TYPES.MemberExpression &&
          !node.callee.computed &&
          node.callee.property.type === AST_NODE_TYPES.Identifier &&
          UNSAFE_CALL_METHODS.has(node.callee.property.name)
        ) {
          context.report({
            node,
            messageId: 'rawSql',
            data: { method: node.callee.property.name },
          });
        }
      },

      // Flag tagged template expressions only for the always-unsafe variants:
      // prisma.$queryRawUnsafe`…` / prisma.$executeRawUnsafe`…`
      TaggedTemplateExpression(node) {
        if (
          node.tag.type === AST_NODE_TYPES.MemberExpression &&
          !node.tag.computed &&
          node.tag.property.type === AST_NODE_TYPES.Identifier &&
          ALWAYS_UNSAFE_METHODS.has(node.tag.property.name)
        ) {
          context.report({
            node,
            messageId: 'rawSql',
            data: { method: node.tag.property.name },
          });
        }
      },
    };
  },
});
