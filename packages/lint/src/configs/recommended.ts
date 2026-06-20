import { plugin } from '../plugin.js';

// Sensible defaults for any TypeScript project.
// More opinionated than `base`, less framework-specific than `strict`, `react`, or `nest`.
// Spread this into your eslint.config.ts after any parser config, then layer a
// framework config (`./react`, `./nest`) on top if applicable.
export const recommended = [
  {
    plugins: { '@nekostack': plugin },
    rules: {
      // Security — universal baselines
      '@nekostack/no-direct-process-env': 'error',
      '@nekostack/no-hardcoded-secrets': 'error',
      // Import hygiene
      '@nekostack/consistent-type-imports': 'warn',
      // Runtime discipline
      '@nekostack/no-console-in-module': 'warn',
      // Schema conventions
      '@nekostack/schema-no-inline-zod': 'warn',
      '@nekostack/schema-export-type': 'warn',
      // Spec coverage
      '@nekostack/service-has-spec': 'warn',
      // Architecture
      '@nekostack/controller-no-service-cycle': 'error',
      // Type safety (v0.6)
      '@nekostack/no-type-assertion-to-any': 'error',
      '@nekostack/no-non-null-assertion': 'warn',
    } as const,
  },
];
