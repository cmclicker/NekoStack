import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

const createRule = RuleCreator(
  (name) =>
    `https://github.com/cmclicker/NekoStack/tree/main/packages/lint/docs/rules/${name}.md`,
);

function isTestFile(filename: string): boolean {
  const f = filename.replace(/\\/g, '/');
  return f.includes('.spec.') || f.includes('.test.') || f.includes('__tests__/');
}

export const noDirectDateNow = createRule({
  name: 'no-direct-date-now',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow `Date.now()` and `new Date()` in non-test source files. ' +
        'Direct date construction makes code non-deterministic and untestable. ' +
        'Inject a clock dependency (e.g., a `ClockService`) so call sites can be controlled in tests.',
    },
    messages: {
      noDateNow:
        '`Date.now()` is not allowed in module code. ' +
        'Inject a clock service so timestamps can be controlled in tests.',
      noNewDate:
        '`new Date()` with no arguments is not allowed in module code. ' +
        'Inject a clock service so the current time can be controlled in tests. ' +
        '`new Date(value)` for parsing a specific timestamp is permitted.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    if (isTestFile(context.filename)) return {};
    return {
      CallExpression(node) {
        if (node.callee.type !== AST_NODE_TYPES.MemberExpression) return;
        const { object, property } = node.callee;
        if (
          object.type === AST_NODE_TYPES.Identifier &&
          object.name === 'Date' &&
          property.type === AST_NODE_TYPES.Identifier &&
          property.name === 'now'
        ) {
          context.report({ node, messageId: 'noDateNow' });
        }
      },

      NewExpression(node) {
        if (
          node.callee.type === AST_NODE_TYPES.Identifier &&
          node.callee.name === 'Date' &&
          node.arguments.length === 0
        ) {
          context.report({ node, messageId: 'noNewDate' });
        }
      },
    };
  },
});
