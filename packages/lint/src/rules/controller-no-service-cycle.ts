import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

const createRule = RuleCreator(
  (name) =>
    `https://github.com/cmclicker/NekoStack/tree/main/packages/lint/docs/rules/${name}.md`,
);

function isControllerFile(filename: string): boolean {
  const f = filename.replace(/\\/g, '/');
  return f.endsWith('.controller.ts') || f.endsWith('.controller.js') || f.includes('/controllers/');
}

function importsController(source: string): boolean {
  const s = source.replace(/\\/g, '/');
  return (
    s.endsWith('.controller') ||
    s.endsWith('.controller.ts') ||
    s.endsWith('.controller.js') ||
    s.includes('/controllers/')
  );
}

export const controllerNoServiceCycle = createRule({
  name: 'controller-no-service-cycle',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow controller files from importing other controller files. ' +
        'Controller-to-controller imports are the primary source of dependency cycles ' +
        'in the controller layer. Controllers may only import from services, utilities, and shared types.',
    },
    messages: {
      cycle:
        'Controllers must not import from other controllers. ' +
        'Extract shared logic to a service or utility instead.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    if (!isControllerFile(context.filename)) return {};

    return {
      ImportDeclaration(node) {
        const source = node.source.value as string;
        if (importsController(source)) {
          context.report({ node, messageId: 'cycle' });
        }
      },
    };
  },
});
