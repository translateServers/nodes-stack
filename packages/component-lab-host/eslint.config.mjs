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
    files: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'test/**/*.ts', 'test/**/*.tsx'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    ignores: ['eslint.config.mjs', 'coverage/**/*', 'dist/**/*'],
  },
];
