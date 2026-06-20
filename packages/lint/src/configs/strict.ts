import { plugin } from '../plugin.js';

// Flat-config array. Enables all NekoStack convention rules.
// Spread this into your eslint.config.ts after any parser config.
export const strict = [
  {
    plugins: { '@nekostack': plugin },
    rules: {
      '@nekostack/no-direct-process-env': 'error',
      '@nekostack/no-hardcoded-secrets': 'error',
      '@nekostack/no-raw-sql': 'error',
      '@nekostack/schema-no-inline-zod': 'error',
      '@nekostack/schema-export-type': 'warn',
      '@nekostack/prisma-json-cast': 'error',
      '@nekostack/service-has-spec': 'warn',
      '@nekostack/controller-no-service-cycle': 'error',
      '@nekostack/react-no-inline-style': 'warn',
      '@nekostack/react-no-dangerously-set-html': 'error',
      '@nekostack/nest-no-orm-in-controller': 'error',
      '@nekostack/consistent-type-imports': 'error',
      '@nekostack/no-console-in-module': 'error',
      '@nekostack/no-direct-date-now': 'warn',
      '@nekostack/no-type-assertion-to-any': 'error',
      '@nekostack/no-non-null-assertion': 'error',
      '@nekostack/react-hook-naming': 'warn',
      '@nekostack/nest-controller-response-type': 'warn',
    } as const,
  },
];
