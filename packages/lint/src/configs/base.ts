import { plugin } from '../plugin.js';

// Minimal flat-config array. Spread this into your eslint.config.ts.
// Contains only universal rules that are always correct — zero false positives.
// For @typescript-eslint/recommended, import it separately from the `typescript-eslint` package.
export const base = [
  {
    plugins: { '@nekostack': plugin },
    rules: {
      '@nekostack/no-direct-process-env': 'error',
      '@nekostack/no-hardcoded-secrets': 'error',
    } as const,
  },
];
