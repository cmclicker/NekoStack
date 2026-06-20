import { noDirectProcessEnv } from './rules/no-direct-process-env.js';
import { schemaNoInlineZod } from './rules/schema-no-inline-zod.js';
import { prismaJsonCast } from './rules/prisma-json-cast.js';
import { serviceHasSpec } from './rules/service-has-spec.js';
import { controllerNoServiceCycle } from './rules/controller-no-service-cycle.js';
import { reactNoInlineStyle } from './rules/react-no-inline-style.js';
import { nestNoOrmInController } from './rules/nest-no-orm-in-controller.js';

export const plugin = {
  meta: {
    name: '@nekostack/lint',
    version: '0.3.0',
  },
  rules: {
    'no-direct-process-env': noDirectProcessEnv,
    'schema-no-inline-zod': schemaNoInlineZod,
    'prisma-json-cast': prismaJsonCast,
    'service-has-spec': serviceHasSpec,
    'controller-no-service-cycle': controllerNoServiceCycle,
    'react-no-inline-style': reactNoInlineStyle,
    'nest-no-orm-in-controller': nestNoOrmInController,
  },
} as const;
