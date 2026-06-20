import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

const createRule = RuleCreator(
  (name) =>
    `https://github.com/cmclicker/NekoStack/tree/main/packages/lint/docs/rules/${name}.md`,
);

function isJsonValueType(typeNode: TSESTree.TypeNode): boolean {
  if (typeNode.type !== AST_NODE_TYPES.TSTypeReference) return false;

  const { typeName } = typeNode;

  // JsonValue (unqualified)
  if (typeName.type === AST_NODE_TYPES.Identifier && typeName.name === 'JsonValue') {
    return true;
  }

  // Prisma.JsonValue (qualified)
  if (
    typeName.type === AST_NODE_TYPES.TSQualifiedName &&
    typeName.left.type === AST_NODE_TYPES.Identifier &&
    typeName.left.name === 'Prisma' &&
    typeName.right.type === AST_NODE_TYPES.Identifier &&
    typeName.right.name === 'JsonValue'
  ) {
    return true;
  }

  return false;
}

export const prismaJsonCast = createRule({
  name: 'prisma-json-cast',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require explicit type assertions when accessing properties of Prisma.JsonValue ' +
        'or JsonValue typed variables. JSON fields are typed as unknown at runtime — ' +
        'always cast before drilling into them.',
    },
    messages: {
      cast:
        'Property access on a JsonValue-typed variable requires an explicit type assertion. ' +
        'Use (value as YourType).property instead of value.property.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const jsonValueVars = new Set<string>();

    return {
      VariableDeclarator(node) {
        if (
          node.id.type === AST_NODE_TYPES.Identifier &&
          node.id.typeAnnotation &&
          isJsonValueType(node.id.typeAnnotation.typeAnnotation)
        ) {
          jsonValueVars.add(node.id.name);
        }
      },

      MemberExpression(node) {
        if (
          node.object.type === AST_NODE_TYPES.Identifier &&
          jsonValueVars.has(node.object.name)
        ) {
          context.report({ node, messageId: 'cast' });
        }
      },
    };
  },
});
