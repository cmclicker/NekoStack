import { plugin } from '../plugin.js';

// NekoStack rules for NestJS 10+ projects.
// Enable decoratorMetadata in your tsconfig (experimentalDecorators + emitDecoratorMetadata)
// and configure @typescript-eslint accordingly.
export const nest = [
  {
    plugins: { '@nekostack': plugin },
    rules: {
      '@nekostack/no-direct-process-env': 'error',
      '@nekostack/schema-no-inline-zod': 'error',
      '@nekostack/prisma-json-cast': 'error',
      '@nekostack/service-has-spec': 'warn',
      '@nekostack/controller-no-service-cycle': 'error',
      '@nekostack/nest-no-orm-in-controller': 'error',
    } as const,
  },
];
