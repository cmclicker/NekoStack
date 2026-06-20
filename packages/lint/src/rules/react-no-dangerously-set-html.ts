import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

const createRule = RuleCreator(
  (name) =>
    `https://github.com/cmclicker/NekoStack/tree/main/packages/lint/docs/rules/${name}.md`,
);

export const reactNoDangerouslySetHtml = createRule({
  name: 'react-no-dangerously-set-html',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow the `dangerouslySetInnerHTML` prop on JSX elements. ' +
        'Setting raw HTML exposes the application to XSS when the content originates from ' +
        'user input or external sources. Sanitise the content with a library such as DOMPurify ' +
        'and enforce a review gate before any approved use.',
    },
    messages: {
      dangerousHtml:
        '`dangerouslySetInnerHTML` is an XSS risk. ' +
        'Render content as React children instead. ' +
        'If raw HTML is unavoidable, sanitise with DOMPurify and disable this rule ' +
        'with a documented eslint-disable comment explaining the justification.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      JSXAttribute(node) {
        if (
          node.name.type === AST_NODE_TYPES.JSXIdentifier &&
          node.name.name === 'dangerouslySetInnerHTML'
        ) {
          context.report({ node, messageId: 'dangerousHtml' });
        }
      },
    };
  },
});
