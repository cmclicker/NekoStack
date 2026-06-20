import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

const createRule = RuleCreator(
  (name) =>
    `https://github.com/cmclicker/NekoStack/tree/main/packages/lint/docs/rules/${name}.md`,
);

const HTTP_DECORATORS = new Set([
  'Get', 'Post', 'Put', 'Delete', 'Patch', 'Head', 'Options', 'All',
]);

function isControllerFile(filename: string): boolean {
  return filename.replace(/\\/g, '/').includes('.controller.');
}

function getHttpDecoratorName(node: TSESTree.MethodDefinition): string | null {
  for (const dec of node.decorators ?? []) {
    const expr = dec.expression;
    // @Get() — call expression
    if (
      expr.type === AST_NODE_TYPES.CallExpression &&
      expr.callee.type === AST_NODE_TYPES.Identifier &&
      HTTP_DECORATORS.has(expr.callee.name)
    ) {
      return expr.callee.name;
    }
    // @Get — bare identifier (rare but valid)
    if (expr.type === AST_NODE_TYPES.Identifier && HTTP_DECORATORS.has(expr.name)) {
      return expr.name;
    }
  }
  return null;
}

export const nestControllerResponseType = createRule({
  name: 'nest-controller-response-type',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require explicit return type annotations on NestJS controller route handler methods. ' +
        'Without return types the API surface is undocumented in the source and TypeScript cannot ' +
        'catch response shape mismatches at compile time. Use a DTO or `Promise<DtoType>`.',
    },
    messages: {
      missingReturnType:
        'NestJS @{{decorator}}() handler "{{method}}" is missing an explicit return type. ' +
        'Add a return type annotation (e.g. `Promise<UserDto>`) so the API surface is documented ' +
        'and TypeScript can verify the response shape.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    if (!isControllerFile(context.filename)) return {};

    return {
      MethodDefinition(node) {
        const decorator = getHttpDecoratorName(node);
        if (!decorator) return;

        const fn = node.value as TSESTree.FunctionExpression;
        if (fn.returnType) return;

        const methodName =
          node.key.type === AST_NODE_TYPES.Identifier ? node.key.name : '(computed)';

        context.report({
          node,
          messageId: 'missingReturnType',
          data: { decorator, method: methodName },
        });
      },
    };
  },
});
