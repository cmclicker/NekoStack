import { afterAll, describe, expect, it } from 'vitest';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { createRuleTester, createJsxRuleTester } from '../src/rule-tester.js';

describe('createRuleTester', () => {
  it('returns a RuleTester instance', () => {
    const tester = createRuleTester();
    expect(tester).toBeInstanceOf(RuleTester);
  });

  it('wires vitest lifecycle hooks onto RuleTester statics', () => {
    createRuleTester();
    expect(RuleTester.afterAll).toBe(afterAll);
    expect(RuleTester.describe).toBe(describe);
    expect(RuleTester.it).toBe(it);
  });

  it('accepts and forwards a config object', () => {
    expect(() =>
      createRuleTester({
        languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
      }),
    ).not.toThrow();
  });
});

describe('createJsxRuleTester', () => {
  it('returns a RuleTester instance', () => {
    const tester = createJsxRuleTester();
    expect(tester).toBeInstanceOf(RuleTester);
  });

  it('also wires vitest lifecycle hooks', () => {
    createJsxRuleTester();
    expect(RuleTester.afterAll).toBe(afterAll);
    expect(RuleTester.describe).toBe(describe);
    expect(RuleTester.it).toBe(it);
  });
});
