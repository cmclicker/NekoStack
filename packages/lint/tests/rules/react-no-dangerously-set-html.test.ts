import { afterAll, describe, it } from 'vitest';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { reactNoDangerouslySetHtml } from '../../src/rules/react-no-dangerously-set-html.js';

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

tester.run('react-no-dangerously-set-html', reactNoDangerouslySetHtml, {
  valid: [
    // Safe: render as React children
    { code: `<div>{text}</div>` },
    // className-only element
    { code: `<div className="neko-card">content</div>` },
    // DOM assignment outside JSX — not a JSX attribute, not flagged
    { code: `element.innerHTML = sanitised;` },
    // Other data attributes
    { code: `<div data-html={raw} aria-label="content" />` },
  ],
  invalid: [
    // Inline object — most common usage
    {
      code: `<div dangerouslySetInnerHTML={{ __html: content }}></div>`,
      errors: [{ messageId: 'dangerousHtml' }],
    },
    // Self-closing with literal HTML string
    {
      code: `<div dangerouslySetInnerHTML={{ __html: '<b>text</b>' }} />`,
      errors: [{ messageId: 'dangerousHtml' }],
    },
    // Variable reference — same risk
    {
      code: `<div dangerouslySetInnerHTML={htmlContent} />`,
      errors: [{ messageId: 'dangerousHtml' }],
    },
  ],
});
