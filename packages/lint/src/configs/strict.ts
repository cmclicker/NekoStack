import { plugin } from '../plugin.js';

// Flat-config array. Enables all NekoStack convention rules.
// Spread this into your eslint.config.ts after any parser config.
export const strict = [
  {
    plugins: { '@nekostack': plugin },
    rules: {
      '@nekostack/no-direct-process-env': 'error',
      '@nekostack/schema-no-inline-zod': 'error',
      '@nekostack/prisma-json-cast': 'error',
      '@nekostack/service-has-spec': 'warn',
      '@nekostack/controller-no-service-cycle': 'error',
    } as const,
  },
];
