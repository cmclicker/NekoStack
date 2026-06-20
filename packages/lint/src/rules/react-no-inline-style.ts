import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

const createRule = RuleCreator(
  (name) =>
    `https://github.com/cmclicker/NekoStack/tree/main/packages/lint/docs/rules/${name}.md`,
);

export const reactNoInlineStyle = createRule({
  name: 'react-no-inline-style',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow inline style props on JSX elements. ' +
        'NekoStack components expose design tokens through @nekostack/theme and @nekostack/ui; ' +
        'inline styles bypass the token system and produce inconsistent spacing and color.',
    },
    messages: {
      inlineStyle:
        'Avoid the style prop. Use a className with CSS custom properties from @nekostack/theme or a utility class from @nekostack/ui instead.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      JSXAttribute(node) {
        if (
          node.name.type === AST_NODE_TYPES.JSXIdentifier &&
          node.name.name === 'style' &&
          node.value?.type === AST_NODE_TYPES.JSXExpressionContainer
        ) {
          context.report({ node, messageId: 'inlineStyle' });
        }
      },
    };
  },
});
