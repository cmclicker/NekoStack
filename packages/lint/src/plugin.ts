import { noDirectProcessEnv } from './rules/no-direct-process-env.js';
import { schemaNoInlineZod } from './rules/schema-no-inline-zod.js';
import { prismaJsonCast } from './rules/prisma-json-cast.js';
import { serviceHasSpec } from './rules/service-has-spec.js';
import { controllerNoServiceCycle } from './rules/controller-no-service-cycle.js';
import { reactNoInlineStyle } from './rules/react-no-inline-style.js';
import { nestNoOrmInController } from './rules/nest-no-orm-in-controller.js';
import { noHardcodedSecrets } from './rules/no-hardcoded-secrets.js';
import { noRawSql } from './rules/no-raw-sql.js';
import { schemaExportType } from './rules/schema-export-type.js';
import { reactNoDangerouslySetHtml } from './rules/react-no-dangerously-set-html.js';
import { consistentTypeImports } from './rules/consistent-type-imports.js';
import { noConsoleInModule } from './rules/no-console-in-module.js';
import { nestEventHandlerHasSpec } from './rules/nest-event-handler-has-spec.js';
import { noDirectDateNow } from './rules/no-direct-date-now.js';
import { noTypeAssertionToAny } from './rules/no-type-assertion-to-any.js';
import { noNonNullAssertion } from './rules/no-non-null-assertion.js';
import { reactHookNaming } from './rules/react-hook-naming.js';
import { nestControllerResponseType } from './rules/nest-controller-response-type.js';

export const plugin = {
  meta: {
    name: '@nekostack/lint',
    version: '0.6.0',
  },
  rules: {
    'no-direct-process-env': noDirectProcessEnv,
    'schema-no-inline-zod': schemaNoInlineZod,
    'prisma-json-cast': prismaJsonCast,
    'service-has-spec': serviceHasSpec,
    'controller-no-service-cycle': controllerNoServiceCycle,
    'react-no-inline-style': reactNoInlineStyle,
    'nest-no-orm-in-controller': nestNoOrmInController,
    'no-hardcoded-secrets': noHardcodedSecrets,
    'no-raw-sql': noRawSql,
    'schema-export-type': schemaExportType,
    'react-no-dangerously-set-html': reactNoDangerouslySetHtml,
    'consistent-type-imports': consistentTypeImports,
    'no-console-in-module': noConsoleInModule,
    'nest-event-handler-has-spec': nestEventHandlerHasSpec,
    'no-direct-date-now': noDirectDateNow,
    'no-type-assertion-to-any': noTypeAssertionToAny,
    'no-non-null-assertion': noNonNullAssertion,
    'react-hook-naming': reactHookNaming,
    'nest-controller-response-type': nestControllerResponseType,
  },
} as const;
