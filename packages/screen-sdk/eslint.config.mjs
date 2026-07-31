// @ts-check
import reactConfig from '@nebula/eslint-config/react';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default [
  ...reactConfig,
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
      },
    },
  },
  {
    // Test files use mock assertions (expect(adapter.method).toHaveBeenCalled)
    // which require accessing methods without calling them — a known false
    // positive for @typescript-eslint/unbound-method.
    files: ['test/**/*.ts', 'test/**/*.tsx', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    ignores: ['eslint.config.mjs', 'dist/**/*', 'coverage/**/*'],
  },
];
