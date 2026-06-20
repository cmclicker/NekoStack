import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

const createRule = RuleCreator(
  (name) =>
    `https://github.com/cmclicker/NekoStack/tree/main/packages/lint/docs/rules/${name}.md`,
);

export const noDirectProcessEnv = createRule({
  name: 'no-direct-process-env',
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow direct process.env access outside @nekostack/config.',
    },
    messages: {
      direct:
        'Direct process.env access is not allowed. Import environment values from @nekostack/config instead.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    if (context.filename.includes('/packages/config/')) return {};

    return {
      MemberExpression(node) {
        const isProcessEnv =
          node.object.type === AST_NODE_TYPES.Identifier &&
          node.object.name === 'process' &&
          ((node.property.type === AST_NODE_TYPES.Identifier && node.property.name === 'env') ||
            (node.property.type === AST_NODE_TYPES.Literal && node.property.value === 'env'));

        if (isProcessEnv) {
          context.report({ node, messageId: 'direct' });
        }
      },
    };
  },
});
