import tseslint from 'typescript-eslint';
import { recommended } from '@nekostack/lint/recommended';

// Starting with `recommended`. Upgrade path to `strict` is tracked in
// packages/lint/docs/internal/ROADMAP.md — schema has ~30 non-null
// assertions in src/ that need careful cleanup first.
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'tests/**', 'examples/**'] },
  ...recommended,
);
