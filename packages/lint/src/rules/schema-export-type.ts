import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

const createRule = RuleCreator(
  (name) =>
    `https://github.com/cmclicker/NekoStack/tree/main/packages/lint/docs/rules/${name}.md`,
);

function isSchemaFile(filename: string): boolean {
  const f = filename.replace(/\\/g, '/');
  return f.endsWith('.schema.ts') || f.endsWith('.schema.js');
}

function toTypeName(schemaName: string): string {
  return schemaName.charAt(0).toUpperCase() + schemaName.slice(1);
}

export const schemaExportType = createRule({
  name: 'schema-export-type',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require every exported Zod schema in a .schema.ts file to have a corresponding ' +
        '`export type T = z.infer<typeof schema>` declaration. ' +
        'NekoStack convention: the schema and its inferred TypeScript type are always co-located ' +
        'so consumers have a typed contract without importing Zod directly.',
    },
    fixable: 'code',
    messages: {
      missingTypeExport:
        '"{{schema}}" is exported but has no corresponding ' +
        '`export type {{type}} = z.infer<typeof {{schema}}>`. ' +
        'Add the type export so consumers get a typed contract.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    if (!isSchemaFile(context.filename)) return {};

    const zodBindings = new Set<string>();

    // Map from schema variable name → the ExportNamedDeclaration node (for the fixer).
    const exportedSchemas = new Map<string, TSESTree.ExportNamedDeclaration>();

    // Schema variable names that already have a z.infer<typeof X> type export.
    const inferredNames = new Set<string>();

    return {
      ImportDeclaration(node) {
        if (node.source.value !== 'zod') return;
        for (const spec of node.specifiers) {
          if (spec.type === AST_NODE_TYPES.ImportDefaultSpecifier) {
            zodBindings.add(spec.local.name);
          } else if (spec.type === AST_NODE_TYPES.ImportNamespaceSpecifier) {
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

      ExportNamedDeclaration(node) {
        const decl = node.declaration;
        if (!decl) return;

        // export const X = z.TYPE(…) — collect as a schema requiring a type export.
        if (decl.type === AST_NODE_TYPES.VariableDeclaration) {
          for (const d of decl.declarations) {
            if (
              d.id.type === AST_NODE_TYPES.Identifier &&
              d.init?.type === AST_NODE_TYPES.CallExpression &&
              d.init.callee.type === AST_NODE_TYPES.MemberExpression &&
              d.init.callee.object.type === AST_NODE_TYPES.Identifier &&
              zodBindings.has(d.init.callee.object.name)
            ) {
              exportedSchemas.set(d.id.name, node);
            }
          }
          return;
        }

        // export type T = z.infer<typeof X> — record X as already covered.
        if (decl.type === AST_NODE_TYPES.TSTypeAliasDeclaration) {
          const ann = decl.typeAnnotation;
          if (
            ann.type === AST_NODE_TYPES.TSTypeReference &&
            ann.typeName.type === AST_NODE_TYPES.TSQualifiedName &&
            ann.typeName.left.type === AST_NODE_TYPES.Identifier &&
            zodBindings.has(ann.typeName.left.name) &&
            ann.typeName.right.type === AST_NODE_TYPES.Identifier &&
            ann.typeName.right.name === 'infer' &&
            ann.typeArguments != null &&
            ann.typeArguments.params.length === 1
          ) {
            const [param] = ann.typeArguments.params;
            if (
              param != null &&
              param.type === AST_NODE_TYPES.TSTypeQuery &&
              param.exprName.type === AST_NODE_TYPES.Identifier
            ) {
              inferredNames.add(param.exprName.name);
            }
          }
        }
      },

      'Program:exit'() {
        for (const [schemaName, exportNode] of exportedSchemas) {
          if (inferredNames.has(schemaName)) continue;
          const typeName = toTypeName(schemaName);
          context.report({
            node: exportNode,
            messageId: 'missingTypeExport',
            data: { schema: schemaName, type: typeName },
            fix(fixer) {
              return fixer.insertTextAfter(
                exportNode,
                `\nexport type ${typeName} = z.infer<typeof ${schemaName}>;`,
              );
            },
          });
        }
      },
    };
  },
});
