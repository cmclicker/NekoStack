import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

const createRule = RuleCreator(
  (name) =>
    `https://github.com/cmclicker/NekoStack/tree/main/packages/lint/docs/rules/${name}.md`,
);

function isSchemaFile(filename: string): boolean {
  const f = filename.replace(/\\/g, '/');
  return (
    f.endsWith('.schema.ts') ||
    f.endsWith('.schema.js') ||
    f.includes('/schemas/') ||
    f.includes('/packages/schema/')
  );
}

export const schemaNoInlineZod = createRule({
  name: 'schema-no-inline-zod',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow inline Zod schema construction outside designated schema files. ' +
        'Define schemas through @nekostack/schema or in *.schema.ts / schemas/ files.',
    },
    messages: {
      inline:
        'Inline Zod schema construction is not allowed here. ' +
        'Define schemas in a *.schema.ts file or under a schemas/ directory.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    if (isSchemaFile(context.filename)) return {};

    const zodBindings = new Set<string>();

    return {
      ImportDeclaration(node) {
        if (node.source.value !== 'zod') return;

        for (const spec of node.specifiers) {
          if (
            spec.type === AST_NODE_TYPES.ImportDefaultSpecifier ||
            spec.type === AST_NODE_TYPES.ImportNamespaceSpecifier
          ) {
            zodBindings.add(spec.local.name);
          } else if (
            spec.type === AST_NODE_TYPES.ImportSpecifier &&
            spec.imported.type === AST_NODE_TYPES.Identifier &&
            spec.imported.name === 'z'
          ) {
            zodBindings.add(spec.local.name);
          }
        }
      },

      CallExpression(node) {
        if (
          node.callee.type === AST_NODE_TYPES.MemberExpression &&
          node.callee.object.type === AST_NODE_TYPES.Identifier &&
          zodBindings.has(node.callee.object.name)
        ) {
          context.report({ node, messageId: 'inline' });
        }
      },
    };
  },
});
