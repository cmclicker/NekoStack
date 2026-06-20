import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

const createRule = RuleCreator(
  (name) =>
    `https://github.com/cmclicker/NekoStack/tree/main/packages/lint/docs/rules/${name}.md`,
);

export const noTypeAssertionToAny = createRule({
  name: 'no-type-assertion-to-any',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow type assertions to `any` (`x as any` or `<any>x`). ' +
        'Asserting to `any` silences TypeScript entirely and defeats the purpose of type-checking. ' +
        'Use `unknown` with a type guard, or assert to the specific type you need.',
    },
    messages: {
      noAsAny:
        'Type assertion to `any` bypasses TypeScript type checking. ' +
        'Use `unknown` with a type guard or assert to the specific target type instead.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      TSAsExpression(node) {
        if (node.typeAnnotation.type === AST_NODE_TYPES.TSAnyKeyword) {
          context.report({ node, messageId: 'noAsAny' });
        }
      },
      TSTypeAssertion(node) {
        if (node.typeAnnotation.type === AST_NODE_TYPES.TSAnyKeyword) {
          context.report({ node, messageId: 'noAsAny' });
        }
      },
    };
  },
});
