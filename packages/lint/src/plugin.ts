import { noDirectProcessEnv } from './rules/no-direct-process-env.js';
import { schemaNoInlineZod } from './rules/schema-no-inline-zod.js';
import { prismaJsonCast } from './rules/prisma-json-cast.js';
import { serviceHasSpec } from './rules/service-has-spec.js';
import { controllerNoServiceCycle } from './rules/controller-no-service-cycle.js';

export const plugin = {
  meta: {
    name: '@nekostack/lint',
    version: '0.2.0',
  },
  rules: {
    'no-direct-process-env': noDirectProcessEnv,
    'schema-no-inline-zod': schemaNoInlineZod,
    'prisma-json-cast': prismaJsonCast,
    'service-has-spec': serviceHasSpec,
    'controller-no-service-cycle': controllerNoServiceCycle,
  },
} as const;
