import { plugin } from '../plugin.js';

// NekoStack rules for React 19 projects.
// For complete React linting, also install eslint-plugin-react, eslint-plugin-react-hooks,
// and eslint-plugin-jsx-a11y — then spread their recommended configs alongside this one.
export const react = [
  {
    plugins: { '@nekostack': plugin },
    rules: {
      '@nekostack/no-direct-process-env': 'error',
      '@nekostack/schema-no-inline-zod': 'error',
      '@nekostack/prisma-json-cast': 'error',
      '@nekostack/react-no-inline-style': 'warn',
    } as const,
  },
];
