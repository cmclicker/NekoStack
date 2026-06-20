import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

const createRule = RuleCreator(
  (name) =>
    `https://github.com/cmclicker/NekoStack/tree/main/packages/lint/docs/rules/${name}.md`,
);

export const noNonNullAssertion = createRule({
  name: 'no-non-null-assertion',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow the non-null assertion operator (`!`). ' +
        'The postfix `!` silently removes `null` and `undefined` from a type without any runtime check. ' +
        'Use optional chaining (`?.`), nullish coalescing (`??`), or an explicit null guard instead.',
    },
    messages: {
      noNonNull:
        'Non-null assertion (`!`) bypasses TypeScript null checking without a runtime guarantee. ' +
        'Use optional chaining (`?.`), nullish coalescing (`??`), or an explicit null check instead.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      TSNonNullExpression(node) {
        context.report({ node, messageId: 'noNonNull' });
      },
    };
  },
});
