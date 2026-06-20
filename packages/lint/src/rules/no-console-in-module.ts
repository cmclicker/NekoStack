import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

const createRule = RuleCreator(
  (name) =>
    `https://github.com/cmclicker/NekoStack/tree/main/packages/lint/docs/rules/${name}.md`,
);

// console.error and console.warn are permitted — they signal real runtime problems.
const BANNED_METHODS = new Set(['log', 'debug', 'info', 'dir', 'table']);

function isTestFile(filename: string): boolean {
  const f = filename.replace(/\\/g, '/');
  return f.includes('.spec.') || f.includes('.test.') || f.includes('__tests__/');
}

export const noConsoleInModule = createRule({
  name: 'no-console-in-module',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow `console.log`, `console.debug`, and related output calls in non-test source files. ' +
        '`console.error` and `console.warn` are permitted as they signal real problems. ' +
        'Test files are exempt. Use a structured logger (e.g., @nekostack/log) in production code.',
    },
    messages: {
      bannedConsole:
        '`console.{{method}}` is not allowed in module code. ' +
        'Use a structured logger or remove the debug output. ' +
        '`console.error` and `console.warn` are permitted for real error signals.',
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
          object.type !== AST_NODE_TYPES.Identifier ||
          object.name !== 'console' ||
          property.type !== AST_NODE_TYPES.Identifier
        )
          return;
        if (BANNED_METHODS.has(property.name)) {
          context.report({
            node,
            messageId: 'bannedConsole',
            data: { method: property.name },
          });
        }
      },
    };
  },
});
