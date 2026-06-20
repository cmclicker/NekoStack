import { existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

const createRule = RuleCreator(
  (name) =>
    `https://github.com/cmclicker/NekoStack/tree/main/packages/lint/docs/rules/${name}.md`,
);

let _existsSync: (path: string) => boolean = existsSync;
export function _setExistsSync(fn: (path: string) => boolean): void {
  _existsSync = fn;
}

const EVENT_DECORATORS = new Set(['EventPattern', 'MessagePattern']);

function getDecoratorName(decorator: TSESTree.Decorator): string | null {
  const expr = decorator.expression;
  if (expr.type === AST_NODE_TYPES.Identifier) return expr.name;
  if (
    expr.type === AST_NODE_TYPES.CallExpression &&
    expr.callee.type === AST_NODE_TYPES.Identifier
  )
    return expr.callee.name;
  return null;
}

export const nestEventHandlerHasSpec = createRule({
  name: 'nest-event-handler-has-spec',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require a co-located spec file for any file containing a method decorated with ' +
        '`@EventPattern` or `@MessagePattern`. Event handlers contain business logic and must be tested. ' +
        'Extends the `service-has-spec` discipline to NestJS microservice event handler methods.',
    },
    messages: {
      missingSpec:
        'Method "{{method}}" is decorated with @{{decorator}} but this file has no co-located spec. ' +
        'Create a sibling *.spec.ts or *.test.ts file.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const filename = context.filename;
    const dir = dirname(filename);
    const stem = basename(filename, '.ts');

    const hasSpec =
      _existsSync(join(dir, `${stem}.spec.ts`)) ||
      _existsSync(join(dir, `${stem}.test.ts`)) ||
      _existsSync(join(dir, `${stem}.spec.js`)) ||
      _existsSync(join(dir, `${stem}.test.js`));

    if (hasSpec) return {};

    return {
      MethodDefinition(node) {
        for (const decorator of node.decorators ?? []) {
          const name = getDecoratorName(decorator);
          if (name && EVENT_DECORATORS.has(name)) {
            const methodName =
              node.key.type === AST_NODE_TYPES.Identifier ? node.key.name : '(computed)';
            context.report({
              node,
              messageId: 'missingSpec',
              data: { method: methodName, decorator: name },
            });
          }
        }
      },
    };
  },
});
