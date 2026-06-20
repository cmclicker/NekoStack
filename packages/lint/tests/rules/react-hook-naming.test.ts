import { afterAll, describe, it } from 'vitest';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { reactHookNaming } from '../../src/rules/react-hook-naming.js';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe as typeof RuleTester.describe;
RuleTester.it = it as typeof RuleTester.it;

const tester = new RuleTester();

tester.run('react-hook-naming', reactHookNaming, {
  valid: [
    // Correctly named custom hook
    {
      code: 'function useData() { useState(null); return null; }',
      filename: 'src/hooks/useData.ts',
    },
    // PascalCase component — allowed to call hooks
    {
      code: 'function UserCard() { const [x, setX] = useState(0); return null; }',
      filename: 'src/components/UserCard.tsx',
    },
    // Arrow function custom hook
    {
      code: 'const useItems = () => { useCallback(() => {}, []); };',
      filename: 'src/hooks/useItems.ts',
    },
    // Plain helper with no hook calls — no naming requirement
    {
      code: 'function getData() { return fetch("/api/data"); }',
      filename: 'src/utils/data.ts',
    },
    // Hook call inside anonymous callback — outer helper is fine (hook attributed to anonymous frame)
    {
      code: 'function setup() { Promise.resolve().then(() => { useState(0); }); }',
      filename: 'src/utils/setup.ts',
    },
    // Test files are exempt
    {
      code: 'function render() { useState(null); }',
      filename: 'src/components/Card.test.tsx',
    },
    // useXxx where third char is uppercase — correctly named
    {
      code: 'function useFormState() { useReducer(fn, {}); }',
      filename: 'src/hooks/useFormState.ts',
    },
  ],
  invalid: [
    // Plain function name calls a hook
    {
      code: 'function getData() { useState(null); return null; }',
      filename: 'src/utils/data.ts',
      errors: [{ messageId: 'requireUsePrefix' }],
    },
    // Arrow function assigned to non-use name
    {
      code: 'const fetchItems = () => { useEffect(() => {}, []); };',
      filename: 'src/utils/items.ts',
      errors: [{ messageId: 'requireUsePrefix' }],
    },
    // camelCase name, calls useMemo
    {
      code: 'function processForm() { const x = useMemo(() => 1, []); return x; }',
      filename: 'src/forms/processor.ts',
      errors: [{ messageId: 'requireUsePrefix' }],
    },
    // Third-party hook call (useQuery) — still requires naming convention
    {
      code: 'function loadData() { useQuery({ queryKey: ["x"] }); }',
      filename: 'src/api/loader.ts',
      errors: [{ messageId: 'requireUsePrefix' }],
    },
    // Lowercase start, calls useContext
    {
      code: 'function authHelper() { useContext(AuthCtx); }',
      filename: 'src/auth/helper.ts',
      errors: [{ messageId: 'requireUsePrefix' }],
    },
  ],
});
