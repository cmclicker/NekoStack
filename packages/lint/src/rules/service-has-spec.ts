import { existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';

const createRule = RuleCreator(
  (name) =>
    `https://github.com/cmclicker/NekoStack/tree/main/packages/lint/docs/rules/${name}.md`,
);

// Replaceable in tests to avoid real filesystem checks
let _existsSync: (path: string) => boolean = existsSync;
export function _setExistsSync(fn: (path: string) => boolean): void {
  _existsSync = fn;
}

export const serviceHasSpec = createRule({
  name: 'service-has-spec',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require every *.service.ts file to have a co-located spec or test file. ' +
        'Untested services are a governance gap — the test must exist alongside the implementation.',
    },
    messages: {
      missingSpec:
        'Service file is missing a co-located test. ' +
        'Create a sibling *.service.spec.ts or *.service.test.ts file.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const filename = context.filename;
    if (!filename.replace(/\\/g, '/').endsWith('.service.ts')) return {};

    return {
      Program(node) {
        const dir = dirname(filename);
        const stem = basename(filename, '.service.ts');
        const hasSpec =
          _existsSync(join(dir, `${stem}.service.spec.ts`)) ||
          _existsSync(join(dir, `${stem}.service.test.ts`)) ||
          _existsSync(join(dir, `${stem}.spec.ts`)) ||
          _existsSync(join(dir, `${stem}.test.ts`));

        if (!hasSpec) {
          context.report({ node, messageId: 'missingSpec' });
        }
      },
    };
  },
});
