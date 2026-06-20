import { afterAll, describe, it } from 'vitest';
import { RuleTester } from '@typescript-eslint/rule-tester';
import type { RuleTesterConfig } from '@typescript-eslint/rule-tester';

function wireVitest(): void {
  RuleTester.afterAll = afterAll;
  RuleTester.describe = describe as typeof RuleTester.describe;
  RuleTester.it = it as typeof RuleTester.it;
}

export function createRuleTester(config?: RuleTesterConfig): RuleTester {
  wireVitest();
  return new RuleTester(config);
}

export function createJsxRuleTester(): RuleTester {
  return createRuleTester({
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
  });
}
