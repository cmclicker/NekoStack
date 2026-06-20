import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

const createRule = RuleCreator(
  (name) =>
    `https://github.com/cmclicker/NekoStack/tree/main/packages/lint/docs/rules/${name}.md`,
);

// Matches `useX` where X is an uppercase letter — React hook naming convention.
const HOOK_CALL_RE = /^use[A-Z]/;

function isTestFile(filename: string): boolean {
  const f = filename.replace(/\\/g, '/');
  return f.includes('.test.') || f.includes('.spec.') || f.includes('/__tests__/');
}

function getFunctionName(
  node:
    | TSESTree.FunctionDeclaration
    | TSESTree.FunctionExpression
    | TSESTree.ArrowFunctionExpression,
): string | null {
  if (node.type === AST_NODE_TYPES.FunctionDeclaration) {
    return node.id?.name ?? null;
  }
  const parent = node.parent;
  if (
    parent?.type === AST_NODE_TYPES.VariableDeclarator &&
    parent.id.type === AST_NODE_TYPES.Identifier
  ) {
    return parent.id.name;
  }
  return null;
}

type Frame = { name: string | null; callsHook: boolean };

export const reactHookNaming = createRule({
  name: 'react-hook-naming',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Functions that call React hooks must be named with the `use` prefix or be PascalCase React components. ' +
        'Calling a hook inside a plain helper named `getData` hides the hook dependency and violates ' +
        'React\'s rules of hooks — only hooks and components may call hooks.',
    },
    messages: {
      requireUsePrefix:
        '"{{name}}" calls React hooks but is not named with the `use` prefix or as a PascalCase component. ' +
        'Rename it to `use{{UpperName}}` or extract the hook calls into a dedicated custom hook.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    if (isTestFile(context.filename)) return {};

    const stack: Frame[] = [];

    function enter(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression,
    ) {
      stack.push({ name: getFunctionName(node), callsHook: false });
    }

    function exit(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression,
    ) {
      const frame = stack.pop();
      if (!frame || !frame.callsHook || !frame.name) return;
      // Allow: starts with `use` (custom hook) or PascalCase (React component)
      if (frame.name.startsWith('use') || /^[A-Z]/.test(frame.name)) return;
      const upperName = frame.name.charAt(0).toUpperCase() + frame.name.slice(1);
      context.report({
        node,
        messageId: 'requireUsePrefix',
        data: { name: frame.name, UpperName: upperName },
      });
    }

    return {
      FunctionDeclaration: enter,
      FunctionExpression: enter,
      ArrowFunctionExpression: enter,
      'FunctionDeclaration:exit': exit,
      'FunctionExpression:exit': exit,
      'ArrowFunctionExpression:exit': exit,

      CallExpression(node) {
        if (stack.length === 0) return;
        const frame = stack[stack.length - 1];
        const callee = node.callee;
        let name: string | null = null;
        if (callee.type === AST_NODE_TYPES.Identifier) {
          name = callee.name;
        } else if (
          callee.type === AST_NODE_TYPES.MemberExpression &&
          callee.property.type === AST_NODE_TYPES.Identifier
        ) {
          name = callee.property.name;
        }
        if (name && HOOK_CALL_RE.test(name)) {
          frame.callsHook = true;
        }
      },
    };
  },
});
