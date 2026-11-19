import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

// One config for the whole workspace: `pnpm lint`.
// Type errors are the job of `pnpm typecheck`, so the rules here stay fast and
// syntactic rather than type-aware.
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/generated/**',
      'playwright-report/**',
      'test-results/**',
      '.playwright-mcp/**',
      'docs/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    rules: {
      // Unused arguments are often part of a signature (middleware, handlers):
      // mark them with a leading underscore.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Floating promises matter in payroll jobs, but that rule needs type
      // information. TODO(NEW): turn on the type-aware set once the modules settle.
      'no-console': ['warn', { allow: ['warn', 'error', 'info', 'log'] }],
      eqeqeq: ['error', 'smart'],
    },
  },

  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },

  {
    // Seeds and tests are allowed to talk to the console and to use raw SQL.
    files: ['**/*.spec.ts', '**/seed.ts', '**/test/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
);
