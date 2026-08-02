// @ts-check
import baseConfig from '@nebula/eslint-config';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default [
  ...baseConfig,
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
      },
    },
  },
  {
    files: ['src/**/*.test.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    ignores: ['eslint.config.mjs', 'coverage/**/*', 'dist/**/*', 'scripts/**/*.mjs'],
  },
];
