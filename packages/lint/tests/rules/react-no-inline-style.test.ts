import { afterAll, describe, it } from 'vitest';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { reactNoInlineStyle } from '../../src/rules/react-no-inline-style.js';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe as typeof RuleTester.describe;
RuleTester.it = it as typeof RuleTester.it;

const tester = new RuleTester({
  languageOptions: {
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});

tester.run('react-no-inline-style', reactNoInlineStyle, {
  valid: [
    // No style prop — className only
    { code: `<div className="neko-card">text</div>` },
    // className from CSS Modules
    { code: `<Component className={styles.wrapper} />` },
    // Data attributes, no style
    { code: `<div data-theme="dark">text</div>` },
    // Non-JSX TypeScript — object literal in plain code is not flagged
    { code: `const s = { color: 'red' };` },
    // Self-closing with no style prop
    { code: `<br />` },
  ],
  invalid: [
    // Inline object literal
    {
      code: `<div style={{ color: 'red', fontSize: 14 }}>text</div>`,
      errors: [{ messageId: 'inlineStyle' }],
    },
    // Variable reference
    {
      code: `<div style={myStyles}>text</div>`,
      errors: [{ messageId: 'inlineStyle' }],
    },
    // Conditional expression
    {
      code: `<div style={active ? activeStyles : baseStyles}>text</div>`,
      errors: [{ messageId: 'inlineStyle' }],
    },
    // Function call
    {
      code: `<div style={getStyles('dark')}>text</div>`,
      errors: [{ messageId: 'inlineStyle' }],
    },
    // Self-closing component with inline style
    {
      code: `<Component style={{ margin: '0 auto' }} />`,
      errors: [{ messageId: 'inlineStyle' }],
    },
  ],
});
