import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

const createRule = RuleCreator(
  (name) =>
    `https://github.com/cmclicker/NekoStack/tree/main/packages/lint/docs/rules/${name}.md`,
);

// Variable / property names that suggest a secret value is expected.
const SECRET_NAME_RE =
  /\b(password|passwd|secret|api[_-]?key|apikey|token|private[_-]?key|privatekey|auth[_-]?token|access[_-]?token|client[_-]?secret|app[_-]?secret)\b/i;

// Well-known credential prefixes that are always secrets regardless of variable name.
const SECRET_VALUE_PREFIXES = [
  'sk_live_',
  'pk_live_',
  'sk_test_',
  'pk_test_',
  'ghp_',
  'gho_',
  'ghu_',
  'ghs_',
  'github_pat_',
  'xoxb-',
  'xoxp-',
  'xoxa-',
  'AKIA',
  'ASIA',
  'AROA',
  'AIza',
  '-----BEGIN',
];

function isTestFile(filename: string): boolean {
  const f = filename.replace(/\\/g, '/');
  return (
    f.includes('.test.') ||
    f.includes('.spec.') ||
    f.includes('/tests/') ||
    f.includes('/__tests__/')
  );
}

function looksLikeSecretValue(value: string): boolean {
  return SECRET_VALUE_PREFIXES.some((prefix) => value.startsWith(prefix));
}

export const noHardcodedSecrets = createRule({
  name: 'no-hardcoded-secrets',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow hardcoded secret values (passwords, API keys, tokens, private keys). ' +
        'Hardcoded secrets leak into version control and compromise all environments they are ' +
        'committed to. Use @nekostack/config or environment variables instead.',
    },
    messages: {
      secretName:
        '"{{name}}" looks like a secret but is assigned a hardcoded string literal. ' +
        'Load it from @nekostack/config or an environment variable instead.',
      secretValue:
        'This string literal looks like an API key, token, or private key. ' +
        'Do not hardcode secrets in source — load them from @nekostack/config.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    if (isTestFile(context.filename)) return {};

    return {
      Literal(node) {
        if (typeof node.value !== 'string' || node.value.length === 0) return;

        const value = node.value;
        const parent = node.parent;

        // Check parent context for a secret-named binding.
        if (
          parent.type === AST_NODE_TYPES.VariableDeclarator &&
          parent.init === node &&
          parent.id.type === AST_NODE_TYPES.Identifier &&
          SECRET_NAME_RE.test(parent.id.name)
        ) {
          context.report({
            node,
            messageId: 'secretName',
            data: { name: parent.id.name },
          });
          return;
        }

        if (
          parent.type === AST_NODE_TYPES.Property &&
          parent.value === node &&
          (parent.key.type === AST_NODE_TYPES.Identifier ||
            parent.key.type === AST_NODE_TYPES.Literal)
        ) {
          const keyName =
            parent.key.type === AST_NODE_TYPES.Identifier
              ? parent.key.name
              : String(parent.key.value);
          if (SECRET_NAME_RE.test(keyName)) {
            context.report({
              node,
              messageId: 'secretName',
              data: { name: keyName },
            });
            return;
          }
        }

        // Check value pattern regardless of variable name.
        if (looksLikeSecretValue(value)) {
          context.report({ node, messageId: 'secretValue' });
        }
      },
    };
  },
});
