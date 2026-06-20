import { plugin } from '../plugin.js';

// NekoStack rules for React 19 projects.
// For complete React linting, also install eslint-plugin-react, eslint-plugin-react-hooks,
// and eslint-plugin-jsx-a11y — then spread their recommended configs alongside this one.
export const react = [
  {
    plugins: { '@nekostack': plugin },
    rules: {
      '@nekostack/no-direct-process-env': 'error',
      '@nekostack/no-hardcoded-secrets': 'error',
      '@nekostack/schema-no-inline-zod': 'error',
      '@nekostack/prisma-json-cast': 'error',
      '@nekostack/schema-export-type': 'warn',
      '@nekostack/react-no-inline-style': 'warn',
      '@nekostack/react-no-dangerously-set-html': 'error',
      '@nekostack/no-type-assertion-to-any': 'error',
      '@nekostack/no-non-null-assertion': 'warn',
      '@nekostack/react-hook-naming': 'warn',
    } as const,
  },
];
