import { plugin } from '../plugin.js';

// NekoStack rules for NestJS 10+ projects.
// Enable decoratorMetadata in your tsconfig (experimentalDecorators + emitDecoratorMetadata)
// and configure @typescript-eslint accordingly.
export const nest = [
  {
    plugins: { '@nekostack': plugin },
    rules: {
      '@nekostack/no-direct-process-env': 'error',
      '@nekostack/no-hardcoded-secrets': 'error',
      '@nekostack/no-raw-sql': 'error',
      '@nekostack/schema-no-inline-zod': 'error',
      '@nekostack/prisma-json-cast': 'error',
      '@nekostack/schema-export-type': 'warn',
      '@nekostack/service-has-spec': 'warn',
      '@nekostack/controller-no-service-cycle': 'error',
      '@nekostack/nest-no-orm-in-controller': 'error',
      '@nekostack/nest-event-handler-has-spec': 'warn',
      '@nekostack/no-direct-date-now': 'warn',
    } as const,
  },
];
