import { noDirectProcessEnv } from './rules/no-direct-process-env.js';

export const plugin = {
  meta: {
    name: '@nekostack/lint',
    version: '0.1.0',
  },
  rules: {
    'no-direct-process-env': noDirectProcessEnv,
  },
} as const;
