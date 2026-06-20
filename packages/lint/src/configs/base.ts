import { plugin } from '../plugin.js';

// Flat-config array. Spread this into your eslint.config.ts.
// v0.2 will extend @typescript-eslint/recommended here — for now import it
// separately from the `typescript-eslint` package if you need it.
export const base = [
  {
    plugins: { '@nekostack': plugin },
    rules: {
      '@nekostack/no-direct-process-env': 'error',
    },
  },
] as const;
