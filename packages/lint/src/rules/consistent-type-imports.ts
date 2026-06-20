import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

const createRule = RuleCreator(
  (name) =>
    `https://github.com/cmclicker/NekoStack/tree/main/packages/lint/docs/rules/${name}.md`,
);

function isTypeOnlyPosition(node: TSESTree.Node): boolean {
  let current: TSESTree.Node = node;
  while (current.parent) {
    const parent = current.parent;
    if (parent.type === 'TSTypeAnnotation' || parent.type === 'TSTypeParameterInstantiation') {
      return true;
    }
    if (parent.type === 'TSTypeAliasDeclaration') {
      return (parent as TSESTree.TSTypeAliasDeclaration).typeAnnotation === current;
    }
    if (parent.type === 'TSTypeQuery') {
      return true; // typeof X in type position
    }
    if (!parent.type.startsWith('TS')) return false;
    current = parent;
  }
  return false;
}

export const consistentTypeImports = createRule({
  name: 'consistent-type-imports',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require `import type` for bindings that are only used in type positions. ' +
        'NekoStack convention: type-only imports must use `import type { T }` (or inline `import { type T }`) ' +
        'so they are erased at compile time and cannot accidentally introduce runtime dependencies.',
    },
    fixable: 'code',
    messages: {
      requireTypeImport:
        '"{{name}}" is only used as a type. Use `import type { {{name}} }` or `import { type {{name}} }` ' +
        'so the import is erased at compile time.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    // name → { specNode, used as value? }
    const importedBindings = new Map<
      string,
      { specNode: TSESTree.ImportSpecifier; valueUsed: boolean; typeUsed: boolean }
    >();

    return {
      ImportDeclaration(node) {
        if (node.importKind === 'type') return;
        for (const spec of node.specifiers) {
          if (spec.type !== AST_NODE_TYPES.ImportSpecifier) continue;
          if ((spec as TSESTree.ImportSpecifier).importKind === 'type') continue;
          importedBindings.set(spec.local.name, {
            specNode: spec,
            valueUsed: false,
            typeUsed: false,
          });
        }
      },

      Identifier(node) {
        const { name } = node;
        const binding = importedBindings.get(name);
        if (!binding) return;
        // Skip the specifier's own local identifier inside the import declaration
        const parent = node.parent;
        if (
          parent?.type === AST_NODE_TYPES.ImportSpecifier ||
          parent?.type === AST_NODE_TYPES.ImportDefaultSpecifier ||
          parent?.type === AST_NODE_TYPES.ImportNamespaceSpecifier
        )
          return;

        if (isTypeOnlyPosition(node)) {
          binding.typeUsed = true;
        } else {
          binding.valueUsed = true;
        }
      },

      'Program:exit'() {
        for (const [name, { specNode, typeUsed, valueUsed }] of importedBindings) {
          if (!typeUsed || valueUsed) continue;
          context.report({
            node: specNode,
            messageId: 'requireTypeImport',
            data: { name },
            fix(fixer) {
              return fixer.insertTextBefore(specNode, 'type ');
            },
          });
        }
      },
    };
  },
});
